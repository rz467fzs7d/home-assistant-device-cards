import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");
function setup(status = "cancel", mode = "eco_wash") {
  const window = new Window(); window.eval(bundle); window.confirm = () => true;
  const card = window.document.createElement("dishwasher-card"); window.document.body.append(card);
  card.setConfig({ state_entity: "sensor.status", progress_entity: "sensor.progress", mode_entity: "sensor.mode", mode_select_entity: "select.program", timeout: .02 });
  const calls = [], hass = { states: { "sensor.status": { state: status }, "sensor.progress": { state: "idle" }, "sensor.mode": { state: "fruit_wash" }, "select.program": { state: mode, attributes: { options: ["neutral_gear", "eco_wash", "fruit_wash"] } } }, callService: async (...args) => { calls.push(args); } };
  card.hass = hass; return { window, card, hass, calls };
}
test("dishwasher registration and live Power Off display do not claim Idle", () => {
  const { card } = setup("power_off", "unavailable");
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Power Off");
  assert.equal(card.shadowRoot.querySelector(".start").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".program-select").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".stop").hidden, false);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, true);
  assert.ok(card.shadowRoot.querySelector(".controls .program-select"));
  assert.match(card.shadowRoot.querySelector(".facts").textContent, /Fruit Wash/);
});
test("program selection is local only; explicit confirmed Start sends exact native option", async () => {
  const { card, hass, calls, window } = setup(); const select = card.shadowRoot.querySelector(".program-select");
  select.value = "fruit_wash"; select.dispatchEvent(new window.Event("change")); card.hass = hass;
  assert.equal(calls.length, 0); assert.equal(select.value, "fruit_wash");
  hass.callService = async (...args) => { calls.push(args); hass.states["sensor.status"].state = "running"; card.hass = hass; };
  await card.operate("start");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["select", "select_option", { entity_id: "select.program", option: "fruit_wash" }]]);
  assert.equal(card.shadowRoot.querySelector(".start").disabled, true);
});
test("cancelled confirmation, running, delay, unknown status and neutral program never start", async () => {
  const { card, hass, calls, window } = setup(); window.confirm = () => false; await card.operate("start");
  window.confirm = () => true;
  for (const status of ["running", "delay", "unavailable", "unknown", "error", "power_off"]) { hass.states["sensor.status"].state = status; card.hass = hass; await card.operate("start"); }
  hass.states["sensor.status"].state = "cancel"; card.hass = hass;
  card.shadowRoot.querySelector(".program-select").value = "neutral_gear"; await card.operate("start");
  assert.equal(calls.length, 0);
});
test("active phase shown, stale idle phase hidden, unknown phase never means door open", () => {
  const { card, hass } = setup("running"); hass.states["sensor.progress"].state = "rinse"; card.hass = hass;
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /Rinse/);
  hass.states["sensor.status"].state = "power_off"; card.hass = hass;
  assert.doesNotMatch(card.shadowRoot.querySelector(".summary").textContent, /Rinse/);
  assert.equal(card.shadowRoot.querySelector(".dw-door"), null);
});
test("sink and cabinet outlines switch together without changing controls", () => {
  const { card, hass, calls } = setup();
  const cabinet = card.shadowRoot.querySelector(".entry svg").innerHTML;
  const config = { ...card.config, icon_variant: "sink" }; card.setConfig(config); card.hass = hass;
  const sink = card.shadowRoot.querySelector(".entry svg").innerHTML;
  assert.notEqual(sink, cabinet);
  assert.match(sink, /M72 8H110/, "sink variant includes its raised dishwasher lid");
  assert.equal(sink, card.shadowRoot.querySelector("header svg").innerHTML);
  assert.equal(calls.length, 0);
  assert.throws(() => card.setConfig({ ...config, icon_variant: "photo" }), /sink or cabinet/);
});
test("visual editor emits the selected dishwasher design", () => {
  const { window } = setup(); const editor = window.document.createElement("cooking-card-editor");
  editor.setConfig({ type: "custom:dishwasher-card", state_entity: "sensor.status" });
  let changed; editor.addEventListener("config-changed", event => { changed = event.detail.config; });
  const select = editor.shadowRoot.querySelector("select"); assert.equal(select.value, "cabinet");
  select.value = "sink"; select.dispatchEvent(new window.Event("change"));
  assert.equal(changed.icon_variant, "sink"); assert.equal(changed.state_entity, "sensor.status");
});
test("start waits for Running readback and surfaces cloud/service errors", async () => {
  for (const fail of [false, true]) {
    const { card, hass } = setup(); if (fail) hass.callService = async () => { throw new Error("Device offline"); };
    await card.operate("start"); assert.match(card.error, fail ? /offline/ : /not confirmed/); assert.equal(card.status, "cancel");
  }
});
test("debug preserves raw cancel, timestamps, local selection and exact blocked reasons without side effects", () => {
  const { card, hass, calls, window } = setup("cancel", "neutral_gear");
  hass.states["sensor.status"].last_changed = "2026-10-23T02:23:12Z";
  hass.states["sensor.status"].attributes = { raw: '<img src=x onerror="alert(1)">' };
  card.hass = hass;
  const debug = card.shadowRoot.querySelector(".status-debug");
  assert.ok(debug);
  debug.open = true;
  let data = JSON.parse(debug.querySelector("pre").textContent);
  assert.equal(data.entities.state_entity.state, "cancel");
  assert.equal(data.entities.state_entity.last_changed, "2026-10-23T02:23:12Z");
  assert.ok(data.start.blocked_reasons.includes("Select A Wash Program"));
  assert.equal(data.last_operation, null);
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Stopped");
  const select = card.shadowRoot.querySelector(".program-select"); select.value = "eco_wash"; select.dispatchEvent(new window.Event("change"));
  data = JSON.parse(debug.querySelector("pre").textContent);
  assert.equal(data.start.enabled, true); assert.equal(data.start.selected_program, "eco_wash");
  assert.equal(data.entities.mode_select_entity.state, "neutral_gear");
  assert.equal(debug.open, true); assert.equal(debug.querySelector("img"), null); assert.equal(calls.length, 0);
  hass.states["sensor.status"].state = "running"; card.hass = hass;
  data = JSON.parse(debug.querySelector("pre").textContent);
  assert.equal(data.transitions.at(-1).status, "running");
  assert.ok(data.start.blocked_reasons.includes("Device State Does Not Allow Start"));
});
test("debug separates service acknowledgment from confirmed device state and retains errors", async () => {
  const { card, hass } = setup();
  await card.operate("start");
  let data = JSON.parse(card.shadowRoot.querySelector(".status-debug pre").textContent);
  assert.equal(data.last_operation.result, "Failed");
  assert.equal(data.last_command.result, "Acknowledged");
  assert.match(data.last_operation.error, /not confirmed/);
  assert.equal(data.last_command.request.data.option, "eco_wash");
  hass.callService = async () => { throw new Error("Device offline"); };
  await card.operate("start");
  data = JSON.parse(card.shadowRoot.querySelector(".status-debug pre").textContent);
  assert.equal(data.last_command.result, "Failed"); assert.match(data.last_command.error, /offline/);
  hass.callService = async () => { hass.states["sensor.status"].state = "running"; card.hass = hass; };
  await card.operate("start");
  data = JSON.parse(card.shadowRoot.querySelector(".status-debug pre").textContent);
  assert.equal(data.last_operation.result, "Confirmed"); assert.equal(data.last_operation.error, null);
});
