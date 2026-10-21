import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");

function setup(status = "sleep", remote = "on") {
  const window = new Window(); window.eval(bundle);
  const card = window.document.createElement("washer-card");
  window.document.body.append(card);
  card.setConfig({ state_entity: "sensor.washer_status", operation_entity: "select.washer_operation", remote_start_entity: "binary_sensor.remote", delay_entity: "number.delay", finish_entity: "sensor.finish", timeout: .04 });
  const calls = [];
  const hass = {
    states: {
      "sensor.washer_status": { state: status },
      "select.washer_operation": { state: "unknown", attributes: { options: ["wake_up", "start", "stop", "power_off"] } },
      "binary_sensor.remote": { state: remote },
      "number.delay": { state: "0", attributes: { min: 0, max: 19, step: 1, unit_of_measurement: "h" } },
      "sensor.finish": { state: new Date(Date.now() + 3600000).toISOString() },
    },
    callService: async (...args) => { calls.push(args); }
  };
  const state = (value, enabled = remote) => {
    hass.states["sensor.washer_status"].state = value;
    hass.states["binary_sensor.remote"].state = enabled;
    card.hass = hass;
  };
  card.hass = hass;
  return { window, card, calls, hass, state };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("Start wakes first and waits for actual readiness and remote permission", async () => {
  const { card, calls, state, hass } = setup("sleep", "off");
  const original = hass.callService;
  hass.callService = async (...args) => { await original(...args); if (args[2].option === "start") state("running", "on"); };
  const result = card.operate(); await tick();
  await card.operate();
  assert.deepEqual(calls.map(c => c[2].option), ["wake_up"]);
  state("initial", "off"); await tick();
  assert.equal(calls.length, 1, "must not start with remote disabled");
  state("initial", "on"); await result;
  assert.deepEqual(calls.map(c => c[2].option), ["wake_up", "start"]);
  assert.equal(card.shadowRoot.querySelector(".primary span").textContent, "Stop");
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /Finishes/);
});

test("ready device starts directly; Stop waits for status readback", async () => {
  const { card, calls, state, hass, window } = setup("initial");
  hass.callService = async (...args) => { calls.push(args); state(args[2].option === "start" ? "running" : "pause"); };
  await card.operate();
  window.confirm = () => false; await card.operate(); assert.equal(calls.length, 1);
  window.confirm = () => true; await card.operate();
  assert.deepEqual(calls.map(c => c[2].option), ["start", "stop"]);
  assert.equal(card.shadowRoot.querySelector(".primary span").textContent, "Start");
  assert.equal(card.shadowRoot.querySelector(".finish").textContent, "");
});

test("wake failure, remote disabled and timeout never fall through to Start", async () => {
  for (const mode of ["cloud", "timeout", "remote"]) {
    const { card, calls, hass } = setup(mode === "remote" ? "initial" : "power_off", "off");
    if (mode === "cloud") hass.callService = async (...args) => { calls.push(args); throw new Error("LG cloud unavailable"); };
    await card.operate();
    assert.ok(calls.every(c => c[2].option === "wake_up"));
    assert.match(card.shadowRoot.querySelector(".message").textContent, mode === "cloud" ? /LG cloud/ : mode === "timeout" ? /timed out/ : /Enable Remote Start/);
    assert.equal(card.busy, "");
  }
});

test("closing or disconnecting cancels pending Start even if wake reply arrives later", async () => {
  for (const disconnect of [false, true]) {
    const { card, calls, hass, state } = setup();
    let finish;
    hass.callService = (...args) => { calls.push(args); return new Promise(resolve => { finish = resolve; }); };
    const result = card.operate();
    if (disconnect) card.remove(); else card.shadowRoot.querySelector(".close").click();
    state("initial"); finish(); await result;
    assert.deepEqual(calls.map(c => c[2].option), ["wake_up"]);
  }
});

test("unavailable/error states disable controls; delay uses number entity and is locked while active", async () => {
  const { card, calls, state } = setup("unknown");
  assert.equal(card.shadowRoot.querySelector(".primary").disabled, true);
  await card.operate(); assert.equal(calls.length, 0);
  state("initial");
  assert.equal(card.shadowRoot.querySelectorAll("select option").length, 20);
  await card.setDelay("3");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["number", "set_value", { entity_id: "number.delay", value: 3 }]);
  state("running"); await card.setDelay("4"); assert.equal(calls.length, 1);
  assert.equal(card.shadowRoot.querySelector("select").disabled, true);
  state("error"); assert.equal(card.shadowRoot.querySelector(".primary").disabled, true);
});

test("cancelling during readiness wait removes observers and prevents a later Start", async () => {
  const { card, calls, state } = setup();
  const result = card.operate(); await tick();
  assert.equal(typeof card.checkWait, "function");
  card.cancel(); await result;
  state("initial"); await tick();
  assert.equal(card.checkWait, null);
  assert.deepEqual(calls.map(c => c[2].option), ["wake_up"]);
});

test("no optimistic success when Start command is not confirmed; external start does not start twice", async () => {
  const { card, calls } = setup("initial");
  await card.operate();
  assert.match(card.shadowRoot.querySelector(".message").textContent, /not confirmed/);
  assert.equal(card.status, "initial"); assert.equal(calls.length, 1);
  const other = setup();
  const result = other.card.operate(); await tick(); other.state("running"); await result;
  assert.deepEqual(other.calls.map(c => c[2].option), ["wake_up"]);
});

test("visual editor emits entity changes and optional fields can be removed", () => {
  const { window, card } = setup();
  const editor = card.constructor.getConfigElement(); editor.setConfig(card.config); editor.hass = card._hass;
  let config;
  editor.addEventListener("config-changed", event => { config = event.detail.config; });
  editor.shadowRoot.querySelector("ha-selector").dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "sensor.changed" } }));
  assert.equal(config.state_entity, "sensor.changed");
});
