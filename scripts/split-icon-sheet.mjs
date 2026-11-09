// Splits a generated 4x4 icon sheet into individual painted icons and registers them.
//   node scripts/split-icon-sheet.mjs <sheet.png> <name1,name2,...> [cols=4] [rows=4]
// Each cell is trimmed to its content and padded into a 160px square PNG at public/assets/icons/painted/<name>.png.
// Cells with (almost) no content are skipped. Rewrites src/ui/components/paintedIcons.ts from the folder contents.
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , sheet, namesArg, colsArg, rowsArg] = process.argv;
const outDir = join(root, 'public', 'assets', 'icons', 'painted');
mkdirSync(outDir, { recursive: true });

if (sheet && namesArg) {
  const names = namesArg.split(',');
  const cols = Number(colsArg ?? 4);
  const rows = Number(rowsArg ?? 4);
  const img = sharp(sheet).ensureAlpha();
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const cw = W / cols;
  const ch = H / rows;
  // background key: if the sheet is opaque (no alpha), treat the dominant corner colour as background
  const corner = [data[0], data[1], data[2], data[3]];
  const opaqueBg = corner[3] > 200;
  const isBg = (i) => (opaqueBg ? Math.abs(data[i] - corner[0]) + Math.abs(data[i + 1] - corner[1]) + Math.abs(data[i + 2] - corner[2]) < 60 : data[i + 3] < 40);
  for (let n = 0; n < names.length && n < cols * rows; n++) {
    const name = names[n];
    if (!name) continue;
    const cx = (n % cols) * cw;
    const cy = Math.floor(n / cols) * ch;
    // find content bounds inside the cell (ignoring a 4% margin so separator lines are excluded)
    const m = Math.round(Math.min(cw, ch) * 0.04);
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = Math.round(cy) + m; y < Math.round(cy + ch) - m; y++) {
      for (let x = Math.round(cx) + m; x < Math.round(cx + cw) - m; x++) {
        const i = (y * W + x) * 4;
        if (!isBg(i)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0 || x1 - x0 < cw * 0.12 || y1 - y0 < ch * 0.12) {
      console.log(`skip ${name}: empty cell`);
      continue;
    }
    const side = Math.max(x1 - x0, y1 - y0) + 1;
    const pad = Math.round(side * 0.08);
    const size = side + pad * 2;
    const left = Math.max(0, Math.round(x0 - (size - (x1 - x0 + 1)) / 2));
    const top = Math.max(0, Math.round(y0 - (size - (y1 - y0 + 1)) / 2));
    const width = Math.min(W - left, size);
    const height = Math.min(H - top, size);
    let cell = sharp(sheet).ensureAlpha().extract({ left, top, width, height });
    if (opaqueBg) {
      // key out the flat background colour of opaque sheets
      const { data: cd, info: ci } = await cell.raw().toBuffer({ resolveWithObject: true });
      const o = Buffer.from(cd);
      for (let i = 0; i < o.length; i += 4) {
        const d = Math.abs(o[i] - corner[0]) + Math.abs(o[i + 1] - corner[1]) + Math.abs(o[i + 2] - corner[2]);
        if (d < 60) o[i + 3] = 0;
        else if (d < 110) o[i + 3] = Math.round(o[i + 3] * ((d - 60) / 50));
      }
      cell = sharp(o, { raw: { width: ci.width, height: ci.height, channels: 4 } });
    }
    await cell.resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(join(outDir, `${name}.png`));
    console.log(`${name}: cell ${n} → ${Math.round(x1 - x0)}x${Math.round(y1 - y0)}`);
  }
}

const names = readdirSync(outDir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).sort();
const ts = `/**
 * Names of icons that have a painted PNG in /assets/icons/painted/<name>.png (generated art).
 * The Icon component renders those as images instead of tinted SVG masks.
 * This file is rewritten by scripts/split-icon-sheet.mjs — do not edit by hand.
 */
export const PAINTED_ICONS = new Set<string>(${JSON.stringify(names)});
`;
writeFileSync(join(root, 'src', 'ui', 'components', 'paintedIcons.ts'), ts);
console.log(`registered ${names.length} painted icons`);
