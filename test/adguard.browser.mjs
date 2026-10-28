import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const icons = {};
for (const name of ["shield-check", "close", "information-outline"]) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  assert.ok(response.ok); icons[`mdi:${name}`] = await response.text();
}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
await mkdir("docs/images", { recursive: true });
try {
  for (const width of [320, 390, 1280]) {
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 820 }, deviceScaleFactor: 2 });
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.setContent(`<style>body{margin:16px;font-family:Arial;background:${dark ? "#151515" : "#fafafa"};--primary-text-color:${dark ? "#eee" : "#222"};--secondary-text-color:${dark ? "#aaa" : "#777"};--card-background-color:${dark ? "#222" : "#fff"};--divider-color:${dark ? "#444" : "#ddd"};--secondary-background-color:${dark ? "#444" : "#eee"};--primary-color:#168db3}main{max-width:440px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}</style><main></main>`);
      await page.evaluate(icons => {
        customElements.define("ha-icon", class extends HTMLElement {
          connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute("icon")] || ""}`; }
        });
      }, icons);
      await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
      await page.evaluate(() => {
        window.calls = [];
        const states = {};
        for (const key of ["protection", "filtering", "safe_browsing", "safe_search", "parental_control", "query_log"]) states[`switch.adguard_home_${key}`] = { state: ["safe_browsing", "parental_control"].includes(key) ? "off" : "on", attributes: {} };
        for (const [key, state, unit] of [["dns_queries", "1552998", "queries"], ["dns_queries_blocked", "548381", "queries"], ["dns_queries_blocked_ratio", "35.31", "%"], ["average_processing_speed", "2.84", "ms"], ["parental_control_blocked", "0", "requests"], ["safe_browsing_blocked", "0", "requests"], ["safe_searches_enforced", "15354", "requests"]]) states[`sensor.adguard_home_${key}`] = { state, attributes: { unit_of_measurement: unit } };
        const card = document.createElement("adguard-card"); card.setConfig({});
        window.hass = { states, callService: async (...args) => { window.calls.push(args); } }; card.hass = window.hass;
        document.querySelector("main").append(card);
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator("adguard-card .entry").evaluate(n => n.getBoundingClientRect().height), 66);
      await page.locator("adguard-card").screenshot({ path: `test-results/adguard-tile-${width}-${dark}.png` });
      await page.locator("adguard-card .identity").click();
      const dialog = page.locator("adguard-card dialog");
      assert.equal(await dialog.evaluate(n => n.open), true);
      assert.equal(await dialog.getByRole("switch").count(), 5);
      assert.equal(await dialog.getByRole("switch", { name: "Query Log", exact: true }).count(), 0);
      assert.equal(await dialog.evaluate(n => n.scrollWidth > n.clientWidth), false);
      assert.equal(await dialog.evaluate(n => { const b = n.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }), true);
      assert.equal(await page.evaluate(() => calls.length), 0);
      await dialog.screenshot({ path: `test-results/adguard-details-${width}-${dark}.png` });
      if (width === 390 && !dark) {
        await dialog.screenshot({ path: "docs/images/adguard-controls.png" });
        await page.locator('adguard-card [data-control="safe_browsing"]').click();
        assert.deepEqual(await page.evaluate(() => calls), [["switch", "turn_on", { entity_id: "switch.adguard_home_safe_browsing" }]]);
        await page.evaluate(() => { hass.states["switch.adguard_home_safe_browsing"].state = "on"; document.querySelector("adguard-card").hass = hass; });
        assert.equal(await page.locator('adguard-card [data-control="safe_browsing"]').isChecked(), true);
      }
      await page.keyboard.press("Escape"); assert.equal(await dialog.evaluate(n => n.open), false);
      await page.evaluate(() => { hass.states["switch.adguard_home_protection"].state = "unavailable"; document.querySelector("adguard-card").hass = hass; });
      await page.locator("adguard-card .identity").click();
      assert.equal(await page.locator('adguard-card [data-control="protection"]').isDisabled(), true);
      assert.deepEqual(errors, []); await page.close();
    }
  }
  console.log("AdGuard desktop/mobile and light/dark layout, read-only opening and mock switch controls verified.");
} finally { await browser.close(); }
