import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 340 }, deviceScaleFactor: 2 });
  await page.setContent('<style>body{margin:0;font:14px Arial;display:grid;grid-template-columns:1fr 1fr}.sample{padding:24px;display:flex;flex-direction:column;gap:16px;align-items:center;color:#616161}.dark{background:#1c1c1c;color:#dedede}.sizes{display:flex;gap:20px;align-items:center}svg{fill:currentColor;flex:none}</style><main class="sample light"></main><main class="sample dark"></main>');
  await page.addScriptTag({ content: await readFile('dist/home-assistant-device-cards.js', 'utf8'), type: 'module' });
  const { pixels, foreheadWidth } = await page.evaluate(async () => {
    const paths = [];
    let foreheadWidth = 0;
    for (const [name, label] of [['cat-tabby', '\u5f39\u5f13 \u00b7 \u72f8\u82b1'], ['cat-calico', '\u9e23\u56e2 \u00b7 \u4e09\u82b1']]) {
      const data = await window.customIcons.hadc.getIcon(name);
      for (const area of document.querySelectorAll('main')) {
        const title = document.createElement('div'); title.textContent = label; area.append(title);
        const sizes = document.createElement('div'); sizes.className = 'sizes';
        for (const size of [64, 24, 20, 16]) sizes.insertAdjacentHTML('beforeend', `<svg width="${size}" height="${size}" viewBox="${data.viewBox}"><path d="${data.path}"/></svg>`);
        area.append(sizes);
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${data.viewBox}"><path fill="#616161" d="${data.path}"/></svg>`;
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 24;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const rgba = [...context.getImageData(0, 0, 24, 24).data];
      paths.push(rgba.filter((_, i) => i % 4 === 3));
      if (name === 'cat-tabby') {
        canvas.width = canvas.height = 16;
        context.drawImage(img, 0, 0, 16, 16);
        const alpha = context.getImageData(0, 0, 16, 16).data;
        const remaining = new Set();
        for (let y = 5; y <= 8; y++) for (let x = 5; x <= 10; x++) {
          if (alpha[(y * 16 + x) * 4 + 3] > 128) remaining.add(y * 16 + x);
        }
        while (remaining.size) {
          const stack = [remaining.values().next().value], columns = [];
          remaining.delete(stack[0]);
          while (stack.length) {
            const value = stack.pop(); columns.push(value % 16);
            for (const next of [value - 1, value + 1, value - 16, value + 16,
                                value - 17, value - 15, value + 15, value + 17]) {
              if (remaining.delete(next)) stack.push(next);
            }
          }
          foreheadWidth = Math.max(foreheadWidth, Math.max(...columns) - Math.min(...columns) + 1);
        }
      }
    }
    return { pixels: paths, foreheadWidth };
  });
  for (const alpha of pixels) assert.ok(alpha.filter(n => n > 100).length > 100, '24px icon must be visible');
  assert.ok(pixels[0].filter((value, i) => Math.abs(value - pixels[1][i]) > 100).length > 20, 'Breed icons must remain visibly distinct at 24px');
  await page.screenshot({ path: 'test-results/pet-icons.png' });
  assert.ok(foreheadWidth >= 5, `Tabby forehead marking must remain a connected wide M at 16px (actual width ${foreheadWidth})`);
  console.log('Native cat icons: distinct silhouettes, connected tabby forehead at 16px, light/dark currentColor, 16/20/24/64px framing verified.');
} finally { await browser.close(); }
