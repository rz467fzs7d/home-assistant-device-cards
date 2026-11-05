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
        connectedCallback() { this.attachShadow({ mode: 'open' }).innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute('icon')] || ''}`; }
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
      window.card = document.createElement('petkit-litter-card'); card.now = () => new Date('2026-11-05T04:00:00Z');
      card.setConfig({ entity: 'sensor.box_device_status', stats_entity: 'sensor.visits', name: 'PURA MAX 2' });
      card.hass = hass; document.querySelector('main').append(card);
    });
    const card = page.locator('petkit-litter-card');
    assert.equal(await card.locator('.entry').evaluate(n => n.getBoundingClientRect().height), 66);
    await card.locator('.entry').click(); const dialog = card.locator('dialog');
    assert.equal(await dialog.evaluate(n => { const r = n.getBoundingClientRect(); return n.open && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && n.scrollWidth <= n.clientWidth; }), true);
    assert.equal(await dialog.locator('.pet-rows').textContent(), 'First0Second1Unidentified2');
    assert.equal(await dialog.locator('.today-total').innerText(), '3');
    assert.deepEqual(await page.evaluate(() => calls), []);
    await dialog.screenshot({ path: `test-results/petkit-${width}-${dark}.png` });
    if (width === 390 && !dark) await dialog.screenshot({ path: 'docs/images/petkit-litter-controls.png' });
    await dialog.getByRole('button', { name: 'Clean', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => calls), []);
    await page.evaluate(() => { hass.states['binary_sensor.box_toilet_occupied'].state = 'on'; card.hass = hass; });
    assert.equal(await dialog.getByRole('button', { name: 'Confirm', exact: true }).isDisabled(), true);
    await page.evaluate(() => { hass.states['binary_sensor.box_toilet_occupied'].state = 'off'; card.hass = hass; });
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => calls), [['button', 'press', { entity_id: 'button.box_scoop' }]]);
    assert.equal(await dialog.locator('.status').innerText(), 'Idle');
    assert.match(await dialog.locator('.feedback').innerText(), /Request sent/);
    await page.evaluate(() => { hass.states['sensor.box_state'].state = 'cleaning'; card.hass = hass; });
    assert.equal(await dialog.locator('.status').innerText(), 'Cleaning');
    await page.evaluate(() => { hass.states['sensor.box_device_status'].state = 'offline'; card.hass = hass; });
    assert.equal(await dialog.getByRole('button', { name: 'Empty litter', exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('switch', { name: 'Automatic cleaning', exact: true }).isDisabled(), true);
    await page.evaluate(() => { card.now = () => new Date('2026-11-05T16:00:00Z'); card.update(); });
    assert.equal(await dialog.locator('.today-total').innerText(), '\u2014');
    await page.evaluate(() => { hass.states['sensor.visits'].attributes.pets[0].name = 'A-very-long-pet-name-that-must-not-overflow-the-dialog'; card.hass = hass; });
    assert.equal(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth), true);
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Petkit: desktop/mobile, light/dark, per-pet counts, date rollover, confirmations and occupancy guards passed with mock services only.');
} finally { await browser.close(); }
