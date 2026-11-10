import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '@/app/scale';
import type { AmbientKind } from '@/content/themes';

/**
 * Living arenas: a few slow ambient layers between the painting and the fighters, so the backgrounds breathe. Each
 * battlefield (src/content/themes.ts) picks one kind:
 *   petals (bamboo province): petals and leaves drifting on the wind, soft light shafts
 *   embers (blood moon abyss): embers rising from the depths, a low red glow that pulses
 *   clouds (heavenly ladder): clouds drifting across, light shafts, a few glints
 *   mist (herb valley): low banks of mist crawling over the floor, golden pollen rising, soft light shafts
 * Everything is in design space and wraps around the 16:9 frame. Hidden with Reduce flashes and motion.
 */
interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  sway: number;
  phase: number;
  spin: number;
  baseAlpha: number;
  flicker: number;
}

export class AmbientLayer extends Container {
  private motes: Mote[] = [];
  private tex: Record<string, Texture> = {};
  private kind: AmbientKind | null = null;
  private time = 0;

  constructor(private renderer: Renderer) {
    super();
    this.eventMode = 'none';
  }

  private texture(key: string, draw: (g: Graphics) => void): Texture {
    if (!this.tex[key]) {
      const g = new Graphics();
      draw(g);
      this.tex[key] = this.renderer.generateTexture(g);
      g.destroy();
    }
    return this.tex[key];
  }

  /** Soft round glow: concentric discs with falling alpha. */
  private glow(key: string, r: number, color: number, peak: number): Texture {
    return this.texture(key, (g) => {
      const steps = 10;
      for (let i = steps; i >= 1; i--) g.circle(r, r, (r * i) / steps).fill({ color, alpha: peak * (1 - i / (steps + 1)) * 0.5 });
    });
  }

