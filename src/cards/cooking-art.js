// Original theme-aware silhouettes shared by appliance tiles and dialogs.
export const cookingArtCss = `
:host{container-type:inline-size}@container(max-width:160px){.entry{gap:8px}.entry .name{font-size:12px}}
.machine{display:grid;place-items:center;width:144px;height:144px;margin:16px auto 24px;border-radius:50%;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888)}
.machine svg{width:116px;height:116px}.appliance-drawing{display:block;fill:currentColor;stroke:none}
.appliance-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:32px;height:32px;border-radius:0;color:var(--state-inactive-color,var(--secondary-text-color,#777));background:none;box-shadow:none}.appliance-icon svg{width:32px;height:32px}
header .appliance-icon,header .appliance-icon svg{width:24px;height:24px}header .appliance-icon{color:var(--primary-text-color,#444)}.entry.active>.appliance-icon{color:var(--state-sensor-active-color,var(--primary-color,#03a9f4))}
`;
const cabinet = '<path fill-rule="evenodd" d="M30 16h68a6 6 0 0 1 6 6v88a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6Zm10 12v6h24v-6Zm46 0v6h6v-6ZM24 44v6h80v-6Zm12 18v34h56V62Z"/><path d="M48 68h6v22h-6zm13-2h6v24h-6zm13 2h6v22h-6z"/>';
const sink = '<path fill-rule="evenodd" d="M12 50h104v10h-6v44a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V60h-6Zm16 12v34h28V62Zm40 0v34h32V62Z"/><path d="M32 50V30a16 16 0 0 1 32 0v8H54v-8a6 6 0 0 0-12 0v20Z"/>';
const fryer = '<path fill-rule="evenodd" d="M39.6 16h48.8a14 14 0 0 1 14 14v68a14 14 0 0 1-14 14H39.6a14 14 0 0 1-14-14V30a14 14 0 0 1 14-14ZM31.6 29v4Q64 43 96.4 33v-4Q64 39 31.6 29ZM64 41a10 10 0 1 0 0 20a10 10 0 0 0 0-20ZM25.6 66v5Q64 83 102.4 71v-5Q64 78 25.6 66ZM58 83v20a6 6 0 0 0 12 0V83a6 6 0 0 0-12 0Z"/>';
const cooker = '<path fill-rule="evenodd" d="M24 53Q64 65 104 53V96Q104 114 64 114T24 96ZM46 73V83H82V73Z"/><path d="M24 46V39Q24 27 64 27T104 39V46Q64 58 24 46ZM44 24V16Q44 12 48 12H76Q80 12 80 16V24ZM86 23V15Q86 11 90 11T94 15V25Z"/>';
export function applianceSvg(kind, variant = "cabinet") {
  const paths = kind === "dishwasher" ? (variant === "sink" ? sink : cabinet) : kind === "air-fryer" ? fryer : cooker;
  return `<svg class="appliance-drawing" viewBox="0 0 128 128" aria-hidden="true">${paths}</svg>`;
}
export const cookingArt = (kind, variant) => `<div class="machine" aria-hidden="true">${applianceSvg(kind, variant)}</div>`;
