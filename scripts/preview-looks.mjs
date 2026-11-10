// Renders recoloured variants with the same colour matrix the game uses (CSS filter order: hue-rotate, saturate,
// brightness; src/content/themes.ts lookMatrix), so a look can be judged before it ships.
//   node scripts/preview-looks.mjs <bible.json> <out.jpg>
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , biblePath, out] = process.argv;
const bible = JSON.parse(readFileSync(biblePath, 'utf8'));

/** 3x3 colour matrix of CSS hue-rotate(h) saturate(s) brightness(b), as in the Filter Effects spec. */
function lookMatrix({ hue = 0, saturate = 1, brightness = 1 }) {
  const r = (hue * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const H = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
  const t = saturate;
  const Sm = [
    [0.213 + 0.787 * t, 0.715 - 0.715 * t, 0.072 - 0.072 * t],
    [0.213 - 0.213 * t, 0.715 + 0.285 * t, 0.072 - 0.072 * t],
    [0.213 - 0.213 * t, 0.715 - 0.715 * t, 0.072 + 0.928 * t],
  ];
  const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
  return mul(Sm, H).map((row) => row.map((v) => v * brightness));
}

const vs = bible.themes.flatMap((t) => t.variants);
const W = 200;
const H = 210;
const cols = 8;
const rows = Math.ceil(vs.length / cols);
const comps = [];
for (let i = 0; i < vs.length; i++) {
  const v = vs[i];
  const { data, info } = await sharp(join(root, 'public/assets/art/sprites', `${v.base}.png`)).resize({ width: W - 10, height: H - 30, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const M = lookMatrix(v.look);
  for (let p = 0; p < data.length; p += 4) {
    const R = data[p], G = data[p + 1], B = data[p + 2];
    data[p] = Math.max(0, Math.min(255, M[0][0] * R + M[0][1] * G + M[0][2] * B));
    data[p + 1] = Math.max(0, Math.min(255, M[1][0] * R + M[1][1] * G + M[1][2] * B));
    data[p + 2] = Math.max(0, Math.min(255, M[2][0] * R + M[2][1] * G + M[2][2] * B));
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="24"><text x="4" y="16" font-size="13" fill="#fff" font-family="sans-serif">${v.name}</text></svg>`);
  comps.push({ input: png, left: (i % cols) * W + 5, top: Math.floor(i / cols) * H + 24 }, { input: label, left: (i % cols) * W, top: Math.floor(i / cols) * H });
}
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#1b2626' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
console.log('written', out, vs.length);
