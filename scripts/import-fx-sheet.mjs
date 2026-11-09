// Imports a generated VFX flipbook sheet (4×4 frames on black) as public/assets/art/fx/<name>.jpg at 1024×1024.
//   node scripts/import-fx-sheet.mjs <sheet.png> <name>
// The sheet is played additively, so black is transparent: faint grey noise is crushed to black and the
// frame content is left untouched.
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , file, name] = process.argv;
if (!file || !name) {
  console.error('usage: node scripts/import-fx-sheet.mjs <sheet.png> <name>');
  process.exit(1);
}
const outDir = join(root, 'public', 'assets', 'art', 'fx');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${name}.jpg`);
await sharp(file)
  .resize(1024, 1024, { fit: 'cover' })
  .flatten({ background: '#000000' })
  .linear(1.06, -8) // crush near-black noise so additive blending stays clean
  .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
  .toFile(out);
const meta = await sharp(out).metadata();
console.log(`wrote ${out} ${meta.width}x${meta.height}`);
