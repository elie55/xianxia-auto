// Fits one clip of a sprite pack to the pack's idle clip, so a character keeps the same size and footing whatever
// it is doing. Needed for AutoSprite's "Padded 2x" exports: the character is drawn smaller in a bigger frame, the
// video model sometimes pushes the camera in mid-clip (the character "grows"), and effects such as a slash arc or a
// breath stream make the tallest-frame height (the converter's charH) useless as a size reference.
//
//   node scripts/fit-sprite-clip.mjs <spriteId> <anim> [--keep a-b] [--rest a-b] [--feather px] [--repivot] [--hit n]
//
//   --keep a-b    keep only frames a..b (0-based, of the current sheet): drops a camera push-in (when the camera
//                 holds still afterwards) or a bad tail. Implies --repivot.
//   --rest a-b    frames (after --keep) that show the body without big effects, used to measure its size and feet.
//                 Default: every frame.
//   --feather px  content cut off by the frame edge (a breath stream leaving the frame) fades out over this many
//                 pixels instead of ending on a hard line. Default 40; 0 disables.
//   --repivot     move the feet pivot to the same spot of the body as the idle clip's pivot.
//   --hit n       set the attack hit frame (after --keep).
//   --release n   set a cast clip's release frame (after --keep): the frame where the technique leaves the hands.
//   --no-size     keep charH / charW (e.g. a normal-framing clip already sized by fix-anim-scale); only cut / fade.
//
// Size: the body (largest opaque blob, so detached splashes do not count) is measured as sqrt(opaque pixels), which
// a camera zoom changes but a pose change barely does. charH = idle.charH x (clip body / idle body), so the body
// covers the same area on screen as in the idle.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [id, anim] = args;
if (!id || !anim || anim === 'idle') {
  console.error('usage: node scripts/fit-sprite-clip.mjs <spriteId> <anim> [--keep a-b] [--rest a-b] [--feather px] [--repivot] [--hit n]');
  process.exit(1);
}
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const range = (s) => (s ? s.split('-').map(Number) : undefined);
const keep = range(opt('--keep'));
const rest = range(opt('--rest'));
const feather = Number(opt('--feather') ?? 40);
const repivot = args.includes('--repivot') || !!keep;
const noSize = args.includes('--no-size');
const hit = opt('--hit');
const release = opt('--release');

const dir = join(root, 'public', 'assets', 'art', 'sprites', id);
const packPath = join(dir, 'pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const idleDef = pack.animations.idle;
const def = pack.animations[anim];
if (!idleDef || !def) throw new Error(`${id} needs an idle clip and a ${anim} clip`);
const median = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
const frameCount = (a) => (Array.isArray(a.frames) ? a.frames.length : a.frames);

/** Raw RGBA frames of a clip. */
async function loadFrames(a) {
  const { data, info } = await sharp(join(dir, a.sheet)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frames = [];
  for (let f = 0; f < frameCount(a); f++) {
    const ox = (f % a.cols) * a.frameW;
    const oy = Math.floor(f / a.cols) * a.frameH;
    const px = Buffer.alloc(a.frameW * a.frameH * 4);
    for (let y = 0; y < a.frameH; y++) data.copy(px, y * a.frameW * 4, ((oy + y) * info.width + ox) * 4, ((oy + y) * info.width + ox + a.frameW) * 4);
    frames.push(px);
  }
  return frames;
}

/** The body: the largest 4-connected opaque blob. Size, box, and the centre of the bottom 12 % (the feet). */
function body(px, w, h) {
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = px[p * 4 + 3] > 40 ? 1 : 0;
  const lab = new Int32Array(w * h);
  const stack = [];
  let best = 0;
  let bestN = 0;
  let next = 0;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || lab[p]) continue;
    next++;
    let n = 0;
    lab[p] = next;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop();
      n++;
      const x = q % w;
      const y = (q / w) | 0;
      if (x > 0 && mask[q - 1] && !lab[q - 1]) (lab[q - 1] = next), stack.push(q - 1);
      if (x < w - 1 && mask[q + 1] && !lab[q + 1]) (lab[q + 1] = next), stack.push(q + 1);
      if (y > 0 && mask[q - w] && !lab[q - w]) (lab[q - w] = next), stack.push(q - w);
      if (y < h - 1 && mask[q + w] && !lab[q + w]) (lab[q + w] = next), stack.push(q + w);
    }
    if (n > bestN) (bestN = n), (best = next);
  }
  if (!bestN) return null;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let p = 0; p < w * h; p++) {
    if (lab[p] !== best) continue;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const band = maxY - Math.round((maxY - minY + 1) * 0.12);
  let sx = 0;
  let bn = 0;
  for (let p = band * w; p < w * h; p++) if (lab[p] === best) (sx += p % w), bn++;
  return { s: Math.sqrt(bestN), w: maxX - minX + 1, h: maxY - minY + 1, bottom: maxY, footX: sx / bn };
}

