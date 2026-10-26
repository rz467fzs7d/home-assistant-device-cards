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
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
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
      const tile = this.shadowRoot.querySelector(`.tile-reading[data-key="${key}"]`);
      tile.querySelector(".tile-value").textContent = valid ? value : "\u2014";
      tile.querySelector(".tile-unit").textContent = unit;
      tile.title = `${fields.find(([field]) => field === key)[1]}: ${value} ${unit}`.trim();
      tile.setAttribute("aria-label", tile.title);
    }
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;letter-spacing:0;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;text-align:left}button:disabled{cursor:default;color:var(--secondary-text-color,#777)}button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:-2px}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;padding:8px 12px;min-width:0;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color,#222)}
      .info{min-width:0;flex:1;container-type:inline-size}.device-art{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;color:var(--state-icon-color,#999)}.device-art svg{width:24px;height:28px}.name{display:block;font-size:14px;line-height:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.readings{display:grid;grid-template-columns:max-content max-content;justify-content:space-between;column-gap:2px;margin-top:3px;color:var(--secondary-text-color,#777)}.tile-reading{display:flex;align-items:baseline;gap:2px;min-width:0;white-space:nowrap;line-height:13px}.tile-value{font-size:11px}.tile-unit{font-size:9px}
      @container(max-width:80px){.tile-value{font-size:10px}.tile-unit{font-size:8px}.tile-reading{gap:1px}}
      dialog{width:340px;max-width:calc(100vw - 32px);border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222)}dialog::backdrop{background:#0006}header{display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:16px}header .device-art{width:24px;height:28px}.close{margin-left:auto;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color,#eee)}.detail{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;font-size:14px;border-bottom:1px solid var(--divider-color,#eee)}.detail:last-child{border:0}.reading{text-align:right}
    </style><button class="entry identity" aria-haspopup="dialog"><span class="device-art">${art}</span><span class="info"><span class="name"></span><span class="readings"></span></span></button><dialog><header><span class="device-art">${art}</span><span class="title"></span><button class="close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="details"></div></dialog>`;
    const name = this.config.name || "Plant Monitor";
    this.shadowRoot.querySelector(".name").textContent = name;
    this.shadowRoot.querySelector(".name").title = name;
    this.shadowRoot.querySelector(".title").textContent = name;
    const dialog = this.shadowRoot.querySelector("dialog");
    this.shadowRoot.querySelector(".identity").onclick = () => dialog.showModal();
    this.shadowRoot.querySelector(".close").onclick = () => dialog.close();
    for (const [key, label] of fields) {
      const tile = document.createElement("span"); tile.className = "tile-reading"; tile.dataset.key = key;
      tile.innerHTML = '<span class="tile-value"></span><span class="tile-unit"></span>';
      this.shadowRoot.querySelector(".readings").append(tile);
      const detail = document.createElement("button"); detail.className = "detail metric"; detail.dataset.key = key;
      detail.innerHTML = `<span>${label}</span><span class="reading"><span class="value"></span> <span class="unit"></span></span>`;
      detail.onclick = () => this.history(key); this.shadowRoot.querySelector(".details").append(detail);
    }
  }
}
if (!customElements.get("plant-monitor-card")) customElements.define("plant-monitor-card", PlantMonitorCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "plant-monitor-card", name: "Plant Monitor", description: "Plant monitor sensor readings", preview: true });