  setKind(kind: AmbientKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    for (const m of this.motes) m.s.destroy();
    this.motes = [];
    this.removeChildren();
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const add = (t: Texture, o: Partial<Mote> & { x: number; y: number; scale?: number; alpha: number; blend?: 'add' | 'normal'; rot?: number }) => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      s.position.set(o.x, o.y);
      s.scale.set(o.scale ?? 1);
      s.rotation = o.rot ?? 0;
      s.alpha = o.alpha;
      if (o.blend === 'add') s.blendMode = 'add';
      this.addChild(s);
      this.motes.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, sway: o.sway ?? 0, phase: o.phase ?? Math.random() * 6.28, spin: o.spin ?? 0, baseAlpha: o.alpha, flicker: o.flicker ?? 0 });
    };
    const shaft = this.texture('shaft', (g) => {
      for (let i = 0; i < 12; i++) g.rect(i * 10, 0, 10, 900).fill({ color: 0xfff4d0, alpha: 0.5 * Math.sin((Math.PI * (i + 0.5)) / 12) });
    });
    if (kind === 'mist') {
      const bank = this.glow('mistBank', 180, 0xe8f4ee, 0.9);
      const pollen = this.glow('pollen', 5, 0xf3e3a0, 1);
      const pollenCore = this.texture('pollenCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xfff6d0 }));
      for (let i = 0; i < 2; i++) add(shaft, { x: rand(400, 1500), y: 280, alpha: 0.05, scale: rand(1.8, 2.4), rot: 0.3, blend: 'add', flicker: 0.03 });
      // mist banks crawl slowly across the floor and the lower hills
      for (let i = 0; i < 9; i++) add(bank, { x: rand(0, DESIGN_W), y: rand(560, 1040), alpha: rand(0.1, 0.2), scale: rand(1.6, 3), vx: rand(5, 14), vy: 0, sway: rand(3, 8), flicker: 0.12 });
      for (let i = 0; i < 4; i++) add(bank, { x: rand(0, DESIGN_W), y: rand(250, 520), alpha: rand(0.06, 0.12), scale: rand(1.8, 3.2), vx: rand(3, 9), vy: 0, sway: rand(2, 6) });
      // golden pollen drifts up from the herb terraces
      for (let i = 0; i < 26; i++) {
        const x = rand(0, DESIGN_W);
        const y = rand(0, DESIGN_H);
        const vy = -rand(6, 18);
        const vx = rand(4, 14);
        add(pollen, { x, y, alpha: rand(0.35, 0.75), scale: rand(0.6, 1.2), vx, vy, sway: rand(8, 18), blend: 'add', flicker: 0.4 });
        add(pollenCore, { x, y, alpha: 0.85, scale: rand(0.7, 1), vx, vy, sway: 0, blend: 'add', flicker: 0.35 });
      }
    } else if (kind === 'petals') {
      const petal = this.texture('petal', (g) => {
        g.ellipse(9, 5, 9, 5).fill({ color: 0xf6b6c8 });
        g.ellipse(9, 5, 4, 2).fill({ color: 0xffe3ec, alpha: 0.8 });
      });
      const leaf = this.texture('leaf', (g) => {
        g.ellipse(12, 5, 12, 5).fill({ color: 0x8fbf5a });
        g.moveTo(1, 5).lineTo(23, 5).stroke({ color: 0x5e8f3a, width: 1 });
      });
      for (let i = 0; i < 3; i++) add(shaft, { x: rand(300, 1600), y: 300, alpha: 0.05, scale: rand(1.6, 2.4), rot: 0.35, blend: 'add', flicker: 0.035 });
      for (let i = 0; i < 16; i++) add(petal, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.55, 0.85), scale: rand(0.7, 1.2), vx: rand(18, 40), vy: rand(14, 30), sway: rand(14, 30), spin: rand(-1.4, 1.4) });
      for (let i = 0; i < 9; i++) add(leaf, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.5, 0.8), scale: rand(0.7, 1.1), vx: rand(24, 46), vy: rand(18, 34), sway: rand(10, 24), spin: rand(-1.8, 1.8) });
    } else if (kind === 'embers') {
      const ember = this.glow('ember', 7, 0xff8a3a, 1);
      const core = this.texture('emberCore', (g) => g.circle(2, 2, 2).fill({ color: 0xffd9a0 }));
      add(this.glow('abyss', 160, 0xc0201a, 0.9), { x: DESIGN_W / 2, y: DESIGN_H + 40, alpha: 0.18, scale: 6, blend: 'add', flicker: 0.07 });
      for (let i = 0; i < 34; i++) {
        const x = rand(0, DESIGN_W);
        const y = rand(0, DESIGN_H);
        const vy = -rand(22, 64);
        const vx = rand(-8, 8);
        add(ember, { x, y, alpha: rand(0.45, 0.9), scale: rand(0.6, 1.3), vx, vy, sway: rand(6, 16), blend: 'add', flicker: 0.35 });
        add(core, { x, y, alpha: 0.9, scale: rand(0.6, 1), vx, vy, sway: 0, blend: 'add', flicker: 0.3 });
      }
    } else {
      const cloud = this.glow('cloud', 140, 0xffffff, 0.9);
      const glint = this.glow('glint', 6, 0xfff6d8, 1);
      for (let i = 0; i < 3; i++) add(shaft, { x: rand(300, 1600), y: 260, alpha: 0.06, scale: rand(1.8, 2.6), rot: -0.3, blend: 'add', flicker: 0.04 });
      for (let i = 0; i < 6; i++) add(cloud, { x: rand(0, DESIGN_W), y: rand(60, 420), alpha: rand(0.1, 0.18), scale: rand(1.4, 2.6), vx: rand(6, 16), vy: 0, sway: rand(4, 10) });
      for (let i = 0; i < 14; i++) add(glint, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H * 0.75), alpha: rand(0.3, 0.7), scale: rand(0.5, 1), vx: rand(-4, 4), vy: rand(-6, -2), sway: rand(4, 10), blend: 'add', flicker: 0.5 });
    }
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const m of this.motes) {
      const s = m.s;
      s.x += m.vx * dt + Math.sin(t * 0.9 + m.phase) * m.sway * dt;
      s.y += m.vy * dt;
      s.rotation += m.spin * dt;
      if (m.flicker) s.alpha = Math.max(0, m.baseAlpha * (1 - m.flicker + m.flicker * Math.sin(t * 2.3 + m.phase * 3)));
      // wrap around the frame with a margin, re-entering from the side the wind comes from
      const pad = 160 * Math.max(1, s.scale.x);
      if (s.x > DESIGN_W + pad) s.x = -pad;
      if (s.x < -pad) s.x = DESIGN_W + pad;
      if (s.y > DESIGN_H + pad) s.y = -pad;
      if (s.y < -pad) s.y = DESIGN_H + pad;
    }
  }
}
