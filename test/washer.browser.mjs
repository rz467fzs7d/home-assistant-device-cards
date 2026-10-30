import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<style>body{margin:16px;background:#fafafa;font-family:Arial;--primary-color:#168db3;--primary-text-color:#222;--secondary-text-color:#777;--card-background-color:white;--secondary-background-color:#f2f3f4}main{max-width:400px}</style><main></main>');
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      window.calls = [];
      const card = document.createElement("washer-card"); window.washer = card;
      card.setConfig({ state_entity: "sensor.washer", operation_entity: "select.operation", remote_start_entity: "binary_sensor.remote", finish_entity: "sensor.finish", delay_entity: "number.delay", delay_min: 3, total_time_entity: "sensor.total", cycles_entity: "sensor.cycles", notification_entity: "event.notification", error_entity: "event.error" });
      const states = {
        "sensor.washer": { state: "sleep" }, "binary_sensor.remote": { state: "on" },
        "select.operation": { state: "unknown", attributes: { options: ["wake_up", "start", "stop"] } },
        "sensor.finish": { state: new Date(Date.now() + 3600000).toISOString() },
        "number.delay": { state: "0", attributes: { min: 0, max: 19, step: 1, unit_of_measurement: "h" } },
        "sensor.total": { state: "80", attributes: { unit_of_measurement: "min" } },
        "sensor.cycles": { state: "14" },
        "event.notification": { state: "2026-01-01T08:00:00Z", attributes: { event_type: "washing_is_complete" } },
        "event.error": { state: "unknown", attributes: { event_type: "door_open_error" } }
      };
      const hass = { states, callService: async (...args) => {
        window.calls.push(args);
        if (args[2].option === "wake_up") states["sensor.washer"].state = "initial";
        if (args[2].option === "start") states["sensor.washer"].state = "running";
        if (args[2].option === "stop") states["sensor.washer"].state = "pause";
        card.hass = hass;
      } };
      card.hass = hass; document.querySelector("main").append(card);
    });
    await page.locator("washer-card .entry").click();
    assert.equal(await page.locator("washer-card dialog").evaluate(el => el.open), true);
    assert.equal(await page.locator("washer-card .facts").innerText().then(text => text.includes("Door")), false);
    await page.screenshot({ path: `test-results/washer-ready-${width}.png` });
    assert.equal(await page.locator("washer-card .stop").isDisabled(), true);
    await page.locator("washer-card .start").click();
    assert.equal(await page.locator("washer-card .start").isDisabled(), true);
    assert.equal(await page.locator("washer-card .stop").isDisabled(), false);
    assert.deepEqual(await page.evaluate(() => window.calls.map(c => c[2].option)), ["wake_up", "start"]);
    assert.equal(await page.locator("washer-card select").isDisabled(), true);
    await page.screenshot({ path: `test-results/washer-running-${width}.png` });
    if (width === 390) await page.locator("washer-card dialog").screenshot({ path: "test-results/washer-controls.png" });
    const bounds = await page.locator("washer-card dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.ok(await page.evaluate(() => {
      const root = window.washer.shadowRoot;
      const dialog = root.querySelector("dialog");
      return dialog.scrollWidth <= dialog.clientWidth && document.documentElement.scrollWidth <= innerWidth;
    }), "dialog and tile must not overflow");
    page.once("dialog", dialog => dialog.accept());
    await page.locator("washer-card .stop").click();
    assert.equal(await page.locator("washer-card .start").isDisabled(), false);
    assert.equal(await page.locator("washer-card .stop").isDisabled(), true);
    await page.evaluate(() => {
      const card = window.washer;
      card._hass.states["sensor.washer"].state = "power_off";
      card._hass.states["binary_sensor.remote"].state = "off";
      card.update();
    });
    assert.equal(await page.locator("washer-card .start").isDisabled(), true);
    assert.equal(await page.locator("washer-card select").isDisabled(), true);
    assert.ok((await page.locator("washer-card .hint").textContent()).includes("Turn on the washer"));
    await page.evaluate(() => {
      const card = window.washer;
      card._hass.states["sensor.washer"].state = "cool_down";
      card.update();
    });
    assert.equal(await page.locator("washer-card .stop").isDisabled(), true);
    assert.ok((await page.locator("washer-card .hint").textContent()).includes("Enable Remote Start"));
    await page.screenshot({ path: `test-results/washer-remote-off-${width}.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("washer-card dialog").evaluate(el => el.open), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Washer browser checks passed at desktop, 390px and 320px.");
} finally { await browser.close(); }