function summarize(list) {
  return { s: median(list.map((b) => b.s)), w: median(list.map((b) => b.w)), h: median(list.map((b) => b.h)), bottom: median(list.map((b) => b.bottom)), footX: median(list.map((b) => b.footX)) };
}

// ── the idle reference ──
const idleBodies = (await loadFrames(idleDef)).map((px) => body(px, idleDef.frameW, idleDef.frameH)).filter(Boolean);
const ref = summarize(idleBodies);

// ── the clip ──
let frames = await loadFrames(def);
const before = frameCount(def);
if (keep) frames = frames.slice(keep[0], keep[1] + 1);
const W = def.frameW;
const H = def.frameH;
const bodies = frames.map((px) => body(px, W, H));
const restList = (rest ? bodies.slice(rest[0], rest[1] + 1) : bodies).filter(Boolean);
const m = summarize(restList);

// fade content that the frame edge cut off
let feathered = 0;
if (feather > 0) {
  for (const px of frames) {
    const touches = { l: false, r: false, t: false, b: false };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] <= 40) continue;
        if (x <= 1) touches.l = true;
        if (x >= W - 2) touches.r = true;
        if (y <= 1) touches.t = true;
        if (y >= H - 2) touches.b = true;
      }
    if (!touches.l && !touches.r && !touches.t && !touches.b) continue;
    feathered++;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let k = 1;
        if (touches.l) k = Math.min(k, x / feather);
        if (touches.r) k = Math.min(k, (W - 1 - x) / feather);
        if (touches.t) k = Math.min(k, y / feather);
        if (touches.b) k = Math.min(k, (H - 1 - y) / feather);
        if (k >= 1) continue;
        k = Math.max(0, k);
        const i = (y * W + x) * 4 + 3;
        px[i] = Math.round(px[i] * k * k * (3 - 2 * k));
      }
  }
}

// repack on the same grid
const cols = def.cols;
const rows = Math.ceil(frames.length / cols);
const sheet = Buffer.alloc(W * cols * H * rows * 4);
frames.forEach((px, f) => {
  const ox = (f % cols) * W;
  const oy = Math.floor(f / cols) * H;
  for (let y = 0; y < H; y++) px.copy(sheet, ((oy + y) * W * cols + ox) * 4, y * W * 4, (y + 1) * W * 4);
});
writeFileSync(join(dir, def.sheet), await sharp(sheet, { raw: { width: W * cols, height: H * rows, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer());

const ratio = m.s / ref.s;
const old = { charH: def.charH, pivotX: def.pivotX, pivotY: def.pivotY };
def.frames = frames.length;
if (!noSize) {
  def.charH = Math.round(idleDef.charH * ratio);
  if (idleDef.charW) def.charW = Math.round(idleDef.charW * ratio);
}
if (release !== undefined) def.releaseFrame = Number(release);
else if (def.releaseFrame !== undefined && keep) def.releaseFrame = Math.max(0, Math.min(frames.length - 1, def.releaseFrame - keep[0]));
if (repivot) {
  // the same spot of the body as the idle's pivot: relative to the feet band centre and the lowest body pixel
  const offX = (idleDef.pivotX * idleDef.frameW - ref.footX) / ref.w;
  const offY = (idleDef.pivotY * idleDef.frameH - ref.bottom) / ref.h;
  def.pivotX = +((m.footX + offX * m.w) / W).toFixed(4);
  def.pivotY = +((m.bottom + offY * m.h) / H).toFixed(4);
}
if (hit !== undefined) def.hitFrame = Number(hit);
else if (def.hitFrame !== undefined && keep) def.hitFrame = Math.max(0, Math.min(frames.length - 1, def.hitFrame - keep[0]));
writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
console.log(
  `${id}/${anim}: frames ${before} -> ${frames.length}, body x${ratio.toFixed(2)} of idle, charH ${old.charH} -> ${def.charH}, ` +
    `pivot ${old.pivotX},${old.pivotY} -> ${def.pivotX},${def.pivotY}, feathered ${feathered} frame(s)` +
    (def.hitFrame !== undefined ? `, hitFrame ${def.hitFrame}` : '') +
    (def.releaseFrame !== undefined ? `, releaseFrame ${def.releaseFrame}` : ''),
);
