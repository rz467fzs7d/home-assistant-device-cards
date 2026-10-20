class SpeakerEditor extends HTMLElement {
  setConfig(config) {
    this.config = { ...config, speakers: [...(config.speakers || [])] };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }
  set hass(value) {
    this._hass = value;
    this.shadowRoot?.querySelectorAll("ha-selector").forEach(el => { el.hass = value; });
  }
  emit(patch) {
    this.config = { ...this.config, ...patch };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  selectField(label, field, options, value, change) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const select = document.createElement("select");
    select.dataset.field = field;
    for (const [id, name] of options) {
      const option = document.createElement("option");
      option.value = id; option.textContent = name; select.append(option);
    }
    select.value = value;
    select.onchange = () => change(select.value);
    wrapper.append(select);
    return wrapper;
  }
  entityField(label, value, change) {
    const selector = document.createElement("ha-selector");
    selector.hass = this._hass;
    selector.selector = { entity: { domain: "media_player" } };
    selector.label = label; selector.value = value || undefined;
    selector.addEventListener("value-changed", event => { event.stopPropagation(); change(event.detail.value || ""); });
    return selector;
  }
  render() {
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color)}.fields{display:grid;gap:16px}
      label{display:grid;gap:6px;font-size:13px}input,select{box-sizing:border-box;width:100%;padding:12px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:inherit;font:inherit}
      ha-selector{display:block;min-width:0}.channels{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      @media(max-width:400px){.channels{grid-template-columns:1fr}}
    </style><div class="fields"></div>`;
    const root = this.shadowRoot.querySelector(".fields");
    const label = document.createElement("label"); label.textContent = "Name";
    const input = document.createElement("input"); input.value = this.config.name || "";
    input.onchange = () => this.emit({ name: input.value }); label.append(input);
    root.append(label, this.entityField("Primary player", this.config.entity, value => this.emit({ entity: value })),
      this.entityField("Volume player (optional)", this.config.volume_entity, value => this.emit({ volume_entity: value })));
    const playback = this.entityField("Additional Playback Sources (optional)",
      this.config.playback_entities || [], value => this.emit({ playback_entities: value || [] }));
    playback.selector = { entity: { domain: "media_player", multiple: true } };
    root.append(playback);
    const theater = this.config.type === "custom:apple-theater-card";
    const general = this.config.type === "custom:general-speaker-stereo-card";
    if (!general) root.append(this.selectField("Speaker model", "model",
      [["homepod", "HomePod"], ["mini", "HomePod mini"]], this.config.model || "homepod",
      model => this.emit({ model })));
    if (theater || general) {
      root.append(this.selectField("Speaker layout", "layout",
        theater ? [["2", "Stereo pair"], ["4", "Front and rear pairs"]] : [["0", "Single stereo entity"], ["2", "Left and right entities"]],
        String(this.config.speakers.length || (theater ? 2 : 0)), value => {
          this.emit({ speakers: Array.from({ length: Number(value) }, (_, i) => this.config.speakers[i] || ""),
            ...(this.config.speaker_state_entities ? { speaker_state_entities: Array.from({ length: Number(value) }, (_, i) => this.config.speaker_state_entities[i] || "") } : {}) });
          this.render();
        }));
    }
    const channels = document.createElement("div"); channels.className = "channels";
    const count = theater ? (this.config.speakers.length === 4 ? 4 : 2) : general ? this.config.speakers.length : 2;
    const positions = count === 4 ? ["Front left", "Front right", "Rear left", "Rear right"] : ["Left", "Right"];
    for (let i = 0; i < count; i++) {
      channels.append(this.entityField(positions[i], this.config.speakers[i], value => {
        const speakers = Array.from({ length: count }, (_, j) => this.config.speakers[j] || "");
        speakers[i] = value; this.emit({ speakers });
      }));
      channels.append(this.entityField(`${positions[i]} activity entity (optional)`, this.config.speaker_state_entities?.[i], value => {
        const entities = Array.from({ length: count }, (_, j) => this.config.speaker_state_entities?.[j] || "");
        entities[i] = value; this.emit({ speaker_state_entities: entities });
      }));
    }
    root.append(channels);
    if (theater) root.append(this.entityField("Television (optional)", this.config.television, value => this.emit({ television: value })));
  }
}
if (!customElements.get("speaker-card-editor")) customElements.define("speaker-card-editor", SpeakerEditor);
