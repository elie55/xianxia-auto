// Jade-and-gold calligraphy brush cursors (tip at the top-left = hotspot 2,2), drawn as SVG and rendered at 1x and 2x.
//   normal: ink tip, jade handle, gold ferrule; hover: the tip glows gold; down: pressed in, with a drop of ink.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const S = Math.SQRT1_2;
// a point at distance t along the brush axis (from the tip at 2,2 toward the bottom-right), offset w across it
const P = (t, w, ox = 0, oy = 0) => [2 + t * S + w * S + ox, 2 + t * S - w * S + oy];
const poly = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';

function brush({ hover = false, down = false } = {}) {
  const o = down ? 1.2 : 0;
  // bristles: a teardrop from the tip (t=0) to the ferrule (t=11)
  const bristle = [];
  for (let t = 0; t <= 11; t += 0.5) bristle.push(P(t, Math.sin((t / 11) * Math.PI * 0.62) * 2.9, o, o));
  for (let t = 11; t >= 0; t -= 0.5) bristle.push(P(t, -Math.sin((t / 11) * Math.PI * 0.62) * 2.9, o, o));
  const ferrule = poly([P(10.6, 3.1, o, o), P(14.4, 3.1, o, o), P(14.4, -3.1, o, o), P(10.6, -3.1, o, o)]);
  const handle = poly([P(14.2, 2.5, o, o), P(36.5, 2.1, o, o), P(37.6, 0, o, o), P(36.5, -2.1, o, o), P(14.2, -2.5, o, o)]);
  const band = poly([P(31, 2.25, o, o), P(32.4, 2.2, o, o), P(32.4, -2.2, o, o), P(31, -2.25, o, o)]);
  const [tx, ty] = P(0, 0, o, o);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="jade" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0d4a3b"/><stop offset="0.5" stop-color="#3fbf9f"/><stop offset="1" stop-color="#0f5444"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9d7024"/><stop offset="0.5" stop-color="#ffe7a8"/><stop offset="1" stop-color="#b8862e"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffe7a8" stop-opacity="0.95"/><stop offset="1" stop-color="#f3cf78" stop-opacity="0"/></radialGradient>
  </defs>
  ${hover ? `<circle cx="${tx + 2.5}" cy="${ty + 2.5}" r="6.5" fill="url(#glow)"/>` : ''}
  ${down ? `<circle cx="${tx - 0.2}" cy="${ty - 0.2}" r="1.9" fill="#0a0f0f"/>` : ''}
  <path d="${handle}" fill="url(#jade)" stroke="#041010" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="${band}" fill="url(#gold)"/>
  <path d="${ferrule}" fill="url(#gold)" stroke="#4a3208" stroke-width="0.7"/>
  <path d="${poly(bristle)}" fill="${hover ? '#2a1e08' : '#0d1212'}" stroke="${hover ? '#f3cf78' : '#000'}" stroke-width="${hover ? 0.8 : 0.6}" stroke-linejoin="round"/>
</svg>`;
}

for (const [name, opts] of [
  ['cursor_brush', {}],
  ['cursor_brush_hover', { hover: true }],
  ['cursor_brush_down', { down: true }],
]) {
  const svg = Buffer.from(brush(opts));
  await sharp(svg, { density: 72 }).resize(32, 32).png().toFile(`${out}/${name}.png`);
  await sharp(svg, { density: 144 }).resize(64, 64).png().toFile(`${out}/${name}@2x.png`);
}
console.log('cursors written to', out);
