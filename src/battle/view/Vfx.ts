import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';

/**
 * Procedural VFX built from Graphics + GSAP. Keyed so content can request effects by name.
 * All durations respect the current battle speed via gsap.globalTimeline.timeScale.
 * Everything is additive-blended and short-lived; particle counts are capped so a busy fight stays smooth.
 */
export class VfxLayer extends Container {
  /** Battle speed multiplier applied to flipbook playback (gsap effects use the global timeline instead). */
  timeScale = 1;
  /** Flipbook frames, shared by every effects layer (front and behind units). */
  private static sheets = new Map<string, Texture[]>();

  /** Loads 4×4 flipbook sheets from /assets/art/fx/<name>.jpg (black background, played additively). Missing sheets are skipped. */
  async loadFlipbooks(names: string[], cols = 4, rows = 4): Promise<void> {
    await Promise.all(
      names.map(async (name) => {
        if (VfxLayer.sheets.has(name)) return;
        const tex = await Assets.load<Texture>(`./assets/art/fx/${name}.jpg`).catch(() => null);
        if (!tex) return;
        const fw = tex.width / cols;
        const fh = tex.height / rows;
        const frames: Texture[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) frames.push(new Texture({ source: tex.source, frame: new Rectangle(c * fw, r * fh, fw, fh) }));
        VfxLayer.sheets.set(name, frames);
      }),
    );
  }

  hasFlipbook(name: string): boolean {
    return VfxLayer.sheets.has(name);
  }

  /**
   * Plays a flipbook once at (x, y). `scale` 1 shows a frame at its native size (256 px for a 1024 sheet);
   * `anchorY` 1 pins the bottom of the frame to y (for strikes and pillars). Returns false when the sheet is missing.
   */
  flipbook(name: string, x: number, y: number, opts: { scale?: number; fps?: number; tint?: number; rotation?: number; anchorY?: number; alpha?: number; flipX?: boolean; delay?: number } = {}): boolean {
    const frames = VfxLayer.sheets.get(name);
    if (!frames) return false;
    const start = () => {
      const s = new AnimatedSprite(frames);
      s.blendMode = 'add';
      s.anchor.set(0.5, opts.anchorY ?? 0.5);
      s.position.set(x, y);
      s.scale.set((opts.flipX ? -1 : 1) * (opts.scale ?? 1), opts.scale ?? 1);
      s.rotation = opts.rotation ?? 0;
      s.tint = opts.tint ?? 0xffffff;
      s.alpha = opts.alpha ?? 1;
      s.loop = false;
      s.animationSpeed = ((opts.fps ?? 24) / 60) * this.timeScale;
      s.onComplete = () => s.destroy();
      this.addChild(s);
      s.play();
    };
    if (opts.delay) gsap.delayedCall(opts.delay, start);
    else start();
    return true;
  }

  private softTex: Texture | null = null;
  private shardTex: Texture | null = null;
  /** Rough budget: skip decorative particles when the layer is already crowded. */
  private get crowded(): boolean {
    return this.children.length > 420;
  }

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

