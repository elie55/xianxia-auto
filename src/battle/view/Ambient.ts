import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '@/app/scale';
import type { AmbientKind } from '@/content/themes';

/**
 * Living arenas: a few slow ambient layers between the painting and the fighters, so the backgrounds breathe. Each
 * battlefield (src/content/themes.ts) picks one kind:
 *   petals (bamboo province): petals and leaves drifting on the wind, soft light shafts
 *   embers (blood moon abyss, furnace volcano): embers rising from the depths, a low red glow that pulses
 *   clouds (heavenly ladder): clouds drifting across, light shafts, a few glints
 *   mist (herb valley): low banks of mist crawling over the floor, golden pollen rising, soft light shafts
 *   wisps (bone marsh): green will-o-wisps bobbing over ground fog
 *   dust (jade quarry): dust drifting through sunbeams, jade glints
 *   bubbles (drowned ruins): bubbles rising through swaying shafts of cold light, drifting silt
 *   ash (pill wastes): grey ash falling like snow, sulfur motes rising through a yellow haze
 *   snow (northern wastes): snow driven on the wind, a few large flakes close to the camera
 *   spores (soul forest): glowing spores and captured souls drifting through violet fog
 *   storm (thunder plateau): rain, storm clouds and lightning flashes
 *   wind (sky isles): wind streaks and fast clouds
 *   sand (starfall desert): sand blowing across the dunes, twinkling stars, a shooting star now and then
 *   void (void rift): violet motes and mirror shards floating up, the rift's glow pulsing
 *   tribulation (tribulation peak): golden sparks, dark clouds, purple tribulation flashes
 *   celestial (heaven gate): golden motes rising through divine light, luminous cloud banks
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

/** A full-frame flash (lightning): fires every `min`-`max` seconds, flickers twice and fades. */
interface Flash {
  s: Sprite;
  peak: number;
  min: number;
  max: number;
  next: number;
  second: number;
}

/** A streak that crosses the sky now and then (shooting star), resting off-frame between passes. */
interface Streak {
  s: Sprite;
  vx: number;
  vy: number;
  wait: number;
  min: number;
  max: number;
}

export class AmbientLayer extends Container {
  private motes: Mote[] = [];
  private flashes: Flash[] = [];
  private streaks: Streak[] = [];
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

  /** A vertical shaft of light, brightest in its middle. */
  private shaftOf(key: string, color: number): Texture {
    return this.texture(key, (g) => {
      for (let i = 0; i < 12; i++) g.rect(i * 10, 0, 10, 900).fill({ color, alpha: 0.5 * Math.sin((Math.PI * (i + 0.5)) / 12) });
    });
  }

  /** A horizontal streak fading at both ends (wind, shooting stars). */
  private streakOf(key: string, length: number, thick: number, color: number): Texture {
    return this.texture(key, (g) => {
      const n = 24;
      for (let i = 0; i < n; i++) g.rect((i * length) / n, 0, length / n + 0.5, thick).fill({ color, alpha: Math.sin((Math.PI * (i + 0.5)) / n) ** 1.5 });
    });
  }

