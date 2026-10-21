import { CookingCard } from "./cooking-card.js";

const label = value => String(value || "Unavailable").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

class DishwasherCard extends CookingCard {
  setConfig(config) {
    for (const key of ["progress_entity", "mode_entity"]) if (config[key] && !/^sensor\./.test(config[key])) throw new Error(`${key} must be a sensor`);
    if (config.mode_select_entity && !/^select\./.test(config.mode_select_entity)) throw new Error("mode_select_entity must be a select");
    this.selectedProgram = null;
    super.setConfig({ name: "Dishwasher", ...config });
  }
  get active() { return ["running", "delay"].includes(this.status); }
  get fault() { return this.status === "error" ? "Device Error" : super.fault; }
  get programs() { return this._hass?.states?.[this.config.mode_select_entity]?.attributes?.options || []; }
  get program() { return this.shadowRoot?.querySelector(".program-select")?.value; }
  can(action) {
    if (action !== "start") return super.can(action);
    const ready = !this.busy && !this.fault && ["cancel", "soft_gear", "idle", "ready", "standby"].includes(this.status);
    return ready && (this.config.mode_select_entity
      ? this.available("mode_select_entity") && this.programs.includes(this.program) && this.program !== "neutral_gear"
      : this.actionAvailable("start_entity"));
  }
  render() {
    super.render();
    if (this.config.mode_select_entity) {
      const row = document.createElement("label"); row.className = "field";
      row.innerHTML = '<span>Program</span><select class="program-select" aria-label="Program"></select>';
      row.querySelector("select").onchange = event => { this.selectedProgram = event.target.value; this.update(); };
      this.shadowRoot.querySelector(".fields").append(row);
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
    const status = this.busy || label(this.state("state_entity"));
    const phase = this.status === "running" && this.available("progress_entity") ? label(this.state("progress_entity")) : "";
    root.querySelector(".status").textContent = status;
    root.querySelector(".summary").textContent = [status, phase].filter(Boolean).join(" · ");
    root.querySelector(".machine").classList.toggle("spinning", this.status === "running" && ["pre_wash", "wash", "rinse"].includes(this.state("progress_entity")));
    root.querySelector(".controls").hidden = !this.config.mode_select_entity && !this.config.start_entity && !this.config.stop_entity;
    const facts = root.querySelector(".facts");
    for (const [key, title] of [["mode_entity", "Current Program"], ["progress_entity", "Stage"]]) {
      if (!this.available(key) || (key === "progress_entity" && !this.active)) continue;
      const row = document.createElement("div"); row.className = "fact";
      for (const text of [key === "mode_entity" && this.status === "power_off" ? "Last Program" : title, label(this.state(key))]) { const span = document.createElement("span"); span.textContent = text; row.append(span); }
      facts.append(row);
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
