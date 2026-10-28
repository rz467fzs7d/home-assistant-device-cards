import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

function setup(config = {}) {
  const window = new Window(); window.eval(readFileSync("dist/home-assistant-device-cards.js", "utf8"));
  const card = window.document.createElement("adguard-card"); window.document.body.append(card);
  const calls = [];
  const hass = { states: {}, callService: async (...args) => calls.push(args) };
  for (const key of ["protection", "filtering", "parental_control", "safe_browsing", "safe_search", "query_log"]) hass.states[`switch.adguard_home_${key}`] = { state: "on", attributes: {} };
  for (const [key, state, unit] of [["dns_queries", "1552998", "queries"], ["dns_queries_blocked", "548381", "queries"], ["dns_queries_blocked_ratio", "35.31", "%"], ["average_processing_speed", "2.84", "ms"], ["parental_control_blocked", "0", "requests"], ["safe_browsing_blocked", "0", "requests"], ["safe_searches_enforced", "15354", "requests"]]) hass.states[`sensor.adguard_home_${key}`] = { state, attributes: { unit_of_measurement: unit } };
  card.setConfig(config); card.hass = hass;
  return { window, card, hass, calls };
}
test("AdGuard registers one compact device with six controls and seven readings", () => {
  const { window, card, calls } = setup();
  assert.ok(window.customCards.some(c => c.type === "adguard-card"));
  assert.equal(card.getCardSize(), 1);
  assert.equal(card.shadowRoot.querySelectorAll('input[role="switch"]').length, 6);
  assert.equal(card.shadowRoot.querySelectorAll(".metric").length, 7);
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Protected");
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /35.31%.*2.84 ms/);
  assert.equal(card.shadowRoot.querySelector('[data-metric="parental_control_blocked"] .value').textContent, "0");
  assert.equal(calls.length, 0);
});
test("opening and closing details never changes DNS settings", () => {
  const { card, calls } = setup();
  card.shadowRoot.querySelector(".identity").click();
  assert.equal(card.shadowRoot.querySelector("dialog").open, true);
  card.shadowRoot.querySelector(".close").click();
  assert.equal(card.shadowRoot.querySelector("dialog").open, false);
  assert.equal(calls.length, 0);
});
test("controls address only their own switch and await HA state rather than inventing success", async () => {
  const { card, hass, calls } = setup();
  await card.toggle("filtering", false);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["switch", "turn_off", { entity_id: "switch.adguard_home_filtering" }]]);
  assert.equal(card.shadowRoot.querySelector('[data-control="filtering"]').checked, true);
  hass.states["switch.adguard_home_filtering"].state = "off"; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector('[data-control="filtering"]').checked, false);
});
test("unavailable controls are disabled, unknown metrics are not zero, and missing stats stay honest", async () => {
  const { card, hass, calls } = setup();
  hass.states["switch.adguard_home_protection"].state = "unavailable";
  delete hass.states["switch.adguard_home_filtering"];
  hass.states["sensor.adguard_home_dns_queries_blocked_ratio"].state = "unknown";
  hass.states["sensor.adguard_home_average_processing_speed"].state = " "; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector(".status").textContent, "Unavailable");
  assert.equal(card.shadowRoot.querySelector('[data-control="protection"]').disabled, true);
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /Unavailable/);
  await card.toggle("filtering", true); assert.equal(calls.length, 0);
});
test("busy operations cannot duplicate requests; service failures remain visible and recover", async () => {
  const { card, hass } = setup(); let reject; let count = 0;
  hass.callService = () => { count++; return new Promise((_, r) => { reject = r; }); };
  const pending = card.toggle("protection", false);
  assert.equal(card.shadowRoot.querySelector('[data-control="protection"]').disabled, true);
  await card.toggle("protection", false); assert.equal(count, 1);
  reject(new Error("Not permitted")); await pending;
  assert.match(card.shadowRoot.querySelector('[role="alert"]').textContent, /Not permitted/);
  assert.equal(card.shadowRoot.querySelector('[data-control="protection"]').disabled, false);
  assert.equal(card.shadowRoot.querySelector('[data-control="protection"]').checked, true);
});
test("prefix and explicit entity bindings are validated and user content stays literal", () => {
  const { card } = setup({ name: "<img src=x>", entity_prefix: "dns", protection_entity: "switch.my_dns" });
  assert.equal(card.shadowRoot.querySelector(".name").textContent, "<img src=x>");
  assert.equal(card.shadowRoot.querySelector("img"), null);
  assert.throws(() => card.setConfig({ entity_prefix: "dns.invalid" }), /prefix/i);
  assert.throws(() => card.setConfig({ protection_entity: "light.dns" }), /switch/i);
  assert.throws(() => card.setConfig({ dns_queries_entity: "switch.dns" }), /sensor/i);
});
test("a stalled service times out without holding DNS controls indefinitely", async () => {
  const { card, hass } = setup(); card.serviceTimeout = 5;
  hass.callService = () => new Promise(() => {});
  await card.toggle("protection", false);
  assert.equal(card.shadowRoot.querySelector('[data-control="protection"]').disabled, false);
  assert.match(card.shadowRoot.querySelector('[role="alert"]').textContent, /timed out/i);
});
test("editor includes bindings and emits config changes without service calls", () => {
  const { window, hass } = setup(); const editor = window.document.createElement("adguard-card-editor");
  editor.setConfig({}); editor.hass = hass;
  const selectors = editor.shadowRoot.querySelectorAll("ha-selector"); assert.equal(selectors.length, 13);
  let changed; editor.addEventListener("config-changed", e => { changed = e.detail.config; });
  selectors[0].dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "switch.custom_protection" } }));
  assert.equal(changed.protection_entity, "switch.custom_protection");
});