  setKind(kind: AmbientKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    for (const m of this.motes) m.s.destroy();
    for (const f of this.flashes) f.s.destroy();
    for (const k of this.streaks) k.s.destroy();
    this.motes = [];
    this.flashes = [];
    this.streaks = [];
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
    /** Glowing motes with a bright core, drifting together. */
    const sparks = (glowTex: Texture, coreTex: Texture, count: number, o: { y?: [number, number]; vx: [number, number]; vy: [number, number]; sway: [number, number]; alpha: [number, number]; scale: [number, number]; flicker: number }) => {
      for (let i = 0; i < count; i++) {
        const x = rand(0, DESIGN_W);
        const y = rand(...(o.y ?? [0, DESIGN_H]));
        const vx = rand(...o.vx);
        const vy = rand(...o.vy);
        const sway = rand(...o.sway);
        add(glowTex, { x, y, alpha: rand(...o.alpha), scale: rand(...o.scale), vx, vy, sway, blend: 'add', flicker: o.flicker });
        add(coreTex, { x, y, alpha: 0.85, scale: rand(0.7, 1), vx, vy, sway, blend: 'add', flicker: o.flicker * 0.8 });
      }
    };
    const flash = (color: number, peak: number, min: number, max: number) => {
      const s = new Sprite(this.texture(`flash${color}`, (g) => g.rect(0, 0, 64, 64).fill({ color })));
      s.width = DESIGN_W + 200;
      s.height = DESIGN_H + 200;
      s.position.set(-100, -100);
      s.alpha = 0;
      s.blendMode = 'add';
      this.addChild(s);
      this.flashes.push({ s, peak, min, max, next: rand(2, max), second: -1 });
    };
    const shaft = this.shaftOf('shaft', 0xfff4d0);

    switch (kind) {
      case 'mist': {
        const bank = this.glow('mistBank', 180, 0xe8f4ee, 0.9);
        const pollen = this.glow('pollen', 5, 0xf3e3a0, 1);
        const pollenCore = this.texture('pollenCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xfff6d0 }));
        for (let i = 0; i < 2; i++) add(shaft, { x: rand(400, 1500), y: 280, alpha: 0.05, scale: rand(1.8, 2.4), rot: 0.3, blend: 'add', flicker: 0.03 });
        // mist banks crawl slowly across the floor and the lower hills
        for (let i = 0; i < 9; i++) add(bank, { x: rand(0, DESIGN_W), y: rand(560, 1040), alpha: rand(0.1, 0.2), scale: rand(1.6, 3), vx: rand(5, 14), vy: 0, sway: rand(3, 8), flicker: 0.12 });
        for (let i = 0; i < 4; i++) add(bank, { x: rand(0, DESIGN_W), y: rand(250, 520), alpha: rand(0.06, 0.12), scale: rand(1.8, 3.2), vx: rand(3, 9), vy: 0, sway: rand(2, 6) });
        // golden pollen drifts up from the herb terraces
        sparks(pollen, pollenCore, 26, { vx: [4, 14], vy: [-18, -6], sway: [8, 18], alpha: [0.35, 0.75], scale: [0.6, 1.2], flicker: 0.4 });
        break;
      }
      case 'petals': {
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
        break;
      }
      case 'embers': {
        const ember = this.glow('ember', 7, 0xff8a3a, 1);
        const core = this.texture('emberCore', (g) => g.circle(2, 2, 2).fill({ color: 0xffd9a0 }));
        add(this.glow('abyss', 160, 0xc0201a, 0.9), { x: DESIGN_W / 2, y: DESIGN_H + 40, alpha: 0.18, scale: 6, blend: 'add', flicker: 0.07 });
        sparks(ember, core, 34, { vx: [-8, 8], vy: [-64, -22], sway: [6, 16], alpha: [0.45, 0.9], scale: [0.6, 1.3], flicker: 0.35 });
        break;
      }
      case 'wisps': {
        const fog = this.glow('marshFog', 180, 0xa8c4a8, 0.9);
        const wisp = this.glow('wisp', 16, 0x9dff9a, 1);
        const core = this.texture('wispCore', (g) => g.circle(3, 3, 3).fill({ color: 0xe8ffe0 }));
        add(this.glow('moonGlow', 160, 0xb8e0a0, 0.8), { x: DESIGN_W * 0.62, y: 120, alpha: 0.08, scale: 3.5, blend: 'add', flicker: 0.1 });
        for (let i = 0; i < 9; i++) add(fog, { x: rand(0, DESIGN_W), y: rand(600, 1050), alpha: rand(0.08, 0.16), scale: rand(1.6, 3), vx: rand(4, 10), vy: 0, sway: rand(3, 7), flicker: 0.12 });
        // will-o-wisps bob slowly over the water
        sparks(wisp, core, 11, { y: [260, 900], vx: [-7, 7], vy: [-5, 3], sway: [12, 24], alpha: [0.5, 0.85], scale: [0.7, 1.3], flicker: 0.5 });
        break;
      }
      case 'dust': {
        const dust = this.glow('dust', 5, 0xe6d6b4, 0.8);
        const glint = this.glow('jadeGlint', 7, 0x7dffb0, 1);
        const glintCore = this.texture('jadeCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xd8ffe8 }));
        for (let i = 0; i < 3; i++) add(shaft, { x: rand(350, 1550), y: 300, alpha: 0.06, scale: rand(1.8, 2.6), rot: 0.32, blend: 'add', flicker: 0.04 });
        for (let i = 0; i < 34; i++) add(dust, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.2, 0.45), scale: rand(0.6, 1.4), vx: rand(8, 22), vy: rand(-4, 4), sway: rand(6, 14), flicker: 0.2 });
        sparks(glint, glintCore, 9, { vx: [-3, 3], vy: [-6, -1], sway: [3, 8], alpha: [0.3, 0.7], scale: [0.5, 1], flicker: 0.6 });
        break;
      }
      case 'bubbles': {
        const cold = this.shaftOf('shaftCold', 0xbff6ff);
        const bubble = this.texture('bubble', (g) => {
          g.circle(8, 8, 7).stroke({ color: 0xdffaff, width: 1.5, alpha: 0.85 });
          g.circle(5.5, 5.5, 2).fill({ color: 0xffffff, alpha: 0.8 });
        });
        const silt = this.glow('silt', 4, 0xbfe8e0, 0.8);
        for (let i = 0; i < 4; i++) add(cold, { x: rand(250, 1650), y: 260, alpha: 0.07, scale: rand(1.6, 2.6), rot: rand(-0.25, 0.25), blend: 'add', flicker: 0.06, sway: rand(4, 10) });
        for (let i = 0; i < 30; i++) add(bubble, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.3, 0.65), scale: rand(0.35, 1.2), vx: rand(-3, 3), vy: -rand(24, 60), sway: rand(10, 22) });
        for (let i = 0; i < 26; i++) add(silt, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.15, 0.35), scale: rand(0.5, 1.2), vx: rand(-6, 6), vy: rand(-4, 4), sway: rand(4, 10), flicker: 0.3 });
        break;
      }
      case 'ash': {
        const flake = this.texture('ashFlake', (g) => {
          g.ellipse(5, 3.5, 5, 3.5).fill({ color: 0xb4b0a6 });
          g.ellipse(4, 3, 2, 1.2).fill({ color: 0xd8d4ca, alpha: 0.7 });
        });
        const sulfur = this.glow('sulfur', 7, 0xd0e060, 1);
        const sulfurCore = this.texture('sulfurCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xf6ffc0 }));
        add(this.glow('smog', 160, 0xd8cf98, 0.8), { x: DESIGN_W * 0.45, y: 80, alpha: 0.1, scale: 6, blend: 'add', flicker: 0.06 });
        for (let i = 0; i < 44; i++) add(flake, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.35, 0.7), scale: rand(0.5, 1.3), vx: rand(6, 20), vy: rand(12, 32), sway: rand(10, 22), spin: rand(-1.5, 1.5) });
        sparks(sulfur, sulfurCore, 10, { y: [500, DESIGN_H], vx: [-4, 6], vy: [-16, -6], sway: [6, 12], alpha: [0.3, 0.6], scale: [0.6, 1.1], flicker: 0.45 });
        break;
      }
      case 'snow': {
        const flake = this.glow('snow', 4, 0xffffff, 1);
        const big = this.glow('snowBig', 9, 0xf4fbff, 1);
        add(this.glow('aurora', 160, 0x8fe8d8, 0.8), { x: DESIGN_W * 0.4, y: 90, alpha: 0.07, scale: 5, blend: 'add', flicker: 0.12 });
        for (let i = 0; i < 64; i++) add(flake, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.5, 0.9), scale: rand(0.5, 1.3), vx: rand(12, 34), vy: rand(30, 70), sway: rand(10, 22) });
        for (let i = 0; i < 9; i++) add(big, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.25, 0.45), scale: rand(1, 1.6), vx: rand(30, 60), vy: rand(70, 110), sway: rand(14, 26) });
        break;
      }
      case 'spores': {
        const fog = this.glow('violetFog', 180, 0x7a62a0, 0.9);
        const spore = this.glow('spore', 7, 0xa8e070, 1);
        const sporeCore = this.texture('sporeCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xeaffd0 }));
        const soul = this.glow('soul', 14, 0xc8a8ff, 1);
        const soulCore = this.texture('soulCore', (g) => g.circle(2.5, 2.5, 2.5).fill({ color: 0xf0e8ff }));
        for (let i = 0; i < 8; i++) add(fog, { x: rand(0, DESIGN_W), y: rand(560, 1050), alpha: rand(0.1, 0.18), scale: rand(1.6, 3), vx: rand(3, 9), vy: 0, sway: rand(3, 7), flicker: 0.12 });
        sparks(spore, sporeCore, 24, { vx: [-5, 5], vy: [-12, -3], sway: [12, 24], alpha: [0.35, 0.7], scale: [0.5, 1.1], flicker: 0.5 });
        // captured souls drift slowly upward between the trees
        sparks(soul, soulCore, 6, { y: [300, 900], vx: [-4, 4], vy: [-14, -6], sway: [16, 30], alpha: [0.35, 0.6], scale: [0.8, 1.3], flicker: 0.3 });
        break;
      }
      case 'storm': {
        const cloud = this.glow('stormCloud', 160, 0x1c2234, 0.9);
        const rain = this.texture('rain', (g) => g.rect(0, 0, 2, 44).fill({ color: 0xc8d8ff, alpha: 0.55 }));
        for (let i = 0; i < 7; i++) add(cloud, { x: rand(0, DESIGN_W), y: rand(0, 260), alpha: rand(0.25, 0.4), scale: rand(1.8, 3), vx: rand(12, 26), vy: 0, sway: rand(4, 10) });
        // rain driven on a slant: the streak leans with its fall
        const angle = Math.atan2(-160, 1100);
        for (let i = 0; i < 80; i++) {
          const v = rand(950, 1250);
          add(rain, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.18, 0.4), scale: rand(0.6, 1.1), vx: v * 0.15, vy: v, rot: angle });
        }
        flash(0xdde6ff, 0.22, 5, 10);
        break;
      }
      case 'wind': {
        const streak = this.streakOf('windStreak', 300, 3, 0xffffff);
        const cloud = this.glow('cloud', 140, 0xffffff, 0.9);
        for (let i = 0; i < 2; i++) add(shaft, { x: rand(400, 1500), y: 260, alpha: 0.05, scale: rand(1.8, 2.4), rot: -0.3, blend: 'add', flicker: 0.04 });
        for (let i = 0; i < 7; i++) add(cloud, { x: rand(0, DESIGN_W), y: rand(80, 1000), alpha: rand(0.08, 0.16), scale: rand(1.4, 2.8), vx: rand(28, 60), vy: 0, sway: rand(6, 14) });
        for (let i = 0; i < 16; i++) add(streak, { x: rand(0, DESIGN_W), y: rand(60, 1040), alpha: rand(0.12, 0.28), scale: rand(0.6, 1.4), vx: rand(320, 560), vy: rand(-10, 10), sway: rand(10, 30) });
        break;
      }
      case 'sand': {
        const grain = this.glow('sand', 3, 0xe8c890, 1);
        const star = this.glow('starTwinkle', 6, 0xd8e4ff, 1);
        const starCore = this.texture('starCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xffffff }));
        for (let i = 0; i < 22; i++) {
          const x = rand(0, DESIGN_W);
          const y = rand(20, 420);
          add(star, { x, y, alpha: rand(0.3, 0.7), scale: rand(0.5, 1), flicker: 0.7 });
          add(starCore, { x, y, alpha: 0.8, scale: rand(0.6, 1), flicker: 0.6 });
        }
        for (let i = 0; i < 56; i++) add(grain, { x: rand(0, DESIGN_W), y: rand(380, DESIGN_H), alpha: rand(0.3, 0.6), scale: rand(0.6, 1.5), vx: rand(70, 160), vy: rand(-8, 12), sway: rand(8, 20) });
        // a shooting star now and then
        const s = new Sprite(this.streakOf('shootingStar', 220, 3, 0xe8f0ff));
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.rotation = Math.atan2(160, 520);
        s.position.set(-400, -400);
        this.addChild(s);
        this.streaks.push({ s, vx: 520, vy: 160, wait: rand(2, 6), min: 6, max: 12 });
        break;
      }
      case 'void': {
        const mote = this.glow('voidMote', 8, 0xb070ff, 1);
        const moteCore = this.texture('voidCore', (g) => g.circle(2, 2, 2).fill({ color: 0xf4e8ff }));
        const shard = this.texture('mirrorShard', (g) => {
          g.poly([0, 0, 14, 4, 6, 18]).fill({ color: 0xd8d0ff, alpha: 0.55 });
          g.poly([0, 0, 14, 4, 6, 18]).stroke({ color: 0xffffff, width: 1, alpha: 0.7 });
        });
        add(this.glow('rift', 160, 0x9a40ff, 0.9), { x: DESIGN_W * 0.5, y: 110, alpha: 0.14, scale: 4.5, blend: 'add', flicker: 0.18 });
        sparks(mote, moteCore, 26, { vx: [-6, 6], vy: [-24, -8], sway: [8, 18], alpha: [0.35, 0.75], scale: [0.5, 1.2], flicker: 0.45 });
        for (let i = 0; i < 10; i++) add(shard, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H), alpha: rand(0.3, 0.6), scale: rand(0.6, 1.4), vx: rand(-6, 6), vy: -rand(4, 14), sway: rand(4, 10), spin: rand(-0.6, 0.6), flicker: 0.3 });
        break;
      }
      case 'tribulation': {
        const cloud = this.glow('tribCloud', 160, 0x2a1a3e, 0.9);
        const spark = this.glow('tribSpark', 6, 0xffd070, 1);
        const sparkCore = this.texture('tribCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xfff4d8 }));
        add(this.glow('vortex', 160, 0x8a4aff, 0.9), { x: DESIGN_W * 0.5, y: 60, alpha: 0.16, scale: 6, blend: 'add', flicker: 0.15 });
        for (let i = 0; i < 6; i++) add(cloud, { x: rand(0, DESIGN_W), y: rand(0, 240), alpha: rand(0.25, 0.4), scale: rand(1.8, 3), vx: rand(6, 16), vy: 0, sway: rand(4, 10) });
        sparks(spark, sparkCore, 22, { vx: [-6, 6], vy: [-40, -12], sway: [6, 14], alpha: [0.35, 0.8], scale: [0.5, 1.1], flicker: 0.5 });
        flash(0xc8a0ff, 0.2, 6, 11);
        break;
      }
      case 'celestial': {
        const gold = this.shaftOf('shaftGold', 0xffe6a0);
        const bank = this.glow('cloudBank', 180, 0xfff8ec, 0.9);
        const mote = this.glow('goldMote', 6, 0xffd878, 1);
        const moteCore = this.texture('goldCore', (g) => g.circle(1.5, 1.5, 1.5).fill({ color: 0xfffbe8 }));
        for (let i = 0; i < 4; i++) add(gold, { x: rand(300, 1600), y: 240, alpha: 0.07, scale: rand(1.8, 2.8), rot: rand(-0.35, 0.35), blend: 'add', flicker: 0.05 });
        for (let i = 0; i < 8; i++) add(bank, { x: rand(0, DESIGN_W), y: rand(640, 1060), alpha: rand(0.1, 0.18), scale: rand(1.6, 3), vx: rand(5, 12), vy: 0, sway: rand(3, 8), flicker: 0.1 });
        sparks(mote, moteCore, 28, { vx: [-4, 4], vy: [-22, -8], sway: [6, 14], alpha: [0.35, 0.75], scale: [0.5, 1.1], flicker: 0.45 });
        break;
      }
      default: {
        const cloud = this.glow('cloud', 140, 0xffffff, 0.9);
        const glint = this.glow('glint', 6, 0xfff6d8, 1);
        for (let i = 0; i < 3; i++) add(shaft, { x: rand(300, 1600), y: 260, alpha: 0.06, scale: rand(1.8, 2.6), rot: -0.3, blend: 'add', flicker: 0.04 });
        for (let i = 0; i < 6; i++) add(cloud, { x: rand(0, DESIGN_W), y: rand(60, 420), alpha: rand(0.1, 0.18), scale: rand(1.4, 2.6), vx: rand(6, 16), vy: 0, sway: rand(4, 10) });
        for (let i = 0; i < 14; i++) add(glint, { x: rand(0, DESIGN_W), y: rand(0, DESIGN_H * 0.75), alpha: rand(0.3, 0.7), scale: rand(0.5, 1), vx: rand(-4, 4), vy: rand(-6, -2), sway: rand(4, 10), blend: 'add', flicker: 0.5 });
      }
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
    for (const f of this.flashes) {
      f.next -= dt;
      if (f.second > 0) {
        f.second -= dt;
        if (f.second <= 0) f.s.alpha = f.peak * 0.8;
      }
      if (f.next <= 0) {
        f.s.alpha = f.peak;
        f.second = 0.14;
        f.next = f.min + Math.random() * (f.max - f.min);
      }
      f.s.alpha *= Math.exp(-dt * 7);
    }
    for (const k of this.streaks) {
      if (k.wait > 0) {
        k.wait -= dt;
        if (k.wait <= 0) {
          k.s.position.set(Math.random() * DESIGN_W * 0.7, Math.random() * 160);
          k.s.alpha = 0.85;
        }
        continue;
      }
      k.s.x += k.vx * dt;
      k.s.y += k.vy * dt;
      k.s.alpha *= Math.exp(-dt * 1.2);
      if (k.s.x > DESIGN_W + 200 || k.s.y > DESIGN_H * 0.5 || k.s.alpha < 0.05) {
        k.s.position.set(-400, -400);
        k.wait = k.min + Math.random() * (k.max - k.min);
      }
    }
  }
}
