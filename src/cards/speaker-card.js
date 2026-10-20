import homepod from "../assets/homepod.svg";
import mini from "../assets/homepod-mini.svg";

const FEATURES = { media_pause: 1, volume_set: 4, volume_mute: 8,
  media_previous_track: 16, media_next_track: 32, media_play: 16384 };
const TYPES = {
  "homepod-stereo-card": "HomePod Stereo",
  "apple-theater-card": "Apple Theater",
  "general-speaker-stereo-card": "Speaker Stereo"
};
const available = state => state && !["unknown", "unavailable"].includes(state.state);
const active = state => ["playing", "buffering"].includes(state?.state);
const displayActive = state => Boolean(state?.state && available(state) && !["off", "standby"].includes(state.state));
const stateLabel = state => (state?.state || "unavailable").replaceAll("_", " ").replace(/\b[a-z]/g, letter => letter.toUpperCase());
const mediaEntity = id => typeof id === "string" && /^media_player\.[a-z0-9_]+$/.test(id);

class SpeakerCard extends HTMLElement {
  static getConfigElement() { return document.createElement("speaker-card-editor"); }
  static getStubConfig(hass) {
    const ids = Object.keys(hass?.states || {}).filter(mediaEntity);
    return { type: `custom:${this.cardType}`, entity: ids[0] || "",
      speakers: this.cardType === "general-speaker-stereo-card" ? [] : ids.slice(0, 2) };
  }
  setConfig(config) {
    const type = this.constructor.cardType;
    if (!mediaEntity(config.entity)) throw new Error("A primary media_player entity is required");
    if (config.playback_entities && (!Array.isArray(config.playback_entities) ||
      config.playback_entities.some(id => !mediaEntity(id)))) {
      throw new Error("playback_entities must contain media_player entities");
    }
    const speakers = (config.speakers || []).slice();
    if (speakers.some(id => !mediaEntity(id))) throw new Error("Speakers must be media_player entities");
    if (new Set(speakers).size !== speakers.length) throw new Error("Speakers must be unique");
    if (config.speaker_state_entities && (!Array.isArray(config.speaker_state_entities) ||
      config.speaker_state_entities.length !== speakers.length ||
      config.speaker_state_entities.some(id => id && !mediaEntity(id)))) {
      throw new Error("speaker_state_entities must match speakers and contain media_player entities");
    }
    if (type === "homepod-stereo-card" && speakers.length !== 2) throw new Error("Select two speakers");
    if (type === "apple-theater-card" && ![2, 4].includes(speakers.length)) throw new Error("Select two or four speakers");
    if (type === "general-speaker-stereo-card" && ![0, 2].includes(speakers.length)) throw new Error("Select two speakers or use only the stereo entity");
    for (const key of ["volume_entity", "television"]) {
      if (config[key] && !mediaEntity(config[key])) throw new Error(`${key} must be a media_player entity`);
    }
    if (config.model && !["homepod", "mini"].includes(config.model)) throw new Error("model must be homepod or mini");
    this.config = { ...config, type: `custom:${type}`, name: config.name || TYPES[type], speakers };
    this._playbackId = config.entity;
    this.pending = false;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }
  set hass(value) { this._hass = value; this.update(); }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 12, rows: 1, min_columns: 6 }; }
  disconnectedCallback() { this.shadowRoot?.querySelector("dialog")?.close(); }
  get playbackId() { return this._playbackId || this.config.entity; }
  get primary() { return this._hass?.states[this.playbackId]; }
  get volumeId() {
    return this.playbackId === this.config.entity
      ? this.config.volume_entity || this.config.entity : this.playbackId;
  }
  get volume() { return this._hass?.states[this.volumeId]; }
  resolvePlayback() {
    const ids = [this.config.entity, ...(this.config.playback_entities || [])];
    const states = this._hass.states;
    // Retain a paused source so its Play button resumes that same session.
    this._playbackId = ids.find(id => active(states[id])) ||
      (ids.includes(this.playbackId) && states[this.playbackId]?.state === "paused" ? this.playbackId : null) ||
      ids.find(id => states[id]?.state === "paused") || this.config.entity;
  }
  speakerState(index) {
    const native = this._hass?.states[this.config.speakers[index]];
    const activity = this._hass?.states[this.config.speaker_state_entities?.[index]];
    if (native?.state === "playing") return native;
    return available(activity) ? activity : native;
  }
  supports(service) {
    const state = service.startsWith("volume_") ? this.volume : this.primary;
    return available(state) && Boolean((state.attributes?.supported_features || 0) & FEATURES[service]);
  }
  moreInfo(entity) {
    this.shadowRoot.querySelector("dialog").close();
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }));
  }
  iconMarkup() {
    const type = this.constructor.cardType;
    if (type === "general-speaker-stereo-card") return '<ha-icon icon="mdi:speaker-multiple"></ha-icon>';
    return `<span class="pair ${type === "apple-theater-card" ? "theater" : ""}" aria-hidden="true">
      ${type === "apple-theater-card" ? '<ha-icon icon="mdi:television"></ha-icon>' : ""}
      <i></i><i></i>${this.config.speakers.length === 4 ? "<i></i><i></i>" : ""}</span>`;
  }
  render() {
    const icon = `data:image/svg+xml,${encodeURIComponent(this.config.model === "mini" ? mini : homepod)}`;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;min-width:0;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);color:var(--primary-text-color)}
      *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;color:inherit}button:disabled{opacity:.35;cursor:default}
      button:focus-visible,input:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .tile{height:66px;display:flex;align-items:center;border:1px solid var(--divider-color,#ddd);border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff));padding-right:8px}
      .entry{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border:0;background:none;text-align:left}
      .art{width:36px;height:36px;flex:none;color:var(--state-media_player-inactive-color,var(--state-inactive-color,var(--secondary-text-color)));display:grid;place-items:center}
      .art.active{color:var(--state-media_player-active-color,var(--state-active-color,var(--primary-color)))}
      .art>ha-icon{--mdc-icon-size:28px}.pair{display:block;width:36px;height:36px;position:relative;transform:scale(.85)}
      .pair i{position:absolute;width:18px;height:30px;background:currentColor;mask:url("${icon}") center/contain no-repeat;-webkit-mask:url("${icon}") center/contain no-repeat}
      .pair i:first-of-type{left:-1px;top:3px}.pair i:nth-of-type(2){right:-1px;top:3px}
      .theater ha-icon{position:absolute;top:-3px;left:4px;--mdc-icon-size:28px}
      .theater i{width:21px;height:25px}.theater i:first-of-type{top:12px;left:-5px}.theater i:nth-of-type(2){top:12px;right:-5px}
      .theater i:nth-of-type(3){top:0;left:-6px}.theater i:nth-of-type(4){top:0;right:-6px}
      .text{min-width:0}.name{font-size:14px;font-weight:500}.summary,.media{font-size:12px;color:var(--secondary-text-color);margin-top:3px}
      .text>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.text .media:empty{display:none}
      .tile .media:not(:empty)+.summary{display:none}
      .icon-button{border:0;border-radius:50%;background:var(--secondary-background-color,#f4f4f4);width:40px;height:40px;flex:none;display:inline-grid;place-items:center}
      dialog{color:inherit;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#ddd);border-radius:8px;width:min(420px,calc(100vw - 32px));padding:20px;max-height:85dvh;overflow:auto}
      dialog::backdrop{background:rgba(0,0,0,.48)}header{display:flex;align-items:center;gap:12px;margin-bottom:20px}h2{font-size:18px;font-weight:500;flex:1;min-width:0;overflow-wrap:anywhere;margin:0}
      .now{min-height:64px;display:flex;flex-direction:column;justify-content:center;text-align:center;overflow-wrap:anywhere}.now .media{font-size:16px;color:var(--primary-text-color)}.artist{font-size:13px;color:var(--secondary-text-color);margin-top:5px}
      .now .media:empty,.artist:empty{display:none}
      .source{font-size:12px;color:var(--secondary-text-color);margin-top:8px}.source:empty{display:none}
      .transport{min-height:48px;display:flex;justify-content:center;gap:20px;margin:24px 0}.transport .icon-button{width:48px;height:48px}
      .volume{display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center;gap:8px;margin:24px 0}
      .volume .mute{grid-column:1;grid-row:1}.volume input{grid-column:2;grid-row:1;width:100%;min-width:0;margin:0;accent-color:var(--primary-color)}
      output{grid-column:3;grid-row:1;font-size:12px;text-align:center}
      .speakers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;border-top:1px solid var(--divider-color,#ddd);padding-top:16px}
      .speaker{border:0;background:none;text-align:center;padding:14px 4px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}.speaker span{display:block;font-size:13px;overflow-wrap:anywhere}.speaker small{display:block;color:var(--secondary-text-color)}
      .speaker-art{display:block;width:40px;height:40px;margin-bottom:4px;color:var(--state-media_player-inactive-color,var(--state-inactive-color,var(--secondary-text-color)))}
      .speaker-art.homepod{background:currentColor;mask:url("${icon}") center/contain no-repeat;-webkit-mask:url("${icon}") center/contain no-repeat}
      .speaker-art ha-icon{--mdc-icon-size:40px}.speaker.active .speaker-art{color:var(--state-media_player-active-color,var(--state-active-color,var(--primary-color)))}.speaker.unavailable .speaker-art{color:var(--state-unavailable-color,var(--secondary-text-color));opacity:.4}
      .unavailable small{color:var(--error-color,#db4437)}.error{color:var(--error-color,#db4437);font-size:13px;overflow-wrap:anywhere}.error:empty{display:none}
      .details{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}[hidden]{display:none!important}
    </style>
    <div class="tile"><button class="entry" aria-haspopup="dialog"><span class="art">${this.iconMarkup()}</span><span class="text"><div class="name"></div><div class="media"></div><div class="summary"></div></span></button>
    <button class="icon-button quick" data-action="play"></button></div>
    <dialog><header><span class="art">${this.iconMarkup()}</span><h2></h2><button class="icon-button close" aria-label="Close" title="Close"><ha-icon icon="mdi:close"></ha-icon></button></header>
    <div class="now"><div class="media"></div><div class="artist"></div><div class="summary"></div><div class="source"></div></div>
    <div class="transport"><button class="icon-button" data-action="media_previous_track" title="Previous" aria-label="Previous"><ha-icon icon="mdi:skip-previous"></ha-icon></button><button class="icon-button" data-action="play"></button><button class="icon-button" data-action="media_next_track" title="Next" aria-label="Next"><ha-icon icon="mdi:skip-next"></ha-icon></button></div>
    <div class="volume"><button class="icon-button mute" data-action="volume_mute"></button><input aria-label="Volume" type="range" min="0" max="100" step="1"><output></output></div>
    <div class="speakers"></div><div class="details"></div><div class="error" role="alert"></div></dialog>`;
    const root = this.shadowRoot;
    root.querySelector(".name").textContent = this.config.name;
    root.querySelector("h2").textContent = this.config.name;
    const dialog = root.querySelector("dialog");
    dialog.setAttribute("aria-label", this.config.name);
    root.querySelector(".entry").onclick = () => dialog.showModal();
    root.querySelector(".close").onclick = () => dialog.close();
    dialog.onclick = event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    };
    root.querySelectorAll("[data-action]").forEach(button => {
      button.onclick = () => {
        let service = button.dataset.action;
        if (service === "play") service = this.primary?.state === "playing" ? "media_pause" : "media_play";
        return this.command(service, service === "volume_mute" ? { is_volume_muted: !this.volume?.attributes?.is_volume_muted } : {});
      };
    });
    const slider = root.querySelector("input");
    slider.oninput = () => { root.querySelector("output").textContent = `${slider.value}%`; };
    slider.onchange = () => this.command("volume_set", { volume_level: Number(slider.value) / 100 });
    const positions = this.config.speakers.length === 4
      ? ["Front Left", "Front Right", "Rear Left", "Rear Right"] : ["Left", "Right"];
    this.config.speakers.forEach((id, index) => {
      const button = document.createElement("button");
      button.className = "speaker";
      button.innerHTML = this.constructor.cardType === "general-speaker-stereo-card"
        ? '<i class="speaker-art" aria-hidden="true"><ha-icon icon="mdi:speaker"></ha-icon></i><span></span><small></small>'
        : '<i class="speaker-art homepod" aria-hidden="true"></i><span></span><small></small>';
      button.querySelector("span").textContent = positions[index];
      button.title = id;
      button.onclick = () => this.moreInfo(id);
      root.querySelector(".speakers").append(button);
    });
    for (const [id, label, iconName] of [[this.config.entity, "Player Details", "mdi:information-outline"], [this.config.television, "Television", "mdi:television"]]) {
      if (!id) continue;
      const button = document.createElement("button");
      button.className = "icon-button";
      button.title = label; button.setAttribute("aria-label", label);
      button.innerHTML = `<ha-icon icon="${iconName}"></ha-icon>`;
      button.onclick = () => this.moreInfo(id);
      root.querySelector(".details").append(button);
    }
    this.update();
  }
  update() {
    if (!this.config || !this._hass) return;
    this.resolvePlayback();
    const root = this.shadowRoot, state = this.primary, attrs = state?.attributes || {};
    root.querySelector(".source").textContent = this.config.playback_entities?.length
      ? attrs.friendly_name || this.playbackId : "";
    const groupActive = [state, ...this.config.speakers.map((_, index) => this.speakerState(index))].some(active) ||
      displayActive(this._hass.states[this.config.television]);
    const missing = this.config.speakers.filter((_, index) => !available(this.speakerState(index))).length;
    const volume = this.volume?.attributes?.volume_level;
    root.querySelectorAll(".summary").forEach(el => { el.textContent =
      `${stateLabel(state)}${typeof volume === "number" ? ` · ${Math.round(volume * 100)}%` : ""}${missing ? ` · ${missing} Unavailable` : ""}`; });
    root.querySelectorAll(".media").forEach(el => { el.textContent = ["playing", "paused", "buffering"].includes(state?.state) ? attrs.media_title || "" : ""; });
    root.querySelector(".artist").textContent = ["playing", "paused", "buffering"].includes(state?.state) ? attrs.media_artist || attrs.app_name || "" : "";
    if (groupActive && !active(state)) {
      root.querySelector(".tile .summary").textContent = `On${missing ? ` · ${missing} Unavailable` : ""}`;
    }
    root.querySelector(".tile").classList.toggle("active", groupActive);
    root.querySelectorAll(".art").forEach(el => el.classList.toggle("active", groupActive));
    root.querySelectorAll(".speaker").forEach((el, index) => {
      const speaker = this.speakerState(index);
      el.querySelector("small").textContent = stateLabel(speaker);
      el.classList.toggle("unavailable", !available(speaker));
      el.classList.toggle("active", active(speaker));
    });
    root.querySelector(".speakers").hidden = !this.config.speakers.length;
    root.querySelectorAll("[data-action]").forEach(button => {
      let service = button.dataset.action;
      if (service === "play") {
        const playing = state?.state === "playing";
        service = playing ? "media_pause" : "media_play";
        button.innerHTML = `<ha-icon icon="mdi:${playing ? "pause" : "play"}"></ha-icon>`;
        button.title = playing ? "Pause" : "Play"; button.setAttribute("aria-label", button.title);
      }
      if (service === "volume_mute") {
        const muted = this.volume?.attributes?.is_volume_muted;
        button.innerHTML = `<ha-icon icon="mdi:${muted ? "volume-off" : "volume-high"}"></ha-icon>`;
        button.title = muted ? "Unmute" : "Mute"; button.setAttribute("aria-label", button.title);
      }
      button.hidden = !this.supports(service);
      button.disabled = this.pending || !this.supports(service);
    });
    const slider = root.querySelector("input");
    root.querySelector(".volume").hidden = !this.supports("volume_set") && !this.supports("volume_mute");
    slider.hidden = !this.supports("volume_set");
    slider.disabled = this.pending || !this.supports("volume_set") || typeof volume !== "number";
    if (root.activeElement !== slider) {
      slider.value = typeof volume === "number" ? Math.round(volume * 100) : 0;
      root.querySelector("output").textContent = typeof volume === "number" ? `${Math.round(volume * 100)}%` : "--";
    }
  }
  async command(service, data = {}) {
    if (!Object.hasOwn(FEATURES, service) || this.pending || !this.supports(service)) return;
    if (service === "volume_set" && (!Number.isFinite(data.volume_level) || data.volume_level < 0 || data.volume_level > 1)) return;
    if (service === "volume_mute" && typeof data.is_volume_muted !== "boolean") return;
    this.pending = true;
    this.shadowRoot.querySelector(".error").textContent = "";
    this.update();
    try {
      await this._hass.callService("media_player", service, { ...data, entity_id: service.startsWith("volume_") ? this.volumeId : this.playbackId });
    } catch (error) {
      this.shadowRoot.querySelector(".error").textContent = error?.message || String(error);
      if (!this.shadowRoot.querySelector("dialog").open) this.shadowRoot.querySelector("dialog").showModal();
    } finally { this.pending = false; this.update(); }
  }
}
for (const [type, name] of Object.entries(TYPES)) {
  class DeviceSpeakerCard extends SpeakerCard { static cardType = type; }
  if (!customElements.get(type)) customElements.define(type, DeviceSpeakerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type, name, description: "A compact panel for an existing paired audio system" });
}
