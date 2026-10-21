class CookingEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
  set hass(hass) { this._hass = hass; this.shadowRoot?.querySelectorAll("ha-selector").forEach(node => { node.hass = hass; }); }
  change(key, value) { this.config = { ...this.config, [key]: value || undefined }; this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true })); }
  render() {
    this.shadowRoot.innerHTML = '<style>:host{display:block}label,ha-selector{display:block;margin-bottom:16px}input,textarea,select{display:block;width:100%;box-sizing:border-box;padding:10px;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:4px}</style>';
    const label = document.createElement("label"); label.textContent = "Name";
    const input = document.createElement("input"); input.value = this.config.name || ""; input.onchange = () => this.change("name", input.value); label.append(input); this.shadowRoot.append(label);
    const fryer = this.config.type === "custom:air-fryer-card";
    const dishwasher = this.config.type === "custom:dishwasher-card";
    if (dishwasher) {
      const label = document.createElement("label"); label.textContent = "Dishwasher Design";
      const select = document.createElement("select"); select.setAttribute("aria-label", "Dishwasher Design");
      for (const [value, title] of [["sink", "Sink"], ["cabinet", "Cabinet"]]) { const option = document.createElement("option"); option.value = value; option.textContent = title; select.append(option); }
      select.value = this.config.icon_variant || "cabinet"; select.onchange = () => this.change("icon_variant", select.value);
      label.append(select); this.shadowRoot.append(label);
    }
    const fields = [["state_entity", "Status", "sensor"], ["start_entity", "Start", fryer ? "button" : "notify"], ["stop_entity", "Stop", "button"], ["remaining_entity", "Remaining Time", "sensor"], ["fault_entity", "Fault", "sensor"], ["finished_entity", "Last Finished", "event"]];
    if (dishwasher) { fields[1][2] = "button"; fields.push(["progress_entity", "Wash Stage", "sensor"], ["mode_entity", "Current Program", "sensor"], ["mode_select_entity", "Program And Start (Midea E1)", "select"]); }
    else if (fryer) fields.push(["pause_entity", "Pause", "button"], ["resume_entity", "Resume", "button"], ["target_temperature_entity", "Target Temperature", "number"], ["target_time_entity", "Duration", "number"], ["recipe_entity", "Recipe", "text"]);
    else fields.push(["temperature_entity", "Temperature", "sensor"], ["cover_entity", "Lid", "sensor"], ["stage_entity", "Cooking Stage", "sensor"], ["taste_entity", "Texture", "sensor"], ["error_entity", "Detailed Fault", "sensor"]);
    for (const [key, title, domain] of fields) {
      const selector = document.createElement("ha-selector"); selector.hass = this._hass; selector.selector = { entity: { domain: [domain] } }; selector.label = title; selector.value = this.config[key];
      selector.addEventListener("value-changed", event => { event.stopPropagation(); this.change(key, event.detail.value); }); this.shadowRoot.append(selector);
    }
    if (!fryer && !dishwasher) {
      const label = document.createElement("label"); label.textContent = "Programs (JSON)";
      const input = document.createElement("textarea"); input.rows = 5; input.value = JSON.stringify(this.config.modes || [], null, 2);
      input.onchange = () => { try { const modes = JSON.parse(input.value); if (!Array.isArray(modes) || modes.some(m => !Number.isInteger(m.value) || typeof m.label !== "string")) throw new Error(); input.setCustomValidity(""); this.change("modes", modes); } catch { input.setCustomValidity('Expected [{"label":"Program","value":1}]'); input.reportValidity(); } };
      label.append(input); this.shadowRoot.append(label);
    }
  }
}
customElements.define("cooking-card-editor", CookingEditor);
