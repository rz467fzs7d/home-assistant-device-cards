import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 600 } });
    await page.setContent('<style>body{margin:16px;font-family:Arial;background:#fafafa}main{max-width:440px}</style><main></main>');
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      const card = document.createElement("plant-monitor-card");
      card.setConfig({ moisture_entity: "sensor.soil", conductivity_entity: "sensor.ec", illuminance_entity: "sensor.light", temperature_entity: "sensor.temp" });
      card.hass = { states: Object.fromEntries([["soil", "54", "%"], ["ec", "215", "\u03bcS/cm"], ["light", "26", "lx"], ["temp", "25.3", "\u00b0C"]].map(([key, state, unit]) => [`sensor.${key}`, { state, attributes: { unit_of_measurement: unit } }])), callService() { throw new Error("Read-only card"); } };
      document.querySelector("main").append(card);
    });
    const geometry = await page.locator("plant-monitor-card").evaluate(el => {
      const root = el.shadowRoot, bounds = root.querySelector(".entry").getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, fits: [...root.querySelectorAll(".metric,.identity")].every(node => node.getBoundingClientRect().right <= bounds.right && node.scrollWidth <= node.clientWidth), height: bounds.height };
    });
    assert.equal(geometry.overflow, false); assert.equal(geometry.fits, true); assert.ok(geometry.height < 110);
    await page.locator("plant-monitor-card").screenshot({ path: `test-results/plant-${width}.png` });
    await page.locator("plant-monitor-card .identity").click();
    assert.equal(await page.locator("plant-monitor-card dialog").evaluate(node => node.open), true);
    await page.locator("plant-monitor-card .close").click();
    await page.close();
  }
  console.log("Plant monitor fits desktop/mobile, preserves readings and opens details without service calls.");
} finally { await browser.close(); }
