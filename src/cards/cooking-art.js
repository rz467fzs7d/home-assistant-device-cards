// Original theme-aware outline drawings shared by appliance tiles and dialogs.
export const cookingArtCss = `
.machine{display:grid;place-items:center;width:144px;height:144px;margin:16px auto 24px;border-radius:50%;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888)}
.machine svg{width:116px;height:116px}.appliance-drawing{display:block;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.appliance-icon{display:inline-flex;flex-shrink:0;width:28px;height:28px;color:var(--state-inactive-color,#999)}.appliance-icon svg{width:100%;height:100%;stroke-width:4.2}
header .appliance-icon{width:24px;height:24px;color:var(--primary-text-color,#444)}.entry.active>.appliance-icon{color:var(--state-active-color,#ff9800)}
`;
const cabinet = '<rect x="30" y="18" width="68" height="94" rx="5"/><path d="M30 38h68M44 47h40M36 104h56"/><rect x="40" y="25" width="18" height="6" rx="1.5"/><circle cx="86" cy="28" r="1.5"/><path d="M42 68v25h44V68M42 85h44M50 68v17m9-17v17m10-17v17m9-17v17"/>';
const sink = '<path d="M15 54h98M21 54v51h86V54M25 105v6m78-6v6M64 63v34M28 93h29M71 93h29"/><path d="M35 52V32a10 10 0 0 1 20 0v5m-4 0h8M30 44h10"/><rect x="28" y="61" width="29" height="27" rx="5"/><path d="M34 69v11m8-11v11m8-11v11M72 62h27v26H72zM77 68h17m-17 7h17m-17 7h17"/>';
const fryer = '<rect x="32" y="20" width="64" height="88" rx="14"/><path d="M33 62h62M43 108v4m42-4v4M44 27h40"/><rect x="47" y="35" width="34" height="14" rx="4"/><path d="M57 42h14"/><rect x="56" y="69" width="16" height="25" rx="5"/><path d="M61 75h6"/>';
const cooker = '<path d="M34 48h60v48a12 12 0 0 1-12 12H46a12 12 0 0 1-12-12ZM43 108v4m42-4v4M34 59H23v14h11m60-14h11v14H94"/><rect x="28" y="33" width="72" height="15" rx="5"/><path d="M49 33v-9a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v9M85 33v-7h7v7M40 41h48"/><rect x="48" y="62" width="32" height="17" rx="4"/><path d="M57 70h14M51 91h4m7 0h4m7 0h4"/>';
export function applianceSvg(kind, variant = "cabinet") {
  const paths = kind === "dishwasher" ? (variant === "sink" ? sink : cabinet) : kind === "air-fryer" ? fryer : cooker;
  return `<svg class="appliance-drawing" viewBox="0 0 128 128" aria-hidden="true">${paths}</svg>`;
}
export const cookingArt = (kind, variant) => `<div class="machine" aria-hidden="true">${applianceSvg(kind, variant)}</div>`;
