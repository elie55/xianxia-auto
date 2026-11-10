// Contact sheet of a battlefield and its new foes as downloaded from ChatGPT (~/Downloads/theme_<id>.png and
// enemy_<id>.png), to review a contract theme at a glance.
//   node scripts/theme-sheet.mjs <themeId> <foe,foe,...> <out.jpg>
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const [, , theme, foes, out] = process.argv;
const dl = join(homedir(), 'Downloads');
const W = 1200;
const parts = [];
const bg = join(dl, `theme_${theme}.png`);
if (existsSync(bg)) parts.push({ input: await sharp(bg).resize(W, 675).toBuffer(), left: 0, top: 0 });
const ids = foes.split(',');
const tw = Math.floor(W / ids.length);
for (let i = 0; i < ids.length; i++) {
  const f = join(dl, `enemy_${ids[i]}.png`);
  if (!existsSync(f)) continue;
  parts.push({ input: await sharp(f).resize({ width: tw - 10, height: 330, fit: 'contain', background: { r: 20, g: 32, b: 32, alpha: 1 } }).flatten({ background: '#142020' }).toBuffer(), left: i * tw + 5, top: 685 });
}
await sharp({ create: { width: W, height: 1025, channels: 3, background: '#142020' } }).composite(parts).jpeg({ quality: 80 }).toFile(out);
console.log('written', out);
