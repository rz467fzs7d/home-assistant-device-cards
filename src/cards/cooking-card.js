import { cookingArtCss, applianceSvg } from "./cooking-art.js";

const valid = value => value !== undefined && !["unknown", "unavailable", ""].includes(value);
const normalize = value => String(value || "").trim().toLowerCase();
const decode = value => String(value).replace(/\\u([\da-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const iconButton = (action, icon, label) => `<button class="control ${action}" title="${label}" aria-label="${label}"><ha-icon icon="mdi:${icon}"></ha-icon></button>`;

export class CookingCard extends HTMLElement {
  static getConfigElement() { return document.createElement("cooking-card-editor"); }
  setConfig(config) {
    if (!/^sensor\./.test(config.state_entity || "")) throw new Error("state_entity must be a sensor");
    const kind = this.localName === "dishwasher-card" ? "dishwasher" : this.localName === "air-fryer-card" ? "air-fryer" : "pressure-cooker";
    for (const key of ["stop_entity", "pause_entity", "resume_entity"]) if (config[key] && !/^button\./.test(config[key])) throw new Error(`${key} must be a button`);
    if (config.start_entity && !(kind === "pressure-cooker" ? /^notify\./ : /^button\./).test(config.start_entity)) throw new Error("Invalid start_entity domain");
    for (const key of ["target_time_entity", "target_temperature_entity"]) if (config[key] && !/^number\./.test(config[key])) throw new Error(`${key} must be a number`);
    if (config.modes && (!Array.isArray(config.modes) || config.modes.some(m => !Number.isInteger(m.value) || typeof m.label !== "string"))) throw new Error("modes must contain integer values and labels");
    this.cancel();
    this.config = { name: kind === "air-fryer" ? "Air Fryer" : "Pressure Cooker", timeout: 30, ...config, kind };
    if (!(this.config.timeout > 0 && this.config.timeout <= 120)) throw new Error("timeout must be between 0 and 120 seconds");
    this.attachShadowIfNeeded(); this.render();
  }
  attachShadowIfNeeded() { if (!this.shadowRoot) this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this.checkWait?.(); this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3 }; }
  state(key) { return this._hass?.states?.[this.config[key]]?.state; }
  get status() { return normalize(this.state("state_entity")); }
  get active() { return ["busy", "cooking", "warming", "keeping warm", "booking", "scheduling", "pause", "preheat pause"].includes(this.status); }
  get paused() { return ["pause", "preheat pause"].includes(this.status); }
  get fault() {
    return ["fault_entity", "error_entity"].map(key => this.state(key)).find(v => valid(v) && !["no faults", "no fault", "无故障", "0"].includes(normalize(v))) || (["fault", "设备异常"].includes(this.status) ? this.state("state_entity") : "");
  }
  available(key) { return valid(this.state(key)); }
  actionAvailable(key) { const entity = this._hass?.states?.[this.config[key]]; return !!entity && entity.state !== "unavailable"; }
  can(action) {
    if (this.busy || !this.available("state_entity") || !this.actionAvailable(`${action}_entity`)) return false;
    if (action === "stop") return this.active;
    if (action === "pause") return this.active && !this.paused && ["cooking", "busy"].includes(this.status);
    if (action === "resume") return this.paused && !this.fault;
    return !this.fault && ["fault_entity", "error_entity"].every(key => !this.config[key] || this.available(key)) && ["idle", "standby", "power off", "cooking finished", "preheat finished"].includes(this.status)
      && (!this.config.cover_entity || (this.available("cover_entity") && this.state("cover_entity") !== "有盖未锁好"))
      && (this.config.kind === "air-fryer" || !!this.config.modes?.length);
  }
  cancel() { this.editGeneration = (this.editGeneration || 0) + 1; clearTimeout(this.numberTimer); this.controller?.abort(); this.controller = null; this.busy = ""; }
  disconnectedCallback() { this.cancel(); this.shadowRoot?.querySelector("dialog")?.close(); }
  render() {
    const entryIcon = `<span class="appliance-icon">${applianceSvg(this.config.kind, this.config.icon_variant)}</span>`;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);color:var(--primary-text-color,#222)}*{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit;color:inherit}button{cursor:pointer}button:disabled,input:disabled,select:disabled{opacity:.4;cursor:default}
      .entry{display:flex;align-items:center;gap:12px;width:100%;height:66px;padding:10px 12px;text-align:left;background:var(--ha-card-background,#fff);border:1px solid var(--divider-color,#ddd);border-radius:8px}.entry>ha-icon{--mdc-icon-size:28px;color:var(--state-inactive-color,#999)}.entry.active>ha-icon{color:var(--state-active-color,#ff9800)}.info{min-width:0;flex:1}.name{font-size:14px;font-weight:500;overflow-wrap:anywhere}.summary{font-size:12px;margin-top:3px;color:var(--secondary-text-color,#777);overflow-wrap:anywhere}
      dialog{width:min(420px,calc(100vw - 32px));max-height:85dvh;overflow:auto;padding:20px;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--ha-card-background,#fff);color:inherit}dialog::backdrop{background:#0007}header{display:flex;align-items:center;gap:10px}h2{flex:1;font-size:16px;font-weight:500;margin:0;overflow-wrap:anywhere}header ha-icon{--mdc-icon-size:24px}.control{display:grid;place-items:center;flex-shrink:0;width:40px;height:40px;border:0;border-radius:12px;background:var(--secondary-background-color,#f2f2f2)}.control ha-icon{--mdc-icon-size:20px}.close,.details{border-radius:50%;width:36px;height:36px}.status{text-align:center;font-size:22px;margin-top:24px}.remaining{text-align:center;font-size:12px;color:var(--secondary-text-color,#777);min-height:18px;margin-top:6px}.controls{display:flex;justify-content:center;gap:10px;margin-bottom:20px}.fields{display:grid;gap:12px}.field{display:flex;align-items:center;gap:8px;font-size:13px}.field>span{flex:1;min-width:0}input,select{height:40px;border:1px solid var(--divider-color,#ddd);border-radius:6px;background:var(--card-background-color,#fff);padding:0 8px;min-width:0;max-width:65%}input{width:84px}.facts{display:grid;gap:12px;margin-top:20px;font-size:12px}.fact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px}.fact span:first-child{color:var(--secondary-text-color,#777)}.fact span:last-child{text-align:right;overflow-wrap:anywhere}.message{font-size:13px;color:var(--error-color,#db4437);overflow-wrap:anywhere;margin-top:16px}.message:empty{display:none}footer{display:flex;justify-content:flex-end;margin-top:16px}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
      .controls{margin-top:20px}.field[data-key]{display:grid;grid-template-columns:minmax(0,1fr) 84px 30px;gap:8px}.field[data-key] input{width:100%;max-width:none}.field .unit{text-align:left}.field:not([data-key]) select{flex:0 1 170px}
      dialog{font-size:13px;line-height:1.5}dialog h2{font-size:16px;line-height:1.5}dialog .status{font-size:22px;line-height:1.4}dialog .field,dialog .facts,dialog input,dialog select{font-size:13px;line-height:1.5}dialog .field>span,dialog .fact>span:first-child{color:var(--secondary-text-color,#777)}dialog .unit,dialog .remaining{font-size:12px;line-height:1.5}.facts:empty{display:none}.fact{min-height:24px;align-items:center}
      ${cookingArtCss}
    </style><button class="entry" aria-haspopup="dialog">${entryIcon}<span class="info"><span class="name"></span><div class="summary"></div></span></button>
    <dialog><header>${entryIcon}<h2></h2>${iconButton("close", "close", "Close")}</header><div class="status"></div><div class="remaining"></div><div class="controls">${iconButton("start", "play", "Start")}${iconButton("pause", "pause", "Pause")}${iconButton("resume", "play-pause", "Resume")}${iconButton("stop", "stop", "Stop")}</div><div class="fields"></div><div class="facts"></div><div class="message" role="alert"></div><footer>${iconButton("details", "information-outline", "Device Details")}</footer></dialog>`;
    const root = this.shadowRoot, dialog = root.querySelector("dialog");
    root.querySelector(".name").textContent = root.querySelector("h2").textContent = this.config.name;
    dialog.setAttribute("aria-label", this.config.name);
    root.querySelector(".entry").onclick = () => { this.update(); dialog.showModal(); };
    root.querySelector(".close").onclick = () => { this.cancel(); dialog.close(); this.update(); };
    for (const event of ["cancel", "close"]) dialog.addEventListener(event, () => { this.cancel(); this.update(); });
    for (const action of ["start", "pause", "resume", "stop"]) root.querySelector(`.${action}`).onclick = () => this.operate(action);
    root.querySelector(".details").onclick = () => { this.cancel(); dialog.close(); this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.config.state_entity }, bubbles: true, composed: true })); };
    for (const [key, title] of [["target_temperature_entity", "Temperature"], ["target_time_entity", "Duration"]]) {
      if (!this.config[key]) continue;
      const row = document.createElement("label"); row.className = "field";
      row.innerHTML = `<span>${title}</span><input type="number" aria-label="${title}"><small class="unit"></small>`;
      row.dataset.key = key;
      row.querySelector("input").oninput = event => {
        event.target.dataset.dirty = "true";
        clearTimeout(this.numberTimer);
        this.numberTimer = setTimeout(() => this.saveNumbers(), 700);
      };
      row.querySelector("input").onchange = () => { clearTimeout(this.numberTimer); this.saveNumbers(); };
      root.querySelector(".fields").append(row);
    }
    if (this.config.kind === "pressure-cooker") {
      const row = document.createElement("label"); row.className = "field"; row.innerHTML = '<span>Program</span><select aria-label="Program"></select>';
      for (const mode of this.config.modes || []) { const option = document.createElement("option"); option.value = mode.value; option.textContent = mode.label; row.querySelector("select").append(option); }
      root.querySelector(".fields").append(row);
    }
    this.update();
  }
  update() {
    if (!this.config || !this._hass || !this.shadowRoot) return;
    const root = this.shadowRoot;
    const status = valid(this.state("state_entity")) ? this.state("state_entity").trim() : "Unavailable";
    const left = Number(this.state("remaining_entity"));
    const remaining = this.active && Number.isFinite(left) && left > 0 ? `${left} Min Remaining` : "";
    root.querySelector(".summary").textContent = [this.busy || status, remaining].filter(Boolean).join(" · ");
    root.querySelector(".status").textContent = this.busy || status;
    root.querySelector(".remaining").textContent = remaining;
    root.querySelector(".entry").classList.toggle("active", this.active);
    const display = root.querySelector(".rk-disp"); if (display) display.textContent = remaining ? `${left}m` : "--";
    for (const action of ["start", "pause", "resume", "stop"]) { const button = root.querySelector(`.${action}`); button.hidden = !this.config[`${action}_entity`]; button.disabled = !this.can(action); }
    for (const row of root.querySelectorAll(".field[data-key]")) {
      const entity = this._hass.states[this.config[row.dataset.key]], input = row.querySelector("input");
      const attrs = entity?.attributes || {};
      for (const attr of ["min", "max", "step"]) input[attr] = attrs[attr] ?? "";
      if (!input.dataset.dirty) input.value = valid(entity?.state) ? entity.state : "";
      input.disabled = !!this.busy || this.active || !valid(entity?.state) || !["idle", "standby", "power off", "cooking finished", "preheat finished"].includes(this.status);
      input.title = attrs.unit_of_measurement || "";
      row.querySelector(".unit").textContent = attrs.unit_of_measurement || "";
    }
    const select = root.querySelector("select"); if (select) select.disabled = !!this.busy || this.active || !this.available("state_entity");
    const facts = [];
    for (const [key, title] of [["temperature_entity", "Temperature"], ["cover_entity", "Lid"], ["taste_entity", "Texture"], ["stage_entity", "Cooking Stage"]]) {
      if (key === "stage_entity" && !["busy", "cooking"].includes(this.status)) continue;
      const entity = this._hass.states[this.config[key]];
      if (valid(entity?.state)) facts.push([title, `${decode(entity.state)}${entity.attributes?.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : ""}`]);
    }
    const finished = this.state("finished_entity"); if (/^\d{4}-\d\d-\d\dT/.test(finished || "") && Number.isFinite(Date.parse(finished))) facts.push(["Last Finished", new Date(finished).toLocaleString()]);
    root.querySelector(".facts").replaceChildren(...facts.map(([name, value]) => { const row = document.createElement("div"); row.className = "fact"; for (const text of [name, value]) { const span = document.createElement("span"); span.textContent = text; row.append(span); } return row; }));
    root.querySelector(".message").textContent = this.error || this.fault || "";
  }
  waitFor(predicate, signal) {
    return new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timer); signal.removeEventListener("abort", abort); if (this.checkWait === check) this.checkWait = null; error ? reject(error) : resolve(); };
      const check = () => { if (predicate()) finish(); };
      const abort = () => finish(new DOMException("Cancelled", "AbortError"));
      const timer = setTimeout(() => finish(new Error("The device has not confirmed the change. Check its status before retrying.")), this.config.timeout * 1000);
      this.checkWait = check; signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort(); else check();
    });
  }
  async run(label, operation) {
    if (this.busy) return;
    const controller = new AbortController(); this.controller = controller; this.busy = label; this.error = ""; this.update();
    try { await operation(controller.signal); } catch (error) { if (!controller.signal.aborted) this.error = error.message || String(error); }
    finally { if (this.controller === controller) { this.controller = null; this.busy = ""; this.update(); } }
  }
  callService(domain, service, data, signal) {
    return new Promise((resolve, reject) => {
      const finish = (error, value) => { clearTimeout(timer); signal.removeEventListener("abort", abort); error ? reject(error) : resolve(value); };
      const abort = () => finish(new DOMException("Cancelled", "AbortError"));
      const timer = setTimeout(() => finish(new Error("The device service timed out. Check its status before retrying.")), this.config.timeout * 1000);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      Promise.resolve().then(() => { if (signal.aborted) throw new DOMException("Cancelled", "AbortError"); return this._hass.callService(domain, service, data); }).then(value => finish(null, value), error => finish(error));
    });
  }
  async operate(action) {
    if (!this.can(action)) return;
    if (action === "start" && this.shadowRoot.querySelector('input[data-dirty="true"]')) { this.error = "Wait for the edited settings to be saved before starting."; this.update(); return; }
    if (["start", "stop"].includes(action) && !window.confirm(action === "start" ? "Start cooking? Confirm the appliance and ingredients are ready." : "Stop cooking?")) return;
    const id = this.config[`${action}_entity`], initial = this.status;
    let data = { entity_id: id }, domain = "button", service = "press";
    if (id.startsWith("notify.")) {
      const mode = Number(this.shadowRoot.querySelector("select")?.value);
      if (!this.config.modes?.some(item => item.value === mode)) return;
      domain = "notify"; service = "send_message"; data = { ...data, message: JSON.stringify([mode]) };
    }
    await this.run(`${action.charAt(0).toUpperCase()}${action.slice(1)} Pending`, async signal => {
      await this.callService(domain, service, data, signal);
      if (signal.aborted) return;
      await this.waitFor(() => this.available("state_entity") && this.status !== initial && (action === "stop" ? !this.active : action === "pause" ? this.paused : this.active && !this.paused), signal);
    });
  }
  async saveNumbers() {
    if (this.savingNumbers || this.busy) return;
    const generation = this.editGeneration;
    this.savingNumbers = true;
    try {
      for (const row of this.shadowRoot.querySelectorAll(".field[data-key]")) {
        if (generation !== this.editGeneration) break;
        const input = row.querySelector("input");
        if (input.dataset.dirty) {
          await this.setNumber(row.dataset.key, input);
          if (input.dataset.dirty) break;
        }
      }
    } finally { this.savingNumbers = false; }
  }
  async setNumber(key, input) {
    if (input.disabled || this.busy) return;
    const entity = this._hass.states[this.config[key]], attrs = entity?.attributes || {}, value = Number(input.value);
    if (!input.value.trim() || !Number.isFinite(value) || !Number.isFinite(attrs.min) || !Number.isFinite(attrs.max) || !(attrs.step > 0) || value < attrs.min || value > attrs.max || Math.abs((value - attrs.min) / attrs.step - Math.round((value - attrs.min) / attrs.step)) > 1e-6) { this.error = "Enter a value within the device range and step."; this.update(); return; }
    await this.run("Applying", async signal => {
      await this.callService("number", "set_value", { entity_id: this.config[key], value }, signal);
      if (signal.aborted) return;
      await this.waitFor(() => this.available(key) && Number(this.state(key)) === value, signal);
      delete input.dataset.dirty;
    });
  }
}
customElements.define("air-fryer-card", class extends CookingCard {});
customElements.define("pressure-cooker-card", class extends CookingCard {});
window.customCards = window.customCards || [];
window.customCards.push({ type: "air-fryer-card", name: "Air Fryer", description: "Air fryer controls using existing Xiaomi Home entities." }, { type: "pressure-cooker-card", name: "Pressure Cooker", description: "Pressure cooker programs and status using existing Xiaomi Home entities." });
