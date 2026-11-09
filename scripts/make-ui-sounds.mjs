// Generates the soft UI sounds that have no recorded asset: a hover tick and a card-flip whoosh.
//   node scripts/make-ui-sounds.mjs
// Writes 16-bit mono WAV files to public/assets/audio/sfx/. Deterministic (seeded noise), so re-running is harmless.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'assets', 'audio', 'sfx');
mkdirSync(out, { recursive: true });
const RATE = 44100;

let seed = 1234567;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}

// hover: a short wooden "tok" — two damped partials and a faint click
{
  const n = Math.round(RATE * 0.06);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t / 0.009);
    s[i] = 0.32 * env * (Math.sin(2 * Math.PI * 1650 * t) + 0.55 * Math.sin(2 * Math.PI * 2480 * t)) + (i < 40 ? 0.12 * noise() * (1 - i / 40) : 0);
  }
  writeFileSync(join(out, 'ui_hover.wav'), wav(s));
}

// flip: a soft paper whoosh — low-passed noise with a rising then falling envelope and a swept cutoff
{
  const n = Math.round(RATE * 0.2);
  const s = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 2 * (1 - t * 0.4);
    const cutoff = 0.04 + 0.22 * Math.sin(Math.PI * t);
    lp += cutoff * (noise() - lp);
    s[i] = 0.55 * env * lp * 3.2;
  }
  writeFileSync(join(out, 'ui_flip.wav'), wav(s));
}
console.log('wrote ui_hover.wav and ui_flip.wav');
