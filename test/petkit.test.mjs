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

test('entry defaults to a full row with a bare theme-colored outline icon', () => {
  const { card, hass } = setup();
  assert.equal(card.getGridOptions().columns, 12);
  const art = card.shadowRoot.querySelector('.entry .device-art');
  assert.equal(art.classList.contains('active'), false);
  assert.equal(art.querySelector('svg').getAttribute('fill'), 'none');
  assert.equal(art.querySelector('svg').getAttribute('stroke'), 'currentColor');
  hass.states['sensor.box_device_status'].state = 'offline'; card.hass = hass;
  assert.equal(art.classList.contains('active'), false);
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
test('opening details sends nothing and one action click sends one request without confirmation', async () => {
  const { card, hass, calls } = setup();
  card.shadowRoot.querySelector('.entry').click(); assert.ok(card.shadowRoot.querySelector('dialog').open);
  assert.equal(calls.length, 0);
  card.shadowRoot.querySelector('[data-action="scoop"]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['button', 'press', { entity_id: 'button.box_scoop' }]]);
  assert.equal(card.shadowRoot.querySelector('.confirmation'), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(card.shadowRoot.querySelector('.feedback').textContent, /Request sent/);
  assert.equal(hass.states['sensor.box_state'].state, 'idle');
  await card.action('scoop'); assert.equal(calls.length, 1);
  card.remove();
});
test('offline, unknown occupancy, busy, faults and unavailable controls block unsafe commands', async () => {
  const { card, hass, calls } = setup();
  for (const [id, state] of [['sensor.box_device_status', 'offline'], ['binary_sensor.box_toilet_occupied', 'on'], ['binary_sensor.box_toilet_occupied', 'unknown'],
    ['sensor.box_state', 'cleaning'], ['sensor.box_error', 'Motor fault'], ['button.box_scoop', 'unavailable']]) {
    const old = hass.states[id].state; hass.states[id].state = state; card.hass = hass;
    await card.action('scoop'); assert.equal(calls.length, 0);
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
  const request = card.action('dump');
  await card.action('scoop'); assert.equal(calls.length, 1);
  await request; assert.match(card.shadowRoot.querySelector('.feedback').textContent, /timed out/);
  release(); await Promise.resolve();
  assert.doesNotMatch(card.shadowRoot.querySelector('.feedback').textContent, /completed|Request sent/);
  assert.equal(calls.length, 1);
});

test('three operation slots replace their active operation with state-driven pause or continue', () => {
  const { card, hass, add, calls } = setup();
  const root = card.shadowRoot;
  assert.equal(root.querySelectorAll('.action').length, 3);
  assert.equal(root.querySelector('[data-action="pause"]'), null);
  add('button.box_action_pause', 'unknown'); add('button.box_action_continue', 'unknown');
  for (const [state, slot, action] of [['cleaning', 'scoop', 'pause'], ['dumping', 'dump', 'pause'],
    ['leveling', 'level', 'pause'], ['cleaning_paused', 'scoop', 'continue'],
    ['dumping_paused', 'dump', 'continue']]) {
    hass.states['sensor.box_state'].state = state; card.hass = hass;
    const button = root.querySelector(`[data-slot="${slot}"]`);
    assert.equal(button.dataset.action, action);
    assert.equal(button.disabled, false);
    assert.match(button.textContent, action === 'pause' ? /Pause/ : /Continue/);
    assert.equal(root.querySelectorAll('.action').length, 3);
  }
  hass.states['sensor.box_state'].state = 'idle'; card.hass = hass;
  assert.deepEqual([...root.querySelectorAll('.action')].map(b => b.dataset.action), ['scoop', 'dump', 'level']);
  assert.equal(calls.length, 0);
});

test('a reported safety pause cannot be resumed even if occupancy readback still says clear', async () => {
  const { card, hass, add, calls } = setup();
  add('button.box_action_continue', 'unknown');
  for (const state of ['cleaning_paused_pet_entered', 'dumping_paused_cover', 'paused_pet_approach', 'paused_system_error']) {
    hass.states['sensor.box_state'].state = state; card.hass = hass;
    await card.action('continue');
    assert.equal(calls.length, 0);
  }
});

test('generic paused state uses the existing operation area without guessing an operation', () => {
  const { card, hass, add, calls } = setup();
  add('button.box_action_continue', 'unknown');
  hass.states['sensor.box_state'].state = 'paused_pet_approach'; card.hass = hass;
  const overlay = card.shadowRoot.querySelector('.context-action');
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.dataset.action, 'continue');
  assert.equal(overlay.textContent, 'Continue');
  assert.ok([...card.shadowRoot.querySelectorAll('.action')].every(b => b.disabled));
  assert.equal(calls.length, 0);
});

test('direct contextual commands recheck current device state', async () => {
  const { card, hass, add, calls } = setup();
  add('button.box_action_pause', 'unknown'); add('button.box_action_continue', 'unknown');
  await card.action('pause'); assert.equal(calls.length, 0);
  hass.states['sensor.box_state'].state = 'cleaning'; card.hass = hass;
  await card.action('continue'); assert.equal(calls.length, 0);
  await card.action('pause');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['button', 'press', { entity_id: 'button.box_action_pause' }]]);
  hass.states['sensor.box_state'].state = 'idle'; card.hass = hass;
  await card.action('continue'); assert.equal(calls.length, 1);
});

test('each action targets its native button directly without a second step', async () => {
  for (const [state, key, entity] of [['idle', 'scoop', 'scoop'], ['idle', 'dump', 'dump_litter'],
    ['idle', 'level', 'level_litter'], ['cleaning', 'pause', 'action_pause'], ['cleaning_paused', 'continue', 'action_continue']]) {
    const { card, hass, add, calls } = setup();
    add('button.box_action_pause', 'unknown'); add('button.box_action_continue', 'unknown');
    hass.states['sensor.box_state'].state = state; card.hass = hass;
    await card.action(key);
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['button', 'press', { entity_id: `button.box_${entity}` }]]);
    assert.equal(hass.states['sensor.box_state'].state, state);
  }
});

