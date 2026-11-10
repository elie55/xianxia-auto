// Sizes every clip of a sprite pack from the height of its first frames against the idle's first frames.
// AutoSprite draws each clip's opening frame itself, and an effect (a spore burst, a sword trail) inflates the trim box
// that convert-autosprite uses as charH, so the character would shrink during that clip. Here charH of a clip becomes
// idle.charH × (clip's first-frame standing height / idle's), which keeps the body the same size in every clip.
//   node scripts/match-clip-heights.mjs <id,id,...> [--write] [--only anim,anim]
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'art', 'sprites');
const args = process.argv.slice(2);
const ids = (args[0] ?? '').split(',').filter(Boolean);
const write = args.includes('--write');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
if (!ids.length) {
  console.error('usage: node scripts/match-clip-heights.mjs <id,id,...> [--write] [--only anim,anim]');
  process.exit(1);
}
const SOLID = 110;

/** Height in px of the solid pixels of one frame. */
async function frameHeight(sheet, a, f) {
  const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ox = (f % a.cols) * a.frameW;
  const oy = Math.floor(f / a.cols) * a.frameH;
  let top = a.frameH;
  let bot = -1;
  for (let y = 0; y < a.frameH; y++)
    for (let x = 0; x < a.frameW; x++)
      if (data[((oy + y) * info.width + ox + x) * 4 + 3] > SOLID) {
        if (y < top) top = y;
        if (y > bot) bot = y;
      }
  return bot - top + 1;
}

const firstHeight = async (id, a) => ((await frameHeight(join(dir, id, a.sheet), a, 0)) + (await frameHeight(join(dir, id, a.sheet), a, 1))) / 2;

for (const id of ids) {
  const file = join(dir, id, 'pack.json');
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  const idle = pack.animations.idle;
  const idleH = await firstHeight(id, idle);
  console.log(`${id}: idle first frames ${idleH.toFixed(0)} px, charH ${idle.charH}`);
  for (const [name, a] of Object.entries(pack.animations)) {
    if (name === 'idle' || (only && !only.includes(name))) continue;
    const h = await firstHeight(id, a);
    // frames of a different size (512 padded clips) compare in their own pixels
    const ratio = (h / idleH) * (idle.frameH / a.frameH);
    const charH = Math.round(idle.charH * ratio * (a.frameH / idle.frameH));
    console.log(`  ${name.padEnd(7)} first ${h.toFixed(0)} px  ratio ${ratio.toFixed(2)}  charH ${a.charH} -> ${charH}`);
    if (write) a.charH = charH;
  }
  if (write) writeFileSync(file, JSON.stringify(pack, null, 2));
}
if (write) console.log('written');
