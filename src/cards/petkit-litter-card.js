import { todayVisits } from './petkit-data.js';

const bindings = {
  state: ['sensor', 'state'], occupancy: ['binary_sensor', 'toilet_occupied'], fault: ['sensor', 'error'],
  litter: ['sensor', 'litter_level'], weight: ['sensor', 'litter_weight'], waste: ['binary_sensor', 'wastebin_filled'],
  scoop: ['button', 'scoop'], dump: ['button', 'dump_litter'], level: ['button', 'level_litter'],
  pause: ['button', 'action_pause'], continue: ['button', 'action_continue'],
  auto_clean: ['switch', 'auto_clean'], child_lock: ['switch', 'child_lock'], do_not_disturb: ['switch', 'do_not_disturb']
};
const actions = [
  ['scoop', 'Clean', 'mdi:broom'], ['dump', 'Empty litter', 'mdi:trash-can-outline'],
  ['level', 'Level litter', 'mdi:format-horizontal-align-center'], ['pause', 'Pause', 'mdi:pause'], ['continue', 'Continue', 'mdi:play']
];
const settings = [['auto_clean', 'Automatic cleaning'], ['child_lock', 'Child lock'], ['do_not_disturb', 'Do not disturb']];
const art = '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10 3h20c5 0 8 4 8 9v20c0 3-2 5-5 5H7c-3 0-5-2-5-5V12c0-5 3-9 8-9Zm3 7a9 9 0 0 0-9 9v5a9 9 0 0 0 18 0v-5a9 9 0 0 0-9-9Zm18 2a2 2 0 1 0 0 .01ZM8 31v2h11v-2Z"/></svg>';
const label = value => String(value || '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

class PetkitLitterCard extends HTMLElement {
  static getConfigElement() { return document.createElement('petkit-litter-card-editor'); }
  static getStubConfig() { return { entity: '', stats_entity: '', name: 'Litter Box' }; }
  setConfig(config) {
    if (typeof config.entity !== 'string' || !/^sensor\.[a-z0-9_]+$/.test(config.entity)) throw new Error('Configure a device status sensor.');
    for (const [key, value] of Object.entries(config)) {
      if (!key.endsWith('_entity') || !value) continue;
      const domain = key === 'stats_entity' ? 'sensor' : bindings[key.slice(0, -7)]?.[0];
      if (!domain || typeof value !== 'string' || !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(value)) throw new Error(`Invalid ${key} binding.`);
    }
    this.config = { ...config }; this.pending = false; this.awaiting = null; this.selected = null; this.feedback = '';
    this.generation = (this.generation || 0) + 1;
    clearTimeout(this.readbackTimer);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render(); this.update();
  }
  connectedCallback() { this.clock = setInterval(() => this.update(), 30000); }
  disconnectedCallback() { clearInterval(this.clock); clearTimeout(this.readbackTimer); }
  set hass(value) { this._hass = value; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  entity(key) {
    if (this.config[`${key}_entity`]) return this.config[`${key}_entity`];
    const base = this.config.entity.match(/^sensor\.(.+)_device_status$/)?.[1];
    return base && bindings[key] ? `${bindings[key][0]}.${base}_${bindings[key][1]}` : undefined;
  }
  state(key) { return this._hass?.states?.[key === 'status' ? this.config.entity : this.entity(key)]?.state; }
  online() { return /^online(?:_|$)/.test(this.state('status') || ''); }
  blocked(key) {
    if (this.pending || this.awaiting) return 'Waiting for the previous request';
    if (!this.online()) return 'Device is offline or unavailable';
    if (!this._hass?.callService) return 'Controls are unavailable';
    const target = this._hass.states[this.entity(key)];
    if (!target || target.state === 'unavailable') return 'This action is unavailable';
    if (key === 'pause') return '';
    if (this.state('occupancy') !== 'off') return 'Occupancy is detected or unknown';
    if (!['no error', 'none', '0'].includes((this.state('fault') || '').toLowerCase())) return 'Fault status is not clear';
    if (['scoop', 'dump', 'level'].includes(key) && this.state('state') !== 'idle') return 'Device is not idle';
    if (!this.state('state') || ['unknown', 'unavailable'].includes(this.state('state'))) return 'Device state is unknown';
    return '';
  }
  stage(key) {
    if (!actions.some(a => a[0] === key) || this.blocked(key)) return;
    this.selected = key; this.update();
  }
  async confirmAction() {
    const key = this.selected;
    if (!key || this.blocked(key)) return;
    this.selected = null;
    await this.request('button', 'press', this.entity(key), true);
  }
  async setting(key, on) {
    if (!settings.some(s => s[0] === key) || typeof on !== 'boolean' || !this.online() || this.pending || this.awaiting
        || !['on', 'off'].includes(this.state(key)) || !this._hass?.callService) return;
    await this.request('switch', on ? 'turn_on' : 'turn_off', this.entity(key), false);
  }
  async request(domain, service, entity, motor) {
    const generation = this.generation, before = this.state('state');
    this.pending = true; this.feedback = ''; this.update(); let timer;
    try {
      await Promise.race([this._hass.callService(domain, service, { entity_id: entity }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out; check the device before retrying.')), this.serviceTimeout ?? 15000); })]);
      if (this.generation !== generation) return;
      this.feedback = 'Request sent';
      if (motor) {
        this.awaiting = { before };
        this.readbackTimer = setTimeout(() => {
          if (this.generation !== generation || !this.awaiting) return;
          this.awaiting = null; this.feedback = 'No device state update yet. Check before retrying.'; this.update();
        }, this.readbackTimeout ?? 30000);
      }
    } catch (err) { if (this.generation === generation) this.feedback = err?.message || 'Request failed'; }
    finally { clearTimeout(timer); if (this.generation === generation) { this.pending = false; this.update(); } }
  }
  history(entityId) {
    if (!this._hass?.states?.[entityId]) return;
    this.shadowRoot.querySelector('dialog').close();
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }
  update() {
    if (!this.config || !this.shadowRoot) return;
    const root = this.shadowRoot, raw = this.state('state');
    if (this.awaiting && raw && !['unknown', 'unavailable'].includes(raw) && raw !== this.awaiting.before) {
      this.awaiting = null; clearTimeout(this.readbackTimer); this.feedback = 'Device state updated';
    }
    const status = this.online() ? label(raw || 'unknown') : label(this.state('status') || 'unavailable');
    root.querySelectorAll('.status').forEach(node => { node.textContent = status; });
    root.querySelectorAll('.device-art').forEach(node => node.classList.toggle('active', this.online()));
    const visits = todayVisits(this._hass?.states?.[this.config.stats_entity], this.now?.() || new Date());
    root.querySelector('.today-total').textContent = String(visits.total ?? '\u2014');
    const litter = this._hass?.states?.[this.entity('litter')];
    const numeric = s => s && s.state !== '' && !['unknown', 'unavailable'].includes(s.state) && Number.isFinite(Number(s.state));
    root.querySelector('.summary').textContent = `${status} \u00b7 ${visits.total ?? '\u2014'} today`;
    root.querySelector('.litter-value').textContent = numeric(litter) ? `${litter.state}${litter.attributes?.unit_of_measurement || '%'}` : '\u2014';
    const weight = this._hass?.states?.[this.entity('weight')];
    root.querySelector('.weight-value').textContent = numeric(weight) ? `${weight.state} ${weight.attributes?.unit_of_measurement || ''}`.trim() : '\u2014';
    root.querySelector('.waste-value').textContent = ({ on: 'Full', off: 'Not full' })[this.state('waste')] || 'Unknown';
    const rows = [...visits.pets, { id: 'unidentified', name: 'Unidentified', count: visits.unidentified }];
    const body = root.querySelector('.pet-rows'); body.replaceChildren();
    for (const pet of rows) {
      const row = document.createElement('tr'), name = document.createElement('th'), value = document.createElement('td');
      name.scope = 'row'; name.textContent = pet.name; value.textContent = String(pet.count ?? '\u2014'); row.append(name, value); body.append(row);
    }
    root.querySelector('.stats-warning').hidden = visits.complete;
    for (const [key, title] of actions) {
      const button = root.querySelector(`[data-action="${key}"]`), reason = this.blocked(key);
      button.disabled = !!reason; button.title = reason || title;
    }
    const confirmation = root.querySelector('.confirmation'); confirmation.hidden = !this.selected;
    root.querySelector('.confirm-label').textContent = this.selected ? `${actions.find(a => a[0] === this.selected)[1]}?` : '';
    root.querySelector('.confirm').disabled = !this.selected || !!this.blocked(this.selected);
    for (const [key] of settings) {
      const input = root.querySelector(`[data-setting="${key}"]`);
      input.checked = this.state(key) === 'on'; input.disabled = !this.online() || this.pending || !!this.awaiting || !['on', 'off'].includes(this.state(key));
    }
    root.querySelector('.feedback').textContent = this.feedback; root.querySelector('.feedback').hidden = !this.feedback;
    root.querySelector('.more-info').disabled = !this._hass?.states?.[this.config.entity];
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;letter-spacing:0;color:var(--primary-text-color,#222);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;min-width:0;padding:8px 12px;text-align:left;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff))}.device-art{display:grid;place-items:center;flex:none;width:32px;height:32px;color:var(--state-icon-color,#999)}.device-art svg{width:28px;height:28px}.device-art.active{color:var(--primary-color,#03a9f4)}.info{flex:1;min-width:0}.name{display:block;font-size:14px;line-height:18px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary{display:block;font-size:12px;color:var(--secondary-text-color,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      dialog{width:420px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:20px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--card-background-color,#fff);color:inherit}dialog::backdrop{background:#0006}header{display:flex;align-items:center;gap:10px}.heading{flex:1;min-width:0}.title{font-size:16px;font-weight:500;overflow-wrap:anywhere}.status{font-size:12px;color:var(--secondary-text-color,#777);margin-top:3px}.icon-button{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:50%;background:var(--secondary-background-color,#eee)}ha-icon{--mdc-icon-size:20px}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:20px 0 16px;border-bottom:1px solid var(--divider-color,#ddd)}.metric{min-width:0;text-align:left;padding:0}.metric-label{display:block;font-size:11px;line-height:16px;color:var(--secondary-text-color,#777)}.metric-value{display:block;font-size:18px;line-height:26px;font-weight:500;overflow-wrap:anywhere}.weight{font-size:11px;color:var(--secondary-text-color,#777)}.pets{margin:16px 0}.section-title{font-size:13px;font-weight:500;margin:0 0 8px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}th,td{padding:9px 0;border-bottom:1px solid var(--divider-color,#eee)}th{text-align:left;font-weight:400;overflow-wrap:anywhere}td{text-align:right;width:52px;font-variant-numeric:tabular-nums}.stats-warning,.feedback{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777);overflow-wrap:anywhere;margin:10px 0}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0}.action{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-height:60px;padding:8px 2px;background:var(--secondary-background-color,#f1f3f4);border-radius:6px;font-size:11px;text-align:center;overflow-wrap:anywhere}.confirmation{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-block:1px solid var(--divider-color,#ddd);padding:12px 0;margin-bottom:12px;font-size:13px}.confirm-label{flex:1;min-width:80px}.confirm,.cancel{display:flex;align-items:center;gap:4px;padding:6px}.confirm{color:var(--error-color,#c62828)}.setting{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;font-size:13px;border-bottom:1px solid var(--divider-color,#eee)}input[role=switch]{appearance:none;position:relative;flex:none;width:36px;height:20px;border:0;border-radius:10px;background:var(--disabled-color,#aaa);cursor:pointer;margin:0}input[role=switch]:before{content:'';position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:white}input[role=switch]:checked{background:var(--primary-color,#03a9f4)}input[role=switch]:checked:before{transform:translateX(16px)}input:disabled{opacity:.45;cursor:default}footer{display:flex;justify-content:flex-end;margin-top:14px}[hidden]{display:none!important}
    </style><button class="entry" aria-haspopup="dialog"><span class="device-art">${art}</span><span class="info"><span class="name"></span><span class="summary"></span></span></button>
    <dialog><header><span class="device-art">${art}</span><div class="heading"><div class="title"></div><div class="status"></div></div><button class="icon-button close" title="Close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header>
    <div class="metrics"><button class="metric stats-history" title="Today visits history"><span class="metric-label">Today visits</span><span class="metric-value today-total"></span></button><button class="metric litter-history" title="Litter level history"><span class="metric-label">Litter</span><span class="metric-value litter-value"></span><span class="weight weight-value"></span></button><div class="metric"><span class="metric-label">Waste bin</span><span class="metric-value waste-value"></span></div></div>
    <section class="pets"><h2 class="section-title">Pets <span class="weight">\u00b7 Today</span></h2><table aria-label="Today visits by pet"><tbody class="pet-rows"></tbody></table><div class="stats-warning">Today's pet breakdown is unavailable.</div></section>
    <div class="actions"></div><div class="confirmation" hidden><span class="confirm-label"></span><button class="cancel" title="Cancel"><ha-icon icon="mdi:close"></ha-icon>Cancel</button><button class="confirm" title="Confirm action"><ha-icon icon="mdi:check"></ha-icon>Confirm</button></div><div class="settings"></div><div class="feedback" role="status" aria-live="polite" hidden></div><footer><button class="icon-button more-info" title="More information" aria-label="More information"><ha-icon icon="mdi:information-outline"></ha-icon></button></footer></dialog>`;
    const root = this.shadowRoot, name = this.config.name || 'Litter Box', dialog = root.querySelector('dialog');
    for (const selector of ['.name', '.title']) { root.querySelector(selector).textContent = name; root.querySelector(selector).title = name; }
    dialog.setAttribute('aria-label', name);
    root.querySelector('.entry').onclick = () => { this.selected = null; this.update(); dialog.showModal(); };
    root.querySelector('.close').onclick = () => dialog.close();
    root.querySelector('.cancel').onclick = () => { this.selected = null; this.update(); };
    root.querySelector('.confirm').onclick = () => this.confirmAction();
    root.querySelector('.stats-history').onclick = () => this.history(this.config.stats_entity);
    root.querySelector('.litter-history').onclick = () => this.history(this.entity('litter'));
    root.querySelector('.more-info').onclick = () => this.history(this.config.entity);
    for (const [key, title, icon] of actions) {
      const button = document.createElement('button'); button.className = 'action'; button.dataset.action = key;
      button.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span>${title}</span>`;
      button.onclick = () => this.stage(key); root.querySelector('.actions').append(button);
    }
    for (const [key, title] of settings) {
      const row = document.createElement('label'); row.className = 'setting';
      row.innerHTML = `<span>${title}</span><input type="checkbox" role="switch" aria-label="${title}" data-setting="${key}">`;
      row.querySelector('input').onchange = event => this.setting(key, event.target.checked);
      root.querySelector('.settings').append(row);
    }
  }
}
if (!customElements.get('petkit-litter-card')) customElements.define('petkit-litter-card', PetkitLitterCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'petkit-litter-card', name: 'Petkit Litter Box', description: 'Litter box controls and per-pet daily visits', preview: true });
