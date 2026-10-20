import powerStripSvg from "../assets/powerstrip.svg";

const powerStripIcon = `data:image/svg+xml,${encodeURIComponent(powerStripSvg)}`;

/* Compact entry with independent outlet controls. No aggregate switching. */
class PowerStripCard extends HTMLElement {
  static getConfigElement() { return document.createElement("power-strip-card-editor"); }
  static getStubConfig(hass) {
    return { type: "custom:power-strip-card", name: "Power Strip",
      entities: Object.keys(hass?.states || {}).filter(id => /^(switch|light)\./.test(id)).slice(0, 2) };
  }
  setConfig(config) {
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error("entities is required");
    this.config = { name: "Power Strip", ...config,
      entities: config.entities.map(item => typeof item === "string" ? { entity: item } : { ...item }) };
    if (this.config.entities.some(item => !/^(switch|light)\./.test(item.entity))) {
      throw new Error("Only switch and light entities are supported");
    }
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.pending = new Set();
    this.render();
  }
  set hass(value) { this._hass = value; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  disconnectedCallback() { this.shadowRoot?.querySelector("dialog")?.close(); }
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}
        *{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}
        .entry{width:100%;height:66px;display:flex;align-items:center;gap:12px;padding:10px 12px;text-align:left;background:var(--ha-card-background,var(--card-background-color,#fff));border:1px solid var(--divider-color,#ddd);border-radius:8px}
        .strip-icon{flex:0 0 32px;width:32px;height:32px;background:var(--secondary-text-color);mask:url("${powerStripIcon}") center/contain no-repeat;-webkit-mask:url("${powerStripIcon}") center/contain no-repeat}
        .entry.active .strip-icon{background:var(--state-switch-active-color,#e6ac00)}
        .entry-info{min-width:0;overflow-wrap:anywhere}
        .name{font-size:14px;font-weight:500}.summary{font-size:12px;color:var(--secondary-text-color);margin-top:3px}
        dialog{color:var(--primary-text-color);background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:24px;width:min(420px,calc(100vw - 32px));max-height:85dvh;overflow:auto}
        dialog::backdrop{background:rgba(0,0,0,.48)}
        header{position:relative;text-align:center;padding:12px 28px 24px}h2{font-size:22px;margin:0;font-weight:500}
        .close{position:absolute;right:-12px;top:-12px;border:0;background:none;width:44px;height:44px}
        .outlets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 20px}
        .outlet{border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:0;padding:0}
        .circle{width:104px;height:104px;border-radius:50%;display:grid;place-items:center;background:var(--secondary-background-color,#eee);color:var(--secondary-text-color)}
        .circle ha-icon{--mdc-icon-size:38px}
        .on .circle{background:var(--state-switch-active-color,#e6ac00);color:#fff}
        .label{font-size:14px;text-align:center;overflow-wrap:anywhere}.state{font-size:12px;color:var(--secondary-text-color)}
        .outlet:disabled{cursor:default;opacity:.5}.outlet[aria-busy=true] .circle{outline:2px dashed var(--primary-color);outline-offset:4px}
        button:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
        .error{color:var(--error-color,#db4437);font-size:13px;margin-top:20px;overflow-wrap:anywhere}
        @media(max-width:350px){dialog{padding:16px}.circle{width:88px;height:88px}}
      </style>
      <button class="entry" aria-haspopup="dialog"><span class="strip-icon" aria-hidden="true"></span><div class="entry-info"><div class="name"></div><div class="summary"></div></div></button>
      <dialog aria-label="Power Strip"><header><h2></h2><div class="summary"></div><button class="close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="outlets"></div><div class="error" role="alert"></div></dialog>`;
    const root = this.shadowRoot;
    root.querySelector(".name").textContent = this.config.name;
    root.querySelector("h2").textContent = this.config.name;
    root.querySelector("dialog").setAttribute("aria-label", this.config.name);
    root.querySelector(".entry").onclick = () => root.querySelector("dialog").showModal();
    root.querySelector(".close").onclick = () => root.querySelector("dialog").close();
    root.querySelector("dialog").onclick = event => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
      }
    };
    this.config.entities.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "outlet";
      button.innerHTML = '<span class="circle"><ha-icon></ha-icon></span><span class="label"></span><span class="state"></span>';
      button.querySelector("ha-icon").setAttribute("icon", item.icon || (item.entity.startsWith("light.") ? "mdi:lightbulb" : "mdi:power"));
      button.querySelector(".label").textContent = item.name || `Outlet ${index + 1}`;
      button.onclick = () => this.toggle(item);
      root.querySelector(".outlets").append(button);
    });
    this.update();
  }
  update() {
    if (!this.config || !this._hass || !this.shadowRoot) return;
    let on = 0, unavailable = 0;
    this.config.entities.forEach((item, index) => {
      const state = this._hass.states[item.entity]?.state;
      const available = state === "on" || state === "off";
      on += state === "on" ? 1 : 0;
      unavailable += available ? 0 : 1;
      const button = this.shadowRoot.querySelectorAll(".outlet")[index];
      button.classList.toggle("on", state === "on");
      button.disabled = !available || this.pending.has(item.entity);
      button.setAttribute("aria-pressed", String(state === "on"));
      button.setAttribute("aria-busy", String(this.pending.has(item.entity)));
      button.querySelector(".state").textContent = !available ? "Unavailable" : state === "on" ? "On" : "Off";
    });
    const off = this.config.entities.length - on - unavailable;
    const summary = `${on} On · ${off} Off${unavailable ? ` · ${unavailable} unavailable` : ""}`;
    this.shadowRoot.querySelectorAll(".summary").forEach(node => { node.textContent = summary; });
    this.shadowRoot.querySelector(".entry").classList.toggle("active", on > 0);
  }
  async toggle(item) {
    const state = this._hass.states[item.entity]?.state;
    if (!["on", "off"].includes(state) || this.pending.has(item.entity)) return;
    if (item.confirmation && !window.confirm(typeof item.confirmation === "string" ? item.confirmation : `Change ${item.name || item.entity}?`)) return;
    this.pending.add(item.entity);
    this.shadowRoot.querySelector(".error").textContent = "";
    this.update();
    try {
      await this._hass.callService(item.entity.split(".")[0], state === "on" ? "turn_off" : "turn_on", { entity_id: item.entity });
    } catch (error) {
      this.shadowRoot.querySelector(".error").textContent = error?.message || String(error);
    } finally {
      this.pending.delete(item.entity);
      this.update();
    }
  }
}
if (!customElements.get("power-strip-card")) customElements.define("power-strip-card", PowerStripCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "power-strip-card", name: "Power Strip", description: "Compact entry with independent outlet controls" });
