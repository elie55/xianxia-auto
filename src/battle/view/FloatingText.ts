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

export class FloatingTextLayer extends Container {
  private pool: Text[] = [];

  spawn(x: number, y: number, text: string, kind: NumberKind, opts: { size?: number; crit?: boolean; dot?: boolean; speed?: number } = {}): void {
    const c = COLORS[kind];
    const size = opts.size ?? (opts.crit ? 44 : opts.dot ? 18 : kind === 'label' ? 20 : 28);
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
    const rise = opts.dot ? 34 : opts.crit ? 70 : 54;
    const dur = (opts.dot ? 0.8 : opts.crit ? 1.3 : 1.0) / (opts.speed ?? 1);
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
  }
}
