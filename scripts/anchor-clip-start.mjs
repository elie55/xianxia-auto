// Anchors newly imported clips on where their first frame stands, relative to the idle clip. AutoSprite generates
// each clip's opening frame itself, so a character can start a clip a few pixels away from where the idle puts it;
// with the idle's pivot copied as-is, the body would jump sideways when the clip starts. This measures the feet
// (centre of the lowest 10 % of solid pixels, as ground-anchors.mjs does) and the ground line on the first frames of
// the idle and of each clip, and shifts the clip's pivot by the difference. charH / charW are copied from the idle
// (same grid, same framing); run fix-anim-scale.mjs afterwards to catch a camera zoom.
//   node scripts/anchor-clip-start.mjs <id,id,...|all> <anim> [anim ...]
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'art', 'sprites');
const [, , idArg, ...anims] = process.argv;
if (!idArg || !anims.length) {
  console.error('usage: node scripts/anchor-clip-start.mjs <id,id,...|all> <anim> [anim ...]');
  process.exit(1);
}
const ids = idArg === 'all' ? readdirSync(dir) : idArg.split(',');
const SOLID = 110;
const FIRST = 2; // frames averaged at the start of a clip

/** Feet x and ground line of the first frames of a clip. */
async function start(sheet, def, count = FIRST) {
  const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const xs = [];
  const bottoms = [];
  for (let f = 0; f < Math.min(count, def.frames); f++) {
    const ox = (f % def.cols) * def.frameW;
    const oy = Math.floor(f / def.cols) * def.frameH;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < def.frameH; y++)
      for (let x = 0; x < def.frameW; x++)
        if (data[((oy + y) * W + ox + x) * 4 + 3] > SOLID) {
          if (top < 0) top = y;
          bottom = y;
          break;
        }
    if (bottom < 0) continue;
    const band = Math.max(2, Math.round((bottom - top) * 0.1));
    let sx = 0;
    let n = 0;
    for (let y = bottom - band; y <= bottom; y++)
      for (let x = 0; x < def.frameW; x++)
        if (data[((oy + y) * W + ox + x) * 4 + 3] > SOLID) {
          sx += x;
          n++;
        }
    if (n) xs.push(sx / n);
    bottoms.push(bottom);
  }
  const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
  return { feetX: avg(xs), bottom: avg(bottoms) };
}

for (const id of ids) {
  const packPath = join(dir, id, 'pack.json');
  if (!existsSync(packPath)) continue;
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const idle = pack.animations.idle;
  if (!idle) continue;
  // the idle loops, so its first frames are as good a reference as any
  const ref = await start(join(dir, id, idle.sheet), idle);
  const notes = [];
  for (const name of anims) {
    const def = pack.animations[name];
    if (!def) continue;
    if (def.frameW !== idle.frameW || def.frameH !== idle.frameH) {
      notes.push(`${name} other grid, skipped`);
      continue;
    }
    const m = await start(join(dir, id, def.sheet), def);
    const dx = m.feetX - ref.feetX;
    const dy = m.bottom - ref.bottom;
    def.pivotX = Math.round((idle.pivotX + dx / def.frameW) * 10000) / 10000;
    def.pivotY = Math.round((idle.pivotY + dy / def.frameH) * 10000) / 10000;
    def.charH = idle.charH;
    if (idle.charW) def.charW = idle.charW;
    notes.push(`${name} shift ${dx.toFixed(1)},${dy.toFixed(1)} px -> pivot ${def.pivotX},${def.pivotY}`);
  }
  writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`${id.padEnd(22)} ${notes.join(' | ')}`);
}
