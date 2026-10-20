import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");
function setup(type = "homepod-stereo-card", extra = {}) {
  const window = new Window();
  window.eval(bundle);
  const card = window.document.createElement(type);
  window.document.body.append(card);
  card.setConfig({ type: `custom:${type}`, entity: "media_player.main",
    speakers: ["media_player.left", "media_player.right"], ...extra });
  const calls = [];
  card.hass = { states: {
    "media_player.main": { state: "playing", attributes: { supported_features: 16445, media_title: "<Song>", volume_level: 0.2 } },
    "media_player.left": { state: "off", attributes: {} },
    "media_player.right": { state: "unavailable", attributes: {} }
  }, callService: async (...args) => { calls.push(args); } };
  return { window, card, calls };
}
test("registers three cards, shows media safely and reports individual availability", () => {
  for (const type of ["homepod-stereo-card", "apple-theater-card", "general-speaker-stereo-card"]) {
    const { card } = setup(type);
    assert.equal(card.shadowRoot.querySelector(".media").textContent, "<Song>");
    assert.equal(card.shadowRoot.querySelectorAll("song").length, 0);
    assert.match(card.shadowRoot.querySelector(".summary").textContent, /1 Unavailable/);
    assert.equal(card.shadowRoot.querySelectorAll(".speaker").length, 2);
    assert.equal(card.shadowRoot.querySelectorAll(".speaker .speaker-art").length, 2);
  }
});
test("controls target only primary; volume can target a different entity", async () => {
  const { card, calls } = setup("apple-theater-card", { volume_entity: "media_player.volume" });
  card._hass.states["media_player.volume"] = { state: "on", attributes: { supported_features: 4, volume_level: 0.4 } };
  await card.command("media_pause");
  await card.command("volume_set", { volume_level: 0.3 });
  assert.deepEqual(calls.map(c => [c[1], c[2].entity_id]), [["media_pause", "media_player.main"], ["volume_set", "media_player.volume"]]);
  await card.command("volume_set", { volume_level: 5 });
  await card.command("join");
  assert.equal(calls.length, 2);
});
test("missing, unsupported, pending controls do not send commands and errors are visible", async () => {
  const { card, calls } = setup();
  await card.command("turn_on");
  card.pending = true;
  await card.command("media_pause");
  card.pending = false;
  card._hass.states["media_player.main"].state = "unavailable";
  await card.command("media_pause");
  assert.equal(calls.length, 0);
  card._hass.states["media_player.main"].state = "playing";
  card._hass.callService = async () => { throw new Error("Service rejected"); };
  await card.command("media_pause");
  assert.match(card.shadowRoot.querySelector(".error").textContent, /Service rejected/);
  assert.equal(card.pending, false);
});
test("validates channels and entities; theater supports four speakers", () => {
  const { card } = setup();
  assert.throws(() => card.setConfig({ entity: "switch.x", speakers: [] }), /media_player/);
  assert.throws(() => card.setConfig({ entity: "media_player.x", speakers: ["media_player.x"] }), /two/);
  const theater = setup("apple-theater-card", { speakers: ["a", "b", "c", "d"].map(x => `media_player.${x}`) }).card;
  assert.equal(theater.shadowRoot.querySelectorAll(".speaker").length, 4);
  assert.match(theater.shadowRoot.textContent, /Rear Right/);
  assert.throws(() => theater.setConfig({ entity: "media_player.x", speakers: ["media_player.a", "media_player.a"] }), /unique/);
  assert.doesNotThrow(() => setup("general-speaker-stereo-card", { speakers: [] }));
});
test("editor exposes filtered entity selectors and theater layout", () => {
  const { window, card } = setup("apple-theater-card");
  const editor = card.constructor.getConfigElement();
  editor.setConfig(card.config);
  editor.hass = card._hass;
  assert.equal(card.shadowRoot.querySelector(".speaker span").textContent, "Left");
  assert.equal(editor.shadowRoot.querySelector(".channels ha-selector").label, "Left");
  let config;
  editor.addEventListener("config-changed", e => { config = e.detail.config; });
  const selector = editor.shadowRoot.querySelector("ha-selector");
  assert.equal(selector.selector.entity.domain, "media_player");
  selector.dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "media_player.new" } }));
  assert.equal(config.entity, "media_player.new");
  const layout = editor.shadowRoot.querySelector('[data-field="layout"]');
  layout.value = "4";
  layout.dispatchEvent(new window.Event("change"));
  assert.equal(config.speakers.length, 4);
  assert.equal(editor.shadowRoot.querySelector(".channels ha-selector").label, "Front left");
});

test("playing audio or an enabled display activates the group; paused audio stays gray", () => {
  const { card } = setup("apple-theater-card", {
    television: "media_player.tv",
    speaker_state_entities: ["media_player.ma_left", "media_player.ma_right"]
  });
  card._hass.states["media_player.main"].state = "off";
  card._hass.states["media_player.ma_right"] = { state: "standby" };
  const art = card.shadowRoot.querySelector(".tile .art");
  for (const state of ["buffering", "playing"]) {
    card._hass.states["media_player.ma_left"] = { state };
    card.update();
    assert.equal(art.classList.contains("active"), true, state);
    assert.equal(card.shadowRoot.querySelectorAll(".speaker.active").length, 1);
    assert.match(card.shadowRoot.querySelector(".tile .summary").textContent, /^On/);
  }
  for (const state of ["on", "idle", "paused", "off", "standby", "unknown", "unavailable"]) {
    card._hass.states["media_player.ma_left"] = { state };
    card.update();
    assert.equal(art.classList.contains("active"), false, state);
  }
  card._hass.states["media_player.tv"] = { state: "on" };
  card.update();
  assert.equal(art.classList.contains("active"), true, "physical display activates group");
  assert.equal(card.shadowRoot.querySelectorAll(".speaker.active").length, 0);
  assert.equal(card.volumeId, "media_player.main");
});
