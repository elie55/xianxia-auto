// Imports AutoSprite "Download All" ZIPs (AutoSprite Format) into the game's sprite packs.
//
//   node scripts/import-autosprite-zips.mjs [folder]      (default: ~/Downloads)
//
// Each "<Character-Name>-spritesheet.zip" holds "<anim>_<dir>/spritesheet.png" + "atlas.json" (+ frames/).
// The character name maps to the sprite id ("Thunder-Ape" -> thunder_ape); "idle_right" -> idle, and
// AutoSprite's weapon-move names (e.g. asm_sword_quick_strike_right) are treated as the attack.
import { readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folder = process.argv[2] ?? join(homedir(), 'Downloads');
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const KNOWN = ['idle', 'walk', 'run', 'hurt', 'death', 'cast', 'jump'];
const classify = (raw) => (KNOWN.includes(raw) ? raw : /hurt|hit|damage/.test(raw) ? 'hurt' : /death|die|dead/.test(raw) ? 'death' : 'attack');

const zips = readdirSync(folder).filter((f) => /-spritesheet(?: \(\d+\))?\.zip$/i.test(f));
let imported = 0;
for (const zip of zips) {
  const id = zip.replace(/-spritesheet(?: \(\d+\))?\.zip$/i, '').toLowerCase().replace(/[-\s]+/g, '_');
  if (only && !only.has(id)) continue;
  const tmp = join(tmpdir(), 'autosprite_zip', id);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${join(folder, zip)}' -DestinationPath '${tmp}'`], { stdio: 'inherit' });
  const pairs = [];
  for (const dir of readdirSync(tmp)) {
    const sheet = join(tmp, dir, 'spritesheet.png');
    const atlas = join(tmp, dir, 'atlas.json');
    if (!existsSync(sheet) || !existsSync(atlas)) continue;
    const anim = classify(dir.toLowerCase().replace(/_(right|left|down|up)$/, ''));
    pairs.push(`${anim}=${sheet}:${atlas}`);
  }
  if (pairs.length === 0) {
    console.log('no animations in', zip);
    continue;
  }
  execFileSync('node', [join(root, 'scripts', 'convert-autosprite.mjs'), id, ...pairs], { stdio: 'inherit' });
  imported++;
}
console.log(`imported ${imported} characters from ${zips.length} zips`);
