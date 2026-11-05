import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const bundle = () => readFileSync('dist/home-assistant-device-cards.js', 'utf8');
const windows = [];
afterEach(async () => { for (const window of windows.splice(0)) { window.document.body.replaceChildren(); await window.happyDOM.abort(); } });
function setup() {
  const window = new Window(); windows.push(window); window.eval(bundle());
  assert.equal(typeof window.customElements.get('petkit-litter-card'), 'function', 'Petkit card is not implemented');
  const card = window.document.createElement('petkit-litter-card'); window.document.body.append(card);
  const states = {}, add = (id, state, attributes = {}) => states[id] = { entity_id: id, state, attributes };
  add('sensor.box_device_status', 'online_ac'); add('sensor.box_state', 'idle'); add('sensor.box_error', 'No error');
  add('binary_sensor.box_toilet_occupied', 'off'); add('sensor.box_litter_level', '82', { unit_of_measurement: '%' });
  add('sensor.visits', '3', { date: '2026-11-05', time_zone: 'Asia/Shanghai', total: 3, unidentified: 2, complete: true,
    pets: [{ id: '1', name: 'First', count: 0 }, { id: '2', name: 'Second', count: 1 }] });
  for (const action of ['scoop', 'dump_litter', 'level_litter']) add('button.box_' + action, 'unknown');
  add('button.box_action_pause', 'unavailable'); add('switch.box_auto_clean', 'on');
  const calls = [], hass = { states, callService: async (...args) => calls.push(args) };
  card.now = () => new Date('2026-11-05T04:00:00Z');
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits' }); card.hass = hass;
  return { window, card, hass, calls, add };
}
test('pets, zero visits and explicit unidentified visits reconcile with today total', () => {
  const { card, calls } = setup();
  assert.equal(card.shadowRoot.querySelector('.pet-rows').textContent, 'First0Second1Unidentified2');
  assert.equal(card.shadowRoot.querySelector('.today-total').textContent, '3');
  assert.equal(calls.length, 0); assert.equal(card.getGridOptions().rows, 1);
});
test('stale, incomplete or inconsistent daily statistics never become fabricated zeroes', () => {
  const { card, hass } = setup();
  for (const change of [{ date: '2026-11-04' }, { complete: false }, { unidentified: 9 }]) {
    const old = { ...hass.states['sensor.visits'].attributes };
    Object.assign(hass.states['sensor.visits'].attributes, change); card.hass = hass;
    assert.equal(card.shadowRoot.querySelector('.today-total').textContent, '\u2014');
    assert.doesNotMatch(card.shadowRoot.querySelector('.pets').textContent, /Unidentified\s*0/);
    hass.states['sensor.visits'].attributes = old;
  }
  card.now = () => new Date('2026-11-05T16:00:00Z'); card.update();
  assert.equal(card.shadowRoot.querySelector('.today-total').textContent, '\u2014');
});
test('opening details and staging a motor command send nothing; confirm rechecks occupancy', async () => {
  const { card, hass, calls } = setup();
  card.shadowRoot.querySelector('.entry').click(); assert.ok(card.shadowRoot.querySelector('dialog').open);
  card.stage('scoop'); assert.equal(calls.length, 0);
  hass.states['binary_sensor.box_toilet_occupied'].state = 'on'; card.hass = hass;
  await card.confirmAction(); assert.equal(calls.length, 0);
  hass.states['binary_sensor.box_toilet_occupied'].state = 'off'; card.hass = hass;
  card.stage('scoop'); await card.confirmAction();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['button', 'press', { entity_id: 'button.box_scoop' }]]);
  assert.match(card.shadowRoot.querySelector('.feedback').textContent, /Request sent/);
  assert.equal(hass.states['sensor.box_state'].state, 'idle');
  await card.confirmAction(); assert.equal(calls.length, 1);
  card.remove();
});
test('offline, unknown occupancy, busy, faults and unavailable controls block unsafe commands', async () => {
  const { card, hass, calls } = setup();
  for (const [id, state] of [['sensor.box_device_status', 'offline'], ['binary_sensor.box_toilet_occupied', 'unknown'],
    ['sensor.box_state', 'cleaning'], ['sensor.box_error', 'Motor fault'], ['button.box_scoop', 'unavailable']]) {
    const old = hass.states[id].state; hass.states[id].state = state; card.hass = hass;
    card.stage('scoop'); await card.confirmAction(); assert.equal(calls.length, 0);
    hass.states[id].state = old; card.hass = hass;
  }
});
test('switch settings require known state, respect readback, and expose failures', async () => {
  const { card, hass, calls } = setup();
  await card.setting('auto_clean', false);
  assert.equal(calls[0][1], 'turn_off'); assert.equal(hass.states['switch.box_auto_clean'].state, 'on');
  hass.states['switch.box_auto_clean'].state = 'unknown'; card.hass = hass;
  await card.setting('auto_clean', true); assert.equal(calls.length, 1);
  hass.states['switch.box_auto_clean'].state = 'on';
  hass.callService = async () => { throw new Error('Rejected'); };
  await card.setting('auto_clean', false); assert.match(card.shadowRoot.querySelector('.feedback').textContent, /Rejected/);
});
test('names remain literal and the editor keeps independent sensor bindings', () => {
  const { window, card, hass } = setup();
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', name: '<img src=x>' });
  assert.equal(card.shadowRoot.querySelector('.name').textContent, '<img src=x>');
  assert.equal(card.shadowRoot.querySelector('img'), null);
  assert.throws(() => card.setConfig({ entity: 'switch.box' }), /sensor/);
  const editor = window.document.createElement('petkit-litter-card-editor');
  editor.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits' }); editor.hass = hass;
  assert.ok(editor.shadowRoot.querySelectorAll('ha-selector').length >= 2);
});

test('explicit zero totals survive rendering and malformed rows fail closed', () => {
  const { card, hass } = setup();
  Object.assign(hass.states['sensor.visits'].attributes, { total: 0, unidentified: 0,
    pets: [{ id: '1', name: 'First', count: 0 }] });
  hass.states['sensor.visits'].state = '0'; card.hass = hass;
  assert.equal(card.shadowRoot.querySelector('.today-total').textContent, '0');
  assert.equal(card.shadowRoot.querySelector('.pet-rows').textContent, 'First0Unidentified0');
  for (const malformed of [undefined, [null], [{ id: '1', count: -1 }]]) {
    hass.states['sensor.visits'].attributes.pets = malformed; card.hass = hass;
    assert.equal(card.shadowRoot.querySelector('.today-total').textContent, '\u2014');
  }
});

test('pending and stalled requests never retry or claim a cycle completed', async () => {
  const { card, hass, calls } = setup();
  let release;
  hass.callService = (...args) => { calls.push(args); return new Promise(resolve => { release = resolve; }); };
  card.serviceTimeout = 5;
  card.stage('dump'); const request = card.confirmAction();
  card.stage('scoop'); await card.confirmAction(); assert.equal(calls.length, 1);
  await request; assert.match(card.shadowRoot.querySelector('.feedback').textContent, /timed out/);
  release(); await Promise.resolve();
  assert.doesNotMatch(card.shadowRoot.querySelector('.feedback').textContent, /completed|Request sent/);
  assert.equal(calls.length, 1);
});
