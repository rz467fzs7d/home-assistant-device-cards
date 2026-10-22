import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
const icons = {};
if (process.env.DOC_SCREENSHOTS) for (const name of ["close", "stove", "pot-steam", "play", "pause", "play-pause", "stop", "check", "information-outline"]) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  if (!response.ok) throw new Error(`Cannot load ${name}`);
  icons[`mdi:${name}`] = await response.text();
}
await mkdir("test-results", { recursive: true });
try {
  for (const width of [1280, 390, 320]) for (const kind of ["air-fryer", "pressure-cooker"]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<style>body{margin:16px;background:#fafafa;--primary-text-color:#222;--secondary-text-color:#777;--ha-card-background:#fff;--secondary-background-color:#f2f2f2}main{max-width:400px}</style><main></main>');
    if (process.env.DOC_SCREENSHOTS) await page.evaluate(icons => {
      customElements.define("ha-icon", class extends HTMLElement {
        connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute("icon")] || ""}`; }
      });
    }, icons);
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(kind => {
      const card = document.createElement(`${kind}-card`); window.card = card; window.calls = [];
      const fryer = kind === "air-fryer";
      card.setConfig({ state_entity: "sensor.status", start_entity: fryer ? "button.start" : "notify.start", stop_entity: "button.stop", pause_entity: fryer ? "button.pause" : undefined, resume_entity: fryer ? "button.resume" : undefined, remaining_entity: "sensor.left", target_temperature_entity: fryer ? "number.temp" : undefined, target_time_entity: fryer ? "number.time" : undefined, cover_entity: fryer ? undefined : "sensor.cover", temperature_entity: fryer ? undefined : "sensor.temp", modes: [{ label: "Fine Cook", value: 1 }, { label: "Soup", value: 6 }] });
      const hass = { states: { "sensor.status": { state: fryer ? "Standby" : "Idle" }, "button.start": { state: "unknown" }, "notify.start": { state: "unknown" }, "button.stop": { state: "unknown" }, "button.pause": { state: "unknown" }, "button.resume": { state: "unknown" }, "sensor.left": { state: "25" }, "sensor.cover": { state: "无盖/有盖已锁好" }, "sensor.temp": { state: "28", attributes: { unit_of_measurement: "°C" } }, "number.temp": { state: "180", attributes: { min: 40, max: 200, step: 1 } }, "number.time": { state: "30", attributes: { min: 1, max: 1440, step: 1 } } }, callService: async (...args) => { window.calls.push(args); hass.states["sensor.status"].state = args[2].entity_id === "button.stop" ? (fryer ? "Standby" : "Idle") : fryer ? "Cooking" : "Busy"; card.hass = hass; } };
      hass.states["number.temp"].attributes.unit_of_measurement = "°C";
      hass.states["number.time"].attributes.unit_of_measurement = "min";
      card.hass = hass; document.querySelector("main").append(card);
    }, kind);
    assert.deepEqual(await page.locator(`${kind}-card .entry .appliance-icon`).evaluate(el => {
      const icon = el.querySelector("svg"), box = el.getBoundingClientRect(), glyph = icon.getBoundingClientRect();
      return [box.width, box.height, glyph.width, glyph.height, getComputedStyle(el).borderRadius, getComputedStyle(icon).stroke];
    }), [32, 32, 32, 32, "0px", "none"]);
    if (kind === "air-fryer") assert.ok(await page.locator(`${kind}-card .entry svg path`).evaluate(el => {
      const box = el.getBBox(); return Math.abs(box.width / box.height - 16 / 20) < .001;
    }), "air fryer silhouette matches Washer's 16:20 aspect ratio");
    if (kind === "air-fryer") assert.match(await page.locator(`${kind}-card .entry svg path`).getAttribute("d"), /M64 41a10 10/, "air fryer uses its round front display");
    if (kind === "pressure-cooker") assert.ok(await page.locator(`${kind}-card .entry svg`).evaluate(el => {
      const box = el.getBBox(); return box.x === 24 && box.width === 80 && box.height > 100;
    }), "pressure cooker keeps a cylindrical body with top handle and valve, without side handles");
    assert.deepEqual(await page.locator(`${kind}-card .entry .appliance-icon`).evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).boxShadow]), ["rgba(0, 0, 0, 0)", "none"]);
    await page.locator(`${kind}-card .entry`).click();
    assert.deepEqual(await page.locator(`${kind}-card`).evaluate(el => {
      const root = el.shadowRoot;
      return ["h2", ".status", ".field", ".facts", "input,select"].map(selector => getComputedStyle(root.querySelector(selector)).fontSize);
    }), ["16px", "22px", "13px", "13px", "13px"]);
    assert.equal(await page.locator(`${kind}-card .stop`).isDisabled(), true);
    await page.screenshot({ path: `test-results/${kind}-${width}.png` });
    if (width === 390) await page.locator(`${kind}-card dialog`).screenshot({ path: `test-results/${kind}-controls.png` });
    const bounds = await page.locator(`${kind}-card dialog`).boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.ok(await page.evaluate(() => window.card.shadowRoot.querySelector("dialog").scrollWidth <= window.card.shadowRoot.querySelector("dialog").clientWidth));
    assert.equal(await page.locator(`${kind}-card .machine`).count(), 0);
    page.once("dialog", dialog => dialog.accept()); await page.locator(`${kind}-card .start`).click();
    await page.waitForFunction(() => window.card.active && !window.card.busy);
    assert.equal(await page.locator(`${kind}-card .stop`).isDisabled(), false);
    assert.match(await page.locator(`${kind}-card .remaining`).textContent(), /25 Min/);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    const fields = await page.locator(`${kind}-card .field[data-key] input`).evaluateAll(els => els.map(el => el.getBoundingClientRect().x));
    if (fields.length > 1) assert.ok(Math.max(...fields) - Math.min(...fields) < 1, "numeric inputs align");
    await page.keyboard.press("Escape"); assert.deepEqual(errors, []); await page.close();
  }
  console.log("Cooking card checks passed at desktop, 390px and 320px; mock services only.");
} finally { await browser.close(); }
