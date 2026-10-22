const fields = [
  ["moisture_entity", "Soil", "mdi:water-percent"],
  ["conductivity_entity", "EC", "mdi:sprout"],
  ["illuminance_entity", "Light", "mdi:white-balance-sunny"],
  ["temperature_entity", "Temp", "mdi:thermometer"]
];
const art = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M7 2h10a1 1 0 0 1 1 1v17a2 2 0 0 1-4 0V10h-4v10a2 2 0 0 1-4 0V3a1 1 0 0 1 1-1Zm1 2v4h8V4Zm0 13v2h1v-2Zm7 0v2h1v-2Z"/></svg>';
class PlantMonitorCard extends HTMLElement {
  static getConfigElement() { return document.createElement("plant-monitor-card-editor"); }
  static getStubConfig() { return { name: "Plant Monitor", moisture_entity: "" }; }
  setConfig(config) {
    const bindings = fields.map(([key]) => config[key]).filter(Boolean);
    if (!bindings.length || bindings.some(value => typeof value !== "string" || !value.startsWith("sensor."))) throw new Error("Configure at least one sensor entity; all bindings must be sensors.");
    this.config = { ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render(); this.update();
  }
  set hass(hass) { this._hass = hass; this.update(); }
  getCardSize() { return 2; }
  getGridOptions() { return { columns: 12, rows: 2, min_columns: 6 }; }
  history(key) {
    const entityId = this.config[key];
    if (!this._hass?.states[entityId]) return;
    this.shadowRoot.querySelector("dialog").close();
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  update() {
    if (!this.shadowRoot || !this.config) return;
    for (const [key] of fields) {
      const state = this._hass?.states[this.config[key]];
      const valid = state && state.state !== "" && Number.isFinite(Number(state.state));
      const value = valid ? state.state : "Unavailable";
      const unit = valid ? state.attributes?.unit_of_measurement || "" : "";
      const metric = this.shadowRoot.querySelector(`.metric[data-key="${key}"]`);
      metric.disabled = !state;
      metric.querySelector(".value").textContent = value;
      metric.querySelector(".unit").textContent = unit;
      const detail = this.shadowRoot.querySelector(`.detail[data-key="${key}"]`);
      detail.disabled = !state;
      detail.querySelector(".reading").textContent = [value, unit].filter(Boolean).join(" ");
    }
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;letter-spacing:0}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;text-align:left}button:disabled{cursor:default;color:var(--secondary-text-color,#777)}button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:-2px}
      .entry{display:grid;grid-template-columns:minmax(110px,1fr) minmax(180px,1.5fr);border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color,#222);min-height:88px;overflow:hidden}
      .identity{display:flex;align-items:center;gap:10px;padding:12px;min-width:0}.device-art{display:inline-flex;width:28px;height:32px;flex-shrink:0;color:var(--state-icon-color,#999)}.device-art svg{width:100%;height:100%;preserve-aspect-ratio:xMidYMid meet}.name{font-size:14px;font-weight:500;overflow-wrap:anywhere}
      .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:7px 8px 7px 0;gap:2px 6px}.metric{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:5px;padding:3px 2px;min-width:0}.metric ha-icon{--mdc-icon-size:17px;color:var(--primary-color,#03a9f4)}.label{display:block;font-size:10px;color:var(--secondary-text-color,#666)}.reading-small{display:flex;align-items:baseline;gap:3px;flex-wrap:wrap;font-size:12px}.unit{font-size:10px;color:var(--secondary-text-color,#666)}
      dialog{width:340px;max-width:calc(100vw - 32px);border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222)}dialog::backdrop{background:#0006}header{display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:16px}header .device-art{width:24px;height:28px}.close{margin-left:auto;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color,#eee)}.detail{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;font-size:14px;border-bottom:1px solid var(--divider-color,#eee)}.detail:last-child{border:0}.reading{text-align:right}
      @media(max-width:350px){.entry{grid-template-columns:minmax(94px,1fr) minmax(165px,1.6fr)}.identity{gap:5px;padding:8px}.name{font-size:13px}.device-art{width:24px}.metrics{gap:2px}}
    </style><div class="entry"><button class="identity"><span class="device-art">${art}</span><span class="name"></span></button><div class="metrics"></div></div><dialog><header><span class="device-art">${art}</span><span class="title"></span><button class="close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="details"></div></dialog>`;
    const name = this.config.name || "Plant Monitor";
    this.shadowRoot.querySelector(".name").textContent = name;
    this.shadowRoot.querySelector(".title").textContent = name;
    const dialog = this.shadowRoot.querySelector("dialog");
    this.shadowRoot.querySelector(".identity").onclick = () => dialog.showModal();
    this.shadowRoot.querySelector(".close").onclick = () => dialog.close();
    for (const [key, label, icon] of fields) {
      const metric = document.createElement("button"); metric.className = "metric"; metric.dataset.key = key;
      metric.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span><span class="label">${label}</span><span class="reading-small"><span class="value"></span><span class="unit"></span></span></span>`;
      metric.onclick = () => this.history(key); this.shadowRoot.querySelector(".metrics").append(metric);
      const detail = document.createElement("button"); detail.className = "detail"; detail.dataset.key = key;
      detail.innerHTML = `<span>${label}</span><span class="reading"></span>`;
      detail.onclick = () => this.history(key); this.shadowRoot.querySelector(".details").append(detail);
    }
  }
}
if (!customElements.get("plant-monitor-card")) customElements.define("plant-monitor-card", PlantMonitorCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "plant-monitor-card", name: "Plant Monitor", description: "Plant monitor sensor readings", preview: true });
