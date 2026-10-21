import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");

function setup(status = "sleep", remote = "on") {
  const window = new Window(); window.eval(bundle);
  const card = window.document.createElement("washer-card");
  window.document.body.append(card);
  card.setConfig({ state_entity: "sensor.washer_status", operation_entity: "select.washer_operation", remote_start_entity: "binary_sensor.remote", delay_entity: "number.delay", delay_min: 3, finish_entity: "sensor.finish", total_time_entity: "sensor.total", cycles_entity: "sensor.cycles", scheduled_finish_entity: "sensor.scheduled", error_entity: "event.error", notification_entity: "event.notification", timeout: .06 });
  const calls = [];
  const hass = {
    states: {
      "sensor.washer_status": { state: status },
      "select.washer_operation": { state: "unknown", attributes: { options: ["wake_up", "start", "stop", "power_off"] } },
      "binary_sensor.remote": { state: remote },
      "number.delay": { state: "0", attributes: { min: 0, max: 19, step: 1, unit_of_measurement: "h" } },
      "sensor.finish": { state: new Date(Date.now() + 3600000).toISOString() },
      "sensor.scheduled": { state: new Date(Date.now() + 10800000).toISOString() },
      "sensor.total": { state: "80", attributes: { unit_of_measurement: "min" } },
      "sensor.cycles": { state: "14" },
      "event.error": { state: "unknown", attributes: { event_type: "door_open_error" } },
      "event.notification": { state: "2026-01-02T08:30:00Z", attributes: { event_type: "washing_is_complete" } },
    },
    callService: async (...args) => {
      calls.push(args);
      if (args[0] === "number") { hass.states[args[2].entity_id].state = String(args[2].value); card.hass = hass; }
    }
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
  assert.equal(card.shadowRoot.querySelector(".start").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, false);
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /Finishes/);
});

test("ready device starts directly; Stop waits for status readback", async () => {
  const { card, calls, state, hass, window } = setup("initial");
  hass.callService = async (...args) => { calls.push(args); state(args[2].option === "start" ? "running" : "pause"); };
  await card.operate();
  window.confirm = () => false; await card.operate(); assert.equal(calls.length, 1);
  window.confirm = () => true; await card.operate();
  assert.deepEqual(calls.map(c => c[2].option), ["start", "stop"]);
  assert.equal(card.shadowRoot.querySelector(".start").disabled, false);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".finish").textContent, "");
});

test("wake failure, remote disabled and timeout never fall through to Start", async () => {
  for (const mode of ["cloud", "timeout", "remote"]) {
    const { card, calls, hass } = setup(mode === "remote" ? "initial" : "sleep", "off");
    if (mode === "cloud") hass.callService = async (...args) => { calls.push(args); throw new Error("LG cloud unavailable"); };
    await card.operate();
    assert.ok(calls.every(c => c[2].option === "wake_up"));
    assert.match(card.shadowRoot.querySelector(mode === "remote" ? ".hint" : ".message").textContent, mode === "cloud" ? /LG cloud/ : mode === "timeout" ? /timed out/ : /Enable Remote Start/);
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
  assert.equal(card.shadowRoot.querySelectorAll("select option").length, 18);
  await card.setDelay("0"); await card.setDelay("1"); await card.setDelay("2");
  assert.equal(calls.length, 0, "read-only zero and out-of-profile values must not be sent");
  await card.setDelay("3");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["number", "set_value", { entity_id: "number.delay", value: 3 }]);
  state("running"); await card.setDelay("4"); assert.equal(calls.length, 1);
  assert.equal(card.shadowRoot.querySelector("select").disabled, true);
  state("error"); assert.equal(card.shadowRoot.querySelector(".primary").disabled, true);
});

test("Off and Finished require appliance preparation, with no speculative wake or start", async () => {
  const { card, calls, state } = setup("power_off", "off");
  await card.operate(false);
  assert.deepEqual(calls, []);
  assert.match(card.shadowRoot.querySelector(".hint").textContent, /Turn on the washer/);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, true);
  assert.equal(card.shadowRoot.querySelector("select").disabled, true);
  state("end", "on"); await card.operate(false);
  assert.deepEqual(calls, []);
  assert.match(card.shadowRoot.querySelector(".hint").textContent, /next load/);
});

test("scheduled and rinse hold have distinct display and mutually exclusive controls", () => {
  const { card, state } = setup("reserved");
  assert.equal(card.active, false);
  assert.equal(card.shadowRoot.querySelector(".entry").classList.contains("active"), false);
  assert.equal(card.shadowRoot.querySelector(".start").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, false);
  assert.match(card.shadowRoot.querySelector(".finish").textContent, /Scheduled Finish/);
  assert.ok(!card.shadowRoot.querySelector(".finish").textContent.includes("Min"));
  state("rinse_hold");
  assert.equal(card.active, false);
  assert.equal(card.shadowRoot.querySelector(".start").disabled, false);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".finish").textContent, "");
});

test("Start is confirmed by reserved state when delay is configured", async () => {
  const { card, hass, state } = setup("initial");
  hass.callService = async () => state("reserved");
  await card.operate(false);
  assert.equal(card.shadowRoot.querySelector(".message").textContent, "");
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, false);
});

test("facts show valid data and dated history; event metadata never becomes a live door alert", () => {
  const { card, state, hass } = setup("initial");
  let text = card.shadowRoot.querySelector(".facts").textContent;
  assert.match(text, /Cycle Duration80 min/);
  assert.match(text, /Wash Cycles14/);
  assert.match(text, /Last NotificationWashing Is Complete/);
  assert.ok(!text.includes("Door") && !text.includes("Last Error"));
  state("power_off");
  assert.ok(!card.shadowRoot.querySelector(".facts").textContent.includes("Cycle Duration"));
  hass.states["event.error"].state = "2026-01-01T10:00:00Z"; card.hass = hass;
  assert.match(card.shadowRoot.querySelector(".facts").textContent, /Last ErrorDoor Open Error/);
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Off");
  hass.states["event.error"].state = "0"; card.hass = hass;
  assert.ok(!card.shadowRoot.querySelector(".facts").textContent.includes("Last Error"));
  hass.states["sensor.cycles"].state = "unavailable";
  hass.states["event.notification"].state = "unknown"; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector(".facts").textContent, "");
});

test("delay waits for readback, surfaces errors and never claims success from a service acknowledgment", async () => {
  const { card, calls, hass } = setup("initial");
  hass.callService = async (...args) => { calls.push(args); };
  const result = card.setDelay("3"); await tick();
  assert.equal(card.shadowRoot.querySelector(".start").disabled, true);
  assert.equal(card.shadowRoot.querySelector(".stop").disabled, true);
  assert.equal(card.shadowRoot.querySelector("select").value, "0");
  await result;
  assert.match(card.shadowRoot.querySelector(".message").textContent, /not confirmed/);
  assert.equal(hass.states["number.delay"].state, "0");
  hass.callService = async () => { throw new Error("Service rejected"); };
  await card.setDelay("4");
  assert.equal(card.shadowRoot.querySelector(".message").textContent, "Service rejected");
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
