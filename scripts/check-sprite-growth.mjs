// Checks an AutoSprite combined export (as_<id>.png + as_manifest.json, see import-autosprite-combined.mjs) for clips
// whose character changes size mid-clip. AutoSprite's video model sometimes pushes the camera in, mostly with the
// "Padded 2x" framing (the character starts small in a big frame); the character then grows on screen in the game.
// Run it before importing. size = sqrt(opaque pixels): a camera zoom changes it, a pose change barely does.
//
//   node scripts/check-sprite-growth.mjs [folder] [prefix] [id]      (defaults: ~/Downloads, as, first id)
//
// Reading the output: a steady clip stays within about +-10 % of its median. A clip that ramps up and holds still
// afterwards (e.g. 0.70 -> 1.40 over six frames, then flat) can be saved with fit-sprite-clip.mjs --keep. A clip
// whose whole motion is the zoom (up then back down) cannot: regenerate it with the normal framing.
// "touches-edge" counts frames cut off by the frame border.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const folder = process.argv[2] ?? join(homedir(), 'Downloads');
const prefix = process.argv[3] ?? 'as';
const manifest = JSON.parse(readFileSync(join(folder, `${prefix}_manifest.json`), 'utf8'));
const id = process.argv[4] ?? Object.keys(manifest)[0];
const { data, info } = await sharp(join(folder, `${prefix}_${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const median = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];

const clips = [];
for (const a of manifest[id].anims) {
  const fw = a.atlas.meta.frame_size.w;
  const fh = a.atlas.meta.frame_size.h;
  const cols = Math.round(a.w / fw);
  const n = Object.keys(a.atlas.frames).length;
  const rows = [];
  for (let f = 0; f < n; f++) {
    const ox = a.x + (f % cols) * fw;
    const oy = a.y + Math.floor(f / cols) * fh;
    let count = 0;
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < fh; y++) {
      let i = ((oy + y) * W + ox) * 4 + 3;
      for (let x = 0; x < fw; x++, i += 4) {
        if (data[i] > 40) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    rows.push({ s: Math.sqrt(count), edge: count > 0 && (minX <= 1 || minY <= 1 || maxX >= fw - 2 || maxY >= fh - 2) });
  }
  clips.push({ kind: a.kind, fw, fh, n, rows });
}
const ref = clips.find((c) => c.kind === 'idle') ?? clips[0];
const refS = median(ref.rows.map((r) => r.s));
const fmt = (v) => v.toFixed(2);
console.log(`${id}: size relative to the ${ref.kind} clip's median`);
for (const c of clips) {
  const rel = c.rows.map((r) => r.s / refS);
  const med = median(rel);
  const spread = Math.max(...rel) / Math.min(...rel);
  const verdict = spread > 1.35 ? 'GROWS' : spread > 1.15 ? 'check' : 'steady';
  console.log(
    `${c.kind.padEnd(10)} ${c.fw}x${c.fh} n=${c.n}  median ${fmt(med)} min ${fmt(Math.min(...rel))} max ${fmt(Math.max(...rel))}` +
      `  touches-edge ${c.rows.filter((r) => r.edge).length}  -> ${verdict}`,
  );
  console.log('   ' + rel.map(fmt).join(' '));
}
