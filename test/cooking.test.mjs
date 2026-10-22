import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");
function setup(kind = "air-fryer", status = "Standby") {
  const window = new Window(); window.eval(bundle); window.confirm = () => true;
  const card = window.document.createElement(`${kind}-card`); window.document.body.append(card);
  card.setConfig({ state_entity: "sensor.status", start_entity: kind === "air-fryer" ? "button.start" : "notify.start", stop_entity: "button.stop", pause_entity: kind === "air-fryer" ? "button.pause" : undefined, resume_entity: kind === "air-fryer" ? "button.resume" : undefined, remaining_entity: "sensor.left", fault_entity: "sensor.fault", target_temperature_entity: kind === "air-fryer" ? "number.temp" : undefined, recipe_entity: "text.recipe", cover_entity: kind === "pressure-cooker" ? "sensor.cover" : undefined, stage_entity: "sensor.stage", modes: [{ label: "Fine Cook", value: 1 }, { label: "Soup", value: 6 }], timeout: .02 });
  const calls = [], hass = { states: { "sensor.status": { state: status }, "button.start": { state: "unknown" }, "notify.start": { state: "unknown" }, "button.stop": { state: "unknown" }, "button.pause": { state: "unknown" }, "button.resume": { state: "unknown" }, "sensor.left": { state: "20" }, "sensor.fault": { state: "No Faults" }, "sensor.cover": { state: "无盖/有盖已锁好" }, "sensor.stage": { state: "保压阶段" }, "number.temp": { state: "180", attributes: { min: 40, max: 200, step: 1, unit_of_measurement: "°C" } }, "text.recipe": { state: "\\u70e4\\u871c\\u85af" } }, callService: async (...args) => { calls.push(args); } };
  const state = value => { hass.states["sensor.status"].state = value; card.hass = hass; };
  card.hass = hass; return { window, card, calls, hass, state };
}
test("action entities with unknown timestamp remain usable, unavailable entities do not", () => {
  const { card, hass } = setup(); assert.equal(card.can("start"), true);
  hass.states["button.start"].state = "unavailable"; card.hass = hass; assert.equal(card.can("start"), false);
});
test("original appliance silhouette is shared by tile, title and dialog without service calls", () => {
  const designs = [];
  for (const kind of ["air-fryer", "pressure-cooker"]) {
    const { card, calls, state } = setup(kind, kind === "air-fryer" ? "Standby" : "Idle");
    const tile = card.shadowRoot.querySelector(".entry svg").innerHTML;
    assert.ok(card.shadowRoot.querySelector(".entry svg").children.length <= 2, "appliance icons stay symbolic, without panels or buttons");
    assert.equal(tile, card.shadowRoot.querySelector("header svg").innerHTML);
    assert.equal(tile, card.shadowRoot.querySelector(".machine svg").innerHTML);
    assert.equal(card.shadowRoot.querySelector('.entry ha-icon'), null);
    state(kind === "air-fryer" ? "Cooking" : "Busy");
    assert.equal(card.shadowRoot.querySelector(".entry").classList.contains("active"), true);
    assert.equal(calls.length, 0); designs.push(tile);
  }
  assert.notEqual(designs[0], designs[1]);
});
test("trim state, hide stale remaining and stage while idle, decode recipe safely", () => {
  const { card } = setup("air-fryer", "Power Off ");
  assert.equal(card.status, "power off"); assert.equal(card.shadowRoot.querySelector(".remaining").textContent, "");
  assert.match(card.shadowRoot.querySelector(".facts").textContent, /烤蜜薯/); assert.doesNotMatch(card.shadowRoot.querySelector(".facts").textContent, /保压/);
});
test("Start and Stop route through buttons and wait for readback", async () => {
  const { card, hass, calls, state } = setup();
  hass.callService = async (...args) => { calls.push(args); state(args[2].entity_id === "button.start" ? "Cooking" : "Standby"); };
  await card.operate("start"); assert.equal(card.can("stop"), true); assert.equal(card.can("start"), false);
  await card.operate("stop"); assert.deepEqual(calls.map(c => c[2].entity_id), ["button.start", "button.stop"]);
});
test("pressure cooker uses exact mode array and original lid state", async () => {
  const { card, hass, calls, state } = setup("pressure-cooker", "Idle");
  card.shadowRoot.querySelector("select").value = "6";
  hass.callService = async (...args) => { calls.push(args); state("Busy"); };
  await card.operate("start"); assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["notify", "send_message", { entity_id: "notify.start", message: "[6]" }]]);
  assert.match(card.shadowRoot.querySelector(".facts").textContent, /无盖\/有盖已锁好/);
  state("Idle"); hass.states["sensor.cover"].state = "有盖未锁好"; card.hass = hass; assert.equal(card.can("start"), false);
});
test("fault, unavailable status and rejected confirmation cannot start", async () => {
  const { card, hass, calls, state, window } = setup(); window.confirm = () => false; await card.operate("start"); assert.equal(calls.length, 0);
  hass.states["sensor.fault"].state = "NTC Disconnect"; card.hass = hass; assert.equal(card.can("start"), false);
  state("unavailable"); assert.equal(card.can("stop"), false);
});
test("pause and resume are mutually exclusive", async () => {
  const { card, hass, calls, state } = setup("air-fryer", "Cooking");
  hass.callService = async (...args) => { calls.push(args); state(args[2].entity_id === "button.pause" ? "Pause" : "Cooking"); };
  assert.equal(card.can("pause"), true); await card.operate("pause"); assert.equal(card.can("resume"), true); assert.equal(card.can("pause"), false); await card.operate("resume"); assert.equal(calls.length, 2);
});
test("number range validation, dirty editing, exact readback", async () => {
  const { card, hass, calls } = setup(); const input = card.shadowRoot.querySelector("input");
  input.value = "201"; await card.setNumber("target_temperature_entity", input); assert.equal(calls.length, 0);
  input.value = "190"; input.dataset.dirty = "true"; card.hass = hass; assert.equal(input.value, "190");
  await card.operate("start"); assert.equal(calls.length, 0);
  hass.callService = async (...args) => { calls.push(args); hass.states["number.temp"].state = "190"; card.hass = hass; };
  await card.setNumber("target_temperature_entity", input); assert.equal(input.dataset.dirty, undefined); assert.equal(calls[0][2].value, 190);
});
test("service error and no-readback timeout surface without optimistic state", async () => {
  for (const error of [false, true]) {
    const { card, hass } = setup(); if (error) hass.callService = async () => { throw new Error("Device offline"); };
    await card.operate("start"); assert.match(card.error, error ? /offline/ : /not confirmed/); assert.equal(card.status, "standby"); assert.equal(card.busy, "");
  }
});
test("closing cancels pending readback and duplicate actions", async () => {
  const { card, calls } = setup(); const pending = card.operate("start"); await card.operate("start"); await new Promise(resolve => setTimeout(resolve, 0)); card.cancel(); await pending; assert.equal(calls.length, 1); assert.equal(card.error, "");
});
test("a stuck service has a bounded wait and releases the controls", async () => {
  const { card, hass } = setup(); hass.callService = () => new Promise(() => {});
  await card.operate("start"); assert.match(card.error, /timed out/); assert.equal(card.busy, "");
});