test('timeline reads only the native calendar, preserves raw weight and adjusts complete daily counts', async () => {
  const { card, hass, calls } = setup();
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', calendar_entity: 'calendar.petkit_history' });
  const ts = Date.parse('2026-11-05T04:00:00Z') / 1000;
  const records = [{ id: 'a', raw_pet_id: '2', pet_id: '1', pet_name: '<img src=x>', raw_weight_kg: 7.5,
    weight_kg: null, correction: 'combined_weight' }, { id: 'b', raw_pet_id: null, pet_id: null }, { id: 'c', raw_pet_id: null, pet_id: null }];
  const reads = [];
  hass.callApi = async (method, path) => {
    reads.push([method, path]);
    return records.map((r, i) => ({ description: JSON.stringify({ v: 1, ts: ts + i, kind: 'visit', ...r }) }));
  };
  card.hass = hass;
  card.shadowRoot.querySelector('.entry').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  card.shadowRoot.querySelector('[data-view="history"]').click();
  assert.match(card.shadowRoot.querySelector('.timeline').textContent, /7.5 kg/);
  assert.match(card.shadowRoot.querySelector('.timeline').textContent, /Auto-corrected/);
  assert.equal(card.shadowRoot.querySelector('.timeline img'), null);
  assert.equal(card.shadowRoot.querySelector('.pet-rows').textContent, 'First1Second0Unidentified2');
  assert.equal(reads[0][0], 'GET'); assert.match(reads[0][1], /^calendars\/calendar.petkit_history\?/);
  assert.equal(calls.length, 0);
});

