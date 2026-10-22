// Original theme-aware silhouettes shared by appliance tiles and dialogs.
export const cookingArtCss = `
:host{container-type:inline-size}@container(max-width:160px){.entry{gap:8px}.entry .name{font-size:12px}}
.machine{display:grid;place-items:center;width:144px;height:144px;margin:16px auto 24px;border-radius:50%;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888)}
.machine svg{width:116px;height:116px}.appliance-drawing{display:block;fill:currentColor;stroke:none}
.appliance-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:40px;height:40px;border-radius:50%;color:var(--state-inactive-color,#9e9e9e);background:color-mix(in srgb,currentColor 16%,transparent)}.appliance-icon svg{width:24px;height:24px}
header .appliance-icon{width:24px;height:24px;border-radius:0;background:none;color:var(--primary-text-color,#444)}.entry.active>.appliance-icon{color:var(--state-active-color,#ff9800)}
`;
const cabinet = '<path fill-rule="evenodd" d="M30 16h68a6 6 0 0 1 6 6v88a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6Zm10 12v6h24v-6Zm46 0v6h6v-6ZM24 44v6h80v-6Zm12 18v34h56V62Z"/><path d="M48 68h6v22h-6zm13-2h6v24h-6zm13 2h6v22h-6z"/>';
const sink = '<path fill-rule="evenodd" d="M12 50h104v10h-6v44a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V60h-6Zm16 12v34h28V62Zm40 0v34h32V62Z"/><path d="M32 50V30a16 16 0 0 1 32 0v8H54v-8a6 6 0 0 0-12 0v20Z"/>';
const fryer = '<path fill-rule="evenodd" d="M48 16h32a18 18 0 0 1 18 18v64a18 18 0 0 1-18 18H48a18 18 0 0 1-18-18V34a18 18 0 0 1 18-18Zm0 19v6h32v-6ZM36 58v6h56v-6Zm23 18v16h10V76Z"/>';
const cooker = '<path d="M28 50h72v40a20 20 0 0 1-20 20H48a20 20 0 0 1-20-20Zm-12 6h10v16H16Zm86 0h10v16h-10Z"/><path fill-rule="evenodd" d="M24 40h24V26h32v14h24v8H24Zm34-6v6h12v-6Z"/>';
export function applianceSvg(kind, variant = "cabinet") {
  const paths = kind === "dishwasher" ? (variant === "sink" ? sink : cabinet) : kind === "air-fryer" ? fryer : cooker;
  return `<svg class="appliance-drawing" viewBox="0 0 128 128" aria-hidden="true">${paths}</svg>`;
}
export const cookingArt = (kind, variant) => `<div class="machine" aria-hidden="true">${applianceSvg(kind, variant)}</div>`;
