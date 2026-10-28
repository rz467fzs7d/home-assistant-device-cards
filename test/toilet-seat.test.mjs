import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");
function setup(state = "unknown") {
  const window = new Window(); window.eval(bundle);
  const card = window.document.createElement("toilet-seat-card");
  window.document.body.append(card);
  const calls = [], hass = { states: { "switch.seat": { state, attributes: {} } }, callService: async (...args) => calls.push(args) };
  card.setConfig({ entity: "switch.seat" }); card.hass = hass;
  return { window, card, hass, calls };
}
test("seat is registered, has dedicated art and preserves unknown without fake features", () => {
  const { window, card, calls } = setup();
  assert.ok(window.customCards.some(c => c.type === "toilet-seat-card"));
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Unknown");
  assert.equal(card.shadowRoot.querySelector(".device-art svg").getAttribute("viewBox"), "0 0 24 24");
  assert.equal(card.shadowRoot.querySelectorAll('[role="switch"]').length, 1);
  assert.equal(card.shadowRoot.querySelector('.detail-status'), null);
  assert.equal(card.shadowRoot.querySelector('.power-controls'), null);
  assert.equal(card.shadowRoot.querySelector('[role="switch"]').disabled, true);
  assert.equal(calls.length, 0);
  assert.equal(card.getGridOptions().rows, 1);
});
test("compact power switch preserves unknown and waits for actual HA state", async () => {
  const { card, hass, calls } = setup();
  await card.power(true); assert.equal(calls.length, 0);
  hass.states["switch.seat"].state = "off"; card.hass = hass;
  await card.power(true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["switch", "turn_on", { entity_id: "switch.seat" }]]);
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Off");
  assert.equal(card.shadowRoot.querySelector('[role="switch"]').checked, false);
  hass.states["switch.seat"].state = "on"; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "On");
  assert.equal(card.shadowRoot.querySelector('[role="switch"]').checked, true);
  await card.power(false);
  assert.equal(calls[1][1], "turn_off");
});
test("missing and unavailable devices cannot send commands", async () => {
  const { card, hass, calls } = setup("unavailable");
  await card.power(true);
  assert.equal(card.shadowRoot.querySelector('[role="switch"]').disabled, true);
  delete hass.states["switch.seat"]; card.hass = hass; await card.power(false);
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Unavailable");
  assert.equal(calls.length, 0);
});
test("pending blocks duplicate calls; errors are visible and timeout recovers", async () => {
  const { card, hass, calls } = setup("off");
  let release; hass.callService = (...args) => { calls.push(args); return new Promise(resolve => { release = resolve; }); };
  const pending = card.power(true); await card.power(false);
  assert.equal(calls.length, 1); assert.equal(card.shadowRoot.querySelector('[role="switch"]').disabled, true);
  release(); await pending;
  hass.callService = async () => { throw new Error("Connection failed"); };
  await card.power(true); assert.equal(card.shadowRoot.querySelector('[role="alert"]').textContent, "Connection failed");
  hass.callService = () => new Promise(() => {}); card.serviceTimeout = 5;
  await card.power(true); assert.match(card.shadowRoot.querySelector('[role="alert"]').textContent, /timed out/);
  assert.equal(card.shadowRoot.querySelector('[role="switch"]').disabled, false);
});
test("details, more-info and literal names do not trigger power", () => {
  const { card, calls } = setup(); let entity;
  card.setConfig({ entity: "switch.seat", name: "<img src=x>" });
  assert.equal(card.shadowRoot.querySelector(".name").textContent, "<img src=x>");
  assert.equal(card.shadowRoot.querySelector("img"), null);
  card.shadowRoot.querySelector(".identity").click(); assert.equal(card.shadowRoot.querySelector("dialog").open, true);
  card.addEventListener("hass-more-info", e => { entity = e.detail.entityId; });
  card.shadowRoot.querySelector(".more-info").click(); assert.equal(entity, "switch.seat");
  assert.equal(card.shadowRoot.querySelector("dialog").open, false); assert.equal(calls.length, 0);
  assert.throws(() => card.setConfig({ entity: "light.seat" }), /switch/);
});
test("editor selects a real switch and preserves name", () => {
  const { window, hass } = setup(); const editor = window.document.createElement("toilet-seat-card-editor");
  editor.setConfig({ entity: "switch.seat", name: "Seat" }); editor.hass = hass;
  const selector = editor.shadowRoot.querySelector("ha-selector");
  assert.equal(selector.selector.entity.domain[0], "switch");
  let result; editor.addEventListener("config-changed", e => { result = e.detail.config; });
  selector.dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "switch.new_seat" } }));
  assert.equal(result.entity, "switch.new_seat"); assert.equal(result.name, "Seat");
});