test('timeline failures are visible and stale date requests do not paint the wrong day', async () => {
  const { card, hass } = setup();
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', calendar_entity: 'calendar.petkit_history' });
  let finish;
  hass.callApi = () => new Promise(resolve => { finish = resolve; }); card.hass = hass;
  const first = card.loadHistory('2026-11-05');
  hass.callApi = async () => { throw new Error('Calendar unavailable'); };
  await card.loadHistory('2026-11-04');
  assert.match(card.shadowRoot.querySelector('.timeline-status').textContent, /Calendar unavailable/);
  finish([]); await first;
  assert.equal(card.historyDate, '2026-11-04');
  assert.match(card.shadowRoot.querySelector('.timeline-status').textContent, /Calendar unavailable/);
});

test('native themeable breed icons are available and selected by real pet ID, not the displayed name', async () => {
  const { window, card, hass, calls } = setup();
  assert.equal(typeof window.customIcons?.hadc?.getIcon, 'function', 'Native cat icon set is not registered');
  const tabby = await window.customIcons.hadc.getIcon('cat-tabby');
  const calico = await window.customIcons.hadc.getIcon('cat-calico');
  assert.equal(tabby.viewBox, '0 0 24 24'); assert.equal(calico.viewBox, '0 0 24 24');
  assert.ok(tabby.path.length > 100 && calico.path.length > 100);
  assert.notEqual(tabby.path, calico.path);
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits',
    pet_icons: { '1': 'hadc:cat-tabby', '2': 'hadc:cat-calico' } });
  card.hass = hass;
  const icons = [...card.shadowRoot.querySelectorAll('.pet-rows ha-icon')].map(n => n.getAttribute('icon'));
  assert.deepEqual(icons, ['hadc:cat-tabby', 'hadc:cat-calico', 'mdi:help-circle-outline']);
  assert.equal(card.shadowRoot.querySelectorAll('.pet-rows img').length, 0);
  assert.equal(calls.length, 0);
  assert.throws(() => card.setConfig({ entity: 'sensor.box_device_status', pet_icons: { '1': '<svg>' } }), /pet_icons/);
});