  private shard(): Texture {
    if (this.shardTex) return this.shardTex;
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 48;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 48);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0.15)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(12, 0);
    g.lineTo(22, 34);
    g.lineTo(12, 48);
    g.lineTo(2, 34);
    g.closePath();
    g.fill();
    this.shardTex = Texture.from(c);
    return this.shardTex;
  }

  /** Particle burst of soft dots. */
  burst(x: number, y: number, color: number, opts: { count?: number; speed?: number; size?: number; life?: number; gravity?: number; spread?: number } = {}): void {
    const n = this.crowded ? Math.ceil((opts.count ?? 14) / 3) : (opts.count ?? 14);
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
        onComplete: () => (gsap.killTweensOf(s), s.destroy()),
      });
      gsap.to(s.scale, { x: 0.1, y: 0.1, duration: life, ease: 'power1.in' });
    }
  }

  /** Thin directional streaks flying away from an impact point (melee hits). */
  sparks(x: number, y: number, dirX: number, color = 0xfff1c0, count = 7, speed = 260): void {
    const n = this.crowded ? 3 : count;
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const len = 10 + Math.random() * 18;
      g.moveTo(0, 0).lineTo(len, 0).stroke({ color, width: 2 + Math.random() * 1.5, cap: 'round' });
      g.moveTo(0, 0).lineTo(len * 0.6, 0).stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
      g.blendMode = 'add';
      g.x = x;
      g.y = y;
      const ang = (dirX >= 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
      g.rotation = ang;
      this.addChild(g);
      const spd = speed * (0.5 + Math.random());
      const life = 0.22 + Math.random() * 0.18;
      gsap.to(g, { x: x + Math.cos(ang) * spd * life, y: y + Math.sin(ang) * spd * life + 20 * life, alpha: 0, duration: life, ease: 'power2.out', onComplete: () => g.destroy() });
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

  /** Ground shockwave: a thick ring hugging the floor plus dust and a flash. */
  shockwave(x: number, y: number, color: number, radius = 120, duration = 0.55): void {
    this.ring(x, y, color, radius, 8, duration, 0.42);
    this.ring(x, y, 0xffffff, radius * 0.7, 3, duration * 0.8, 0.42);
    this.burst(x, y, 0xcfc6b0, { count: 10, speed: radius * 0.9, size: 22, life: 0.5, spread: 1.1, gravity: -10 });
    this.flash(x, y - 20, color, radius * 0.9, 0.35);
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
    gsap.to(s, { width: size, height: size, alpha: 0, duration, ease: 'power2.out', onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
  }

  /** Curved slash arc with a bright core. */
  slash(x: number, y: number, facing: number, color = 0xffffff, size = 70, tilt = 0): void {
    const g = new Graphics();
    g.x = x;
    g.y = y;
    g.scale.x = facing;
    g.rotation = tilt;
    g.blendMode = 'add';
    this.addChild(g);
    const state = { t: 0 };
    gsap.to(state, {
      t: 1,
      duration: 0.24,
      ease: 'power2.out',
      onUpdate: () => {
        g.clear();
        const a0 = -Math.PI * 0.55 + state.t * 0.2;
        const a1 = a0 + Math.PI * 0.7 * Math.min(1, state.t * 1.6);
        const r = size;
        const pts: number[] = [];
        for (let a = a0; a <= a1; a += 0.08) pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.9);
        if (pts.length >= 4) {
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.stroke({ color, width: 9 * (1 - state.t * 0.7) + 1, alpha: 0.9 - state.t * 0.7, cap: 'round' });
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.stroke({ color: 0xffffff, width: 3 * (1 - state.t * 0.7) + 0.5, alpha: 1 - state.t * 0.8, cap: 'round' });
        }
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
    this.sparks(x, y - 10, 1, color, 4, 200);
    this.sparks(x, y - 10, -1, color, 4, 200);
  }

  /** Lightning that jumps along a list of points (chain lightning). */
  chain(points: { x: number; y: number }[], color = 0xfff27a): void {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      gsap.delayedCall(i * 0.07, () => this.lightning(a.x, a.y, b.x, b.y, color));
    }
  }

  /** Tapered glowing beam between two points (breath attacks, piercing thrusts). */
  beam(x0: number, y0: number, x1: number, y1: number, color: number, width = 26, duration = 0.45): void {
    const g = new Graphics();
    g.blendMode = 'add';
    this.addChild(g);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    g.x = x0;
    g.y = y0;
    g.rotation = ang;
    const state = { t: 0 };
    gsap.to(state, {
      t: 1,
      duration,
      ease: 'power1.out',
      onUpdate: () => {
        const t = state.t;
        const reach = len * Math.min(1, t * 2.2);
        const w = width * (1 - t * 0.85);
        g.clear();
        g.poly([0, -w * 0.5, reach, -w * 0.25, reach + w, 0, reach, w * 0.25, 0, w * 0.5]).fill({ color, alpha: 0.55 * (1 - t) });
        g.poly([0, -w * 0.18, reach, -w * 0.08, reach + w * 0.6, 0, reach, w * 0.08, 0, w * 0.18]).fill({ color: 0xffffff, alpha: 0.9 * (1 - t) });
      },
      onComplete: () => g.destroy(),
    });
    this.flash(x0, y0, color, width * 3, 0.3);
    gsap.delayedCall(duration * 0.45, () => this.flash(x1, y1, color, width * 4, 0.35));
  }

  /** Crystal shards bursting upward and falling back (ice, bone, glass). */
  shards(x: number, y: number, color = 0xa8e4ff, count = 10, power = 1): void {
    const n = this.crowded ? 4 : count;
    const tex = this.shard();
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.tint = color;
      s.blendMode = 'add';
      const k = 0.5 + Math.random() * 0.7;
      s.scale.set(k * 0.9, k);
      s.x = x + (Math.random() - 0.5) * 30;
      s.y = y - 10;
      s.rotation = (Math.random() - 0.5) * 0.8;
      this.addChild(s);
      const vx = (Math.random() - 0.5) * 220 * power;
      const vy = -(140 + Math.random() * 180) * power;
      const life = 0.55 + Math.random() * 0.3;
      const st = { t: 0 };
      gsap.to(st, {
        t: 1,
        duration: life,
        ease: 'none',
        onUpdate: () => {
          const t = st.t * life;
          s.x = x + vx * t;
          s.y = y - 10 + vy * t + 520 * t * t;
          s.rotation += 0.12;
          s.alpha = 1 - st.t * st.t;
        },
        onComplete: () => (gsap.killTweensOf(s), s.destroy()),
      });
    }
    this.flash(x, y - 40, color, 110, 0.3);
  }

  /** Column of flame: rising puffs plus a bright core. */
  fireColumn(x: number, y: number, color = 0xff8a3c, height = 200, count = 16): void {
    const n = this.crowded ? 6 : count;
    const tex = this.soft();
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = i % 3 === 0 ? 0xfff0a0 : color;
      s.blendMode = 'add';
      const sz = 26 + Math.random() * 30;
      s.width = s.height = sz;
      s.x = x + (Math.random() - 0.5) * 50;
      s.y = y - Math.random() * 30;
      this.addChild(s);
      const delay = Math.random() * 0.25;
      gsap.to(s, { y: y - height * (0.5 + Math.random() * 0.5), x: s.x + (Math.random() - 0.5) * 40, alpha: 0, duration: 0.6 + Math.random() * 0.4, delay, ease: 'power1.out', onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
      gsap.to(s.scale, { x: s.scale.x * 0.3, y: s.scale.y * 0.3, duration: 0.9, delay, ease: 'power1.in' });
    }
    this.pillar(x, y, color, height * 0.8, 0.5);
  }

  /** Expanding smoke puffs (poison clouds, shadow mist). */
  smoke(x: number, y: number, color = 0x9fe85a, count = 10, radius = 70): void {
    const n = this.crowded ? 4 : count;
    const tex = this.soft();
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = color;
      s.alpha = 0.55;
      const sz = 30 + Math.random() * 30;
      s.width = s.height = sz;
      s.x = x + (Math.random() - 0.5) * 30;
      s.y = y - 20 - Math.random() * 30;
      this.addChild(s);
      const ang = Math.random() * Math.PI * 2;
      gsap.to(s, { x: s.x + Math.cos(ang) * radius * Math.random(), y: s.y - 30 - Math.random() * 50, alpha: 0, duration: 0.9 + Math.random() * 0.5, ease: 'power1.out', onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
      gsap.to(s, { width: sz * 2.2, height: sz * 2.2, duration: 1.1, ease: 'power1.out' });
    }
  }

  /** Gentle rising sparkles that twinkle (heals, blessings, enlightenment). */
  motes(x: number, y: number, color = 0x8dff9a, count = 10, height = 120): void {
    const n = this.crowded ? 4 : count;
    const tex = this.soft();
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = color;
      s.blendMode = 'add';
      const sz = 6 + Math.random() * 10;
      s.width = s.height = sz;
      s.x = x + (Math.random() - 0.5) * 70;
      s.y = y - Math.random() * 20;
      s.alpha = 0;
      this.addChild(s);
      const life = 0.8 + Math.random() * 0.6;
      const delay = Math.random() * 0.3;
      gsap.to(s, { alpha: 1, duration: 0.2, delay });
      gsap.to(s, { y: s.y - height * (0.5 + Math.random() * 0.5), x: s.x + Math.sin(i) * 14, duration: life, delay, ease: 'sine.out' });
      gsap.to(s, { alpha: 0, duration: 0.35, delay: delay + life - 0.35, onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
      gsap.to(s.scale, { x: s.scale.x * 1.6, y: s.scale.y * 1.6, duration: 0.25, delay: delay + life * 0.4, yoyo: true, repeat: 1 });
    }
  }

  /** Shield dome: a translucent arc that flares and fades over the unit. */
  dome(x: number, y: number, color = 0xbfe4ff, rx = 60, ry = 90, fill = 0.06): void {
    const g = new Graphics();
    g.x = x;
    g.y = y;
    g.blendMode = 'add';
    this.addChild(g);
    // a thin shimmering outline that never covers the character: faint fill, soft rim, quick fade
    const st = { a: 0.55, k: 0.9 };
    const draw = () => {
      g.clear();
      g.ellipse(0, -ry * 0.55, rx * st.k, ry * 0.75 * st.k).fill({ color, alpha: st.a * fill });
      g.ellipse(0, -ry * 0.55, rx * st.k, ry * 0.75 * st.k).stroke({ color, width: 2, alpha: st.a * 0.7 });
      g.ellipse(0, -ry * 0.55, rx * st.k * 0.86, ry * 0.75 * st.k * 0.86).stroke({ color: 0xffffff, width: 1, alpha: st.a * 0.25 });
    };
    draw();
    gsap.to(st, { k: 1.05, duration: 0.22, ease: 'back.out(2)', onUpdate: draw });
    gsap.to(st, { a: 0, duration: 0.4, delay: 0.18, ease: 'power1.in', onUpdate: draw, onComplete: () => g.destroy() });
  }

  /** Thin shimmering outline around a body: reads as a barrier without covering the character. */
  rim(x: number, y: number, color = 0xbfe4ff, rx = 60, ry = 90): void {
    const g = new Graphics();
    g.x = x;
    g.y = y;
    g.blendMode = 'add';
    this.addChild(g);
    const st = { a: 0.5, k: 0.92 };
    const draw = () => {
      g.clear();
      g.ellipse(0, -ry * 0.55, rx * st.k, ry * 0.75 * st.k).stroke({ color, width: 1.6, alpha: st.a });
    };
    draw();
    gsap.to(st, { k: 1.06, duration: 0.24, ease: 'back.out(2)', onUpdate: draw });
    gsap.to(st, { a: 0, duration: 0.35, delay: 0.2, ease: 'power1.in', onUpdate: draw, onComplete: () => g.destroy() });
  }

  /** Glowing soul wisp that drifts upward (death). */
  wisp(x: number, y: number, color = 0x9fd5ff): void {
    const s = new Sprite(this.soft());
    s.anchor.set(0.5);
    s.tint = color;
    s.blendMode = 'add';
    s.width = s.height = 54;
    s.x = x;
    s.y = y;
    s.alpha = 0;
    this.addChild(s);
    const tl = gsap.timeline({ onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
    tl.to(s, { alpha: 1, duration: 0.3 }, 0.25);
    tl.to(s, { y: y - 170, x: x + (Math.random() - 0.5) * 60, duration: 1.4, ease: 'sine.out' }, 0.25);
    tl.to(s, { alpha: 0, width: 10, height: 10, duration: 0.5, ease: 'power1.in' }, 1.15);
    this.motes(x, y, color, 6, 140);
  }

  /** Rotating formation glyph on the ground (arrays, summons, talisman casts). */
  glyph(x: number, y: number, color = 0x9fe0ff, radius = 70, duration = 0.9): void {
    const g = new Graphics();
    g.x = x;
    g.y = y;
    g.scale.y = 0.45;
    g.blendMode = 'add';
    this.addChild(g);
    g.circle(0, 0, radius).stroke({ color, width: 2.5, alpha: 0.9 });
    g.circle(0, 0, radius * 0.72).stroke({ color, width: 1.5, alpha: 0.7 });
    for (let i = 0; i < 2; i++) {
      const pts: number[] = [];
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI * 2 * k) / 3 + (i ? Math.PI / 3 : 0) - Math.PI / 2;
        pts.push(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86);
      }
      g.poly(pts).stroke({ color: 0xffffff, width: 1.2, alpha: 0.75 });
    }
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI * 2 * k) / 6;
      g.circle(Math.cos(a) * radius, Math.sin(a) * radius, 4).fill({ color: 0xffffff, alpha: 0.9 });
    }
    g.alpha = 0;
    gsap.to(g, { alpha: 1, duration: 0.15 });
    gsap.to(g, { rotation: Math.PI * 0.6, duration, ease: 'none' });
    gsap.to(g, { alpha: 0, duration: 0.3, delay: duration - 0.3, onComplete: () => g.destroy() });
  }

  /** Moving projectile; bursts on arrival. */
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
        // keep the sprite pointing along its actual path
        g.rotation = Math.atan2(c.y - lastY, c.x - lastX) || ang;
        if (++trailTimer.n % 2 === 0 && !this.crowded) {
          const tr = new Sprite(this.soft());
          tr.anchor.set(0.5);
          tr.tint = color;
          tr.blendMode = 'add';
          tr.width = tr.height = 26;
          tr.x = lastX;
          tr.y = lastY;
          this.addChild(tr);
          gsap.to(tr, { alpha: 0, width: 4, height: 4, duration: 0.3, onComplete: () => (gsap.killTweensOf(tr), tr.destroy()) });
        }
        lastX = c.x;
        lastY = c.y;
      },
      onComplete: () => {
        c.destroy();
        this.burst(x1, y1, color, { count: 8, speed: 80, size: 14, life: 0.35 });
        this.sparks(x1, y1, x1 - x0, color, 4, 180);
      },
    });
  }

  /** Rising embers around a unit (burn). */
  embers(x: number, y: number, color = 0xff8a3c, count = 6): void {
    const tex = this.soft();
    const n = this.crowded ? 2 : count;
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = color;
      s.blendMode = 'add';
      s.width = s.height = 8 + Math.random() * 10;
      s.x = x + (Math.random() - 0.5) * 50;
      s.y = y - Math.random() * 40;
      this.addChild(s);
      gsap.to(s, { y: s.y - 60 - Math.random() * 40, x: s.x + (Math.random() - 0.5) * 30, alpha: 0, duration: 0.7 + Math.random() * 0.4, ease: 'power1.out', onComplete: () => (gsap.killTweensOf(s), s.destroy()) });
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

/** Signature colour for a class's weapon trails. */
export const CLASS_FX_COLOR: Record<string, number> = {
  sword: 0xe8f1ff,
  martial: 0xffd27f,
  body: 0xffb347,
  talisman: 0xffe9a0,
  array: 0x9fe0ff,
  alchemist: 0x9fe85a,
  shadow: 0xb57cff,
};
