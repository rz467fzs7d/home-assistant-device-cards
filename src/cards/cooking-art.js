// SPDX-License-Identifier: MIT
// Appliance silhouettes adapted from ADNPolymerase/ha-appliance-card v2.30.0.
// Copyright (c) 2026 ADNPolymerase. See NOTICE.md.
export const cookingArtCss = `
.machine{position:relative;width:96px;height:108px;margin:12px auto 20px;--ac-body:#d7d7d7;--ac-body-hi:#eeeeee;--ac-body-lo:#bdbdbd}
.af-body{position:absolute;border-radius:16px 16px 7px 7px;background:linear-gradient(90deg,var(--ac-body-lo),var(--ac-body-hi) 30%,var(--ac-body) 70%,var(--ac-body-lo));box-shadow:inset 0 0 0 1px #0003;left:21px;right:21px;top:20px;bottom:9px}
.af-vent{position:absolute;height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,#0007 0 1.2px,transparent 1.2px 3px);left:34px;right:34px;top:24px}
.af-seam{position:absolute;height:1.5px;background:#0005;left:21px;right:21px;top:52px}
.af-drawer{position:absolute;border-radius:3px 3px 8px 8px;background:linear-gradient(90deg,var(--ac-body-lo),var(--ac-body) 35%,var(--ac-body-hi) 60%,var(--ac-body-lo));box-shadow:inset 0 0 0 1px #0003;left:21px;right:21px;top:53px;bottom:9px}
.af-handle{position:absolute;border-radius:3px;background:linear-gradient(180deg,#5f666e,#2b3036);box-shadow:0 1px 1px #0005;left:15px;width:24px;top:13px;height:13px}
.af-btn{position:absolute;width:5px;height:2px;border-radius:1px;background:#90a4ae;left:9.5px;top:1.5px}
.af-foot{position:absolute;bottom:5px;width:9px;height:3px;border-radius:0 0 3px 3px;background:#555}.af-foot.f1{left:25px}.af-foot.f2{right:25px}
.af-led{position:absolute;width:3px;height:3px;border-radius:50%;background:#777;left:46.5px;top:43px}
.machine.heating .af-led,.machine.heating .af-seam{background:var(--state-active-color,#ff9800)}
.rk-body{position:absolute;left:8px;right:8px;top:34px;bottom:8px;border-radius:12px 12px 16px 16px;background:linear-gradient(105deg,var(--ac-body),var(--ac-body-hi) 55%,var(--ac-body-lo));border:1px solid #aaa}
.rk-lid{position:absolute;left:12px;right:12px;top:22px;height:16px;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,var(--ac-body-hi),var(--ac-body));border:1px solid #aaa}
.rk-vent{position:absolute;left:50%;top:15px;width:14px;height:9px;margin-left:-7px;border-radius:4px 4px 2px 2px;background:#777}
.rk-handle{position:absolute;left:20px;right:20px;top:8px;height:10px;border:2.5px solid #777;border-bottom:none;border-radius:10px 10px 0 0}
.rk-disp{position:absolute;left:50%;top:12px;transform:translateX(-50%);min-width:32px;height:12px;padding:0 3px;border-radius:2px;background:#14161a;color:#aaa;text-align:center;font:600 8px/12px monospace}
.rk-key{position:absolute;top:32px;width:8px;height:8px;border-radius:50%;background:#999}.rk-key.k1{left:22px}.rk-key.k2{left:34px}.rk-key.k3{left:46px}
.rk-foot{position:absolute;left:20px;right:20px;bottom:4px;height:4px;border-radius:2px;background:#777}.machine.heating .rk-foot,.machine.heating .rk-disp{color:var(--state-active-color,#ff9800)}
.dw-body{position:absolute;inset:0;border-radius:10px 10px 6px 6px;background:linear-gradient(145deg,var(--ac-body,#d7d7d7),var(--ac-body-lo,#aeb2b5));border:1px solid var(--divider-color,#c7c7c7);perspective:260px}
.dw-controls{position:absolute;top:6px;left:8px;right:8px;height:12px;border:1px solid #fff2;border-radius:3px;background:#141617c7}
.dw-controls::before,.dw-controls::after{content:"";position:absolute;top:3px;width:4px;height:4px;border-radius:50%;background:#697078}.dw-controls::before{right:5px}.dw-controls::after{right:12px}
.dw-screen{position:absolute;top:2px;left:4px;width:24px;height:6px;border-radius:2px;background:#16292e;box-shadow:inset 0 0 0 1px #81d5cd4d}
.dw-cavity{position:absolute;top:22px;right:8px;bottom:8px;left:8px;overflow:hidden;border:3px solid #34383b;border-radius:4px;background:linear-gradient(180deg,#33474f,#7d8f95);box-shadow:inset 0 0 10px #0005}
.dw-rack{position:absolute;right:10%;bottom:13%;left:10%;height:34%;border-top:1px solid #dee8ebc2;border-bottom:1px solid #dee8eb80;background:repeating-linear-gradient(90deg,transparent 0 7px,#dee8eb94 8px 9px);transform:perspective(100px) rotateX(18deg)}
.dw-door{position:absolute;top:22px;right:8px;bottom:8px;left:8px;z-index:5;border:3px solid #34383b;border-radius:4px;background:linear-gradient(180deg,#0e141880,#0e1418bd);box-shadow:inset 0 0 0 1px #e1ebec4d,0 3px 5px #0004;transform-origin:50% 100%}
.dw-door::after{content:"";position:absolute;inset:0;border-radius:2px;background:linear-gradient(116deg,#ffffff2b 0 17%,transparent 40%)}
.dw-door::before{content:"";position:absolute;top:4px;right:18%;left:18%;height:2px;border-radius:8px;background:#e1e7e899}
.dw-spray{position:absolute;top:21%;left:10%;width:80%;height:5px;border-radius:8px;background:var(--primary-color,#03a9f4);opacity:0;transform-origin:50% 50%}
.machine.spinning .dw-spray{opacity:1;animation:dw-spray-spin 2.8s linear infinite}.machine.spinning .dw-door{background:linear-gradient(180deg,#121a1e14,#121a1e4d)}
@keyframes dw-spray-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.machine.spinning .dw-spray{animation:none}}
`;
export const cookingArt = kind => kind === "dishwasher"
  ? '<div class="machine"><div class="dw-body"><div class="dw-controls"><div class="dw-screen"></div></div><div class="dw-cavity"><div class="dw-rack"></div><div class="dw-spray"></div></div><div class="dw-door" aria-hidden="true"></div></div></div>'
  : kind === "air-fryer"
  ? '<div class="machine"><div class="af-body"></div><div class="af-vent"></div><div class="af-led"></div><div class="af-seam"></div><div class="af-drawer"><div class="af-handle"><div class="af-btn"></div></div></div><div class="af-foot f1"></div><div class="af-foot f2"></div></div>'
  : '<div class="machine"><div class="rk-handle"></div><div class="rk-vent"></div><div class="rk-lid"></div><div class="rk-body"><div class="rk-disp">--</div><div class="rk-key k1"></div><div class="rk-key k2"></div><div class="rk-key k3"></div></div><div class="rk-foot"></div></div>';
