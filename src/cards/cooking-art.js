// Original theme-aware outline drawings shared by appliance tiles and dialogs.
export const cookingArtCss = `
.machine{display:grid;place-items:center;width:144px;height:144px;margin:16px auto 24px;border-radius:50%;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888)}
.machine svg{width:116px;height:116px}.appliance-drawing{display:block;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.appliance-icon{display:inline-flex;flex-shrink:0;width:28px;height:28px;color:var(--state-inactive-color,#999)}.appliance-icon svg{width:100%;height:100%;stroke-width:4.2}
header .appliance-icon{width:24px;height:24px;color:var(--primary-text-color,#444)}.entry.active>.appliance-icon{color:var(--state-active-color,#ff9800)}
`;
const cabinet = '<rect x="30" y="18" width="68" height="94" rx="5"/><path d="M30 38h68M44 47h40M36 104h56"/><rect x="40" y="25" width="18" height="6" rx="1.5"/><circle cx="86" cy="28" r="1.5"/><path d="M42 68v25h44V68M42 85h44M50 68v17m9-17v17m10-17v17m9-17v17"/>';
const sink = '<path d="M15 54h98M21 54v51h86V54M25 105v6m78-6v6M64 63v34M28 93h29M71 93h29"/><path d="M35 52V32a10 10 0 0 1 20 0v5m-4 0h8M30 44h10"/><rect x="28" y="61" width="29" height="27" rx="5"/><path d="M34 69v11m8-11v11m8-11v11M72 62h27v26H72zM77 68h17m-17 7h17m-17 7h17"/>';
const fryer = '<path d="M40 24h48a10 10 0 0 1 10 10v65a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10V34a10 10 0 0 1 10-10ZM30 64h68M37 109v4m54-4v4"/><rect x="49" y="36" width="30" height="13" rx="3"/><circle cx="42" cy="42" r="2"/><circle cx="86" cy="42" r="2"/><rect x="55" y="72" width="18" height="23" rx="4"/><path d="M43 29h42"/>';
const cooker = '<path d="M30 52h68v45a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12ZM26 52a38 24 0 0 1 76 0H26ZM29 62h-6v17h7m68-17h7v17h-7M40 109v4m48-4v4"/><path d="M49 27v-5a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v5M84 30v-5h5v7"/><rect x="48" y="66" width="32" height="15" rx="3"/><circle cx="48" cy="93" r="2"/><circle cx="64" cy="93" r="2"/><circle cx="80" cy="93" r="2"/>';
export function applianceSvg(kind, variant = "cabinet") {
  const paths = kind === "dishwasher" ? (variant === "sink" ? sink : cabinet) : kind === "air-fryer" ? fryer : cooker;
  return `<svg class="appliance-drawing" viewBox="0 0 128 128" aria-hidden="true">${paths}</svg>`;
}
export const cookingArt = (kind, variant) => `<div class="machine" aria-hidden="true">${applianceSvg(kind, variant)}</div>`;
