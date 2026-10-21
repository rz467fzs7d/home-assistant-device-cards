// Original theme-aware outline drawings shared by appliance tiles and dialogs.
export const cookingArtCss = `
.machine{display:grid;place-items:center;width:144px;height:144px;margin:16px auto 24px;border-radius:50%;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888)}
.machine svg{width:116px;height:116px}.appliance-drawing{display:block;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.appliance-icon{display:inline-flex;flex-shrink:0;width:28px;height:28px;color:var(--state-inactive-color,#999)}.appliance-icon svg{width:100%;height:100%;stroke-width:4.2}
header .appliance-icon{width:24px;height:24px;color:var(--primary-text-color,#444)}.entry.active>.appliance-icon{color:var(--state-active-color,#ff9800)}
`;
const cabinet = '<rect x="30" y="18" width="68" height="94" rx="5"/><path d="M30 38h68M44 47h40M36 104h56"/><rect x="40" y="25" width="18" height="6" rx="1.5"/><circle cx="86" cy="28" r="1.5"/><path d="M42 68v25h44V68M42 85h44M50 68v17m9-17v17m10-17v17m9-17v17"/>';
const sink = '<path d="M15 54h98M21 54v51h86V54M25 105v6m78-6v6M64 63v34M28 93h29M71 93h29"/><path d="M35 52V32a10 10 0 0 1 20 0v5m-4 0h8M30 44h10"/><rect x="28" y="61" width="29" height="27" rx="5"/><path d="M34 69v11m8-11v11m8-11v11M72 62h27v26H72zM77 68h17m-17 7h17m-17 7h17"/>';
const fryer = '<rect x="32" y="20" width="64" height="88" rx="16"/><path d="M32 56h64M64 72v16"/>';
const cooker = '<path d="M32 46h64v46a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16ZM26 46h76"/><path d="M50 46V30h28v16M88 46V36"/>';
export function applianceSvg(kind, variant = "cabinet") {
  const paths = kind === "dishwasher" ? (variant === "sink" ? sink : cabinet) : kind === "air-fryer" ? fryer : cooker;
  return `<svg class="appliance-drawing" viewBox="0 0 128 128" aria-hidden="true">${paths}</svg>`;
}
export const cookingArt = (kind, variant) => `<div class="machine" aria-hidden="true">${applianceSvg(kind, variant)}</div>`;
