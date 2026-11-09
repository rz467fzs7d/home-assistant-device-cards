import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const [width, columns] of [[320, 3], [320, 2], [390, 2], [390, 1], [1280, 1]]) {
    const page = await browser.newPage({ viewport: { width, height: 600 } });
    await page.setContent(`<style>body{margin:16px;font-family:Arial;background:#fafafa}main{max-width:440px;display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:8px}</style><main></main>`);
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      const card = document.createElement("plant-monitor-card");
      card.setConfig({ moisture_entity: "sensor.soil", conductivity_entity: "sensor.ec", illuminance_entity: "sensor.light", temperature_entity: "sensor.temp" });
      card.hass = { states: Object.fromEntries([["soil", "54", "%"], ["ec", "215", "\u03bcS/cm"], ["light", "26", "lx"], ["temp", "25.3", "\u00b0C"]].map(([key, state, unit]) => [`sensor.${key}`, { state, attributes: { unit_of_measurement: unit } }])), callService() { throw new Error("Read-only card"); } };
      document.querySelector("main").append(card);
    });
    const geometry = await page.locator("plant-monitor-card").evaluate(el => {
      const root = el.shadowRoot, bounds = root.querySelector(".entry").getBoundingClientRect();
      const name = root.querySelector(".name").getBoundingClientRect();
      const readings = root.querySelector(".readings").getBoundingClientRect();
      const items = [...root.querySelectorAll(".tile-reading")].map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          contentRight: node.lastElementChild.getBoundingClientRect().right,
          fontSize: getComputedStyle(node.firstElementChild).fontSize,
          fits: node.scrollWidth <= node.clientWidth };
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth,
        fits: items.every(item => item.fits && item.left >= bounds.left && item.right <= bounds.right && item.bottom <= bounds.bottom),
        height: bounds.height, width: bounds.width, items,
        stacked: name.bottom <= readings.top,
        sideBySide: name.right <= readings.left && name.top < readings.bottom && name.bottom > readings.top,
        rightInset: bounds.right - readings.right,
        textOffset: name.left - bounds.left,
        iconWidth: root.querySelector('.entry .device-art').getBoundingClientRect().width };
    });
    assert.equal(geometry.overflow, false); assert.equal(geometry.fits, true, JSON.stringify(geometry)); assert.equal(geometry.height, 66);
    if (columns === 1) {
      assert.equal(geometry.sideBySide, true, "Wide cards group all readings to the right of the title");
      assert.equal(geometry.rightInset, 13);
      assert.equal(geometry.textOffset, 57);
      assert.equal(geometry.iconWidth, 32);
    } else {
      assert.equal(geometry.stacked, true, "Narrow cards stack the reading group under the title");
    }
    const [soil, conductivity, light, temperature] = geometry.items;
    assert.equal(soil.top, conductivity.top);
    assert.equal(light.top, temperature.top);
    assert.ok(soil.top < light.top);
    assert.ok(Math.abs(soil.contentRight - light.contentRight) < 1);
    assert.ok(Math.abs(conductivity.contentRight - temperature.contentRight) < 1);
    assert.ok(geometry.items.every(item => item.fontSize === "11px"));
    assert.equal(await page.locator('plant-monitor-card .entry .metric').count(), 0);
    assert.equal(await page.locator('plant-monitor-card .entry .tile-reading').count(), 4);
    await page.locator("plant-monitor-card").screenshot({ path: `test-results/plant-${width}-${columns}.png` });
    await page.locator("plant-monitor-card .identity").click();
    assert.equal(await page.locator("plant-monitor-card dialog").evaluate(node => node.open), true);
    await page.locator("plant-monitor-card .close").click();
    await page.close();
  }
  console.log("Plant monitor fits desktop/mobile, preserves readings and opens details without service calls.");
} finally { await browser.close(); }
