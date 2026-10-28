import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const icons = {};
for (const name of ["power", "power-off", "close", "information-outline"]) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  assert.ok(response.ok); icons[`mdi:${name}`] = await response.text();
}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true }); await mkdir("docs/images", { recursive: true });
try {
  for (const width of [320, 390, 1280]) for (const dark of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 700 }, deviceScaleFactor: 2 });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.setContent(`<style>body{margin:16px;font-family:Arial;background:${dark ? "#151515" : "#fafafa"};--primary-text-color:${dark ? "#eee" : "#222"};--secondary-text-color:${dark ? "#aaa" : "#777"};--card-background-color:${dark ? "#222" : "#fff"};--divider-color:${dark ? "#444" : "#ddd"};--secondary-background-color:${dark ? "#444" : "#eee"};--primary-color:#168db3}main{max-width:440px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}</style><main></main>`);
    await page.evaluate(icons => {
      customElements.define("ha-icon", class extends HTMLElement {
        connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute("icon")] || ""}`; }
      });
    }, icons);
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      window.calls = []; window.hass = { states: { "switch.seat": { state: "unknown", attributes: {} } }, callService: async (...args) => { calls.push(args); } };
      const card = document.createElement("toilet-seat-card"); card.setConfig({ entity: "switch.seat" }); card.hass = hass; document.querySelector("main").append(card);
    });
    const card = page.locator("toilet-seat-card");
    assert.equal(await card.locator(".entry").evaluate(n => n.getBoundingClientRect().height), 66);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await card.screenshot({ path: `test-results/seat-tile-${width}-${dark}.png` });
    await card.locator(".identity").click(); const dialog = card.locator("dialog");
    assert.equal(await dialog.evaluate(n => { const b = n.getBoundingClientRect(); return n.open && b.left >= 0 && b.right <= innerWidth && n.scrollWidth <= n.clientWidth; }), true);
    assert.equal(await dialog.locator(".status").innerText(), "Unknown");
    const power = dialog.getByRole("switch", { name: "Power", exact: true });
    assert.equal(await power.isDisabled(), true);
    assert.equal(await dialog.evaluate(n => n.getBoundingClientRect().height < 230), true);
    await page.evaluate(() => { hass.states["switch.seat"].state = "off"; document.querySelector("toilet-seat-card").hass = hass; });
    await power.click();
    assert.deepEqual(await page.evaluate(() => calls), [["switch", "turn_on", { entity_id: "switch.seat" }]]);
    assert.equal(await dialog.locator(".status").innerText(), "Off");
    assert.equal(await power.isChecked(), false);
    await page.evaluate(() => { hass.states["switch.seat"].state = "on"; document.querySelector("toilet-seat-card").hass = hass; });
    assert.equal(await dialog.locator(".status").innerText(), "On");
    if (width === 390 && !dark) await dialog.screenshot({ path: "docs/images/toilet-seat-controls.png" });
    await page.evaluate(() => { hass.states["switch.seat"].state = "unavailable"; document.querySelector("toilet-seat-card").hass = hass; });
    assert.equal(await power.isDisabled(), true);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    assert.deepEqual(errors, []); await page.close();
  }
  console.log("Toilet seat: compact dialog, desktop/mobile light/dark, honest states and mock-only switch controls passed.");
} finally { await browser.close(); }
