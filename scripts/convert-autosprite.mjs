// Converts AutoSprite exports into the game's sprite-pack format (per-animation frame metadata).
//
//   node scripts/convert-autosprite.mjs <spriteId> <anim>=<sheet.png>:<atlas.json> [<anim>=... ]
//   e.g. node scripts/convert-autosprite.mjs li_jian "idle=C:/Users/Shadow/Downloads/Li Jian-idle-v1.png:C:/Users/Shadow/Downloads/Li Jian-idle-v1.json"
//
// Writes public/assets/art/sprites/<id>/pack.json and copies each sheet as <anim>.png.
// Existing animations in an existing pack.json are preserved unless overridden.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , id, ...pairs] = process.argv;
if (!id || pairs.length === 0) {
  console.error('usage: node scripts/convert-autosprite.mjs <spriteId> <anim>=<sheet.png>:<atlas.json> ...');
  process.exit(1);
}
const outDir = join(root, 'public', 'assets', 'art', 'sprites', id);
mkdirSync(outDir, { recursive: true });
const packPath = join(outDir, 'pack.json');
const pack = existsSync(packPath) ? JSON.parse(readFileSync(packPath, 'utf8')) : { animations: {} };
if (!pack.animations) pack.animations = {};
// drop legacy top-level fields from the first format
for (const k of ['frameW', 'frameH', 'fps', 'anchorX', 'anchorY', 'height']) delete pack[k];

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const anim = pair.slice(0, eq);
  const rest = pair.slice(eq + 1);
  const m = rest.match(/^(.*\.png):(.*\.json)$/i);
  if (!m) {
    console.error('bad pair', pair);
    process.exit(1);
  }
  const [, sheet, atlasPath] = m;
  const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'));
  const frames = Object.values(atlas.frames);
  const fw = atlas.meta.frame_size.w;
  const fh = atlas.meta.frame_size.h;
  const cols = Math.round(atlas.meta.size.w / fw);
  let trimH = 0;
  for (const f of frames) if (f.trim) trimH = Math.max(trimH, f.trim.h);
  if (!trimH) trimH = Math.round(fh * 0.85);
  const fps = Math.round((atlas.meta.fps ?? 12) * 10) / 10;
  pack.animations[anim] = {
    sheet: `${anim}.png`,
    frames: frames.length,
    cols,
    frameW: fw,
    frameH: fh,
    fps,
    pivotX: atlas.meta.pivot?.x ?? 0.5,
    pivotY: atlas.meta.pivot?.y ?? 0.93,
    charH: trimH,
    loop: anim === 'idle' || anim === 'walk' || anim === 'run',
    ...(anim === 'attack' ? { hitFrame: Math.max(1, Math.round(frames.length * 0.45)) } : {}),
  };
  copyFileSync(sheet, join(outDir, `${anim}.png`));
  console.log(`${id}/${anim}: ${frames.length} frames ${fw}x${fh} cols ${cols} fps ${fps} charH ${trimH} pivot ${pack.animations[anim].pivotX.toFixed(2)},${pack.animations[anim].pivotY.toFixed(2)}`);
}
writeFileSync(packPath, JSON.stringify(pack, null, 2));
console.log('wrote', packPath);
