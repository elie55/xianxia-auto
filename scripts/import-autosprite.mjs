// Imports every AutoSprite export found in a folder (default: ~/Downloads) into sprite packs.
//
//   node scripts/import-autosprite.mjs [folder]
//
// Expects AutoSprite's naming: "<Character Name>-<animation>-v<N>.png" + matching ".json" atlas.
// The character name is mapped to the sprite id by lower-casing and replacing spaces with underscores
// (e.g. "Thunder Ape-idle-v1.png" -> thunder_ape/idle). AutoSprite names weapon attacks after the move
// (e.g. "asm_sword_quick_strike"), so any unknown animation name is treated as the attack. Highest version wins.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folder = process.argv[2] ?? join(homedir(), 'Downloads');
const re = /^(.+?)-([a-z0-9_]+)-v(\d+)\.png$/i;
const KNOWN = ['idle', 'walk', 'run', 'hurt', 'death', 'cast', 'jump'];
const classify = (raw) => (KNOWN.includes(raw) ? raw : /hurt|hit|damage/.test(raw) ? 'hurt' : /death|die|dead/.test(raw) ? 'death' : 'attack');

const best = new Map(); // key id/anim -> {v, png, json}
for (const f of readdirSync(folder)) {
  const m = f.match(re);
  if (!m) continue;
  const id = m[1].trim().toLowerCase().replace(/\s+/g, '_');
  const anim = classify(m[2].toLowerCase());
  const v = Number(m[3]);
  const json = join(folder, f.replace(/\.png$/i, '.json'));
  if (!existsSync(json)) continue;
  const key = `${id}/${anim}`;
  const cur = best.get(key);
  if (!cur || v > cur.v) best.set(key, { v, png: join(folder, f), json, id, anim });
}
const byId = new Map();
for (const e of best.values()) {
  if (!byId.has(e.id)) byId.set(e.id, []);
  byId.get(e.id).push(e);
}
if (byId.size === 0) {
  console.log('no AutoSprite exports found in', folder);
  process.exit(0);
}
for (const [id, list] of byId) {
  const pairs = list.map((e) => `${e.anim}=${e.png}:${e.json}`);
  execFileSync('node', [join(root, 'scripts', 'convert-autosprite.mjs'), id, ...pairs], { stdio: 'inherit' });
}
console.log(`imported ${best.size} animations for ${byId.size} characters`);
