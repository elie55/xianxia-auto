// Derives the dark lacquer button plaque from the painted jade plaque: only the green (jade) interior is
// recoloured, so the gold trim and the cream cloud ornaments stay identical across the whole button family.
//   node scripts/make-button-variants.mjs
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'art', 'ui');

async function recolour(src, out, map) {
  const { data, info } = await sharp(join(dir, src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] === 0) continue;
    // jade fill: green clearly above red, blue not far below green (gold trim has red >= green, clouds are near-white)
    const jade = g > r * 1.18 && g > 40 && b > g * 0.55 && !(r > 170 && g > 170 && b > 150);
    if (!jade) continue;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const [nr, ng, nb] = map(l);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(dir, out));
  console.log('wrote', out);
}

// dark ink-teal lacquer that keeps a faint trace of the cloud pattern
const dark = (l) => [Math.round(8 + l * 0.1), Math.round(17 + l * 0.17), Math.round(19 + l * 0.19)];
await recolour('button_jade_9.png', 'button_dark_9.png', dark);
await recolour('button_jade.png', 'button_dark.png', dark);
