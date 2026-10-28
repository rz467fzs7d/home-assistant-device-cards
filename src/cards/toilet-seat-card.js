const art = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m4.2 12.6-.8-5.7C3 3.6 4.9 1.3 7.9 1.1c3.3-.2 5.9 2.3 6.3 5.5l.6 5.6Z"/><path fill="currentColor" fill-rule="evenodd" d="m4.1 14 9.7-.3 6.5 3.1c2.7 1.4 2.7 3.2.1 4.5-2.8 1.4-7.5 1.5-10.6.1L3 18.2v-2.1Zm3.5 1.8 4.3 2.1c2 .9 5.4 1 7.4.1l-6.1-2.8Z"/></svg>';
class ToiletSeatCard extends HTMLElement {
  static getConfigElement() { return document.createElement("toilet-seat-card-editor"); }
  static getStubConfig() { return { entity: "", name: "Toilet Seat" }; }
  setConfig(config) {
    if (typeof config.entity !== "string" || !/^switch\.[a-z0-9_]+$/.test(config.entity)) throw new Error("Configure a switch entity.");
    this.config = { ...config }; this.pending = false; this.error = "";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render(); this.update();
  }
  set hass(value) { this._hass = value; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  state() { return this._hass?.states?.[this.config.entity]?.state; }
  async power(on) {
    const state = this.state();
    if (typeof on !== "boolean" || !["on", "off", "unknown"].includes(state) || this.pending || !this._hass?.callService) return;
    const entity = this.config.entity;
    this.pending = true; this.error = ""; this.update(); let timer;
    try {
      await Promise.race([
        this._hass.callService("switch", on ? "turn_on" : "turn_off", { entity_id: entity }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Request timed out; check the device state before retrying.")), this.serviceTimeout ?? 15000); })
      ]);
    } catch (err) { if (this.config.entity === entity) this.error = err?.message || "Unable to update power."; }
    finally { clearTimeout(timer); if (this.config.entity === entity) { this.pending = false; this.update(); } }
  }
  update() {
    if (!this.config || !this.shadowRoot) return;
    const state = this.state(), known = ["on", "off"].includes(state);
    const status = known ? state === "on" ? "On" : "Off" : state === "unknown" ? "Unknown" : "Unavailable";
    this.shadowRoot.querySelectorAll(".status").forEach(el => { el.textContent = status; });
    this.shadowRoot.querySelectorAll(".device-art").forEach(el => el.classList.toggle("active", state === "on"));
    for (const button of this.shadowRoot.querySelectorAll("[data-power]")) {
      button.disabled = !["on", "off", "unknown"].includes(state) || this.pending || !this._hass?.callService;
      button.setAttribute("aria-pressed", String(known && button.dataset.power === state));
      button.setAttribute("aria-busy", String(this.pending));
    }
    const error = this.shadowRoot.querySelector('[role="alert"]'); error.textContent = this.error; error.hidden = !this.error;
    this.shadowRoot.querySelector(".more-info").disabled = !this._hass?.states?.[this.config.entity];
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);letter-spacing:0;color:var(--primary-text-color,#222)}*{box-sizing:border-box}button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:-2px}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;padding:8px 12px;text-align:left;min-width:0;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff))}.device-art{display:grid;place-items:center;flex-shrink:0;width:32px;height:32px;color:var(--state-icon-color,#999)}.device-art svg{width:28px;height:28px}.device-art.active{color:var(--state-switch-active-color,var(--primary-color,#03a9f4))}.info{flex:1;min-width:0}.name{display:block;font-size:14px;font-weight:500;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status{display:block;font-size:12px;line-height:16px;color:var(--secondary-text-color,#777)}
      dialog{width:340px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);overflow:auto;border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222)}dialog::backdrop{background:#0006}header{display:flex;align-items:center;gap:8px}.title{flex:1;min-width:0;font-size:16px;font-weight:500;overflow-wrap:anywhere}.close,.more-info{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color,#eee)}.detail-status{margin:24px 0;text-align:center;font-size:18px;color:inherit}.power-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px}.power-controls button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:1px solid var(--divider-color,#ddd);border-radius:8px}.power-controls button[aria-pressed=true]{background:var(--secondary-background-color,#eee);border-color:var(--primary-color,#03a9f4)}ha-icon{--mdc-icon-size:20px}footer{display:flex;justify-content:flex-end;margin-top:16px}[role=alert]{font-size:12px;color:var(--error-color,#c62828);overflow-wrap:anywhere;margin-top:12px}[hidden]{display:none!important}
    </style><button class="entry identity" aria-haspopup="dialog"><span class="device-art">${art}</span><span class="info"><span class="name"></span><span class="status"></span></span></button><dialog><header><span class="device-art">${art}</span><span class="title"></span><button class="close" aria-label="Close" title="Close"><ha-icon icon="mdi:close"></ha-icon></button></header><div class="status detail-status"></div><div class="power-controls" role="group" aria-label="Power"><button data-power="on" aria-label="Turn on"><ha-icon icon="mdi:power"></ha-icon>On</button><button data-power="off" aria-label="Turn off"><ha-icon icon="mdi:power-off"></ha-icon>Off</button></div><div role="alert" hidden></div><footer><button class="more-info" aria-label="More information" title="More information"><ha-icon icon="mdi:information-outline"></ha-icon></button></footer></dialog>`;
    const dialog = this.shadowRoot.querySelector("dialog"), name = this.config.name || "Toilet Seat";
    for (const selector of [".name", ".title"]) { const el = this.shadowRoot.querySelector(selector); el.textContent = name; el.title = name; }
    dialog.setAttribute("aria-label", name);
    this.shadowRoot.querySelector(".identity").onclick = () => dialog.showModal();
    this.shadowRoot.querySelector(".close").onclick = () => dialog.close();
    this.shadowRoot.querySelectorAll("[data-power]").forEach(el => { el.onclick = () => this.power(el.dataset.power === "on"); });
    this.shadowRoot.querySelector(".more-info").onclick = () => {
      dialog.close();
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.config.entity }, bubbles: true, composed: true }));
    };
  }
}
if (!customElements.get("toilet-seat-card")) customElements.define("toilet-seat-card", ToiletSeatCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "toilet-seat-card", name: "Toilet Seat", description: "Toilet seat power control", preview: true });
