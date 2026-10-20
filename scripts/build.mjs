import { build } from "esbuild";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
await build({
  entryPoints: ["src/index.js"],
  outfile: "dist/home-assistant-device-cards.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  loader: { ".svg": "text" },
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: `/* Home Assistant Device Cards ${version} | MIT | Powerstrip artwork: SVG Repo, CC0 */` }
});
