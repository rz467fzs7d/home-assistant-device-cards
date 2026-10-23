import { CookingCard } from "./cooking-card.js";

const label = value => String(value || "Unavailable").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

class DishwasherCard extends CookingCard {
  setConfig(config) {
    if (config.icon_variant && !["sink", "cabinet"].includes(config.icon_variant)) throw new Error("icon_variant must be sink or cabinet");
    for (const key of ["progress_entity", "mode_entity"]) if (config[key] && !/^sensor\./.test(config[key])) throw new Error(`${key} must be a sensor`);
    if (config.mode_select_entity && !/^select\./.test(config.mode_select_entity)) throw new Error("mode_select_entity must be a select");
    this.selectedProgram = null;
    this.transitions = [];
    this.observedSignature = null;
    this.lastOperation = null;
    this.lastCommand = null;
    super.setConfig({ name: "Dishwasher", icon_variant: "cabinet", ...config });
  }
  get active() { return ["running", "delay"].includes(this.status); }
  get fault() { return this.status === "error" ? "Device Error" : super.fault; }
  get programs() { return this._hass?.states?.[this.config.mode_select_entity]?.attributes?.options || []; }
  get program() { return this.shadowRoot?.querySelector(".program-select")?.value; }
  get startBlockedReasons() {
    const reasons = [];
    if (this.busy) reasons.push("Operation In Progress");
    if (this.fault) reasons.push(`Device Fault: ${this.fault}`);
    if (!this.available("state_entity")) reasons.push("Status Unavailable");
    else if (!["cancel", "soft_gear", "idle", "ready", "standby"].includes(this.status)) reasons.push("Device State Does Not Allow Start");
    for (const key of ["fault_entity", "error_entity"]) if (this.config[key] && !this.available(key)) reasons.push(`${key} Unavailable`);
    if (this.config.mode_select_entity) {
      if (!this.available("mode_select_entity")) reasons.push("Program Control Unavailable");
      if (!this.programs.includes(this.program) || this.program === "neutral_gear") reasons.push("Select A Wash Program");
    } else if (!this.actionAvailable("start_entity")) reasons.push("Start Action Unavailable");
    return reasons;
  }
  can(action) {
    if (action !== "start") return super.can(action);
    return this.startBlockedReasons.length === 0;
  }
  render() {
    super.render();
    const style = document.createElement("style");
    style.textContent = '.controls{justify-content:flex-start;min-width:0}.program-field{display:block;min-width:0;margin-left:auto;flex:0 1 190px}.program-field select{width:100%;max-width:100%;font-size:13px;text-overflow:ellipsis}.program-field>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}';
    this.shadowRoot.append(style);
    const debugStyle = document.createElement("style");
    debugStyle.textContent = '.status-debug{margin-top:16px;border-top:1px solid var(--divider-color,#ddd);padding-top:12px;font-size:12px;min-width:0}.status-debug summary{cursor:pointer;font-weight:500}.status-debug pre{font-family:monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;margin:10px 0 0}.status-debug summary:focus-visible{outline:2px solid var(--primary-color,#03a9f4)}';
    this.shadowRoot.append(debugStyle);
    const debug = document.createElement("details"); debug.className = "status-debug";
    debug.innerHTML = '<summary>Debug</summary><pre></pre>';
    this.shadowRoot.querySelector("footer").before(debug);
    const entry = this.shadowRoot.querySelector(".entry"), open = entry.onclick;
    entry.onclick = event => { debug.open = false; open(event); };
    if (this.config.mode_select_entity) {
      const row = document.createElement("label"); row.className = "program-field";
      row.innerHTML = '<span>Program</span><select class="program-select" aria-label="Program"></select>';
      row.querySelector("select").onchange = event => { this.selectedProgram = event.target.value; this.update(); };
      this.shadowRoot.querySelector(".controls").append(row);
    }
    this.update();
  }
  update() {
    super.update();
    if (!this.config || !this._hass || !this.shadowRoot) return;
    const root = this.shadowRoot, select = root.querySelector(".program-select");
    if (select) {
      const key = JSON.stringify(this.programs);
      if (select.dataset.options !== key) {
        select.replaceChildren(...this.programs.map(value => { const option = document.createElement("option"); option.value = value; option.textContent = label(value); option.disabled = value === "neutral_gear"; return option; }));
        select.dataset.options = key;
      }
      const current = this.available("mode_select_entity") ? this.state("mode_select_entity") : this.state("mode_entity");
      select.value = this.selectedProgram && this.programs.includes(this.selectedProgram) ? this.selectedProgram : current || "";
      select.disabled = !!this.busy || !this.available("mode_select_entity") || !["cancel", "soft_gear", "idle", "ready", "standby"].includes(this.status);
      root.querySelector(".start").hidden = false;
      root.querySelector(".start").disabled = !this.can("start");
    }
    const status = this.busy || (this.status === "cancel" ? "Stopped" : label(this.state("state_entity")));
    const phase = this.status === "running" && this.available("progress_entity") ? label(this.state("progress_entity")) : "";
    root.querySelector(".status").textContent = status;
    root.querySelector(".summary").textContent = [status, phase].filter(Boolean).join(" · ");
    root.querySelector(".controls").hidden = !this.config.mode_select_entity && !this.config.start_entity && !this.config.stop_entity;
    for (const action of ["start", "stop"]) {
      const button = root.querySelector(`.${action}`); button.hidden = false; button.disabled = !this.can(action);
      button.title = action === "stop" && !this.config.stop_entity ? "Stop Not Exposed By Integration" : action === "stop" ? "Stop" : this.startBlockedReasons.join("; ") || "Start";
    }
    const facts = root.querySelector(".facts");
    for (const [key, title] of [["mode_entity", "Current Program"], ["progress_entity", "Stage"]]) {
      if (!this.available(key) || (key === "progress_entity" && !this.active)) continue;
      const row = document.createElement("div"); row.className = "fact";
      for (const text of [key === "mode_entity" && this.status === "power_off" ? "Last Program" : title, label(this.state(key))]) { const span = document.createElement("span"); span.textContent = text; row.append(span); }
      facts.append(row);
    }
    this.updateDiagnostics();
  }
  updateDiagnostics() {
    const pre = this.shadowRoot?.querySelector(".status-debug pre");
    if (!pre || !this._hass) return;
    const entities = {};
    for (const [key, id] of Object.entries(this.config)) {
      if (!key.endsWith("_entity")) continue;
      const entity = this._hass.states[id];
      entities[key] = { entity_id: id, state: entity?.state ?? null, available: this.available(key), last_changed: entity?.last_changed ?? null, last_updated: entity?.last_updated ?? null, last_reported: entity?.last_reported ?? null, attributes: entity?.attributes ?? {}, missing: !entity };
    }
    const observed = { status: this.state("state_entity") ?? null, stage: this.state("progress_entity") ?? null, program: this.state("mode_entity") ?? null, program_control: this.state("mode_select_entity") ?? null };
    const signature = JSON.stringify(observed);
    if (this.observedSignature !== signature) {
      this.observedSignature = signature;
      this.transitions.push({ observed_at: new Date().toISOString(), ...observed });
      this.transitions = this.transitions.slice(-30);
    }
    pre.textContent = JSON.stringify({
      captured_at: new Date().toISOString(), component_version: __VERSION__,
      normalized_status: this.status, active: this.active, fault: this.fault || null,
      start: { enabled: this.can("start"), blocked_reasons: this.startBlockedReasons, selected_program: this.program || null, selection_is_local: true, confirmation_states: ["running", "delay"] },
      stop: { enabled: this.can("stop"), entity: this.config.stop_entity || null },
      current_error: this.error || null, last_operation: this.lastOperation,
      last_command: this.lastCommand, entities, transitions: this.transitions,
      scope: "Current HA entities and this card session only; not device packet logs or backend log history. Observed timestamps are not device report timestamps."
    }, null, 2);
  }
  async callService(domain, service, data, signal) {
    const command = { requested_at: new Date().toISOString(), request: { domain, service, data }, result: "Pending", error: null };
    this.lastCommand = command; this.updateDiagnostics();
    try {
      const result = await super.callService(domain, service, data, signal);
      command.result = "Acknowledged";
      return result;
    } catch (error) {
      command.result = signal.aborted ? "Cancelled" : "Failed"; command.error = error.message || String(error); throw error;
    } finally { command.finished_at = new Date().toISOString(); this.updateDiagnostics(); }
  }
  async run(title, operation) {
    if (this.busy) return;
    const record = { action: title, started_at: new Date().toISOString(), result: "Pending", error: null };
    this.lastOperation = record;
    let signal;
    try { await super.run(title, async current => { signal = current; await operation(current); }); }
    finally {
      record.result = signal?.aborted ? "Cancelled" : this.error ? "Failed" : "Confirmed";
      record.error = this.error || null; record.finished_at = new Date().toISOString(); this.updateDiagnostics();
    }
  }
  async operate(action) {
    if (action !== "start" || !this.config.mode_select_entity) return super.operate(action);
    if (!this.can("start")) return;
    const program = this.program;
    if (!window.confirm(`Start ${label(program)}? Confirm the dishwasher is loaded and ready.`)) return;
    await this.run("Start Pending", async signal => {
      // Midea E1 select_option starts the cycle; never call it on dropdown change.
      await this.callService("select", "select_option", { entity_id: this.config.mode_select_entity, option: program }, signal);
      if (signal.aborted) return;
      await this.waitFor(() => this.status === "running" || this.status === "delay", signal);
    });
  }
}
customElements.define("dishwasher-card", DishwasherCard);
window.customCards.push({ type: "dishwasher-card", name: "Dishwasher", description: "Dishwasher status and confirmed native program control." });
