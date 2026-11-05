import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';

const icons = {};
for (const name of ['broom', 'trash-can-outline', 'format-horizontal-align-center', 'pause', 'play', 'close', 'check', 'information-outline']) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  assert.ok(response.ok); icons[`mdi:${name}`] = await response.text();
}
await mkdir('test-results', { recursive: true }); await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
try {
  for (const width of [320, 390, 1280]) for (const dark of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(`<style>body{margin:16px;font-family:Arial;background:${dark ? '#151515' : '#fafafa'};--primary-text-color:${dark ? '#eee' : '#222'};--secondary-text-color:${dark ? '#aaa' : '#666'};--card-background-color:${dark ? '#222' : '#fff'};--divider-color:${dark ? '#444' : '#ddd'};--secondary-background-color:${dark ? '#333' : '#f0f2f3'};--primary-color:#14889a}main{max-width:440px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}</style><main></main>`);
    await page.evaluate(icons => {
      customElements.define('ha-icon', class extends HTMLElement {
        static get observedAttributes() { return ['icon']; }
        connectedCallback() { if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); this.paint(); }
        attributeChangedCallback() { if (this.shadowRoot) this.paint(); }
        paint() { this.shadowRoot.innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute('icon')] || ''}`; }
      });
    }, icons);
    await page.addScriptTag({ content: await readFile('dist/home-assistant-device-cards.js', 'utf8'), type: 'module' });
    await page.evaluate(() => {
      window.calls = []; const states = {};
      const add = (id, state, attributes = {}) => states[id] = { entity_id: id, state, attributes };
      add('sensor.box_device_status', 'online_ac'); add('sensor.box_state', 'idle'); add('sensor.box_error', 'No error');
      add('binary_sensor.box_toilet_occupied', 'off'); add('binary_sensor.box_wastebin_filled', 'off');
      add('sensor.box_litter_level', '82', { unit_of_measurement: '%' }); add('sensor.box_litter_weight', '6.6', { unit_of_measurement: 'kg' });
      add('sensor.visits', '3', { date: '2026-11-05', time_zone: 'Asia/Shanghai', total: 3, unidentified: 2, complete: true,
        pets: [{ id: '1', name: 'First', count: 0 }, { id: '2', name: 'Second', count: 1 }] });
      for (const name of ['scoop', 'dump_litter', 'level_litter']) add('button.box_' + name, 'unknown');
      for (const name of ['action_pause', 'action_continue']) add('button.box_' + name, 'unavailable');
      for (const name of ['auto_clean', 'child_lock', 'do_not_disturb']) add('switch.box_' + name, name === 'auto_clean' ? 'on' : 'off');
      window.hass = { states, callService: async (...args) => calls.push(args) };
      const plant = document.createElement('plant-monitor-card');
      plant.setConfig({ name: 'Plant Monitor', moisture_entity: 'sensor.box_litter_level' }); plant.hass = hass;
      document.querySelector('main').append(plant);
      window.card = document.createElement('petkit-litter-card'); card.now = () => new Date('2026-11-05T04:00:00Z');
      card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', name: 'PURA MAX 2' });
      card.hass = hass; document.querySelector('main').append(card);
      document.querySelector('main').style.gridTemplateColumns = 'minmax(0, 1fr)';
    });
    const card = page.locator('petkit-litter-card');
    assert.equal(await card.locator('.entry').evaluate(n => n.getBoundingClientRect().height), 66);
    const dimensions = await page.evaluate(() => {
      const snapshot = element => {
        const root = element.shadowRoot, entry = root.querySelector('.entry'), icon = root.querySelector('.device-art'), name = root.querySelector('.name');
        return { width: entry.getBoundingClientRect().width, height: entry.getBoundingClientRect().height,
          color: getComputedStyle(icon).color, iconWidth: root.querySelector('.device-art svg').getBoundingClientRect().width,
          titleSize: getComputedStyle(name).fontSize, titleHeight: getComputedStyle(name).lineHeight };
      };
      return [snapshot(document.querySelector('plant-monitor-card')), snapshot(card)];
    });
    assert.deepEqual(dimensions[0], dimensions[1]);
    await page.screenshot({ path: `test-results/petkit-tile-${width}-${dark}.png` });
    await card.locator('.entry').click(); const dialog = card.locator('dialog');
    assert.equal(await dialog.evaluate(n => { const r = n.getBoundingClientRect(); return n.open && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && n.scrollWidth <= n.clientWidth; }), true);
    assert.equal(await dialog.locator('.pet-rows').textContent(), 'First0Second1Unidentified2');
    assert.equal(await dialog.locator('.today-total').innerText(), '3');
    assert.equal(await dialog.locator('.action').count(), 3);
    assert.equal(await dialog.locator('.context-action').isVisible(), false);
    const menuHeight = await dialog.locator('.actions').evaluate(n => n.getBoundingClientRect().height);
    assert.deepEqual(await page.evaluate(() => calls), []);
    await dialog.screenshot({ path: `test-results/petkit-${width}-${dark}.png` });
    if (width === 390 && !dark) await dialog.screenshot({ path: 'docs/images/petkit-litter-controls.png' });
    await page.evaluate(() => { hass.states['binary_sensor.box_toilet_occupied'].state = 'on'; card.hass = hass; });
    assert.equal(await dialog.getByRole('button', { name: 'Clean', exact: true }).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => calls), []);
    await page.evaluate(() => { hass.states['binary_sensor.box_toilet_occupied'].state = 'off'; card.hass = hass; });
    await dialog.getByRole('button', { name: 'Clean', exact: true }).click();
    assert.equal(await dialog.locator('.confirmation').count(), 0);
    assert.deepEqual(await page.evaluate(() => calls), [['button', 'press', { entity_id: 'button.box_scoop' }]]);
    assert.equal(await dialog.getByRole('button', { name: 'Clean', exact: true }).isDisabled(), true);
    assert.equal(await dialog.locator('.status').innerText(), 'Idle');
    assert.match(await dialog.locator('.feedback').innerText(), /Request sent/);
    await page.evaluate(() => {
      hass.states['button.box_action_pause'].state = 'unknown'; hass.states['button.box_action_continue'].state = 'unknown';
      hass.states['sensor.box_state'].state = 'cleaning'; card.hass = hass;
    });
    assert.equal(await dialog.locator('.status').innerText(), 'Cleaning');
    for (const [state, slot, action] of [['cleaning', 'scoop', 'pause'], ['cleaning_paused', 'scoop', 'continue'],
      ['dumping', 'dump', 'pause'], ['dumping_paused', 'dump', 'continue'], ['leveling', 'level', 'pause']]) {
      await page.evaluate(state => { hass.states['sensor.box_state'].state = state; card.hass = hass; }, state);
      const active = dialog.locator(`[data-slot="${slot}"]`);
      assert.equal(await active.getAttribute('data-action'), action);
      assert.equal(await active.isDisabled(), false);
      assert.equal(await dialog.locator('.actions').evaluate(n => n.getBoundingClientRect().height), menuHeight);
      assert.equal(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth), true);
      if (width === 390 && !dark) await dialog.screenshot({ path: `test-results/petkit-${state}.png` });
    }
    await page.evaluate(() => { hass.states['sensor.box_state'].state = 'paused'; card.hass = hass; });
    assert.equal(await dialog.locator('.context-action').isVisible(), true);
    assert.equal(await dialog.locator('.actions').evaluate(n => n.getBoundingClientRect().height), menuHeight);
    assert.deepEqual(await page.evaluate(() => calls), [['button', 'press', { entity_id: 'button.box_scoop' }]]);
    await page.evaluate(() => { hass.states['sensor.box_device_status'].state = 'offline'; card.hass = hass; });
    assert.equal(await dialog.getByRole('button', { name: 'Empty litter', exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('switch', { name: 'Automatic cleaning', exact: true }).isDisabled(), true);
    await page.evaluate(() => { card.now = () => new Date('2026-11-05T16:00:00Z'); card.update(); });
    assert.equal(await dialog.locator('.today-total').innerText(), '\u2014');
    await page.evaluate(() => { hass.states['sensor.visits'].attributes.pets[0].name = 'A-very-long-pet-name-that-must-not-overflow-the-dialog'; card.hass = hass; });
    assert.equal(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth), true);
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Petkit: desktop/mobile, light/dark, direct single-click controls, duplicate protection and occupancy guards passed with mock services only.');
} finally { await browser.close(); }
