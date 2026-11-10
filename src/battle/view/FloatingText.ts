import { Container, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';

export type NumberKind = 'physical' | 'magic' | 'true' | 'crit' | 'heal' | 'shield' | 'burn' | 'poison' | 'frost' | 'bleed' | 'tribulation' | 'buff' | 'stones' | 'label' | 'qi';

const COLORS: Record<NumberKind, { fill: string; stroke: string }> = {
  physical: { fill: '#ffffff', stroke: '#1a0c08' },
  magic: { fill: '#d9c2ff', stroke: '#1b0b33' },
  true: { fill: '#ffd9a1', stroke: '#2b1400' },
  crit: { fill: '#ffd84a', stroke: '#3a1c00' },
  heal: { fill: '#8dff9a', stroke: '#06300d' },
  shield: { fill: '#bfe4ff', stroke: '#06203a' },
  burn: { fill: '#ff8a3c', stroke: '#2a0d00' },
  poison: { fill: '#9fe85a', stroke: '#0e2a00' },
  frost: { fill: '#a8e4ff', stroke: '#032030' },
  bleed: { fill: '#ff6b7a', stroke: '#2a0008' },
  tribulation: { fill: '#fff6a8', stroke: '#2a2000' },
  buff: { fill: '#f3cf78', stroke: '#2a1a00' },
  stones: { fill: '#f3cf78', stroke: '#2a1a00' },
  label: { fill: '#f0e9d8', stroke: '#000000' },
  qi: { fill: '#8fd5ff', stroke: '#002033' },
};

let seq = 0;

/** A live number that later events with the same key add into instead of spawning new text. */
interface Merge {
  t: Text;
  total: number;
  until: number;
  format: (total: number) => string;
}

export class FloatingTextLayer extends Container {
  private pool: Text[] = [];
  private merges = new Map<string, Merge>();

  /**
   * Repeating numbers (heals, shields, ticks, buffs) on the same unit: while the last one is still young, the new
   * amount is added to it (the text bumps) instead of stacking another number on top. Labels just skip duplicates.
   * Returns true when the event was absorbed into a live number.
   */
  merge(key: string, amount: number, windowSec: number, format: (total: number) => string): boolean {
    const now = performance.now() / 1000;
    const m = this.merges.get(key);
    if (m && now < m.until && m.t.parent === this) {
      m.total += amount;
      m.t.text = m.format(m.total);
      gsap.fromTo(m.t.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: 0.18, ease: 'back.out(2)', overwrite: 'auto' });
      return true;
    }
    return false;
  }

  /** Spawns a number that merge() can add into for `windowSec` (see merge). */
  spawnMerged(key: string, amount: number, windowSec: number, format: (total: number) => string, x: number, y: number, kind: NumberKind, opts: Parameters<FloatingTextLayer['spawn']>[4] = {}): void {
    if (this.merge(key, amount, windowSec, format)) return;
    const t = this.spawn(x, y, format(amount), kind, opts);
    this.merges.set(key, { t, total: amount, until: performance.now() / 1000 + windowSec, format });
  }

  /** Clears merge bookkeeping (a new fight). */
  resetMerges(): void {
    this.merges.clear();
  }

  spawn(x: number, y: number, text: string, kind: NumberKind, opts: { size?: number; crit?: boolean; dot?: boolean; speed?: number; amount?: number } = {}): Text {
    const c = COLORS[kind];
    // heavier hits read heavier: ~0.82× for chip damage, 1× at 10, ~1.36× at 1 000, capped at 1.5× (ticks scale half as much)
    const weight = opts.size === undefined && opts.amount ? Math.min(1.5, Math.max(0.82, 0.82 + 0.18 * Math.log10(Math.max(1, opts.amount)))) : 1;
    const k = opts.dot ? 1 + (weight - 1) * 0.5 : weight;
    const size = Math.round((opts.size ?? (opts.crit ? 44 : opts.dot ? 18 : kind === 'label' ? 20 : 28)) * k);
    const t = this.pool.pop() ?? new Text({ text: '', style: new TextStyle({ fontFamily: 'Noto Sans', fontWeight: '800' }) });
    t.text = text;
    const style = t.style as TextStyle;
    style.fontSize = size;
    style.fill = c.fill;
    style.stroke = { color: c.stroke, width: Math.max(3, size * 0.14) };
    style.fontFamily = kind === 'label' || kind === 'buff' ? 'Cinzel' : 'Noto Sans';
    style.fontWeight = '800';
    style.letterSpacing = kind === 'label' ? 2 : 0;
    style.dropShadow = { alpha: 0.6, blur: 4, distance: 2, color: '#000000', angle: Math.PI / 2 };
    t.anchor.set(0.5, 1);
    const jitter = (seq++ % 5) - 2;
    t.x = x + jitter * 9;
    t.y = y;
    t.alpha = 1;
    t.scale.set(opts.crit ? 0.4 : 0.7);
    t.rotation = opts.crit ? (Math.random() - 0.5) * 0.25 : 0;
    this.addChild(t);
    const rise = (opts.dot ? 34 : opts.crit ? 70 : 54) + (k > 1.25 ? 12 : 0);
    const dur = ((opts.dot ? 0.8 : opts.crit ? 1.3 : 1.0) * (k > 1.25 ? 1.15 : 1)) / (opts.speed ?? 1);
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeChild(t);
        this.pool.push(t);
      },
    });
    tl.to(t.scale, { x: 1, y: 1, duration: opts.crit ? 0.18 : 0.12, ease: 'back.out(3)' }, 0);
    if (opts.crit) tl.to(t.scale, { x: 1.15, y: 1.15, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.18);
    tl.to(t, { y: y - rise, duration: dur, ease: 'power2.out' }, 0);
    tl.to(t, { alpha: 0, duration: dur * 0.4, ease: 'power1.in' }, dur * 0.6);
    return t;
  }
}
