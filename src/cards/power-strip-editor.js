import { powerStripIcons } from "./power-strip-icons.js";

class PowerStripEditor extends HTMLElement {
  setConfig(config) {
    this.config = { ...config, entities: (config.entities || []).map(e => typeof e === "string" ? { entity: e } : { ...e }) };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }
  set hass(hass) {
    this._hass = hass;
    this.shadowRoot?.querySelectorAll("ha-selector").forEach(el => { el.hass = hass; });
  }
  emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  field(label, value, change) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.value = value || "";
    input.addEventListener("change", () => change(input.value));
    wrapper.append(input);
    return wrapper;
  }
  iconButton(icon, title, click, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.disabled = disabled;
    const symbol = document.createElement("ha-icon");
    symbol.setAttribute("icon", icon);
    button.append(symbol);
    button.onclick = click;
    return button;
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color)}
      label{display:grid;gap:6px;font-size:13px;margin-bottom:12px}
      input,select{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:inherit;font:inherit}
      .row{border-top:1px solid var(--divider-color,#ccc);padding:16px 0}
      .toolbar{display:flex;justify-content:flex-end;gap:4px}
      button{min-width:40px;min-height:40px;background:none;border:0;color:var(--primary-color);cursor:pointer}
      button:disabled{opacity:.3;cursor:default}
      .fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
      ha-selector{display:block}
    </style><div class="fields-root"></div>`;
    const root = this.shadowRoot.querySelector(".fields-root");
    root.append(this.field("Name", this.config.name, value => { this.config = { ...this.config, name: value }; this.emit(); }));
    const iconLabel = document.createElement("label");
    iconLabel.textContent = "Appearance";
    const icons = document.createElement("select");
    for (const [value, { label }] of Object.entries(powerStripIcons)) {
      const option = document.createElement("option");
      option.value = value; option.textContent = label; icons.append(option);
    }
    icons.value = this.config.icon_variant || "default";
    icons.onchange = () => { this.config = { ...this.config, icon_variant: icons.value }; this.emit(); };
    iconLabel.append(icons); root.append(iconLabel);
    this.config.entities.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "row";
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      const move = offset => {
        const entities = [...this.config.entities];
        [entities[index], entities[index + offset]] = [entities[index + offset], entities[index]];
        this.config = { ...this.config, entities }; this.emit(); this.render();
      };
      toolbar.append(
        this.iconButton("mdi:arrow-up", "Move up", () => move(-1), index === 0),
        this.iconButton("mdi:arrow-down", "Move down", () => move(1), index === this.config.entities.length - 1),
        this.iconButton("mdi:delete-outline", "Remove outlet", () => {
          this.config = { ...this.config, entities: this.config.entities.filter((_, i) => i !== index) };
          this.emit(); this.render();
        })
      );
      row.append(toolbar);
      const update = patch => {
        const entities = this.config.entities.map((entry, i) => i === index ? { ...entry, ...patch } : entry);
        this.config = { ...this.config, entities }; this.emit();
      };
      const selector = document.createElement("ha-selector");
      selector.hass = this._hass;
      selector.selector = { entity: { domain: ["switch", "light"] } };
      selector.value = item.entity;
      selector.label = `Outlet ${index + 1}`;
      selector.addEventListener("value-changed", event => { event.stopPropagation(); update({ entity: event.detail.value }); });
      row.append(selector);
      const fields = document.createElement("div");
      fields.className = "fields";
      fields.append(this.field("Name", item.name, value => update({ name: value })),
        this.field("Icon (optional)", item.icon, value => update({ icon: value })));
      row.append(fields, this.field("Confirmation message (optional)",
        typeof item.confirmation === "string" ? item.confirmation : item.confirmation ? "Change outlet power?" : "",
        value => update({ confirmation: value || false })));
      root.append(row);
    });
    const add = this.iconButton("mdi:plus", "Add outlet", () => {
      this.config = { ...this.config, entities: [...this.config.entities, { entity: "" }] };
      this.emit(); this.render();
    });
    add.append(document.createTextNode(" Add outlet"));
    root.append(add);
  }
}
if (!customElements.get("power-strip-card-editor")) customElements.define("power-strip-card-editor", PowerStripEditor);