test('visual editor changes one pet icon without changing names or device bindings', () => {
  const { window, hass, calls } = setup();
  const editor = window.document.createElement('petkit-litter-card-editor');
  editor.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', pet_icons: { '1': 'hadc:cat-tabby' } });
  editor.hass = hass;
  const picker = editor.shadowRoot.querySelector('[data-pet-id="2"]');
  assert.ok(picker, 'Per-pet native icon picker is not implemented');
  let changed;
  editor.addEventListener('config-changed', event => { changed = event.detail.config; });
  picker.dispatchEvent(new window.CustomEvent('value-changed', { detail: { value: 'hadc:cat-calico' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(changed.pet_icons)), { '1': 'hadc:cat-tabby', '2': 'hadc:cat-calico' });
  assert.equal(changed.entity, 'sensor.box_device_status');
  assert.equal(calls.length, 0);
});

test('weight tab uses valid native statistics with 7/30/90 day ranges and actual measurement times', async () => {
  const { window, card, hass, add, calls } = setup();
  const configs = [];
  window.customElements.define('hui-statistics-graph-card', class extends window.HTMLElement {
    setConfig(config) { this.config = config; configs.push(config); }
  });
  window.loadCardHelpers = async () => ({ createCardElement: config => {
    const element = window.document.createElement('hui-statistics-graph-card'); element.setConfig(config); return element;
  } });
  add('sensor.valid', '4.66', { unit_of_measurement: 'kg' });
  add('sensor.raw', '4.66'); add('sensor.measured', '2026-11-05 09:39:12');
  hass.states['sensor.valid'].last_changed = '2026-11-05T04:00:00Z';
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits',
    pet_weight_entities: { '1': 'sensor.valid' }, pet_raw_weight_entities: { '1': 'sensor.raw' },
    pet_weight_time_entities: { '1': 'sensor.measured' } }); card.hass = hass;
  card.shadowRoot.querySelector('.entry').click();
  card.setView('weight'); await new Promise(resolve => setTimeout(resolve, 0));
  const root = card.shadowRoot;
  assert.equal(root.querySelector('.overview').hidden, true);
  assert.equal(root.querySelector('.weight-view').hidden, false);
  assert.match(root.querySelector('.weight-pets').textContent, /4.66 kg/);
  assert.match(root.querySelector('.weight-pets').textContent, /2026-11-05.*09:39/);
  assert.doesNotMatch(root.querySelector('.weight-pets').textContent, /12:00/);
  assert.equal(configs.at(-1).days_to_show, 7);
  assert.equal(configs.at(-1).entities[0].entity, 'sensor.valid');
  root.querySelector('[data-days="30"]').click(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(configs.at(-1).days_to_show, 30);
  root.querySelector('[data-days="90"]').click(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(configs.at(-1).days_to_show, 90);
  assert.equal(configs.at(-1).period, 'day');
  assert.equal(calls.length, 0);
});

test('weight views never show combined values or unknown as zero and graph errors stay visible', async () => {
  const { window, card, hass, add } = setup();
  add('sensor.valid', 'unknown'); add('sensor.raw', '7.5'); add('sensor.measured', 'Unknown');
  card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits',
    pet_weight_entities: { '1': 'sensor.valid' }, pet_raw_weight_entities: { '1': 'sensor.raw' },
    pet_weight_time_entities: { '1': 'sensor.measured' } }); card.hass = hass;
  card.shadowRoot.querySelector('.entry').click();
  card.setView('weight'); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(card.shadowRoot.querySelector('.weight-pets').textContent, /Needs review.*7.5 kg/);
  assert.doesNotMatch(card.shadowRoot.querySelector('.weight-pets').textContent, /0 kg/);
  assert.match(card.shadowRoot.querySelector('.weight-status').textContent, /unavailable/i);
  assert.throws(() => card.setConfig({ entity: 'sensor.box_device_status', pet_weight_entities: { '1': 'switch.invalid' } }), /pet_weight_entities/);
  window.loadCardHelpers = async () => { throw new Error('Chart failed'); };
  card.setView('weight'); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(card.shadowRoot.querySelector('.weight-status').textContent, /Chart failed/);
});

test('a stale chart loader cannot paint after changing range, closing or replacing configuration', async () => {
  const { window, card, hass, calls } = setup();
  let finish; const loads = [];
  window.loadCardHelpers = () => new Promise(resolve => { finish = resolve; });
  card.setConfig({ entity: 'sensor.box_device_status', pet_weight_entities: { '1': 'sensor.valid' } }); card.hass = hass;
  card.shadowRoot.querySelector('.entry').click(); card.setView('weight');
  card.setView('overview');
  finish({ createCardElement: config => { loads.push(config); return window.document.createElement('div'); } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loads.length, 0);
  assert.equal(card.shadowRoot.querySelector('.weight-chart').childElementCount, 0);
  assert.equal(calls.length, 0);
});

test('weight editor maps sensors per pet without disturbing other bindings', () => {
  const { window, hass } = setup();
  const editor = window.document.createElement('petkit-litter-card-editor');
  editor.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits',
    pet_weight_entities: { '1': 'sensor.valid_one' } }); editor.hass = hass;
  const picker = editor.shadowRoot.querySelector('[data-weight-pet-id="2"][data-weight-binding="pet_weight_entities"]');
  let changed; editor.addEventListener('config-changed', event => { changed = event.detail.config; });
  picker.dispatchEvent(new window.CustomEvent('value-changed', { detail: { value: 'sensor.valid_two' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(changed.pet_weight_entities)), { '1': 'sensor.valid_one', '2': 'sensor.valid_two' });
  assert.equal(changed.entity, 'sensor.box_device_status');
});
