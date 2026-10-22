import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const bundle = readFileSync("dist/home-assistant-device-cards.js", "utf8");

function setup() {
  const window = new Window();
  window.eval(bundle);
  const card = window.document.createElement("power-strip-card");
  window.document.body.append(card);
  const calls = [];
  card.setConfig({ entities: ["switch.one", "light.two", "switch.missing"] });
  card.hass = {
    states: { "switch.one": { state: "on" }, "light.two": { state: "off" } },
    callService: async (...args) => { calls.push(args); }
  };
  return { window, card, calls };
}
test("counts, unavailable and embedded icon", () => {
  const { card } = setup();
  assert.equal(card.shadowRoot.querySelector(".summary").textContent, "1 On · 1 Off · 1 unavailable");
  assert.equal(card.shadowRoot.querySelectorAll(".outlet").length, 3);
  assert.equal(card.shadowRoot.querySelectorAll(".outlet")[2].disabled, true);
  assert.match(card.shadowRoot.querySelector("style").textContent, /data:image\/svg\+xml/);
  assert.ok(!bundle.includes("/local/powerstrip.svg"));
  const css = card.shadowRoot.querySelector("style").textContent;
  const iconUrl = css.match(/mask:url\("([^"]+)"\)/)?.[1];
  assert.ok(iconUrl, "SVG URL must not contain unescaped CSS string quotes");
  assert.match(decodeURIComponent(iconUrl.split(",")[1]), /<svg/);
  assert.match(decodeURIComponent(iconUrl.split(",")[1]), /<\/svg>/);
});
test("summary hides zero counts in both tile and dialog", () => {
  const { card } = setup();
  for (const [state, expected] of [["on", "3 On"], ["off", "3 Off"], ["unavailable", "3 unavailable"]]) {
    card.hass = { states: Object.fromEntries(["switch.one", "light.two", "switch.missing"]
      .map(id => [id, { state }])) };
    for (const summary of card.shadowRoot.querySelectorAll(".summary")) {
      assert.equal(summary.textContent, expected);
    }
  }
  card.hass = { states: { "switch.one": { state: "on" }, "light.two": { state: "on" } } };
  assert.equal(card.shadowRoot.querySelector(".summary").textContent, "2 On · 1 unavailable");
});
test("appearance changes only artwork, not outlet controls", () => {
  const { card } = setup();
  for (const icon_variant of ["homekit", "cn-six", "cn-six-usb", "cn-five-cord-right", "cn-five-cord-left", "cn-five-cord-right-tilted", "cn-three-cord-right-tilted"]) {
    card.setConfig({ icon_variant, entities: ["switch.one", "light.two"] });
    assert.equal(card.shadowRoot.querySelectorAll(".outlet").length, 2);
    assert.equal(card.shadowRoot.querySelector(".summary").textContent, "1 On · 1 Off");
    const css = card.shadowRoot.querySelector("style").textContent;
    const svg = decodeURIComponent(css.match(/mask:url\("([^"]+)"\)/)[1].split(",")[1]);
    assert.match(svg, /id="cutouts"/);
    if (icon_variant === "cn-six") {
      assert.match(svg, /width="11.9" height="6.9" rx="1.2"/);
      assert.equal((svg.match(/<use /g) || []).length, 6);
    }
    assert.ok(css.includes(`transform:scale(${icon_variant.endsWith("-tilted") ? 1.4 : 1})`));
    if (icon_variant === "homekit") {
      const parser = new card.ownerDocument.defaultView.DOMParser();
      const root = parser.parseFromString(svg, "image/svg+xml").documentElement;
      const viewBox = root.getAttribute("viewBox").split(/\s+/).map(Number);
      assert.equal(viewBox[2], viewBox[3], "source icon canvas must be square before rotation");
      assert.equal(root.getAttribute("width"), root.getAttribute("height"));
      assert.equal(root.getAttribute("preserveAspectRatio"), "xMidYMid meet");
      assert.doesNotMatch(svg, /scale\(/, "raw artwork must not be stretched");
      assert.doesNotMatch(svg, /rotate\(/, "HomeKit icon must remain horizontal");
      assert.equal(root.querySelectorAll("circle").length, 3);
      assert.equal(root.querySelectorAll("ellipse").length, 0);
      assert.ok(card.shadowRoot.querySelector(".homekit>svg"));
    }
    if (icon_variant === "cn-three-cord-right-tilted") {
      assert.equal((svg.match(/<use /g) || []).length, 3);
      assert.match(svg, /rotate\(-25\) scale\(\.95\)/);
      assert.doesNotMatch(svg, /scale\([^)]*[ ,][^)]*\)/, "socket artwork must never stretch non-uniformly");
    }
  }
  assert.throws(() => card.setConfig({ entities: ["switch.one"], icon_variant: "bogus" }), /icon_variant/);
});
test("individual controls, service errors, confirmation and duplicate protection", async () => {
  const { window, card, calls } = setup();
  await card.toggle({ entity: "switch.one" });
  await card.toggle({ entity: "light.two" });
  assert.deepEqual(calls.map(c => [c[0], c[1], c[2].entity_id]),
    [["switch", "turn_off", "switch.one"], ["light", "turn_on", "light.two"]]);
  await card.toggle({ entity: "switch.missing" });
  card.pending.add("switch.one");
  await card.toggle({ entity: "switch.one" });
  card.pending.clear();
  window.confirm = () => false;
  await card.toggle({ entity: "switch.one", confirmation: true });
  assert.equal(calls.length, 2);
  card._hass.callService = async () => { throw new Error("Rejected"); };
  await card.toggle({ entity: "switch.one" });
  assert.equal(card.shadowRoot.querySelector(".error").textContent, "Rejected");
  assert.equal(card.pending.size, 0);
});
test("validates domains and preserves literal names", () => {
  const { card } = setup();
  assert.throws(() => card.setConfig({ entities: ["sensor.no"] }), /switch and light/);
  card.setConfig({ name: "<img onerror=alert(1)>", entities: ["switch.one"] });
  assert.equal(card.shadowRoot.querySelector(".name").textContent, "<img onerror=alert(1)>");
  assert.equal(card.shadowRoot.querySelectorAll("img").length, 0);
});
test("editor supports selection, names, order, removal and append", () => {
  const { window, card } = setup();
  const editor = card.constructor.getConfigElement();
  editor.setConfig({ type: "custom:power-strip-card", entities: ["switch.one", "light.two"] });
  editor.hass = card._hass;
  window.document.body.append(editor);
  let config;
  editor.addEventListener("config-changed", e => { config = e.detail.config; });
  const selector = editor.shadowRoot.querySelector("ha-selector");
  selector.dispatchEvent(new window.CustomEvent("value-changed", { detail: { value: "switch.new" } }));
  assert.equal(config.entities[0].entity, "switch.new");
  editor.shadowRoot.querySelector('[aria-label="Move down"]').click();
  assert.equal(config.entities[0].entity, "light.two");
  editor.shadowRoot.querySelector('[aria-label="Remove outlet"]').click();
  assert.equal(config.entities.length, 1);
  editor.shadowRoot.querySelector('[aria-label="Add outlet"]').click();
  assert.equal(config.entities.length, 2);
  const appearance = editor.shadowRoot.querySelector("select");
  appearance.value = "cn-six-usb";
  appearance.dispatchEvent(new window.Event("change"));
  assert.equal(config.icon_variant, "cn-six-usb");
  assert.equal(config.entities.length, 2);
});
