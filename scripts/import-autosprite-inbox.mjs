// Converts everything in .autosprite-inbox/<id>/<anim>/{spritesheet.png,atlas.json} into sprite packs.
//   node scripts/import-autosprite-inbox.mjs [id,id,...]
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inbox = join(root, '.autosprite-inbox');
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const KNOWN = ['idle', 'walk', 'run', 'hurt', 'death', 'cast', 'jump'];
const classify = (raw) => (KNOWN.includes(raw) ? raw : /hurt|hit|damage/.test(raw) ? 'hurt' : /death|die|dead/.test(raw) ? 'death' : 'attack');
let n = 0;
for (const id of readdirSync(inbox)) {
  if (only && !only.has(id)) continue;
  const pairs = [];
  for (const dir of readdirSync(join(inbox, id))) {
    const sheet = join(inbox, id, dir, 'spritesheet.png');
    const atlas = join(inbox, id, dir, 'atlas.json');
    if (existsSync(sheet) && existsSync(atlas)) pairs.push(`${classify(dir)}=${sheet}:${atlas}`);
  }
  if (!pairs.length) continue;
  execFileSync('node', [join(root, 'scripts', 'convert-autosprite.mjs'), id, ...pairs], { stdio: 'inherit' });
  n++;
}
console.log(`imported ${n} characters from the inbox`);
