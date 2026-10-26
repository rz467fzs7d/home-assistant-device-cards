import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");
const config = { name: "Plant Monitor", moisture_entity: "sensor.soil", conductivity_entity: "sensor.ec", illuminance_entity: "sensor.light", temperature_entity: "sensor.temp" };
function setup() {
  const window = new Window(); window.eval(bundle);
  const card = window.document.createElement("plant-monitor-card"); window.document.body.append(card);
  const calls = [];
  const hass = { states: {
    "sensor.soil": { state: "54", attributes: { unit_of_measurement: "%" } },
    "sensor.ec": { state: "215", attributes: { unit_of_measurement: "\u03bcS/cm" } },
    "sensor.light": { state: "0", attributes: { unit_of_measurement: "lx" } },
    "sensor.temp": { state: "25.3", attributes: { unit_of_measurement: "\u00b0C" } },
  }, callService: async (...args) => calls.push(args) };
  card.setConfig(config); card.hass = hass;
  return { window, card, hass, calls };
}
test("plant monitor registers and combines four real readings, including zero", () => {
  const { window, card, calls } = setup();
  assert.ok(window.customCards.some(item => item.type === "plant-monitor-card"));
  assert.equal(card.shadowRoot.querySelectorAll(".metric").length, 4);
  assert.equal(card.shadowRoot.querySelector('.metric[data-key="illuminance_entity"] .value').textContent, "0");
  assert.match(card.shadowRoot.textContent, /215/);
  assert.equal(card.shadowRoot.querySelector('.metric[data-key="conductivity_entity"] .unit').textContent, "\u03bcS/cm");
  assert.equal(card.shadowRoot.querySelectorAll(".device-art svg").length, 2);
  assert.equal(calls.length, 0);
});
test("plant monitor is one ordinary tile with four readings visible", () => {
  const { card } = setup();
  assert.equal(card.getCardSize(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(card.getGridOptions())), { columns: 6, rows: 1, min_columns: 3 });
  assert.equal(card.shadowRoot.querySelector(".entry .metric"), null);
  assert.equal(card.shadowRoot.querySelectorAll(".entry .tile-reading").length, 4);
  assert.equal(card.shadowRoot.querySelector('.tile-reading[data-key="moisture_entity"] .tile-value').textContent, "54");
  assert.equal(card.shadowRoot.querySelector('.tile-reading[data-key="illuminance_entity"] .tile-value').textContent, "0");
  assert.equal(card.shadowRoot.querySelectorAll("dialog .detail").length, 4);
});
test("unavailable data is explicit, missing entities cannot open another sensor", () => {
  const { card, hass, calls } = setup();
  hass.states["sensor.soil"].state = "unavailable";
  delete hass.states["sensor.ec"];
  hass.states["sensor.temp"].state = "not-a-number";
  card.hass = hass;
  for (const key of ["moisture_entity", "conductivity_entity", "temperature_entity"]) {
    assert.equal(card.shadowRoot.querySelector(`.metric[data-key="${key}"] .value`).textContent, "Unavailable");
    assert.equal(card.shadowRoot.querySelector(`.tile-reading[data-key="${key}"] .tile-value`).textContent, "\u2014");
  }
  assert.equal(card.shadowRoot.querySelector('.metric[data-key="conductivity_entity"]').disabled, true);
  assert.equal(card.shadowRoot.querySelector('.metric[data-key="moisture_entity"]').disabled, false);
  assert.equal(calls.length, 0);
});
test("identity opens live details; each reading opens only its own entity history", () => {
  const { card, hass, calls } = setup(); const events = [];
  card.addEventListener("hass-more-info", event => events.push(event.detail.entityId));
  card.shadowRoot.querySelector(".identity").click();
  assert.equal(card.shadowRoot.querySelector("dialog").open, true);
  hass.states["sensor.soil"].state = "55"; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector('.detail[data-key="moisture_entity"] .reading').textContent, "55 %");
  card.shadowRoot.querySelector('.detail[data-key="temperature_entity"]').click();
  assert.deepEqual(events, ["sensor.temp"]);
  assert.equal(card.shadowRoot.querySelector("dialog").open, false);
  card.shadowRoot.querySelector('[data-key="conductivity_entity"].metric').click();
  assert.deepEqual(events, ["sensor.temp", "sensor.ec"]);
  assert.equal(calls.length, 0);
});
test("plant monitor validates sensor bindings and keeps user text literal", () => {
  const { card } = setup();
  assert.throws(() => card.setConfig({ moisture_entity: "switch.outlet" }), /sensor/);
  assert.throws(() => card.setConfig({}), /sensor/i);
  card.setConfig({ ...config, name: '<img src=x onerror="alert(1)">' });
  assert.equal(card.shadowRoot.querySelector(".name").textContent, '<img src=x onerror="alert(1)">');
  assert.equal(card.shadowRoot.querySelector("img"), null);
});
test("plant editor exposes four sensor selectors and emits binding changes", () => {
  const { window, hass } = setup();
  const editor = window.document.createElement("plant-monitor-card-editor");
  editor.setConfig(config); editor.hass = hass;
  const selectors = [...editor.shadowRoot.querySelectorAll("ha-selector")];
  assert.equal(selectors.length, 4);
  assert.ok(selectors.every(node => node.selector.entity.domain[0] === "sensor"));
  let changed; editor.addEventListener("config-changed", event => { changed = event.detail.config; });
  selectors[0].dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "sensor.new_soil" } }));
  assert.equal(changed.moisture_entity, "sensor.new_soil");
  assert.equal(changed.temperature_entity, "sensor.temp");
});
