// Usage: node process-image.mjs <url-or-path> <hero|enemy|bg|event|icon> <id>
// Downloads (if URL), trims transparent borders, resizes and writes into the game's public assets.
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [, , src, kind, id] = process.argv;
if (!src || !kind || !id) {
  console.error('usage: node process-image.mjs <url|path> <hero|enemy|bg|event|icon> <id>');
  process.exit(1);
}
const PUB = 'C:/Users/Shadow/Desktop/XIANXIA AUTOBATTLER/public/assets/art';
const RAW = 'C:/Users/Shadow/AppData/Local/Temp/claude/7ec11df460e02efe/f9f12aaf-5666-4dfb-9793-b431e734a7cd/assets/raw';
mkdirSync(RAW, { recursive: true });

async function load() {
  if (/^https?:/i.test(src)) {
    const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`download failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const rawPath = join(RAW, `${kind}_${id}.png`);
    writeFileSync(rawPath, buf);
    console.log('raw saved', rawPath, buf.length);
    return buf;
  }
  return readFileSync(src);
}

function out(rel) {
  const p = join(PUB, rel);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

const buf = await load();
const meta = await sharp(buf).metadata();
console.log('input', meta.width, meta.height, meta.hasAlpha ? 'alpha' : 'opaque');

if (kind === 'hero' || kind === 'enemy') {
  // trim fully transparent borders (threshold on alpha), keep a small margin
  let img = sharp(buf).ensureAlpha();
  const trimmed = await img.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }).toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  console.log('trimmed', width, height);
  const pad = Math.round(Math.max(width, height) * 0.02);
  const padded = await sharp(trimmed.data).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  if (kind === 'hero') {
    await sharp(padded).resize({ height: 1400, withoutEnlargement: true }).png({ compressionLevel: 9, palette: false }).toFile(out(`heroes/${id}/portrait.png`));
  }
  await sharp(padded).resize({ height: 600, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(out(`sprites/${id}.png`));
  console.log('written', kind, id);
} else if (kind === 'bg') {
  await sharp(buf).resize({ width: 1920, height: 1080, fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toFile(out(`bg/${id}.jpg`));
  console.log('written bg', id);
} else if (kind === 'event') {
  await sharp(buf).resize({ height: 960, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(out(`events/${id}.jpg`));
  console.log('written event', id);
} else if (kind === 'icon') {
  await sharp(buf).resize({ width: 512, height: 512, fit: 'cover' }).png().toFile(out(`icons/${id}.png`));
  console.log('written icon', id);
}
