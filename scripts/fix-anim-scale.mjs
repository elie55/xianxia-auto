// AutoSprite renders each animation of a character at its own zoom, so a clip can show the character 10–20 %
// larger or smaller than the idle clip even though both sheets share the same frame grid. The idle clip is the
// reference: for every other clip this measures the median per-frame alpha bounding box and, when its height
// differs from idle's by at least 5 % AND the feet line moved the same way (a zoom, not a pose change), rewrites
// charH / charW / pivotY so the clip keeps the character at the idle size on screen with the feet on the ground.
//   node scripts/fix-anim-scale.mjs [id ...]
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'art', 'sprites');
const only = process.argv.slice(2);
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function measure(file, a) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const n = Array.isArray(a.frames) ? a.frames.length : a.frames;
  const hs = [];
  const bots = [];
  for (let f = 0; f < n; f++) {
    const ox = (f % a.cols) * a.frameW;
    const oy = Math.floor(f / a.cols) * a.frameH;
    let minY = Infinity;
    let maxY = -1;
    for (let y = 0; y < a.frameH; y++) {
      let i = ((oy + y) * W + ox) * 4 + 3;
      for (let x = 0; x < a.frameW; x++, i += 4) {
        if (data[i] > 40) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxY < 0) continue;
    hs.push(maxY - minY + 1);
    bots.push(maxY);
  }
  return { h: median(hs), bot: median(bots) };
}

let changed = 0;
for (const id of readdirSync(dir)) {
  if (only.length && !only.includes(id)) continue;
  const packPath = join(dir, id, 'pack.json');
  if (!existsSync(packPath)) continue;
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const idleDef = pack.animations?.idle;
  if (!idleDef) continue;
  const idle = await measure(join(dir, id, idleDef.sheet), idleDef);
  // the idle clip's convention: the pivot sits a hair below its lowest opaque pixel
  const feetOffset = idleDef.pivotY * idleDef.frameH - idle.bot;
  const notes = [];
  for (const [name, def] of Object.entries(pack.animations)) {
    if (name === 'idle') continue;
    if (def.frameW !== idleDef.frameW || def.frameH !== idleDef.frameH) continue; // other grid: anchored on its own
    const m = await measure(join(dir, id, def.sheet), def);
    const ratio = m.h / idle.h;
    const botShift = (m.bot - idle.bot) / def.frameH;
    const zoom = Math.abs(ratio - 1) >= 0.05 && Math.sign(botShift) === Math.sign(ratio - 1) && Math.abs(botShift) >= 0.015;
    const target = zoom
      ? { charH: Math.round(idleDef.charH * ratio), charW: Math.round(idleDef.charW * ratio), pivotY: +((m.bot + feetOffset) / def.frameH).toFixed(4) }
      : { charH: idleDef.charH, charW: idleDef.charW, pivotY: def.pivotY };
    if (target.charH !== def.charH || target.charW !== def.charW || Math.abs(target.pivotY - def.pivotY) > 0.0005) {
      Object.assign(def, target);
      changed++;
      notes.push(`${name} x${ratio.toFixed(2)} charH ${def.charH} pivotY ${def.pivotY}`);
    }
  }
  if (notes.length) {
    writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
    console.log(id.padEnd(20), notes.join(' | '));
  }
}
console.log(`${changed} clip(s) updated`);
