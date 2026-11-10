// Imports the "as_<id>.png" + "as_manifest.json" files produced by the in-page AutoSprite export helper
// (each PNG stacks a character's sprite sheets vertically; the manifest holds the regions + atlases).
//
//   node scripts/import-autosprite-combined.mjs [folder] [prefix]   (defaults: ~/Downloads, as)
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folder = process.argv[2] ?? join(homedir(), 'Downloads');
const prefix = process.argv[3] ?? 'as';
const manifest = JSON.parse(readFileSync(join(folder, `${prefix}_manifest.json`), 'utf8'));
const KNOWN = ['idle', 'walk', 'run', 'hurt', 'death', 'cast', 'jump'];
const classify = (raw) => (KNOWN.includes(raw) ? raw : /hurt|hit|damage/.test(raw) ? 'hurt' : /death|die|dead/.test(raw) ? 'death' : 'attack');
const inbox = join(root, '.autosprite-inbox');
const ids = [];
for (const [id, entry] of Object.entries(manifest)) {
  // each clip is a region of <prefix>_<id>.png, or of its own `file` (several characters packed in one PNG)
  const fileOf = (a) => join(folder, a.file ?? `${prefix}_${id}.png`);
  const missing = entry.anims.map(fileOf).filter((f) => !existsSync(f));
  if (missing.length) {
    console.log('missing', [...new Set(missing)].join(', '));
    continue;
  }
  for (const a of entry.anims) {
    const dir = join(inbox, id, classify(String(a.kind).toLowerCase()));
    mkdirSync(dir, { recursive: true });
    await sharp(fileOf(a)).extract({ left: a.x, top: a.y, width: a.w, height: a.h }).png().toFile(join(dir, 'spritesheet.png'));
    writeFileSync(join(dir, 'atlas.json'), JSON.stringify(a.atlas));
  }
  ids.push(id);
}
if (ids.length) execFileSync('node', [join(root, 'scripts', 'import-autosprite-inbox.mjs'), ids.join(',')], { stdio: 'inherit' });
console.log(`imported ${ids.length} characters`);
