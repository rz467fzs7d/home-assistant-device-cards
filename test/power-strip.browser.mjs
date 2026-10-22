import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
await mkdir("test-results", { recursive: true });
try {
  for (const width of [320, 390, 1280]) for (const deviceScaleFactor of [1, 2]) {
    const page = await browser.newPage({ viewport: { width, height: 180 }, deviceScaleFactor });
    await page.setContent('<style>body{margin:16px;background:#fafafa;--primary-text-color:#222;--secondary-text-color:#777;--card-background-color:#fff}main{max-width:210px}</style><main></main>');
    await page.addScriptTag({ content: await readFile("dist/home-assistant-device-cards.js", "utf8"), type: "module" });
    await page.evaluate(() => {
      const card = document.createElement("power-strip-card");
      card.setConfig({ name: "Power Strip", icon_variant: "homekit", entities: Array.from({ length: 5 }, (_, i) => `switch.socket_${i}`) });
      card.hass = { states: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`switch.socket_${i}`, { state: i ? "off" : "on" }])), callService: async () => { throw new Error("Visual checks must not control devices"); } };
      document.querySelector("main").append(card);
    });
    const geometry = await page.locator("power-strip-card").evaluate(el => {
      const root = el.shadowRoot, icon = root.querySelector(".homekit"), svg = icon.querySelector("svg");
      const transformed = svg.getScreenCTM();
      return {
        transform: getComputedStyle(icon).transform,
        mask: getComputedStyle(icon).maskImage,
        canvas: [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height],
        size: [svg.getBoundingClientRect().width, svg.getBoundingClientRect().height],
        scaleX: Math.hypot(transformed.a, transformed.b),
        scaleY: Math.hypot(transformed.c, transformed.d),
        shear: transformed.a * transformed.c + transformed.b * transformed.d,
        circles: [...svg.querySelectorAll("circle")].map(circle => circle.r.baseVal.value),
        clearOfText: svg.getBoundingClientRect().right < root.querySelector(".entry-info").getBoundingClientRect().left,
      };
    });
    assert.equal(geometry.transform, "none");
    assert.equal(geometry.mask, "none");
    assert.deepEqual(geometry.canvas, [46, 46]);
    assert.ok(geometry.size.every(size => Math.abs(size - 27.54) < .02));
    assert.ok(Math.abs(geometry.scaleX - geometry.scaleY) < .000001);
    assert.ok(Math.abs(geometry.shear) < .000001);
    assert.equal(geometry.circles.length, 3);
    assert.ok(geometry.circles.every(radius => Math.abs(radius - 3.72657) < .000001));
    assert.equal(geometry.clearOfText, true);
    const proportions = await page.evaluate(() => {
      const single = document.querySelector("power-strip-card");
      const card = document.createElement("power-strip-card");
      card.setConfig({ name: "Six Sockets", icon_variant: "cn-six", entities: Array.from({ length: 6 }, (_, i) => `switch.socket_${i}`) });
      card.hass = { states: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`switch.socket_${i}`, { state: "on" }])), callService: async () => { throw new Error("No device calls in visual checks"); } };
      document.querySelector("main").append(card);
      const icon = card.shadowRoot.querySelector(".strip-icon"), style = getComputedStyle(icon);
      const uri = JSON.parse(style.maskImage.slice(4, -1));
      const xml = new DOMParser().parseFromString(decodeURIComponent(uri.slice(uri.indexOf(",") + 1)), "image/svg+xml");
      const box = xml.documentElement.getAttribute("viewBox").split(" ").map(Number);
      const rects = [...xml.querySelectorAll('g[fill="currentColor"]>rect')];
      const value = (node, attr) => Number(node.getAttribute(attr));
      const left = Math.min(...rects.map(rect => value(rect, "x")));
      const right = Math.max(...rects.map(rect => value(rect, "x") + value(rect, "width")));
      const factor = parseFloat(style.maskSize) / box[2];
      const svg = single.shadowRoot.querySelector("svg"), body = svg.querySelector('mask>path[fill="white"]').getBBox();
      const singleFactor = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return { widthRatio: (right - left) * factor / (body.width * singleFactor), heightRatio: value(rects[0], "height") * factor / (body.height * singleFactor) };
    });
    assert.ok(Math.abs(proportions.widthRatio - 1) < .01, "six-slot and single-row visible artwork should have equal width");
    assert.ok(Math.abs(proportions.heightRatio - 2) < .05, "six-slot visible artwork should be twice as tall");
    await page.locator("main").screenshot({ path: `test-results/strip-homekit-${width}-${deviceScaleFactor}.png` });
    await page.close();
  }
  console.log("HomeKit strip uses circular sockets and uniform vector transforms at desktop/mobile and 1x/2x pixel density.");
} finally { await browser.close(); }
