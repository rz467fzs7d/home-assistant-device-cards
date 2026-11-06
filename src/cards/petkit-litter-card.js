import { todayVisits } from './petkit-data.js';
import { calendarRecords, correctedVisits, dateInZone, dayBounds, shiftDate } from './petkit-history.js';

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
const art = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 5h20a6 6 0 0 1 6 6v23H4V11a6 6 0 0 1 6-6Z"/><rect x="8" y="11" width="18" height="19" rx="9"/><path d="M8 35v2m24-2v2M12 30h10"/><circle cx="31" cy="13" r="1"/></svg>';
const label = value => String(value || '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

class PetkitLitterCard extends HTMLElement {
  static getConfigElement() { return document.createElement('petkit-litter-card-editor'); }
  static getStubConfig() { return { entity: '', stats_entity: '', name: 'Litter Box' }; }
  setConfig(config) {
    if (typeof config.entity !== 'string' || !/^sensor\.[a-z0-9_]+$/.test(config.entity)) throw new Error('Configure a device status sensor.');
    for (const [key, value] of Object.entries(config)) {
      if (!key.endsWith('_entity') || !value) continue;
      const domain = key === 'calendar_entity' ? 'calendar' : key === 'stats_entity' ? 'sensor' : bindings[key.slice(0, -7)]?.[0];
      if (!domain || typeof value !== 'string' || !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(value)) throw new Error(`Invalid ${key} binding.`);
    }
    if (config.pet_icons !== undefined && (!config.pet_icons || typeof config.pet_icons !== 'object' || Array.isArray(config.pet_icons)
      || Object.values(config.pet_icons).some(icon => typeof icon !== 'string' || !/^[a-z][a-z0-9-]*:[a-z0-9_-]+$/.test(icon)))) throw new Error('Invalid pet_icons mapping.');
    for (const key of ['pet_weight_entities', 'pet_weight_time_entities', 'pet_raw_weight_entities']) {
      const value = config[key];
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.values(value).some(entity => typeof entity !== 'string' || !/^sensor\.[a-z0-9_]+$/.test(entity)))) throw new Error(`Invalid ${key} mapping.`);
    }
    this.config = { ...config }; this.pending = false; this.awaiting = null; this.feedback = '';
    this.generation = (this.generation || 0) + 1;
    this.historyCache = new Map(); this.historyDate = null; this.view = 'overview';
    this.weightDays = 7; this.weightChart = null; this.weightChartRequest = null;
    clearTimeout(this.readbackTimer);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render(); this.update();
  }
  connectedCallback() { this.clock = setInterval(() => {
    this.update();
    if (this.shadowRoot?.querySelector('dialog')?.open && this.config?.calendar_entity) this.loadHistory(this.historyDate || this.today(), true);
  }, 30000); }
  disconnectedCallback() { clearInterval(this.clock); clearTimeout(this.readbackTimer); this.clearWeightChart(); }
  set hass(value) { this._hass = value; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 12, rows: 1, min_columns: 3 }; }
  entity(key) {
    if (this.config[`${key}_entity`]) return this.config[`${key}_entity`];
    const base = this.config.entity.match(/^sensor\.(.+)_device_status$/)?.[1];
    return base && bindings[key] ? `${bindings[key][0]}.${base}_${bindings[key][1]}` : undefined;
  }
  state(key) { return this._hass?.states?.[key === 'status' ? this.config.entity : this.entity(key)]?.state; }
  online() { return /^online(?:_|$)/.test(this.state('status') || ''); }
  operation() {
    if (!this.online()) return {};
    const raw = this.state('state') || '';
    const match = raw.match(/^(cleaning|dumping|leveling)(?:(_paused)(?:_.*)?)?$/);
    if (match) return { slot: ({ cleaning: 'scoop', dumping: 'dump', leveling: 'level' })[match[1]], action: match[2] ? 'continue' : 'pause' };
    return /^paused(?:_|$)/.test(raw) ? { action: 'continue' } : {};
  }
  blocked(key) {
    if (this.pending || this.awaiting) return 'Waiting for the previous request';
    if (!this.online()) return 'Device is offline or unavailable';
    if (!this._hass?.callService) return 'Controls are unavailable';
    const target = this._hass.states[this.entity(key)];
    if (!target || target.state === 'unavailable') return 'This action is unavailable';
    if (['pause', 'continue'].includes(key) && this.operation().action !== key) return 'Device state has changed';
    if (key === 'pause') return '';
    if (key === 'continue' && /(?:^|_)paused_/.test(this.state('state') || '')) return 'Device is paused for a safety condition';
    if (this.state('occupancy') !== 'off') return 'Occupancy is detected or unknown';
    if (!['no error', 'none', '0'].includes((this.state('fault') || '').toLowerCase())) return 'Fault status is not clear';
    if (['scoop', 'dump', 'level'].includes(key) && this.state('state') !== 'idle') return 'Device is not idle';
    if (!this.state('state') || ['unknown', 'unavailable'].includes(this.state('state'))) return 'Device state is unknown';
    return '';
  }
  async action(key) {
    if (!actions.some(a => a[0] === key) || this.blocked(key)) return;
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
  zone() { return this._hass?.states?.[this.config.stats_entity]?.attributes?.time_zone || this._hass?.config?.time_zone || 'UTC'; }
  today() { return dateInZone(this.now?.() || new Date(), this.zone()); }
  petIcon(id) { return id && id !== 'unidentified' ? this.config.pet_icons?.[id] || 'mdi:cat' : 'mdi:help-circle-outline'; }
  async loadHistory(day, force = false) {
    if (!this.config.calendar_entity) return;
    try { shiftDate(day, 0); if (day > this.today()) return; } catch { return; }
    this.historyDate = day;
    const cached = this.historyCache.get(day);
    if (cached?.loading || (cached?.rows && !force && Date.now() - cached.loadedAt < 30000)) { this.update(); return; }
    const generation = this.generation;
    const entry = { loading: true, rows: cached?.rows }; this.historyCache.set(day, entry); this.update();
    try {
      if (!this._hass?.callApi) throw new Error('Calendar connection is unavailable');
      const [start, end] = dayBounds(day, this.zone());
      const result = await this._hass.callApi('GET', `calendars/${this.config.calendar_entity}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (generation !== this.generation) return;
      if (!Array.isArray(result)) throw new Error('Calendar returned an invalid response');
      entry.rows = calendarRecords(result, day, this.zone()); entry.loadedAt = Date.now();
    } catch (error) { if (generation === this.generation) entry.error = error?.message || 'Calendar could not be loaded'; }
    finally { if (generation === this.generation) { entry.loading = false; this.update(); } }
  }
  setView(view) {
    if (!['overview', 'history', 'weight'].includes(view)) return;
    this.view = view;
    this.clearWeightChart();
    if (view === 'history') this.loadHistory(this.historyDate || this.today());
    this.update();
  }
  clearWeightChart() {
    this.weightChartRequest = null; this.weightChart = null;
    this.shadowRoot?.querySelector('.weight-chart')?.replaceChildren();
  }
  async loadWeightChart() {
    if (this.weightChartRequest || this.weightChart || !this._hass || !this.shadowRoot.querySelector('dialog').open) return;
    const token = {}; this.weightChartRequest = token;
    const generation = this.generation, status = this.shadowRoot.querySelector('.weight-status');
    status.textContent = 'Loading\u2026'; let timer;
    try {
      if (!window.loadCardHelpers) throw new Error('Native statistics chart is unavailable');
      const helpers = await Promise.race([window.loadCardHelpers(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Native chart loading timed out')), 15000);
      })]);
      if (this.generation !== generation || this.weightChartRequest !== token || this.view !== 'weight') return;
      const pets = this._hass.states[this.config.stats_entity]?.attributes?.pets || [];
      const entities = Object.entries(this.config.pet_weight_entities || {}).map(([id, entity]) => ({ entity, name: pets.find(p => p.id === id)?.name || id }));
      const chart = helpers.createCardElement({ type: 'statistics-graph', entities, days_to_show: this.weightDays,
        period: this.weightDays === 90 ? 'day' : 'hour', stat_types: ['mean'], chart_type: 'line', logarithmic_scale: false });
      chart.hass = this._hass;
      chart.addEventListener('ll-upgrade', () => { chart.hass = this._hass; });
      this.weightChart = chart; this.shadowRoot.querySelector('.weight-chart').replaceChildren(chart);
      status.textContent = '';
    } catch (error) {
      if (this.generation === generation && this.weightChartRequest === token) status.textContent = error?.message || 'Weight chart is unavailable';
    } finally { clearTimeout(timer); }
  }
  updateWeights() {
    const root = this.shadowRoot, enabled = !!Object.keys(this.config.pet_weight_entities || {}).length;
    root.querySelector('[data-view="weight"]').hidden = !enabled;
    root.querySelector('.weight-view').hidden = !enabled || this.view !== 'weight';
    if (!enabled || this.view !== 'weight') return;
    const pets = this._hass?.states?.[this.config.stats_entity]?.attributes?.pets || [];
    const list = root.querySelector('.weight-pets'); list.replaceChildren();
    const numeric = value => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
    for (const [id, entity] of Object.entries(this.config.pet_weight_entities)) {
      const value = numeric(this._hass?.states?.[entity]?.state);
      const raw = numeric(this._hass?.states?.[this.config.pet_raw_weight_entities?.[id]]?.state);
      const valid = value !== null && (raw === null || Math.abs(value - raw) < .000001);
      const row = document.createElement('div'); row.className = 'weight-pet';
      const icon = document.createElement('ha-icon'); icon.setAttribute('icon', this.petIcon(id)); icon.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div');
      const name = document.createElement('div'); name.className = 'weight-pet-name'; name.textContent = pets.find(p => p.id === id)?.name || id;
      const date = document.createElement('div'); date.className = 'measurement-time';
      const measured = this._hass?.states?.[this.config.pet_weight_time_entities?.[id]]?.state;
      // Source timestamps are local Petkit measurement times, not HA last_changed.
      date.textContent = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(measured || '')
        ? `Measured ${measured.replace('T', ' ').slice(0, 16)}` : 'Measurement time unavailable';
      date.title = `${measured || 'Unknown'} \u00b7 ${this.zone()}`;
      content.append(name, date);
      const weight = document.createElement('div'); weight.className = 'pet-weight-value';
      weight.textContent = valid ? `${value} kg` : raw !== null ? `Needs review \u00b7 ${raw} kg` : 'Unavailable';
      weight.classList.toggle('needs-review', !valid && raw !== null);
      row.append(icon, content, weight); list.append(row);
    }
    root.querySelector('.weight-period').textContent = this.weightDays === 90 ? 'Daily weight \u00b7 kg' : 'Hourly weight \u00b7 kg';
    for (const button of root.querySelectorAll('[data-days]')) button.setAttribute('aria-pressed', String(Number(button.dataset.days) === this.weightDays));
    if (this.weightChart) this.weightChart.hass = this._hass;
    else this.loadWeightChart();
  }
  updateHistory() {
    const root = this.shadowRoot, active = !!this.config.calendar_entity, hasWeights = !!Object.keys(this.config.pet_weight_entities || {}).length;
    root.querySelector('.view-tabs').hidden = !active && !hasWeights;
    root.querySelector('[data-view="history"]').hidden = !active;
    root.querySelector('.overview').hidden = (active && this.view === 'history') || (hasWeights && this.view === 'weight');
    root.querySelector('.history-view').hidden = !active || this.view !== 'history';
    for (const tab of root.querySelectorAll('[data-view]')) tab.setAttribute('aria-selected', String(tab.dataset.view === this.view));
    if (!active) return;
    const day = this.historyDate || this.today(), entry = this.historyCache.get(day);
    const input = root.querySelector('.history-date');
    if (input.value !== day) input.value = day;
    input.max = this.today(); root.querySelector('.next-day').disabled = day >= this.today();
    const status = root.querySelector('.timeline-status');
    status.textContent = entry?.error || (entry?.loading ? 'Loading\u2026' : entry?.rows?.length ? '' : 'No records');
    status.hidden = !status.textContent;
    const list = root.querySelector('.timeline'); list.replaceChildren();
    for (const item of entry?.rows || []) {
      const row = document.createElement('li'); row.className = 'timeline-row';
      const icon = document.createElement('ha-icon'); icon.setAttribute('icon', item.kind === 'visit' ? this.petIcon(item.pet_id) : 'mdi:broom');
      icon.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div'); content.className = 'event-content';
      const title = document.createElement('div'); title.className = 'event-title';
      title.textContent = item.kind === 'visit' ? item.pet_name : label(item.result || item.kind);
      const detail = document.createElement('div'); detail.className = 'event-detail';
      const parts = [];
      if (item.kind === 'visit') parts.push('Visit');
      if (item.raw_weight_kg !== null) parts.push(`${item.raw_weight_kg} kg`);
      if (item.duration_seconds !== null) parts.push(`${Math.floor(item.duration_seconds / 60)}m ${item.duration_seconds % 60}s`);
      detail.textContent = parts.join(' \u00b7 '); content.append(title, detail);
      if (item.correction) {
        const badge = document.createElement('span'); badge.className = 'correction'; badge.textContent = 'Auto-corrected';
        const raw = this._hass?.states?.[this.config.stats_entity]?.attributes?.pets?.find(p => p.id === item.raw_pet_id)?.name || 'Unidentified';
        badge.title = `Original: ${raw} \u00b7 ${item.raw_weight_kg} kg. Combined weight; excluded from weight trend.`;
        content.append(badge);
      } else if (item.kind === 'visit' && item.raw_weight_kg !== null && item.weight_kg === null) {
        const badge = document.createElement('span'); badge.className = 'correction'; badge.textContent = 'Needs review';
        badge.title = 'Excluded from weight trend'; content.append(badge);
      }
      const time = document.createElement('time'); time.className = 'event-time';
      time.dateTime = new Date(item.ts * 1000).toISOString();
      time.textContent = new Intl.DateTimeFormat(this._hass?.locale?.language || 'en-GB', { timeZone: this.zone(), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(item.ts * 1000));
      row.append(icon, content, time); list.append(row);
    }
    const summary = root.querySelector('.history-summary');
    const visits = (entry?.rows || []).filter(row => row.kind === 'visit');
    const cleaning = (entry?.rows || []).filter(row => row.kind !== 'visit');
    summary.textContent = entry?.rows ? `${visits.length} visits \u00b7 ${cleaning.length} cleaning operations` : '';
    const weights = root.querySelector('.daily-weights'); weights.replaceChildren();
    const pets = this._hass?.states?.[this.config.stats_entity]?.attributes?.pets || [];
    for (const pet of pets) {
      const values = visits.filter(row => row.pet_id === pet.id && row.weight_kg !== null).map(row => row.weight_kg);
      if (!values.length) continue;
      const line = document.createElement('div');
      const low = Math.min(...values), high = Math.max(...values);
      line.textContent = `${pet.name} \u00b7 ${low === high ? low : `${low}\u2013${high}`} kg`;
      weights.append(line);
    }
    weights.hidden = !weights.childElementCount;
  }
  update() {
    if (!this.config || !this.shadowRoot) return;
    const root = this.shadowRoot, raw = this.state('state');
    if (this.awaiting && raw && !['unknown', 'unavailable'].includes(raw) && raw !== this.awaiting.before) {
      this.awaiting = null; clearTimeout(this.readbackTimer); this.feedback = 'Device state updated';
    }
    const status = this.online() ? label(raw || 'unknown') : label(this.state('status') || 'unavailable');
    root.querySelectorAll('.status').forEach(node => { node.textContent = status; });
    const sourceVisits = todayVisits(this._hass?.states?.[this.config.stats_entity], this.now?.() || new Date());
    const archive = this.config.calendar_entity ? this.historyCache?.get(this.today()) : null;
    const visits = archive?.rows && !archive.error ? correctedVisits(sourceVisits, archive.rows) : sourceVisits;
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
      name.scope = 'row';
      const label = document.createElement('span'); label.className = 'pet-label';
      const icon = document.createElement('ha-icon'); icon.setAttribute('icon', this.petIcon(pet.id)); icon.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = pet.name; label.append(icon, text); name.append(label);
      value.textContent = String(pet.count ?? '\u2014'); row.append(name, value); body.append(row);
    }
    root.querySelector('.stats-warning').hidden = visits.complete;
    const operation = this.operation();
    for (const [slot, title] of actions.slice(0, 3)) {
      const key = operation.slot === slot ? operation.action : slot;
      const [, actionTitle, icon] = actions.find(a => a[0] === key);
      const button = root.querySelector(`[data-slot="${slot}"]`), reason = this.blocked(key);
      button.dataset.action = key; button.disabled = !!reason;
      button.title = reason || (key === slot ? title : `${actionTitle}: ${title}`);
      button.classList.toggle('current', key !== slot);
      button.querySelector('ha-icon').setAttribute('icon', icon);
      button.querySelector('.action-label').textContent = actionTitle;
      const caption = button.querySelector('.operation-label'); caption.textContent = title; caption.hidden = key === slot;
    }
    const overlay = root.querySelector('.context-action');
    overlay.hidden = !operation.action || !!operation.slot;
    overlay.disabled = !!this.blocked('continue');
    overlay.title = this.blocked('continue') || 'Continue current operation';
    for (const [key] of settings) {
      const input = root.querySelector(`[data-setting="${key}"]`);
      input.checked = this.state(key) === 'on'; input.disabled = !this.online() || this.pending || !!this.awaiting || !['on', 'off'].includes(this.state(key));
    }
    root.querySelector('.feedback').textContent = this.feedback; root.querySelector('.feedback').hidden = !this.feedback;
    root.querySelector('.more-info').disabled = !this._hass?.states?.[this.config.entity];
    this.updateHistory();
    this.updateWeights();
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;letter-spacing:0;color:var(--primary-text-color,#222);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;min-width:0;padding:8px 12px;text-align:left;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff))}.device-art{display:grid;place-items:center;flex:none;width:32px;height:32px;color:var(--state-icon-color,#999)}.device-art svg{width:24px;height:28px}.info{flex:1;min-width:0}.name{display:block;font-size:14px;line-height:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary{display:block;font-size:11px;line-height:13px;margin-top:3px;color:var(--secondary-text-color,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      dialog{width:420px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:20px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--card-background-color,#fff);color:inherit;font-size:14px;line-height:20px}dialog::backdrop{background:#0006}header{display:flex;align-items:center;gap:10px}.heading{flex:1;min-width:0}.title{font-size:16px;line-height:22px;font-weight:500;overflow-wrap:anywhere}.status{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777);margin-top:2px}.icon-button{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:50%;background:var(--secondary-background-color,#eee)}ha-icon{--mdc-icon-size:20px}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:20px 0 16px;border-bottom:1px solid var(--divider-color,#ddd)}
      .metric{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;min-width:0;text-align:left;padding:0}
      .metric-label{display:block;font-size:12px;line-height:18px;color:var(--secondary-text-color,#777)}
      .metric-value{display:block;font-size:20px;line-height:28px;font-weight:500;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.waste-value{font-size:16px}
      .weight{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777)}.pets{margin:16px 0}.section-title{font-size:14px;line-height:20px;font-weight:500;margin:0 0 8px}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:20px}th,td{padding:10px 0;border-bottom:1px solid var(--divider-color,#eee)}th{text-align:left;font-weight:400;overflow-wrap:anywhere}td{text-align:right;width:52px;font-variant-numeric:tabular-nums}
      .pet-label{display:flex;align-items:center;gap:10px;min-width:0}.pet-label ha-icon{flex:none;color:var(--secondary-text-color,#777)}.pet-label>span{min-width:0;overflow-wrap:anywhere}
      .stats-warning,.feedback{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777);overflow-wrap:anywhere;margin:10px 0}
      .actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0;position:relative;height:72px}
      .action{display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;height:72px;padding:8px 2px;background:var(--secondary-background-color,#f1f3f4);border-radius:6px;font-size:12px;line-height:16px;text-align:center;overflow-wrap:anywhere}
      .action.current{color:var(--primary-color,#03a9f4);box-shadow:inset 0 0 0 1px currentColor}.operation-label{font-size:12px;line-height:16px;color:var(--secondary-text-color,#777)}
      .context-action{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:6px;background:var(--secondary-background-color,#f1f3f4);font-size:14px;line-height:20px}
      .setting{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;font-size:14px;line-height:20px;border-bottom:1px solid var(--divider-color,#eee)}input[role=switch]{appearance:none;position:relative;flex:none;width:36px;height:20px;border:0;border-radius:10px;background:var(--disabled-color,#aaa);cursor:pointer;margin:0}input[role=switch]:before{content:'';position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:white}input[role=switch]:checked{background:var(--primary-color,#03a9f4)}input[role=switch]:checked:before{transform:translateX(16px)}input:disabled{opacity:.45;cursor:default}footer{display:flex;justify-content:flex-end;margin-top:14px}[hidden]{display:none!important}
      .view-tabs{display:flex;gap:20px;border-bottom:1px solid var(--divider-color,#ddd);margin-top:16px}.view-tabs button{padding:10px 0;font-size:14px;border-bottom:2px solid transparent}.view-tabs button[aria-selected=true]{border-color:var(--primary-color,#03a9f4);color:var(--primary-color,#03a9f4)}
      .weight-pet{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:center;padding:14px 0;border-bottom:1px solid var(--divider-color,#ddd)}.weight-pet>ha-icon{color:var(--secondary-text-color,#777)}.weight-pet-name{font-size:14px;line-height:20px}.measurement-time{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777);overflow-wrap:anywhere}.pet-weight-value{font-size:18px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums;max-width:120px;overflow-wrap:anywhere;text-align:right}.pet-weight-value.needs-review{font-size:12px;line-height:18px;color:var(--warning-color,#b36b00)}
      .weight-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0}.weight-period,.weight-status{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777)}.weight-ranges{display:flex;border:1px solid var(--divider-color,#ddd);border-radius:4px;overflow:hidden;flex:none}.weight-ranges button{font-size:12px;padding:6px 9px;min-height:32px;border-right:1px solid var(--divider-color,#ddd)}.weight-ranges button:last-child{border:0}.weight-ranges button[aria-pressed=true]{background:var(--secondary-background-color,#eee);color:var(--primary-color,#03a9f4)}.weight-chart{min-height:240px;--ha-card-border-width:0px;--ha-card-border-radius:0px;--ha-card-box-shadow:none;--ha-card-background:transparent}.weight-chart>*{display:block}.weight-status:empty{display:none}
      .date-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px}.history-date{font:inherit;min-width:0;max-width:190px;color:inherit;color-scheme:light dark;border:1px solid var(--divider-color,#ddd);border-radius:4px;padding:6px;background:var(--card-background-color,#fff)}
      .history-summary,.daily-weights,.timeline-status{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777)}.daily-weights{display:flex;flex-wrap:wrap;gap:4px 16px;padding:8px 0}.timeline{list-style:none;padding:0;margin:12px 0 0}.timeline-row{display:grid;grid-template-columns:22px minmax(0,1fr) 44px;align-items:start;gap:10px;padding:12px 0;border-bottom:1px solid var(--divider-color,#eee)}.timeline-row>ha-icon{color:var(--secondary-text-color,#777);margin-top:2px}.event-title{font-size:14px;line-height:20px;overflow-wrap:anywhere}.event-detail,.event-time,.correction{font-size:12px;line-height:18px;color:var(--secondary-text-color,#777);overflow-wrap:anywhere}.event-time{text-align:right;font-variant-numeric:tabular-nums}.correction{display:inline-block;color:var(--primary-color,#03a9f4);margin-top:2px}.history-view{min-height:280px}
    </style><button class="entry" aria-haspopup="dialog"><span class="device-art">${art}</span><span class="info"><span class="name"></span><span class="summary"></span></span></button>
    <dialog><header><span class="device-art">${art}</span><div class="heading"><div class="title"></div><div class="status"></div></div><button class="icon-button close" title="Close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header>
    <div class="view-tabs" role="tablist" aria-label="Litter box views" hidden><button role="tab" data-view="overview" aria-selected="true">Overview</button><button role="tab" data-view="history" aria-selected="false">History</button><button role="tab" data-view="weight" aria-selected="false" hidden>Weight</button></div>
    <div class="overview"><div class="metrics"><button class="metric stats-history" title="Today visits history"><span class="metric-label">Today visits</span><span class="metric-value today-total"></span></button><button class="metric litter-history" title="Litter level history"><span class="metric-label">Litter</span><span class="metric-value litter-value"></span><span class="weight weight-value"></span></button><div class="metric"><span class="metric-label">Waste bin</span><span class="metric-value waste-value"></span></div></div>
    <section class="pets"><h2 class="section-title">Pets <span class="weight">\u00b7 Today</span></h2><table aria-label="Today visits by pet"><tbody class="pet-rows"></tbody></table><div class="stats-warning">Today's pet breakdown is unavailable.</div></section>
    <div class="actions"></div><div class="settings"></div><div class="feedback" role="status" aria-live="polite" hidden></div></div>
    <section class="history-view" hidden><div class="date-toolbar"><button class="icon-button previous-day" title="Previous day" aria-label="Previous day"><ha-icon icon="mdi:chevron-left"></ha-icon></button><input class="history-date" type="date" aria-label="History date"><button class="icon-button next-day" title="Next day" aria-label="Next day"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div><div class="history-summary"></div><div class="daily-weights" hidden></div><p class="timeline-status" role="status"></p><ol class="timeline"></ol></section>
    <section class="weight-view" hidden><div class="weight-pets"></div><div class="weight-toolbar"><span class="weight-period"></span><div class="weight-ranges" role="group" aria-label="Weight range"><button data-days="7" aria-pressed="true">7d</button><button data-days="30" aria-pressed="false">30d</button><button data-days="90" aria-pressed="false">90d</button></div></div><p class="weight-status" role="status"></p><div class="weight-chart"></div></section>
    <footer><button class="icon-button more-info" title="More information" aria-label="More information"><ha-icon icon="mdi:information-outline"></ha-icon></button></footer></dialog>`;
    const root = this.shadowRoot, name = this.config.name || 'Litter Box', dialog = root.querySelector('dialog');
    for (const selector of ['.name', '.title']) { root.querySelector(selector).textContent = name; root.querySelector(selector).title = name; }
    dialog.setAttribute('aria-label', name);
    root.querySelector('.entry').onclick = () => { dialog.showModal(); this.update(); if (this.config.calendar_entity) this.loadHistory(this.today()); };
    dialog.addEventListener('close', () => this.clearWeightChart());
    root.querySelector('.close').onclick = () => dialog.close();
    root.querySelector('.stats-history').onclick = () => this.config.calendar_entity ? this.setView('history') : this.history(this.config.stats_entity);
    for (const tab of root.querySelectorAll('[data-view]')) tab.onclick = () => this.setView(tab.dataset.view);
    for (const button of root.querySelectorAll('[data-days]')) button.onclick = () => {
      this.weightDays = Number(button.dataset.days); this.clearWeightChart(); this.update();
    };
    root.querySelector('.history-date').onchange = event => this.loadHistory(event.target.value);
    root.querySelector('.previous-day').onclick = () => this.loadHistory(shiftDate(this.historyDate || this.today(), -1));
    root.querySelector('.next-day').onclick = () => this.loadHistory(shiftDate(this.historyDate || this.today(), 1));
    root.querySelector('.litter-history').onclick = () => this.history(this.entity('litter'));
    root.querySelector('.more-info').onclick = () => this.history(this.config.entity);
    for (const [key, title, icon] of actions.slice(0, 3)) {
      const button = document.createElement('button'); button.className = 'action'; button.dataset.slot = key; button.dataset.action = key;
      button.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span class="action-label">${title}</span><span class="operation-label" hidden></span>`;
      button.onclick = () => this.action(button.dataset.action); root.querySelector('.actions').append(button);
    }
    const overlay = document.createElement('button'); overlay.className = 'context-action'; overlay.dataset.action = 'continue'; overlay.hidden = true;
    overlay.innerHTML = '<ha-icon icon="mdi:play"></ha-icon><span>Continue</span>';
    overlay.onclick = () => this.action('continue'); root.querySelector('.actions').append(overlay);
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
