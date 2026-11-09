import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';

/**
 * Procedural VFX built from Graphics + GSAP. Keyed so content can request effects by name.
 * All durations respect the current battle speed via gsap.globalTimeline.timeScale.
 */
export class VfxLayer extends Container {
  private softTex: Texture | null = null;

  private soft(): Texture {
    if (this.softTex) return this.softTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.softTex = Texture.from(c);
    return this.softTex;
  }

  /** Particle burst of soft dots. */
  burst(x: number, y: number, color: number, opts: { count?: number; speed?: number; size?: number; life?: number; gravity?: number; spread?: number } = {}): void {
    const n = opts.count ?? 14;
    const tex = this.soft();
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = color;
      s.blendMode = 'add';
      const sz = (opts.size ?? 18) * (0.6 + Math.random() * 0.8);
      s.width = s.height = sz;
      s.x = x;
      s.y = y;
      this.addChild(s);
      const ang = Math.random() * Math.PI * 2;
      const spd = (opts.speed ?? 120) * (0.4 + Math.random());
      const spread = opts.spread ?? 1;
      const life = (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      gsap.to(s, {
        x: x + Math.cos(ang) * spd * spread,
        y: y + Math.sin(ang) * spd * 0.6 * spread + (opts.gravity ?? 0),
        alpha: 0,
        duration: life,
        ease: 'power2.out',
        onComplete: () => s.destroy(),
      });
      gsap.to(s.scale, { x: 0.1, y: 0.1, duration: life, ease: 'power1.in' });
    }
  }

