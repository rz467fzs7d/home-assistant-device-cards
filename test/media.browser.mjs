import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent(`<style>body{margin:16px;background:#fafafa;font-family:Arial;--primary-color:#168db3;--primary-text-color:#222;--secondary-text-color:#777;--card-background-color:white;--secondary-background-color:#f2f3f4}main{max-width:400px;display:grid;gap:12px}</style><main></main>`);
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      window.calls = [];
      for (const [type, model, count] of [
        ["homepod-stereo-card", "homepod", 2],
        ["homepod-stereo-card", "mini", 2],
        ["apple-theater-card", "homepod", 4],
        ["general-speaker-stereo-card", "homepod", 2]
      ]) {
        const card = document.createElement(type);
        card.setConfig({ entity: "media_player.main", model, speakers: Array.from({ length: count }, (_, i) => `media_player.speaker_${i}`) });
        card.hass = { states: {
          "media_player.main": { state: "playing", attributes: { supported_features: 16445, media_title: "A song with a very long title that must fit the card", volume_level: .2 } },
          ...Object.fromEntries(Array.from({ length: count }, (_, i) => [`media_player.speaker_${i}`, { state: "playing" }]))
        }, callService: async (...args) => window.calls.push(args) };
        document.querySelector("main").append(card);
      }
    });
    await page.screenshot({ path: `test-results/media-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must not overflow");
    await page.locator("apple-theater-card .entry").click();
    const colors = await page.evaluate(() => {
      const card = document.querySelector("apple-theater-card");
      card._hass.states["media_player.main"].state = "off";
      card._hass.states["media_player.speaker_1"].state = "paused";
      card.update();
      const root = card.shadowRoot;
      const colors = [root.querySelector(".pair ha-icon"), ...root.querySelector(".pair").querySelectorAll("i")].map(el => getComputedStyle(el).color);
      card._hass.states["media_player.main"].state = "playing";
      card.update();
      return colors;
    });
    assert.notEqual(colors[0], colors[1], "playing left speaker differs from idle TV");
    assert.equal(colors[0], colors[2], "paused right speaker stays gray");
    await page.screenshot({ path: `test-results/theater-${width}.png` });
    assert.equal(await page.locator("apple-theater-card dialog .speaker").count(), 4);
    const rect = await page.locator("apple-theater-card dialog").boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width, "dialog fits viewport");
    await page.locator('apple-theater-card dialog [aria-label="Pause"]').click();
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    assert.equal(await page.evaluate(() => window.calls[0][2].entity_id), "media_player.main");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("apple-theater-card dialog").evaluate(el => el.open), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Desktop/mobile browser checks passed; screenshots in test-results/");
} finally {
  await browser.close();
}
