class WasherEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
  set hass(hass) { this._hass = hass; this.shadowRoot?.querySelectorAll("ha-selector").forEach(node => { node.hass = hass; }); }
  change(key, value) {
    this.config = { ...this.config, [key]: value || undefined };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  render() {
    this.shadowRoot.innerHTML = '<style>:host{display:block}label,ha-selector{display:block;margin-bottom:16px}input{display:block;width:100%;box-sizing:border-box;padding:10px;font:inherit;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:4px}</style>';
    const name = document.createElement("label"); name.textContent = "Name";
    const input = document.createElement("input"); input.value = this.config.name || "Washer";
    input.onchange = () => this.change("name", input.value); name.append(input); this.shadowRoot.append(name);
    for (const [key, title, domain] of [
      ["state_entity", "Status", ["sensor"]], ["operation_entity", "Operation", ["select"]],
      ["remote_start_entity", "Remote Start (optional)", ["binary_sensor"]],
      ["finish_entity", "Estimated Finish (optional)", ["sensor"]],
      ["delay_entity", "Delay (optional)", ["number", "input_select"]]
    ]) {
      const selector = document.createElement("ha-selector"); selector.hass = this._hass;
      selector.selector = { entity: { domain } }; selector.label = title; selector.value = this.config[key];
      selector.addEventListener("value-changed", event => { event.stopPropagation(); this.change(key, event.detail.value); });
      this.shadowRoot.append(selector);
    }
  }
}
if (!customElements.get("washer-card-editor")) customElements.define("washer-card-editor", WasherEditor);
