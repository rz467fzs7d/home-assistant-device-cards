export const adguardControls = [
  ["protection", "Protection"], ["filtering", "Filtering"], ["safe_browsing", "Safe Browsing"],
  ["safe_search", "Safe Search"], ["parental_control", "Parental Control"]
];
export const adguardMetrics = [
  ["dns_queries", "DNS Queries"], ["dns_queries_blocked", "Blocked Queries"],
  ["dns_queries_blocked_ratio", "Blocked", "%"], ["average_processing_speed", "Response Time", "ms"],
  ["parental_control_blocked", "Parental Control Blocks"], ["safe_browsing_blocked", "Safe Browsing Blocks"],
  ["safe_searches_enforced", "Safe Searches"]
];

class AdGuardCard extends HTMLElement {
  static getConfigElement() { return document.createElement("adguard-card-editor"); }
  static getStubConfig() { return { entity_prefix: "adguard_home", name: "AdGuard Home" }; }
  setConfig(config) {
    const prefix = config.entity_prefix ?? "adguard_home";
    if (typeof prefix !== "string" || !/^[a-z0-9_]+$/.test(prefix)) throw new Error("Entity prefix must contain only lowercase letters, digits and underscores.");
    const bindings = {};
    for (const [rows, domain] of [[adguardControls, "switch"], [adguardMetrics, "sensor"]]) {
      for (const [key] of rows) {
        const value = config[`${key}_entity`] ?? `${domain}.${prefix}_${key}`;
        if (typeof value !== "string" || !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(value)) throw new Error(`${key}_entity must be a ${domain} entity.`);
        bindings[key] = value;
      }
    }
    this.config = { ...config, entity_prefix: prefix }; this.bindings = bindings;
    this.pending = new Set(); this.error = "";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render(); this.update();
  }
  set hass(hass) { this._hass = hass; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  state(key) { return this._hass?.states?.[this.bindings[key]]; }
  available(key) { return ["on", "off"].includes(this.state(key)?.state); }
  reading(key, fallback = "") {
    const state = this.state(key), raw = state?.state;
    if (typeof raw !== "string" || !raw.trim() || !Number.isFinite(Number(raw))) return { value: "Unavailable", unit: "", valid: false };
    return { value: new Intl.NumberFormat(this._hass?.locale?.language || "en", { maximumFractionDigits: 2 }).format(Number(raw)), unit: state.attributes?.unit_of_measurement || fallback, valid: true };
  }
  async toggle(key, on) {
    if (!adguardControls.some(([id]) => id === key) || !this.available(key) || this.pending.has(key) || !this._hass?.callService) return;
    const pending = this.pending;
    pending.add(key); this.error = ""; this.update();
    let timer;
    try {
      await Promise.race([
        this._hass.callService("switch", on ? "turn_on" : "turn_off", { entity_id: this.bindings[key] }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("AdGuard request timed out; check the device state before retrying.")), this.serviceTimeout ?? 15000); })
      ]);
    }
    catch (err) { if (pending === this.pending) this.error = err?.message || "Unable to update AdGuard."; }
    finally { clearTimeout(timer); pending.delete(key); if (pending === this.pending) this.update(); }
  }
  update() {
    if (!this.config || !this.shadowRoot) return;
    const active = this.state("protection")?.state === "on", available = this.available("protection");
    const status = available ? active ? "Protected" : "Disabled" : "Unavailable";
    this.shadowRoot.querySelectorAll(".status").forEach(node => { node.textContent = status; });
    this.shadowRoot.querySelectorAll(".shield").forEach(node => { node.classList.toggle("active", available && active); });
    const ratio = this.reading("dns_queries_blocked_ratio", "%"), latency = this.reading("average_processing_speed", "ms");
    this.shadowRoot.querySelector(".summary").textContent = `${ratio.valid ? `${ratio.value}%` : "Unavailable"} / ${latency.valid ? `${latency.value} ${latency.unit}` : "Unavailable"}`;
    for (const [key] of adguardControls) {
      const input = this.shadowRoot.querySelector(`[data-control="${key}"]`);
      input.checked = this.state(key)?.state === "on";
      input.disabled = !this.available(key) || this.pending.has(key) || !this._hass?.callService;
      input.setAttribute("aria-busy", String(this.pending.has(key)));
      input.closest("label").querySelector(".control-state").textContent = this.pending.has(key) ? "Updating" : this.available(key) ? input.checked ? "On" : "Off" : "Unavailable";
    }
    for (const [key, , unit] of adguardMetrics) {
      const reading = this.reading(key, unit), row = this.shadowRoot.querySelector(`[data-metric="${key}"]`);
      row.querySelector(".value").textContent = reading.value;
      row.querySelector(".unit").textContent = reading.unit;
      row.disabled = !this.state(key);
    }
    const error = this.shadowRoot.querySelector('[role="alert"]'); error.textContent = this.error; error.hidden = !this.error;
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);letter-spacing:0;color:var(--primary-text-color,#222)}*{box-sizing:border-box}button,input{font:inherit}button{color:inherit;cursor:pointer;border:0;background:none}button:focus-visible,input:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}button:disabled{cursor:default}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;padding:8px 12px;text-align:left;min-width:0;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff))}.shield{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;color:var(--state-icon-color,#999)}.shield ha-icon{--mdc-icon-size:28px}.shield.active{color:var(--success-color,#388e3c)}.info{min-width:0;flex:1}.name{font-size:14px;line-height:16px;font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status{font-size:12px;line-height:15px;color:var(--secondary-text-color,#777)}.summary{display:block;font-size:10px;line-height:13px;color:var(--secondary-text-color,#777);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      dialog{width:380px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);overflow:auto;padding:16px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222)}dialog::backdrop{background:#0006}header{display:flex;gap:8px;align-items:center;margin-bottom:12px;min-width:0}.title{font-size:16px;font-weight:500;flex:1;min-width:0;overflow-wrap:anywhere}.close,.more-info{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color,#eee)}.control{display:flex;align-items:center;gap:12px;min-height:46px;border-bottom:1px solid var(--divider-color,#eee);font-size:14px;cursor:pointer}.control-name{flex:1;min-width:0;overflow-wrap:anywhere}.control-state{font-size:11px;color:var(--secondary-text-color,#777)}input[role=switch]{appearance:none;position:relative;flex-shrink:0;width:36px;height:20px;border-radius:10px;background:var(--disabled-color,#aaa);margin:0;cursor:pointer;transition:background .15s}input[role=switch]:before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:#fff;transition:transform .15s}input[role=switch]:checked{background:var(--primary-color,#03a9f4)}input[role=switch]:checked:before{transform:translateX(16px)}input[role=switch]:disabled{opacity:.45;cursor:default}.metrics{padding-top:12px}.metric{display:flex;align-items:baseline;gap:12px;justify-content:space-between;width:100%;padding:7px 0;text-align:left;font-size:12px}.metric-label{flex:1;min-width:0;overflow-wrap:anywhere;color:var(--secondary-text-color,#777)}.reading{font-size:13px;text-align:right;overflow-wrap:anywhere;max-width:55%}.unit{font-size:11px;color:var(--secondary-text-color,#777)}footer{display:flex;justify-content:flex-end;margin-top:8px}[role=alert]{color:var(--error-color,#c62828);font-size:12px;overflow-wrap:anywhere;margin-top:12px}[hidden]{display:none!important}
    </style><button class="entry identity" aria-haspopup="dialog"><span class="shield"><ha-icon icon="mdi:shield-check"></ha-icon></span><span class="info"><span class="name"></span><span class="status"></span><span class="summary"></span></span></button>
    <dialog aria-label="AdGuard Home"><header><span class="shield"><ha-icon icon="mdi:shield-check"></ha-icon></span><span class="title"></span><button class="close" title="Close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="controls"></div><div class="metrics"></div><div role="alert" hidden></div><footer><button class="more-info" title="More information" aria-label="More information"><ha-icon icon="mdi:information-outline"></ha-icon></button></footer></dialog>`;
    const name = this.config.name || "AdGuard Home", dialog = this.shadowRoot.querySelector("dialog");
    for (const selector of [".name", ".title"]) { const el = this.shadowRoot.querySelector(selector); el.textContent = name; el.title = name; }
    dialog.setAttribute("aria-label", name);
    this.shadowRoot.querySelector(".identity").onclick = () => dialog.showModal();
    this.shadowRoot.querySelector(".close").onclick = () => dialog.close();
    this.shadowRoot.querySelector(".more-info").onclick = () => this.moreInfo("protection");
    for (const [key, label] of adguardControls) {
      const row = document.createElement("label"); row.className = "control";
      row.innerHTML = `<span class="control-name">${label}</span><span class="control-state"></span><input type="checkbox" role="switch" data-control="${key}" aria-label="${label}">`;
      row.querySelector("input").onchange = event => this.toggle(key, event.target.checked);
      this.shadowRoot.querySelector(".controls").append(row);
    }
    for (const [key, label] of adguardMetrics) {
      const row = document.createElement("button"); row.className = "metric"; row.dataset.metric = key;
      row.innerHTML = `<span class="metric-label">${label}</span><span class="reading"><span class="value"></span> <span class="unit"></span></span>`;
      row.onclick = () => this.moreInfo(key); this.shadowRoot.querySelector(".metrics").append(row);
    }
  }
  moreInfo(key) {
    if (!this.state(key)) return;
    this.shadowRoot.querySelector("dialog").close();
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.bindings[key] }, bubbles: true, composed: true }));
  }
}
if (!customElements.get("adguard-card")) customElements.define("adguard-card", AdGuardCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "adguard-card", name: "AdGuard Home", description: "AdGuard protection controls and DNS statistics", preview: true });
