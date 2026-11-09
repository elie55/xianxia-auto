// Usage: node make-ico.mjs <square.png> <out.ico> [<out512.png>]
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const [, , src, outIco, outPng] = process.argv;
const sizes = [256, 128, 64, 48, 32, 16];
const pngs = [];
for (const s of sizes) pngs.push(await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer());
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const entries = [];
let offset = 6 + 16 * sizes.length;
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0); e.writeUInt8(s >= 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += pngs[i].length; entries.push(e);
});
writeFileSync(outIco, Buffer.concat([header, ...entries, ...pngs]));
if (outPng) await sharp(src).resize(512, 512).png().toFile(outPng);
console.log('wrote', outIco, offset, 'bytes');
