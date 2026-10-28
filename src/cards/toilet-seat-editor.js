class ToiletSeatEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
  set hass(value) { this._hass = value; const selector = this.shadowRoot?.querySelector("ha-selector"); if (selector) selector.hass = value; }
  change(key, value) {
    this.config = { ...this.config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  render() {
    this.shadowRoot.innerHTML = '<style>label,ha-selector{display:block;margin-bottom:16px}input{display:block;width:100%;padding:10px;box-sizing:border-box;font:inherit}</style><label>Name<input></label><ha-selector></ha-selector>';
    const input = this.shadowRoot.querySelector("input"); input.value = this.config.name || "Toilet Seat";
    input.onchange = () => this.change("name", input.value);
    const selector = this.shadowRoot.querySelector("ha-selector"); selector.hass = this._hass;
    selector.selector = { entity: { domain: ["switch"] } }; selector.label = "Power"; selector.value = this.config.entity;
    selector.addEventListener("value-changed", event => { event.stopPropagation(); this.change("entity", event.detail.value); });
  }
}
if (!customElements.get("toilet-seat-card-editor")) customElements.define("toilet-seat-card-editor", ToiletSeatEditor);
