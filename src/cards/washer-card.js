const ACTIVE = ["detecting", "running", "drying", "steam_softening", "spinning", "rinsing", "refreshing", "cool_down", "reserved", "rinse_hold"];
const READY = ["initial", "pause", "end"];
const ASLEEP = ["sleep", "power_off"];
const LABELS = { initial: "Ready", pause: "Paused", power_off: "Off", sleep: "Sleeping", end: "Finished", cool_down: "Cooling Down", steam_softening: "Steam Softening", rinse_hold: "Rinse Hold", reserved: "Scheduled" };
const label = value => LABELS[value] || String(value || "Unavailable").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

class WasherCard extends HTMLElement {
  static getConfigElement() { return document.createElement("washer-card-editor"); }
  static getStubConfig(hass) {
    const ids = Object.keys(hass?.states || {});
    return { type: "custom:washer-card", name: "Washer", state_entity: ids.find(id => /^sensor\..*washer.*current_status$/.test(id)), operation_entity: ids.find(id => /^select\..*washer.*operation$/.test(id)) };
  }
  setConfig(config) {
    if (!/^sensor\./.test(config.state_entity || "") || !/^select\./.test(config.operation_entity || "")) throw new Error("state_entity (sensor) and operation_entity (select) are required");
    if (config.delay_entity && !/^(number|input_select)\./.test(config.delay_entity)) throw new Error("delay_entity must be number or input_select");
    if (config.remote_start_entity && !/^binary_sensor\./.test(config.remote_start_entity)) throw new Error("remote_start_entity must be a binary_sensor");
    if (config.finish_entity && !/^sensor\./.test(config.finish_entity)) throw new Error("finish_entity must be a sensor");
    this.cancel();
    this.config = { name: "Washer", timeout: 30, ...config };
    if (!(this.config.timeout > 0 && this.config.timeout <= 120)) throw new Error("timeout must be between 0 and 120 seconds");
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }
  set hass(value) { this._hass = value; this.checkWait?.(); this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  disconnectedCallback() { this.cancel(); this.shadowRoot?.querySelector("dialog")?.close(); }
  state(id) { return this._hass?.states?.[id]?.state; }
  get status() { return this.state(this.config.state_entity); }
  get active() { return ACTIVE.includes(this.status); }
  get ready() { return READY.includes(this.status); }
  get remote() { return !this.config.remote_start_entity || this.state(this.config.remote_start_entity) === "on"; }
  get options() { return this._hass?.states?.[this.config.operation_entity]?.attributes?.options || []; }
  cancel() { this.controller?.abort(); this.controller = null; this.busy = ""; }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}
      *{box-sizing:border-box}[hidden]{display:none!important}button,select{font:inherit;color:inherit}button{cursor:pointer}button:disabled,select:disabled{opacity:.45;cursor:default}
      .entry{width:100%;height:66px;display:flex;align-items:center;gap:12px;padding:10px 12px;text-align:left;background:var(--ha-card-background,var(--card-background-color,#fff));border:1px solid var(--divider-color,#ddd);border-radius:8px}
      .entry>ha-icon{--mdc-icon-size:28px;color:var(--state-inactive-color,var(--secondary-text-color,#777))}.entry.active>ha-icon{color:var(--state-sensor-active-color,var(--primary-color,#03a9f4))}
      .info{min-width:0;flex:1}.name{font-size:14px;font-weight:500;overflow-wrap:anywhere}.summary{font-size:12px;color:var(--secondary-text-color);margin-top:3px;overflow-wrap:anywhere}
      .remote{--mdc-icon-size:18px;color:var(--state-inactive-color,var(--secondary-text-color,#777))}.remote.on{color:var(--state-binary_sensor-active-color,var(--primary-color,#03a9f4))}
      dialog{color:var(--primary-text-color);background:var(--ha-card-background,var(--card-background-color,#fff));border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:20px;width:min(400px,calc(100vw - 32px));max-height:85dvh;overflow:auto}
      dialog::backdrop{background:rgba(0,0,0,.48)}header{display:flex;align-items:center;gap:10px}header>ha-icon{--mdc-icon-size:24px}h2{font-size:16px;font-weight:500;margin:0;flex:1;overflow-wrap:anywhere}
      .icon-button{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:var(--secondary-background-color,#eee)}.icon-button ha-icon{--mdc-icon-size:20px}
      .status-row{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:12px}.status{font-size:18px;font-weight:500}.finish{text-align:right;font-size:13px;color:var(--secondary-text-color);overflow-wrap:anywhere}
      .controls{display:flex;align-items:center;gap:12px;min-height:48px}.primary{display:flex;align-items:center;justify-content:center;gap:8px;min-width:108px;height:40px;border:0;border-radius:6px;background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}.primary ha-icon{--mdc-icon-size:20px}
      .delay{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0;font-size:13px;color:var(--secondary-text-color)}select{min-width:70px;max-width:120px;height:40px;border:1px solid var(--divider-color,#ddd);border-radius:6px;background:var(--card-background-color,#fff);padding:0 8px}
      .remote-line{font-size:12px;color:var(--secondary-text-color);margin-top:16px}.message{font-size:13px;color:var(--error-color,#db4437);margin-top:12px;overflow-wrap:anywhere}.message:empty{display:none}
      footer{display:flex;justify-content:flex-end;margin-top:14px}button:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
      @media(max-width:350px){dialog{padding:16px}.controls{gap:8px}.primary{min-width:92px}.delay{gap:5px}}
    </style>
    <button class="entry" aria-haspopup="dialog"><ha-icon icon="mdi:washing-machine"></ha-icon><span class="info"><span class="name"></span><div class="summary"></div></span><ha-icon class="remote" icon="mdi:remote"></ha-icon></button>
    <dialog><header><ha-icon icon="mdi:washing-machine"></ha-icon><h2></h2><button class="icon-button close" aria-label="Close" title="Close"><ha-icon icon="mdi:close"></ha-icon></button></header>
    <div class="status-row"><span class="status"></span><span class="finish"></span></div>
    <div class="controls"><button class="primary"><ha-icon></ha-icon><span></span></button><label class="delay">Delay<select aria-label="Delay"></select></label></div>
    <div class="remote-line"></div><div class="message" role="alert"></div>
    <footer><button class="icon-button details" aria-label="Washer Details" title="Washer Details"><ha-icon icon="mdi:information-outline"></ha-icon></button></footer></dialog>`;
    const root = this.shadowRoot, dialog = root.querySelector("dialog");
    root.querySelector(".name").textContent = root.querySelector("h2").textContent = this.config.name;
    dialog.setAttribute("aria-label", this.config.name);
    root.querySelector(".entry").onclick = () => { this.update(); dialog.showModal(); };
    const close = () => { this.cancel(); dialog.close(); this.update(); };
    root.querySelector(".close").onclick = close;
    dialog.addEventListener("cancel", () => { this.cancel(); this.update(); });
    dialog.addEventListener("close", () => { this.cancel(); this.update(); });
    dialog.onclick = event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    };
    root.querySelector(".primary").onclick = () => this.operate();
    root.querySelector("select").onchange = event => this.setDelay(event.target.value);
    root.querySelector(".details").onclick = () => {
      close();
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.config.state_entity }, bubbles: true, composed: true }));
    };
    this.update();
  }
  update() {
    if (!this.config || !this.shadowRoot || !this._hass) return;
    const root = this.shadowRoot;
    const finish = Date.parse(this.state(this.config.finish_entity));
    const minutes = Number.isFinite(finish) ? Math.max(0, Math.ceil((finish - Date.now()) / 60000)) : null;
    const finishText = this.active && minutes !== null ? `Finishes ${new Date(finish).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${minutes} Min)` : "";
    root.querySelector(".entry").classList.toggle("active", this.active);
    root.querySelector(".summary").textContent = [this.busy || label(this.status), finishText].filter(Boolean).join(" · ");
    root.querySelector(".status").textContent = this.busy || label(this.status);
    root.querySelector(".finish").textContent = finishText;
    root.querySelectorAll(".remote").forEach(node => {
      node.hidden = !this.config.remote_start_entity;
      node.classList.toggle("on", this.remote);
      node.title = `Remote Start: ${label(this.state(this.config.remote_start_entity))}`;
    });
    root.querySelector(".remote-line").textContent = this.config.remote_start_entity ? `Remote Start: ${label(this.state(this.config.remote_start_entity))}` : "";
    const button = root.querySelector(".primary");
    button.querySelector("span").textContent = this.active ? "Stop" : "Start";
    button.querySelector("ha-icon").setAttribute("icon", this.active ? "mdi:stop" : "mdi:play");
    button.setAttribute("aria-busy", String(!!this.busy));
    button.disabled = !!this.busy || this.pendingDelay || !(this.active || this.ready || ASLEEP.includes(this.status)) || !this.options.includes(this.active ? "stop" : "start");
    const entity = this._hass.states[this.config.delay_entity], select = root.querySelector("select");
    let values = [];
    if (this.config.delay_entity?.startsWith("input_select.")) values = entity?.attributes?.options || [];
    else if (entity) {
      const { min, max, step } = entity.attributes || {};
      if (Number.isFinite(min) && Number.isFinite(max) && step > 0 && (max - min) / step <= 100) {
        for (let n = min; n <= max; n += step) values.push(String(Number(n.toFixed(4))));
      }
    }
    const key = JSON.stringify(values);
    if (select.dataset.options !== key) {
      select.replaceChildren(...values.map(value => {
        const option = document.createElement("option"); option.value = value;
        option.textContent = this.config.delay_entity?.startsWith("number.") ? `${value} ${entity.attributes.unit_of_measurement || "h"}` : value;
        return option;
      }));
      select.dataset.options = key;
    }
    select.value = entity?.state || "";
    select.disabled = !!this.busy || this.pendingDelay || this.active || !values.includes(entity?.state);
    root.querySelector(".delay").hidden = !this.config.delay_entity;
  }
  waitFor(predicate, signal, message) {
    return new Promise((resolve, reject) => {
      let timer;
      const done = error => {
        clearTimeout(timer); signal.removeEventListener("abort", abort);
        if (this.checkWait === check) this.checkWait = null;
        error ? reject(error) : resolve();
      };
      const abort = () => done(new DOMException("Cancelled", "AbortError"));
      const check = () => {
        if (signal.aborted) abort();
        else if (["error", "unavailable", "unknown"].includes(this.status) || !this.status) done(new Error(`Washer ${label(this.status)}`));
        else if (predicate()) done();
      };
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => done(new Error(message)), this.config.timeout * 1000);
      this.checkWait = check; check();
    });
  }
  async command(option, signal) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!this.options.includes(option)) throw new Error(`Operation unavailable: ${option}`);
    await this._hass.callService("select", "select_option", { entity_id: this.config.operation_entity, option });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  }
  async operate() {
    if (this.busy || this.pendingDelay || this.shadowRoot.querySelector(".primary").disabled) return;
    const stop = this.active;
    if (stop && !window.confirm("Stop the washer?")) return;
    const controller = new AbortController(); this.controller = controller;
    const { signal } = controller;
    this.shadowRoot.querySelector(".message").textContent = "";
    try {
      this.busy = stop ? "Stopping..." : "Starting..."; this.update();
      if (!stop && ASLEEP.includes(this.status)) {
        this.busy = "Waking Up..."; this.update();
        await this.command("wake_up", signal);
        await this.waitFor(() => (this.ready && this.remote) || this.active, signal, "Wake up timed out. Check remote start on the washer.");
      }
      if (!stop && this.active) return;
      if (!stop && (!this.ready || !this.remote)) throw new Error("Enable Remote Start on the washer before starting.");
      this.busy = stop ? "Stopping..." : "Starting..."; this.update();
      await this.command(stop ? "stop" : "start", signal);
      await this.waitFor(() => stop ? !this.active : this.active, signal, "Command sent, but the washer has not confirmed the new state.");
    } catch (error) {
      if (error.name !== "AbortError") this.shadowRoot.querySelector(".message").textContent = error.message || String(error);
    } finally {
      if (this.controller === controller) { this.controller = null; this.busy = ""; this.update(); }
    }
  }
  async setDelay(value) {
    if (this.busy || this.pendingDelay || this.active) return;
    const entity = this.config.delay_entity, select = this.shadowRoot.querySelector("select");
    if (![...select.options].some(option => option.value === value)) return;
    this.pendingDelay = true; this.busy = "Setting Delay..."; this.update();
    this.shadowRoot.querySelector(".message").textContent = "";
    try {
      const number = entity.startsWith("number.");
      await this._hass.callService(number ? "number" : "input_select", number ? "set_value" : "select_option", { entity_id: entity, ...(number ? { value: Number(value) } : { option: value }) });
    } catch (error) { this.shadowRoot.querySelector(".message").textContent = error.message || String(error); }
    finally { this.pendingDelay = false; this.busy = ""; this.update(); }
  }
}
if (!customElements.get("washer-card")) customElements.define("washer-card", WasherCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "washer-card", name: "Washer", description: "Compact washer tile with wake-before-start controls" });
