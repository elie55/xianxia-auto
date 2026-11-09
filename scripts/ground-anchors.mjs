// Recomputes sprite-pack anchors from the sheet pixels so every character stands exactly on its hex:
//   pivotY = lowest opaque row of the animation (ground line), pivotX = centre of the feet,
//   charH  = standing height measured on the idle cycle (shared by all animations so the size never pops),
//   charW  = idle width (used for the ground shadow).
//   node scripts/ground-anchors.mjs [id,id,...]
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'art', 'sprites');
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const SOLID = 110; // alpha threshold for "body" pixels (ignores soft glows / aura)

async function measure(sheet, def) {
  const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const fw = def.frameW;
  const fh = def.frameH;
  const cols = def.cols;
  let bottom = 0;
  let top = fh;
  let left = fw;
  let right = 0;
  const feetXs = [];
  for (let i = 0; i < def.frames; i++) {
    const cx = (i % cols) * fw;
    const cy = Math.floor(i / cols) * fh;
    let fTop = -1;
    let fBottom = -1;
    for (let y = 0; y < fh; y++) {
      let any = false;
      for (let x = 0; x < fw; x++) {
        const a = data[((cy + y) * W + cx + x) * 4 + 3];
        if (a > SOLID) {
          any = true;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
      if (any) {
        if (fTop < 0) fTop = y;
        fBottom = y;
      }
    }
    if (fBottom < 0) continue;
    if (fTop < top) top = fTop;
    if (fBottom > bottom) bottom = fBottom;
    // feet centre: mean x of solid pixels in the lowest 10% of this frame's body
    const band = Math.max(2, Math.round((fBottom - fTop) * 0.1));
    let sx = 0;
    let n = 0;
    for (let y = fBottom - band; y <= fBottom; y++) {
      for (let x = 0; x < fw; x++) {
        if (data[((cy + y) * W + cx + x) * 4 + 3] > SOLID) {
          sx += x;
          n++;
        }
      }
    }
    if (n) feetXs.push(sx / n);
  }
  feetXs.sort((a, b) => a - b);
  const feetX = feetXs.length ? feetXs[Math.floor(feetXs.length / 2)] : fw / 2;
  return { top, bottom, left, right, feetX };
}

let n = 0;
for (const id of readdirSync(dir)) {
  if (only && !only.has(id)) continue;
  const packPath = join(dir, id, 'pack.json');
  if (!existsSync(packPath)) continue;
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const anims = pack.animations;
  if (!anims?.idle) continue;
  const idle = await measure(join(dir, id, anims.idle.sheet), anims.idle);
  const charH = Math.max(40, idle.bottom - idle.top + 1);
  const charW = Math.max(20, idle.right - idle.left + 1);
  const report = [];
  for (const [name, def] of Object.entries(anims)) {
    const m = name === 'idle' ? idle : await measure(join(dir, id, def.sheet), def);
    const sameGrid = def.frameW === anims.idle.frameW && def.frameH === anims.idle.frameH;
    // Keep the anchor constant across animations of the same grid: the feet stay where the idle cycle
    // puts them, and the ground line may only drift a little (weapon trails / effects can touch the frame edge).
    const feetX = sameGrid ? idle.feetX : m.feetX;
    const lo = idle.bottom - def.frameH * 0.04;
    const hi = idle.bottom + def.frameH * 0.03;
    const bottom = sameGrid ? Math.min(hi, Math.max(lo, m.bottom)) : m.bottom;
    def.pivotX = Math.round((feetX / def.frameW) * 10000) / 10000;
    def.pivotY = Math.round(((bottom + 1) / def.frameH) * 10000) / 10000;
    def.charH = charH;
    def.charW = charW;
    report.push(`${name} ground ${Math.round(bottom + 1)}/${def.frameH} feet ${Math.round(feetX)}`);
  }
  writeFileSync(packPath, JSON.stringify(pack, null, 2));
  console.log(`${id}: charH ${charH} charW ${charW} · ${report.join(' · ')}`);
  n++;
}
console.log(`updated ${n} packs`);
