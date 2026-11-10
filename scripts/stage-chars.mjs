// Stages ChatGPT character downloads for AutoSprite: zeroes the faint background haze (alpha < 20), fades 20-60,
// and writes "<Name>.png" into an upload folder; also writes the still sprite used by the menus (sprites/<id>.png).
//   node scripts/stage-chars.mjs <outDir> <id=Name> [<id=Name> ...]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , outDir, ...pairs] = process.argv;
mkdirSync(outDir, { recursive: true });
for (const pair of pairs) {
  const [id, name] = pair.split('=');
  const src = join(homedir(), 'Downloads', `enemy_${id}.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    const v = data[i];
    data[i] = v < 20 ? 0 : v < 60 ? Math.round(((v - 20) * 60) / 40) : v;
  }
  const clean = join(outDir, `${name}.png`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(clean);
  execFileSync('node', [join(root, 'scripts', 'process-image.mjs'), clean, 'enemy', id], { stdio: 'ignore' });
  console.log('staged', id, '->', clean);
}
