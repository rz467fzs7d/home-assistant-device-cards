import { adguardControls, adguardMetrics } from "./adguard-card.js";

class AdGuardEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
  set hass(hass) { this._hass = hass; this.shadowRoot?.querySelectorAll("ha-selector").forEach(node => { node.hass = hass; }); }
  change(key, value) {
    this.config = { ...this.config, [key]: value || undefined };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  render() {
    this.shadowRoot.innerHTML = '<style>:host{display:block}label,ha-selector{display:block;margin-bottom:16px}input{display:block;width:100%;padding:10px;box-sizing:border-box;font:inherit}</style>';
    for (const [key, label, fallback] of [["name", "Name", "AdGuard Home"], ["entity_prefix", "Entity Prefix", "adguard_home"]]) {
      const row = document.createElement("label"); row.textContent = label;
      const input = document.createElement("input"); input.value = this.config[key] ?? fallback;
      input.onchange = () => this.change(key, input.value); row.append(input); this.shadowRoot.append(row);
    }
    for (const [rows, domain] of [[adguardControls, "switch"], [adguardMetrics, "sensor"]]) {
      for (const [key, label] of rows) {
        const selector = document.createElement("ha-selector"); selector.hass = this._hass;
        selector.selector = { entity: { domain: [domain] } }; selector.label = label;
        selector.value = this.config[`${key}_entity`] ?? `${domain}.${this.config.entity_prefix || "adguard_home"}_${key}`;
        selector.addEventListener("value-changed", event => { event.stopPropagation(); this.change(`${key}_entity`, event.detail.value); });
        this.shadowRoot.append(selector);
      }
    }
  }
}
if (!customElements.get("adguard-card-editor")) customElements.define("adguard-card-editor", AdGuardEditor);
