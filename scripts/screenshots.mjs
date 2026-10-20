import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

// Render the real cards with synthetic entities, never a household dashboard.
const names = ["close", "power", "lightbulb", "speaker-multiple", "speaker",
  "skip-previous", "skip-next", "play", "pause", "volume-off", "volume-high",
  "information-outline", "television"];
const icons = Object.fromEntries(await Promise.all(names.map(async name => {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`);
  if (!response.ok) throw new Error(`Cannot load MDI icon ${name}: ${response.status}`);
  return [`mdi:${name}`, await response.text()];
})));
await mkdir("docs/images", { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 2 });
  await page.setContent(`<style>
    body{margin:0;background:#f7f8fa;font-family:Arial,sans-serif;color:#222;
    --primary-color:#168db3;--primary-text-color:#222;--secondary-text-color:#777;
    --state-media_player-active-color:#168db3;--state-switch-active-color:#e6ac00;
    --card-background-color:#fff;--ha-card-background:#fff;--secondary-background-color:#f0f1f2}
    main{padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
    h2{font-size:14px;font-weight:500;margin:0 0 10px}section{min-width:0}
  </style><main></main>`);
  await page.evaluate(icons => {
    customElements.define("ha-icon", class extends HTMLElement {
      static get observedAttributes() { return ["icon"]; }
      connectedCallback() { this.render(); }
      attributeChangedCallback() { this.render(); }
      render() {
        if (!this.shadowRoot) this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>${icons[this.getAttribute("icon")] || ""}`;
      }
    });
  }, icons);
  await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
  await page.evaluate(() => {
    const states = {
      "media_player.stereo": { state: "playing", attributes: { media_title: "Evening Session", media_artist: "Demo Artist", volume_level: .3, supported_features: 16445 } },
      "media_player.mini": { state: "paused", attributes: { volume_level: .2, supported_features: 16445 } },
      "media_player.theater": { state: "playing", attributes: { media_title: "Movie Night", volume_level: .35, supported_features: 16445 } },
      "media_player.sonos": { state: "idle", attributes: { volume_level: .18, supported_features: 16445 } },
      "media_player.left": { state: "playing", attributes: {} },
      "media_player.right": { state: "playing", attributes: {} },
      "media_player.mini_left": { state: "paused", attributes: {} },
      "media_player.mini_right": { state: "paused", attributes: {} },
      "media_player.tv": { state: "on", attributes: {} },
    };
    const labels = ["Monitor", "Desk Lamp", "Charger", "Speaker", "Printer", "Spare"];
    const entities = labels.map((name, i) => {
      const entity = `${i === 1 ? "light" : "switch"}.demo_${i}`;
      states[entity] = { state: i < 4 ? "on" : "off", attributes: {} };
      return { entity, name };
    });
    const examples = [
      ["Power Strip", { type: "power-strip-card", name: "Desk Power", icon_variant: "cn-six-usb", entities }],
      ["Inline Power Strip", { type: "power-strip-card", name: "Utility Power", icon_variant: "cn-five-cord-right", entities: entities.slice(0, 5) }],
      ["HomePod Stereo", { type: "homepod-stereo-card", name: "HomePod Stereo", entity: "media_player.stereo", speakers: ["media_player.left", "media_player.right"], model: "homepod" }],
      ["HomePod Mini Stereo", { type: "homepod-stereo-card", name: "HomePod Mini", entity: "media_player.mini", speakers: ["media_player.mini_left", "media_player.mini_right"], model: "mini" }],
      ["Apple Theater", { type: "apple-theater-card", name: "Apple Theater", entity: "media_player.theater", television: "media_player.tv", speakers: ["media_player.left", "media_player.right"], model: "homepod" }],
      ["General Speaker Stereo", { type: "general-speaker-stereo-card", name: "Speaker Stereo", entity: "media_player.sonos" }],
    ];
    for (const [label, config] of examples) {
      const section = document.createElement("section");
      const heading = document.createElement("h2"); heading.textContent = label;
      const card = document.createElement(config.type);
      card.setConfig(config);
      card.hass = { states, callService: async () => {} };
      section.append(heading, card); document.querySelector("main").append(section);
    }
  });
  await page.locator("main").screenshot({ path: "docs/images/cards-overview.png" });
  await page.setViewportSize({ width: 920, height: 1000 });
  for (const [type, filename] of [
    ["power-strip-card", "power-strip-controls"],
    ["homepod-stereo-card", "homepod-stereo-controls"],
    ["apple-theater-card", "apple-theater-controls"],
  ]) {
    const card = page.locator(type).first();
    await card.locator(".entry").click();
    await card.locator("dialog").screenshot({ path: `docs/images/${filename}.png` });
    await page.keyboard.press("Escape");
  }
  console.log("Saved four demo screenshots to docs/images/");
} finally {
  await browser.close();
}
