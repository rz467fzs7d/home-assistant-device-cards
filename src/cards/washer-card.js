const ACTIVE = ["detecting", "running", "drying", "steam_softening", "spinning", "rinsing", "refreshing", "cool_down"];
const READY = ["initial", "pause", "rinse_hold"];
const ASLEEP = ["sleep"];
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
    for (const key of ["total_time_entity", "cycles_entity", "scheduled_finish_entity"]) {
      if (config[key] && !/^sensor\./.test(config[key])) throw new Error(`${key} must be a sensor`);
    }
    for (const key of ["error_entity", "notification_entity"]) {
      if (config[key] && !/^event\./.test(config[key])) throw new Error(`${key} must be an event`);
    }
    if (config.delay_min !== undefined && (!Number.isFinite(config.delay_min) || config.delay_min < 0)) throw new Error("delay_min must be a non-negative number");
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
  get scheduled() { return this.status === "reserved"; }
  get canStop() { return this.active || this.scheduled; }
  get ready() { return READY.includes(this.status); }
  get remote() { return !this.config.remote_start_entity || this.state(this.config.remote_start_entity) === "on"; }
  get startReason() {
    if (this.status === "power_off") return "Turn on the washer and enable Remote Start.";
    if (this.status === "end") return "Prepare the next load and enable Remote Start on the washer.";
    if ((this.ready || this.canStop) && !this.remote) return "Enable Remote Start on the washer.";
    if (ASLEEP.includes(this.status) && !this.options.includes("wake_up")) return "Wake up the washer at the appliance.";
    return "";
  }
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
      .controls{display:flex;align-items:center;gap:12px;min-height:48px}.primary{position:relative;display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:0;border-radius:12px;background:var(--secondary-background-color,#f2f2f2);color:var(--primary-text-color,#222)}.primary ha-icon{--mdc-icon-size:20px}.primary span{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.primary:hover:not(:disabled){background:var(--divider-color,#e5e5e5)}
      .delay{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0;font-size:13px;color:var(--secondary-text-color)}select{min-width:70px;max-width:120px;height:40px;border:1px solid var(--divider-color,#ddd);border-radius:6px;background:var(--card-background-color,#fff);padding:0 8px}
      .remote-line{font-size:12px;color:var(--secondary-text-color);margin-top:16px}.hint{font-size:12px;color:var(--secondary-text-color);margin-top:12px;overflow-wrap:anywhere}.hint:empty{display:none}.facts{display:grid;gap:12px;margin-top:16px;font-size:12px}.facts:empty{display:none}.fact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:12px;align-items:baseline}.fact-label{color:var(--secondary-text-color)}.fact-value{text-align:right;overflow-wrap:anywhere}.event-time{display:block;color:var(--secondary-text-color);font-size:11px;margin-top:3px}.message{font-size:13px;color:var(--error-color,#db4437);margin-top:12px;overflow-wrap:anywhere}.message:empty{display:none}
      footer{display:flex;justify-content:flex-end;margin-top:14px}button:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
      @media(max-width:350px){dialog{padding:16px}.controls{gap:8px}.delay{gap:5px}}
    </style>
    <button class="entry" aria-haspopup="dialog"><ha-icon icon="mdi:washing-machine"></ha-icon><span class="info"><span class="name"></span><div class="summary"></div></span><ha-icon class="remote" icon="mdi:remote"></ha-icon></button>
    <dialog><header><ha-icon icon="mdi:washing-machine"></ha-icon><h2></h2><button class="icon-button close" aria-label="Close" title="Close"><ha-icon icon="mdi:close"></ha-icon></button></header>
    <div class="status-row"><span class="status"></span><span class="finish"></span></div>
    <div class="controls"><button class="primary start" title="Start" aria-label="Start"><ha-icon icon="mdi:play"></ha-icon><span>Start</span></button><button class="primary stop" title="Stop" aria-label="Stop"><ha-icon icon="mdi:stop"></ha-icon><span>Stop</span></button><label class="delay">Delay<select aria-label="Delay"></select></label></div>
    <div class="remote-line"></div><div class="hint"></div><div class="facts"></div><div class="message" role="alert"></div>
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
    root.querySelector(".start").onclick = () => this.operate(false);
    root.querySelector(".stop").onclick = () => this.operate(true);
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
    const finish = Date.parse(this.state(this.scheduled ? this.config.scheduled_finish_entity : this.config.finish_entity));
    const minutes = Number.isFinite(finish) ? Math.max(0, Math.ceil((finish - Date.now()) / 60000)) : null;
    const finishText = (this.active || this.scheduled) && minutes !== null && finish > Date.now() ? `${this.scheduled ? "Scheduled Finish" : "Finishes"} ${new Date(finish).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${this.active ? ` (${minutes} Min)` : ""}` : "";
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
    root.querySelector(".hint").textContent = this.startReason;
    root.querySelector(".status").style.color = this.status === "error" ? "var(--error-color,#db4437)" : "";
    for (const stop of [false, true]) {
      const button = root.querySelector(stop ? ".stop" : ".start");
      button.setAttribute("aria-busy", String(!!this.busy));
      button.disabled = !!this.busy || !!this.pendingDelay || (stop ? !this.canStop || !this.remote : !(this.ready || ASLEEP.includes(this.status)) || !!this.startReason) || !this.options.includes(stop ? "stop" : "start");
      button.title = this.startReason || (stop ? "Stop" : "Start");
    }
    const entity = this._hass.states[this.config.delay_entity], select = root.querySelector("select");
    let values = [];
    if (this.config.delay_entity?.startsWith("input_select.")) values = entity?.attributes?.options || [];
    else if (entity) {
      const { max, step } = entity.attributes || {};
      const min = Math.max(entity.attributes?.min ?? 0, this.config.delay_min ?? 0);
      if (Number.isFinite(min) && Number.isFinite(max) && step > 0 && (max - min) / step <= 100) {
        for (let n = min; n <= max; n += step) values.push(String(Number(n.toFixed(4))));
      }
    }
    const current = entity?.state;
    const unlisted = current !== undefined && !["unknown", "unavailable"].includes(current) && !values.includes(current);
    const key = JSON.stringify([values, unlisted ? current : null]);
    if (select.dataset.options !== key) {
      select.replaceChildren(...values.map(value => {
        const option = document.createElement("option"); option.value = value;
        option.textContent = this.config.delay_entity?.startsWith("number.") ? `${value} ${entity.attributes.unit_of_measurement || "h"}` : value;
        return option;
      }));
      if (unlisted) {
        const option = document.createElement("option"); option.value = current;
        option.textContent = Number(current) === 0 ? "Not Set" : `${current} (Current)`;
        option.disabled = true; select.prepend(option);
      }
      select.dataset.options = key;
    }
    select.value = entity?.state || "";
    select.disabled = !!this.busy || !!this.pendingDelay || !this.ready || !this.remote || !values.length || !entity || ["unknown", "unavailable"].includes(current);
    root.querySelector(".delay").hidden = !this.config.delay_entity;
    this.updateFacts();
  }
  updateFacts() {
    const facts = this.shadowRoot.querySelector(".facts");
    const rows = [];
    const total = this._hass.states[this.config.total_time_entity];
    if ((this.active || this.scheduled || ["pause", "rinse_hold", "initial"].includes(this.status)) && total && !["unknown", "unavailable"].includes(total.state) && Number.isFinite(Number(total.state)) && Number(total.state) > 0) {
      rows.push(["Cycle Duration", `${total.state} ${total.attributes?.unit_of_measurement || "Min"}`]);
    }
    const cycles = this.state(this.config.cycles_entity);
    if (cycles !== undefined && !["unknown", "unavailable"].includes(cycles) && Number.isFinite(Number(cycles))) rows.push(["Wash Cycles", cycles]);
    for (const [entity, title] of [[this.config.notification_entity, "Last Notification"], [this.config.error_entity, "Last Error"]]) {
      const event = this._hass.states[entity];
      const timestamp = /^\d{4}-\d{2}-\d{2}T/.test(event?.state || "") ? Date.parse(event.state) : NaN;
      if (Number.isFinite(timestamp) && event?.attributes?.event_type) rows.push([title, label(event.attributes.event_type), new Date(timestamp).toLocaleString()]);
    }
    const key = JSON.stringify(rows);
    if (facts.dataset.rows === key) return;
    facts.dataset.rows = key;
    facts.replaceChildren(...rows.map(([title, value, time]) => {
      const row = document.createElement("div"); row.className = "fact";
      const name = document.createElement("span"); name.className = "fact-label"; name.textContent = title;
      const text = document.createElement("span"); text.className = "fact-value"; text.textContent = value;
      if (time) { const date = document.createElement("span"); date.className = "event-time"; date.textContent = time; text.append(date); }
      row.append(name, text); return row;
    }));
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
    if (["start", "stop"].includes(option) && !this.remote) throw new Error("Enable Remote Start on the washer.");
    if (!this.options.includes(option)) throw new Error(`Operation unavailable: ${option}`);
    await this._hass.callService("select", "select_option", { entity_id: this.config.operation_entity, option });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  }
  async operate(stop = this.canStop) {
    if (this.busy || this.pendingDelay || this.shadowRoot.querySelector(stop ? ".stop" : ".start").disabled) return;
    if (stop && !window.confirm("Stop the washer?")) return;
    const controller = new AbortController(); this.controller = controller;
    const { signal } = controller;
    this.shadowRoot.querySelector(".message").textContent = "";
    try {
      this.busy = stop ? "Stopping..." : "Starting..."; this.update();
      if (!stop && ASLEEP.includes(this.status)) {
        this.busy = "Waking Up..."; this.update();
        await this.command("wake_up", signal);
        await this.waitFor(() => (this.ready && this.remote) || this.canStop, signal, "Wake up timed out. Check remote start on the washer.");
      }
      if (!stop && this.canStop) return;
      if (!stop && (!this.ready || !this.remote)) throw new Error("Enable Remote Start on the washer before starting.");
      this.busy = stop ? "Stopping..." : "Starting..."; this.update();
      await this.command(stop ? "stop" : "start", signal);
      await this.waitFor(() => stop ? !this.canStop : this.canStop, signal, "Command sent, but the washer has not confirmed the new state.");
    } catch (error) {
      if (error.name !== "AbortError") this.shadowRoot.querySelector(".message").textContent = error.message || String(error);
    } finally {
      if (this.controller === controller) { this.controller = null; this.busy = ""; this.update(); }
    }
  }
  async setDelay(value) {
    if (this.busy || this.pendingDelay || this.shadowRoot.querySelector("select").disabled) return;
    const entity = this.config.delay_entity, select = this.shadowRoot.querySelector("select");
    if (![...select.options].some(option => option.value === value && !option.disabled)) return;
    const controller = new AbortController(); this.controller = controller;
    const { signal } = controller;
    this.pendingDelay = true; this.busy = "Setting Delay..."; this.update();
    this.shadowRoot.querySelector(".message").textContent = "";
    try {
      const number = entity.startsWith("number.");
      await this._hass.callService(number ? "number" : "input_select", number ? "set_value" : "select_option", { entity_id: entity, ...(number ? { value: Number(value) } : { option: value }) });
      await this.waitFor(() => this.state(entity) === value, signal, "Delay sent, but the washer has not confirmed the new value.");
    } catch (error) {
      if (error.name !== "AbortError") this.shadowRoot.querySelector(".message").textContent = error.message || String(error);
    } finally {
      this.pendingDelay = false;
      if (this.controller === controller) { this.controller = null; this.busy = ""; }
      this.update();
    }
  }
}
if (!customElements.get("washer-card")) customElements.define("washer-card", WasherCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "washer-card", name: "Washer", description: "Compact washer tile with wake-before-start controls" });
