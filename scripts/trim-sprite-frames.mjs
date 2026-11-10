// AutoSprite's "Padded 2x" export draws the character in a 512 px frame so big moves are never cut, which leaves most
// of every frame empty: a 5x5 sheet is 2560x2560 (about 26 MB of GPU memory each). This crops every frame of a clip to
// the union of the character's alpha bounds across the whole clip (plus a margin, and always keeping the feet pivot),
// repacks the sheet with the same grid, and rewrites frameW / frameH / pivotX / pivotY in pack.json. The character's
// pixel size (charH) does not change, so it shows at exactly the same size and spot in the game.
//   node scripts/trim-sprite-frames.mjs <spriteId> [anim ...]
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , id, ...onlyAnims] = process.argv;
if (!id) {
  console.error('usage: node scripts/trim-sprite-frames.mjs <spriteId> [anim ...]');
  process.exit(1);
}
const dir = join(root, 'public', 'assets', 'art', 'sprites', id);
const packPath = join(dir, 'pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const MARGIN = 10;

for (const [name, a] of Object.entries(pack.animations)) {
  if (onlyAnims.length && !onlyAnims.includes(name)) continue;
  const file = join(dir, a.sheet);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const n = Array.isArray(a.frames) ? a.frames.length : a.frames;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let f = 0; f < n; f++) {
    const ox = (f % a.cols) * a.frameW;
    const oy = Math.floor(f / a.cols) * a.frameH;
    for (let y = 0; y < a.frameH; y++) {
      const row = (oy + y) * W;
      for (let x = 0; x < a.frameW; x++) {
        if (data[(row + ox + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) {
    console.log(`${id}/${name}: empty, skipped`);
    continue;
  }
  // keep the feet pivot inside the crop, then add a margin, clamped to the frame
  const px = a.pivotX * a.frameW;
  const py = a.pivotY * a.frameH;
  const left = Math.max(0, Math.floor(Math.min(minX, px) - MARGIN));
  const top = Math.max(0, Math.floor(Math.min(minY, py) - MARGIN));
  const right = Math.min(a.frameW, Math.ceil(Math.max(maxX + 1, px) + MARGIN));
  const bottom = Math.min(a.frameH, Math.ceil(Math.max(maxY + 1, py) + MARGIN));
  const nw = right - left;
  const nh = bottom - top;
  if (nw >= a.frameW * 0.95 && nh >= a.frameH * 0.95) {
    console.log(`${id}/${name}: already tight (${a.frameW}x${a.frameH}), kept`);
    continue;
  }
  const rows = Math.ceil(n / a.cols);
  const composites = [];
  for (let f = 0; f < n; f++) {
    const ox = (f % a.cols) * a.frameW;
    const oy = Math.floor(f / a.cols) * a.frameH;
    const tile = await sharp(file).extract({ left: ox + left, top: oy + top, width: nw, height: nh }).png().toBuffer();
    composites.push({ input: tile, left: (f % a.cols) * nw, top: Math.floor(f / a.cols) * nh });
  }
  const out = await sharp({ create: { width: nw * a.cols, height: nh * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(file, out);
  const before = `${a.frameW}x${a.frameH}`;
  a.pivotX = Math.round(((px - left) / nw) * 10000) / 10000;
  a.pivotY = Math.round(((py - top) / nh) * 10000) / 10000;
  a.frameW = nw;
  a.frameH = nh;
  console.log(`${id}/${name}: frame ${before} -> ${nw}x${nh}, sheet ${nw * a.cols}x${nh * rows}, pivot ${a.pivotX},${a.pivotY}`);
}
writeFileSync(packPath, JSON.stringify(pack, null, 2));
console.log('wrote', packPath);
