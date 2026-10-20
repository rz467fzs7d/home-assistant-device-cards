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
    const symmetric = await page.evaluate(() => [...document.querySelector("main").children]
      .filter(card => card.shadowRoot.querySelector(".pair"))
      .every(card => {
        const pair = card.shadowRoot.querySelector(".pair");
        const [left, right] = pair.querySelectorAll("i");
        const a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
        const p = pair.getBoundingClientRect();
        return Math.abs(a.width - b.width) < .01 && Math.abs(a.height - b.height) < .01 &&
          Math.abs(a.y - b.y) < .01 && Math.abs(a.x - p.x - (p.right - b.right)) < .01 &&
          Number.isInteger(a.width) && Number.isInteger(a.height) &&
          Math.abs((b.x - a.x) - Math.round(b.x - a.x)) < .01 &&
          getComputedStyle(left).opacity === getComputedStyle(right).opacity;
      }));
    assert.ok(symmetric, "left/right artwork must have equal size, height, opacity and symmetric offsets");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must not overflow");
    await page.locator("apple-theater-card .entry").click();
    const colors = await page.evaluate(() => {
      const card = document.querySelector("apple-theater-card");
      card.style.setProperty("--state-media_player-active-color", "#ff9800");
      card.style.setProperty("--state-inactive-color", "#888888");
      card._hass.states["media_player.main"].state = "off";
      card._hass.states["media_player.speaker_1"].state = "off";
      card.update();
      const root = card.shadowRoot;
      const colors = [root.querySelector(".tile .art"), ...root.querySelectorAll(".speaker-art")].map(el => getComputedStyle(el).color);
      card._hass.states["media_player.main"].state = "playing";
      card.update();
      return colors;
    });
    assert.equal(colors[0], "rgb(255, 152, 0)", "group uses HA theme active color");
    assert.equal(colors[0], colors[1], "enabled member and group share active color");
    assert.equal(colors[2], "rgb(136, 136, 136)", "off speaker uses HA theme inactive color");
    await page.screenshot({ path: `test-results/theater-${width}.png` });
    assert.equal(await page.locator("apple-theater-card dialog .speaker").count(), 4);
    const rect = await page.locator("apple-theater-card dialog").boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width, "dialog fits viewport");
    const slider = await page.locator("apple-theater-card dialog input").boundingBox();
    assert.ok(Math.abs(slider.x + slider.width / 2 - (rect.x + rect.width / 2)) < 1, "volume slider remains centered without mute");
    assert.ok((await page.locator("apple-theater-card .now").boundingBox()).height >= 64);
    assert.equal(await page.locator("apple-theater-card dialog .speaker small").nth(1).textContent(), "Off");
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