  /** Expanding ring. */
  ring(x: number, y: number, color: number, radius = 60, width = 4, duration = 0.5, squash = 0.5): void {
    const g = new Graphics();
    g.ellipse(0, 0, 10, 10 * squash).stroke({ color, width, alpha: 1 });
    g.x = x;
    g.y = y;
    g.blendMode = 'add';
    this.addChild(g);
    const state = { r: 10, a: 1 };
    gsap.to(state, {
      r: radius,
      a: 0,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        g.clear();
        g.ellipse(0, 0, state.r, state.r * squash).stroke({ color, width: width * state.a + 1, alpha: state.a });
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Flash a soft glow at a point. */
  flash(x: number, y: number, color: number, size = 120, duration = 0.3): void {
    const s = new Sprite(this.soft());
    s.anchor.set(0.5);
    s.tint = color;
    s.blendMode = 'add';
    s.width = s.height = size * 0.3;
    s.x = x;
    s.y = y;
    this.addChild(s);
    gsap.to(s, { width: size, height: size, alpha: 0, duration, ease: 'power2.out', onComplete: () => s.destroy() });
  }

  /** Curved slash arc. */
  slash(x: number, y: number, facing: number, color = 0xffffff, size = 70): void {
    const g = new Graphics();
    g.x = x;
    g.y = y;
    g.scale.x = facing;
    g.blendMode = 'add';
    this.addChild(g);
    const state = { t: 0 };
    gsap.to(state, {
      t: 1,
      duration: 0.22,
      ease: 'power2.out',
      onUpdate: () => {
        g.clear();
        const a0 = -Math.PI * 0.55 + state.t * 0.2;
        const a1 = a0 + Math.PI * 0.7 * Math.min(1, state.t * 1.6);
        const r = size;
        g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r * 0.9);
        for (let a = a0; a <= a1; a += 0.1) g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9);
        g.stroke({ color, width: 7 * (1 - state.t * 0.7) + 1, alpha: 1 - state.t * 0.8, cap: 'round' });
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Jagged lightning bolt from (x0,y0) to (x1,y1). */
  lightning(x0: number, y0: number, x1: number, y1: number, color = 0xfff27a): void {
    const g = new Graphics();
    g.blendMode = 'add';
    this.addChild(g);
    const draw = (alpha: number, width: number) => {
      g.clear();
      const segs = 9;
      g.moveTo(x0, y0);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const jx = (Math.random() - 0.5) * 28;
        const jy = (Math.random() - 0.5) * 18;
        g.lineTo(x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy);
      }
      g.lineTo(x1, y1);
      g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
      g.stroke({ color: 0xffffff, width: Math.max(1, width * 0.4), alpha: alpha * 0.9 });
    };
    draw(1, 5);
    const state = { a: 1 };
    gsap.to(state, {
      a: 0,
      duration: 0.28,
      ease: 'power1.in',
      onUpdate: () => draw(state.a, 5 * state.a + 1),
      onComplete: () => g.destroy(),
    });
    this.flash(x1, y1, color, 100, 0.25);
  }

  /** Vertical lightning strike from the sky onto (x,y). */
  strike(x: number, y: number, color = 0xfff27a): void {
    this.lightning(x + (Math.random() - 0.5) * 120, y - 520, x, y, color);
    this.burst(x, y, color, { count: 10, speed: 90, size: 14, life: 0.4 });
  }

  /** Moving projectile; returns a promise resolved on arrival. */
  projectile(x0: number, y0: number, x1: number, y1: number, duration: number, style: ProjectileStyle): void {
    const c = new Container();
    c.x = x0;
    c.y = y0;
    this.addChild(c);
    const g = new Graphics();
    c.addChild(g);
    const color = style.color;
    switch (style.shape) {
      case 'sword':
        g.moveTo(-22, 0).lineTo(18, 0).stroke({ color: 0xe8f1ff, width: 4, cap: 'round' });
        g.moveTo(-10, -5).lineTo(-10, 5).stroke({ color, width: 3 });
        g.circle(18, 0, 3).fill({ color: 0xffffff });
        break;
      case 'arrow':
        g.moveTo(-18, 0).lineTo(14, 0).stroke({ color: 0xe0d0a0, width: 3, cap: 'round' });
        g.poly([14, 0, 6, -5, 6, 5]).fill({ color: 0xfff1c0 });
        break;
      case 'orb':
      default: {
        g.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.95 });
        g.circle(0, 0, 16).fill({ color, alpha: 0.35 });
        break;
      }
    }
    const glow = new Sprite(this.soft());
    glow.anchor.set(0.5);
    glow.tint = color;
    glow.blendMode = 'add';
    glow.width = glow.height = 60;
    c.addChildAt(glow, 0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.rotation = ang;
    const arc = style.arc ?? 0;
    const state = { t: 0 };
    let lastX = x0;
    let lastY = y0;
    const trailTimer = { n: 0 };
    gsap.to(state, {
      t: 1,
      duration,
      ease: style.ease ?? 'none',
      onUpdate: () => {
        const t = state.t;
        c.x = x0 + (x1 - x0) * t;
        c.y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * arc;
        if (++trailTimer.n % 2 === 0) {
          const tr = new Sprite(this.soft());
          tr.anchor.set(0.5);
          tr.tint = color;
          tr.blendMode = 'add';
          tr.width = tr.height = 26;
          tr.x = lastX;
          tr.y = lastY;
          this.addChild(tr);
          gsap.to(tr, { alpha: 0, width: 4, height: 4, duration: 0.3, onComplete: () => tr.destroy() });
        }
        lastX = c.x;
        lastY = c.y;
      },
      onComplete: () => {
        c.destroy();
        this.burst(x1, y1, color, { count: 8, speed: 80, size: 14, life: 0.35 });
      },
    });
  }

  /** Rising embers around a unit (burn). */
  embers(x: number, y: number, color = 0xff8a3c, count = 6): void {
    const tex = this.soft();
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = color;
      s.blendMode = 'add';
      s.width = s.height = 8 + Math.random() * 10;
      s.x = x + (Math.random() - 0.5) * 50;
      s.y = y - Math.random() * 40;
      this.addChild(s);
      gsap.to(s, { y: s.y - 60 - Math.random() * 40, x: s.x + (Math.random() - 0.5) * 30, alpha: 0, duration: 0.7 + Math.random() * 0.4, ease: 'power1.out', onComplete: () => s.destroy() });
    }
  }

  /** Pillar of light (heal / enlightenment). */
  pillar(x: number, y: number, color: number, height = 220, duration = 0.6): void {
    const g = new Graphics();
    g.rect(-18, -height, 36, height).fill({ color, alpha: 0.35 });
    g.rect(-6, -height, 12, height).fill({ color: 0xffffff, alpha: 0.5 });
    g.x = x;
    g.y = y;
    g.blendMode = 'add';
    g.scale.y = 0;
    this.addChild(g);
    gsap.to(g.scale, { y: 1, duration: duration * 0.4, ease: 'power3.out' });
    gsap.to(g, { alpha: 0, duration: duration * 0.6, delay: duration * 0.4, ease: 'power1.in', onComplete: () => g.destroy() });
    this.ring(x, y, color, 70, 3, duration, 0.45);
  }

  /** Dust puff at feet when moving/landing. */
  dust(x: number, y: number): void {
    this.burst(x, y, 0xcfc6b0, { count: 5, speed: 40, size: 16, life: 0.4, spread: 1.2 });
  }
}

export interface ProjectileStyle {
  shape: 'sword' | 'arrow' | 'orb';
  color: number;
  arc?: number;
  ease?: string;
}

export const PROJECTILE_STYLES: Record<string, ProjectileStyle> = {
  flying_sword: { shape: 'sword', color: 0x9fe0ff, arc: 30, ease: 'power2.in' },
  spirit_arrow: { shape: 'arrow', color: 0xffe9a0, arc: 40 },
  spirit_bolt: { shape: 'orb', color: 0x9fd5ff, arc: 25 },
  fire_talisman: { shape: 'orb', color: 0xff8a3c, arc: 50 },
  ice_shard: { shape: 'arrow', color: 0xa8e4ff, arc: 20 },
  lightning_bolt: { shape: 'orb', color: 0xfff27a, arc: 0 },
  moon_orb: { shape: 'orb', color: 0xc9d8ff, arc: 60 },
  petal: { shape: 'orb', color: 0xffb7d5, arc: 70 },
  poison_vial: { shape: 'orb', color: 0x9fe85a, arc: 80 },
  prayer_bead: { shape: 'orb', color: 0xf3cf78, arc: 60 },
  venom_spit: { shape: 'orb', color: 0x8fdc4b, arc: 40 },
  ghost_flame: { shape: 'orb', color: 0x7ff0e1, arc: 30 },
  bone_shard: { shape: 'arrow', color: 0xd8e6ee, arc: 30 },
};

export const STATUS_COLORS: Record<string, number> = {
  burn: 0xff8a3c,
  poison: 0x9fe85a,
  frost: 0xa8e4ff,
  stun: 0xfff27a,
  taunt: 0xffd27f,
  bleed: 0xff6b7a,
  weaken: 0xb0a0d0,
  sunder: 0xff9f7a,
};
