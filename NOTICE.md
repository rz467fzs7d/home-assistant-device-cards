# Third-party artwork

`src/cards/cooking-art.js` contains original SVG silhouette drawings.
Versions 0.11 and 0.12 used silhouettes adapted from
ADNPolymerase/ha-appliance-card v2.30.0 (MIT, Copyright (c) 2026 ADNPolymerase).
Those silhouettes were replaced with original line art in version 0.13.

`src/assets/powerstrip.svg`:
- Title: Powerstrip
- Source: https://www.svgrepo.com/svg/298/powerstrip
- Uploader: SVG Repo
- License: CC0, as listed on the source page on 2026-10-20.
- The original artwork is unchanged; runtime coloring uses a CSS mask.

Home Assistant is a separate project. This library is a community extension,
not an official Home Assistant product.

`src/assets/homepod.svg`, `src/assets/homepod-mini.svg` and `src/assets/apple-tv.svg`:
- Source: https://github.com/elax46/custom-brand-icons/tree/main/icon-svg
- License: MIT (retrieved 2026-10-20).
- Fill color removed for theme-aware CSS masks. Paired layouts are composed
  by this library. These are community icons, not Apple SF Symbols.

`src/assets/powerstrip-cn-*.svg`:
- Source: https://github.com/elax46/custom-brand-icons/blob/main/icon-svg/smart-power-strip.svg
- License: MIT, as reproduced below.
- Adaptations retain the original case and circular socket styling, remove the
  master switch, and use Chinese five-hole socket markings. Variants include
  six staggered sockets with four decorative USB ports, six staggered sockets
  without USB, and four or five inline sockets without USB.
- USB ports in these illustrations do not imply independently controllable
  entities. These assets do not certify electrical standards compliance.
- The `*-inline-cord*.svg` variants reuse the cord geometry from SVG Repo
  Powerstrip 298 (CC0, credited above), scaled to fit the case.

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Apple, HomePod and Apple TV are trademarks of Apple Inc. This project is not
affiliated with or endorsed by Apple.

The optional HomeKit power-strip artwork is Apple's SF Symbol
`poweroutlet.strip.fill`, sourced from husker-dev/sf-symbols
(mono/poweroutlet.strip.fill.svg). Apple symbol artwork is not covered by
this project's MIT license; Apple's applicable SF Symbols terms apply.
