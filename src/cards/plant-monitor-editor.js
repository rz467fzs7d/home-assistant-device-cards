class PlantMonitorEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
  set hass(hass) { this._hass = hass; this.shadowRoot?.querySelectorAll("ha-selector").forEach(node => { node.hass = hass; }); }
  change(key, value) {
    this.config = { ...this.config, [key]: value || undefined };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  render() {
    this.shadowRoot.innerHTML = '<style>:host{display:block}label,ha-selector{display:block;margin-bottom:16px}input{display:block;width:100%;padding:10px;box-sizing:border-box;font:inherit}</style>';
    const label = document.createElement("label"); label.textContent = "Name";
    const input = document.createElement("input"); input.value = this.config.name || "Plant Monitor";
    input.onchange = () => this.change("name", input.value); label.append(input); this.shadowRoot.append(label);
    for (const [key, title] of [["moisture_entity", "Soil Moisture"], ["conductivity_entity", "Conductivity"], ["illuminance_entity", "Illuminance"], ["temperature_entity", "Temperature"]]) {
      const selector = document.createElement("ha-selector"); selector.hass = this._hass; selector.selector = { entity: { domain: ["sensor"] } }; selector.label = title; selector.value = this.config[key];
      selector.addEventListener("value-changed", event => { event.stopPropagation(); this.change(key, event.detail.value); }); this.shadowRoot.append(selector);
    }
  }
}
if (!customElements.get("plant-monitor-card-editor")) customElements.define("plant-monitor-card-editor", PlantMonitorEditor);
