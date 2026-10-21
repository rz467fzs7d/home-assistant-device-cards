import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const icons = {};
if (process.env.DOC_SCREENSHOTS) for (const name of ["dishwasher", "close", "play", "stop", "information-outline"]) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  if (!response.ok) throw new Error(`Cannot load ${name}`);
  icons[`mdi:${name}`] = await response.text();
}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const width of [1280, 390, 320]) for (const variant of ["cabinet", "sink"]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<style>body{margin:16px;background:#fafafa;--primary-text-color:#222;--secondary-text-color:#777;--ha-card-background:#fff;--secondary-background-color:#f2f2f2}main{max-width:400px}</style><main></main>');
    if (process.env.DOC_SCREENSHOTS) await page.evaluate(icons => {
      customElements.define("ha-icon", class extends HTMLElement {
        connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute("icon")] || ""}`; }
      });
    }, icons);
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(variant => {
      const card = document.createElement("dishwasher-card"); window.card = card; window.calls = [];
      card.setConfig({ state_entity: "sensor.status", progress_entity: "sensor.progress", mode_entity: "sensor.mode", mode_select_entity: "select.mode", icon_variant: variant });
      const hass = { states: { "sensor.status": { state: "power_off" }, "sensor.progress": { state: "idle" }, "sensor.mode": { state: "fruit_wash" }, "select.mode": { state: "unavailable", attributes: { options: ["eco_wash", "fruit_wash"] } } }, callService: async (...args) => { window.calls.push(args); hass.states["sensor.status"].state = "running"; hass.states["sensor.progress"].state = "wash"; card.hass = hass; } };
      card.hass = hass; document.querySelector("main").append(card);
    }, variant);
    await page.locator("dishwasher-card .entry").click();
    assert.equal(await page.locator("dishwasher-card .start").isEnabled(), false);
    assert.equal(await page.locator("dishwasher-card select").isEnabled(), false);
    const startBox = await page.locator("dishwasher-card .start").boundingBox();
    const stopBox = await page.locator("dishwasher-card .stop").boundingBox();
    const programBox = await page.locator("dishwasher-card select").boundingBox();
    assert.ok(startBox.x < stopBox.x && stopBox.x + stopBox.width <= programBox.x);
    assert.ok(Math.abs(startBox.y - programBox.y) < 2, "controls share one row");
    await page.screenshot({ path: `test-results/dishwasher-${variant}-off-${width}.png` });
    const bounds = await page.locator("dishwasher-card dialog").boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.ok(await page.evaluate(() => window.card.shadowRoot.querySelector("dialog").scrollWidth <= window.card.shadowRoot.querySelector("dialog").clientWidth));
    assert.ok(await page.locator("dishwasher-card .machine svg").evaluate(el => el.getBoundingClientRect().height > 100 && el.querySelector("path").getBBox().width > 30 && getComputedStyle(el).fill === "none"));
    await page.evaluate(() => { window.card._hass.states["sensor.status"].state = "cancel"; window.card._hass.states["select.mode"].state = "eco_wash"; window.card.update(); });
    await page.locator("dishwasher-card select").selectOption("fruit_wash");
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    if (width === 390) await page.locator("dishwasher-card dialog").screenshot({ path: variant === "cabinet" ? "test-results/dishwasher-controls.png" : "test-results/dishwasher-sink-controls.png" });
    page.once("dialog", dialog => dialog.accept()); await page.locator("dishwasher-card .start").click();
    await page.waitForFunction(() => window.card.status === "running" && !window.card.busy);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    assert.match(await page.locator("dishwasher-card .summary").textContent(), /Wash/);
    await page.keyboard.press("Escape"); assert.deepEqual(errors, []); await page.close();
  }
  console.log("Dishwasher mock controls and responsive checks passed at desktop, 390px and 320px.");
} finally { await browser.close(); }
