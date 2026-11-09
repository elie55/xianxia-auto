import { AnimatedSprite, ColorMatrixFilter, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import gsap from 'gsap';
import type { Unit } from '@/battle/sim/unit';
import { STATUS_COLORS } from './Vfx';
import { loadSpritePack, type SpriteAnimDef, type SpritePack } from './SpritePack';
import { loadUnitTexture } from './textures';

/** On-screen height (design px) of a scale-1 character. */
const UNIT_HEIGHT = 150;
/** Flying units hover this far above their hex (design px, before scale). */
const HOVER_LIFT = 16;

let shadowTex: Texture | null = null;
/** Soft radial ground shadow shared by every unit. */
function softShadow(): Texture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 32, 2, 64, 32, 30);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save();
  g.scale(2, 1);
  g.beginPath();
  g.arc(32, 32, 31, 0, Math.PI * 2);
  g.fill();
  g.restore();
  shadowTex = Texture.from(c);
  return shadowTex;
}

export class UnitView extends Container {
  readonly unit: Unit;
  /** Holds the sprite; offset for hover, hit reactions and the idle bob. */
  private body = new Container();
  private pack: SpritePack | null = null;
  private anim: AnimatedSprite | null = null;
  private currentAnim = 'idle';
  private shadow = new Sprite(softShadow());
  private aura: Graphics;
  private bars = new Container();
  private hpBar = new Graphics();
  private qiBar = new Graphics();
  private statusRow = new Container();
  private nameLabel: Text | null = null;
  private brightness = new ColorMatrixFilter();
  private bob = Math.random() * Math.PI * 2;
  private baseScale: number;
  private auraColor = 0x3fbf9f;
  private auraAlpha = 0.35;
  private hasRealArt = false;
  /** Visible width of the character in design px (from the pack), for shadows and hit boxes. */
  private visualW: number;
  dead = false;
  barWidth: number;

  constructor(unit: Unit) {
    super();
    this.unit = unit;
    this.baseScale = unit.visualScale;
    this.visualW = 60 * this.baseScale;
    this.barWidth = unit.boss ? 160 : unit.elite ? 100 : 74;

    this.shadow.anchor.set(0.5, 0.5);
    this.shadow.y = 2;
    this.addChild(this.shadow);
    this.fitShadow();

    this.aura = new Graphics();
    this.auraColor = unit.side === 'ally' ? 0x3fbf9f : 0xd2382c;
    this.drawAura(this.auraColor);
    this.aura.alpha = 0;
    this.addChild(this.aura);

    this.addChild(this.body);
    this.body.filters = [this.brightness];
    this.brightness.enabled = false;

    this.buildPlaceholder();
    void this.tryLoadArt();

    this.bars.y = -UNIT_HEIGHT * this.baseScale - 26;
    this.addChild(this.bars);
    this.bars.addChild(this.hpBar);
    this.bars.addChild(this.qiBar);
    this.bars.addChild(this.statusRow);
    this.statusRow.y = -22;

    if (unit.boss || unit.elite) {
      this.nameLabel = new Text({
        text: unit.name.toUpperCase(),
        style: new TextStyle({ fontFamily: 'Cinzel', fontWeight: '700', fontSize: unit.boss ? 18 : 14, fill: unit.boss ? '#ff6b5a' : '#f3cf78', letterSpacing: 2, stroke: { color: '#000000', width: 4 } }),
      });
      this.nameLabel.anchor.set(0.5, 1);
      this.nameLabel.y = -30;
      this.bars.addChild(this.nameLabel);
    }
    this.refreshBars();
  }

  private fitShadow(): void {
    const w = Math.max(44, this.visualW * 1.05);
    this.shadow.width = w;
    this.shadow.height = w * 0.34;
    this.shadow.alpha = this.unit.flying ? 0.55 : 0.9;
  }

  private drawAura(color: number): void {
    const rx = Math.max(38 * this.baseScale, this.visualW * 0.6);
    this.aura.clear();
    this.aura.ellipse(0, 0, rx, rx * 0.37).stroke({ color, width: 3, alpha: 0.9 });
  }

  /** Prefer an animated sprite pack, then a static PNG, else keep the procedural placeholder. */
  private async tryLoadArt(): Promise<void> {
    const pack = await loadSpritePack(this.unit.sprite);
    if (this.destroyed) return;
    if (pack && pack.anims.idle?.length) {
      this.pack = pack;
      const idle = pack.def.animations.idle;
      if (idle.charW) this.visualW = (idle.charW / idle.charH) * UNIT_HEIGHT * this.baseScale;
      const a = new AnimatedSprite(pack.anims.idle);
      a.loop = true;
      this.body.removeChildren();
      this.anim = a;
      this.body.addChild(a);
      this.applyAnimDef('idle');
      a.gotoAndPlay(Math.floor(Math.random() * pack.anims.idle.length));
      this.hasRealArt = true;
      this.fitShadow();
      this.drawAura(this.auraColor);
      return;
    }
    const tex = await loadUnitTexture(this.unit.sprite);
    if (!tex || this.destroyed) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    const h = UNIT_HEIGHT * this.baseScale;
    s.scale.set(h / s.texture.height);
    this.visualW = s.texture.width * s.scale.x;
    this.body.removeChildren();
    this.body.addChild(s);
    this.hasRealArt = true;
    this.fitShadow();
  }

  /** Sets anchor/scale/speed for the given animation so the character keeps its on-screen size. */
  private applyAnimDef(name: string, speedOverride?: number): SpriteAnimDef | null {
    const a = this.anim;
    const def = this.pack?.def.animations[name];
    if (!a || !def) return null;
    a.anchor.set(def.pivotX, def.pivotY);
    const targetH = UNIT_HEIGHT * this.baseScale;
    a.scale.set(targetH / def.charH);
    a.animationSpeed = (speedOverride ?? def.fps) / 60;
    return def;
  }

  /** Plays a pack animation if available; returns true when handled. */
  private playAnim(name: string, opts: { fps?: number; onDone?: () => void } = {}): boolean {
    const a = this.anim;
    const frames = this.pack?.anims[name];
    if (!a || !frames || frames.length === 0) return false;
    const def = this.applyAnimDef(name, opts.fps);
    if (!def) return false;
    this.currentAnim = name;
    a.textures = frames;
    a.loop = !!def.loop;
    a.onComplete = undefined;
    a.gotoAndPlay(0);
    if (!def.loop) {
      a.onComplete = () => {
        a.onComplete = undefined;
        opts.onDone?.();
        if (!this.dead) this.playAnim('idle');
      };
    }
    return true;
  }

  /** Procedural "paper cutout" cultivator used until real art is loaded. */
  private buildPlaceholder(): void {
    const u = this.unit;
    const c = new Container();
    const accent = parseColor(u.accent ?? (u.side === 'ally' ? '#3fbf9f' : '#d2382c'));
    const s = this.baseScale;
    const g = new Graphics();
    if (u.side === 'ally') {
      g.moveTo(-26 * s, 0).lineTo(26 * s, 0).lineTo(16 * s, -78 * s).lineTo(-16 * s, -78 * s).closePath().fill({ color: accent });
      g.moveTo(-26 * s, 0).lineTo(26 * s, 0).lineTo(20 * s, -24 * s).lineTo(-20 * s, -24 * s).closePath().fill({ color: 0x000000, alpha: 0.25 });
      g.rect(-17 * s, -50 * s, 34 * s, 7 * s).fill({ color: 0xf3cf78 });
      g.ellipse(0, -80 * s, 22 * s, 9 * s).fill({ color: darken(accent, 0.75) });
      g.circle(0, -100 * s, 17 * s).fill({ color: 0xf1d2b0 });
      g.arc(0, -102 * s, 17 * s, Math.PI, Math.PI * 2).fill({ color: 0x1b1a24 });
      g.rect(-17 * s, -104 * s, 34 * s, 6 * s).fill({ color: 0x1b1a24 });
      g.circle(0, -121 * s, 6 * s).fill({ color: 0x1b1a24 });
      if (u.classes.includes('sword')) g.moveTo(22 * s, -70 * s).lineTo(40 * s, -130 * s).stroke({ color: 0xdfe9ea, width: 3 * s });
      if (u.classes.includes('martial')) g.moveTo(-30 * s, -20 * s).lineTo(-30 * s, -140 * s).stroke({ color: 0xb08a5a, width: 4 * s });
      if (u.classes.includes('talisman') || u.classes.includes('array')) g.circle(30 * s, -90 * s, 8 * s).fill({ color: 0xffe066, alpha: 0.9 });
    } else {
      const dark = u.boss ? 0x3b1020 : 0x2a1a24;
      g.ellipse(0, -40 * s, 36 * s, 42 * s).fill({ color: dark });
      g.ellipse(0, -40 * s, 30 * s, 34 * s).fill({ color: darken(accent, 0.5), alpha: 0.7 });
      g.circle(0, -92 * s, 20 * s).fill({ color: dark });
      g.moveTo(-12 * s, -106 * s).lineTo(-26 * s, -134 * s).lineTo(-4 * s, -110 * s).closePath().fill({ color: accent });
      g.moveTo(12 * s, -106 * s).lineTo(26 * s, -134 * s).lineTo(4 * s, -110 * s).closePath().fill({ color: accent });
      g.circle(-7 * s, -94 * s, 3.5 * s).fill({ color: 0xff6b5a });
      g.circle(7 * s, -94 * s, 3.5 * s).fill({ color: 0xff6b5a });
      g.moveTo(-34 * s, -30 * s).lineTo(-48 * s, -8 * s).stroke({ color: accent, width: 3 * s });
      g.moveTo(34 * s, -30 * s).lineTo(48 * s, -8 * s).stroke({ color: accent, width: 3 * s });
    }
    c.addChild(g);
    const glyph = new Text({
      text: (u.hanzi ?? u.name).slice(0, 1),
      style: new TextStyle({ fontFamily: 'Ma Shan Zheng', fontSize: 26 * s, fill: '#ffffff', stroke: { color: '#000000', width: 3 } }),
    });
    glyph.anchor.set(0.5);
    glyph.y = u.side === 'ally' ? -40 * s : -42 * s;
    c.addChild(glyph);
    this.body.addChild(c);
  }

  /** True when the sprite pack has a walk cycle (then movement uses it instead of the hop). */
  get hasWalk(): boolean {
    return !!this.pack?.anims.walk?.length;
  }

  /** Switches between the idle and walk cycles while the simulation moves the unit. */
  setMoving(moving: boolean): void {
    if (this.dead) return;
    if (moving && this.currentAnim === 'idle' && this.hasWalk) this.playAnim('walk', { fps: 22 });
    else if (!moving && this.currentAnim === 'walk') this.playAnim('idle');
  }

  setFacing(f: 1 | -1): void {
    const sx = Math.abs(this.body.scale.x) || 1;
    this.body.scale.x = f * sx;
  }

  update(time: number, idleSpeed = 1): void {
    if (this.dead) return;
    if (this.unit.flying) {
      // hover: the body floats above the hex while the shadow breathes underneath
      const t = Math.sin(time * 1.6 * idleSpeed + this.bob);
      this.body.y = -HOVER_LIFT * this.baseScale + t * 5;
      const k = 1 - (t + 1) * 0.08;
      const s = this.shadowBaseScale;
      this.shadow.scale.set(s * k, s * 0.68 * k);
      this.shadow.alpha = 0.5 - (t + 1) * 0.08;
    } else if (!this.anim) {
      this.body.y = Math.sin(time * 2.2 * idleSpeed + this.bob) * (this.hasRealArt ? 1.5 : 2);
    }
    this.aura.alpha = this.auraAlpha + Math.sin(time * 3 + this.bob) * 0.1;
    this.refreshBars();
  }

  private get shadowBaseScale(): number {
    return Math.max(44, this.visualW * 1.05) / this.shadow.texture.width;
  }

  refreshBars(): void {
    const u = this.unit;
    const w = this.barWidth;
    const h = u.boss ? 12 : 8;
    const hp = Math.max(0, u.hp / u.maxHp);
    const shield = u.maxHp > 0 ? Math.min(1, u.shield / u.maxHp) : 0;
    const g = this.hpBar;
    g.clear();
    g.roundRect(-w / 2 - 1, -h - 1, w + 2, h + 2, 2).fill({ color: 0x000000, alpha: 0.75 });
    g.rect(-w / 2, -h, w * hp, h).fill({ color: u.side === 'ally' ? 0x4fd36a : 0xd7382c });
    if (hp > 0) g.rect(-w / 2, -h, w * hp, h * 0.4).fill({ color: 0xffffff, alpha: 0.18 });
    if (shield > 0) g.rect(-w / 2, -h, w * Math.min(1, shield), h).fill({ color: 0xbfe4ff, alpha: 0.85 });
    if (u.boss) {
      const segs = Math.floor(u.maxHp / 1000);
      for (let i = 1; i < segs; i++) {
        const x = -w / 2 + (w * i) / segs;
        g.rect(x, -h, 1, h).fill({ color: 0x000000, alpha: 0.5 });
      }
    }
    const q = this.qiBar;
    q.clear();
    if (u.maxQi > 0) {
      const qh = 4;
      q.roundRect(-w / 2 - 1, 2, w + 2, qh + 2, 1).fill({ color: 0x000000, alpha: 0.7 });
      const qf = Math.min(1, u.qi / u.maxQi);
      q.rect(-w / 2, 3, w * qf, qh).fill({ color: qf >= 1 ? 0x9fe0ff : 0x5ab8ff });
    }
    this.statusRow.removeChildren();
    const chips: { color: number; text: string }[] = [];
    if (u.burns.length) chips.push({ color: STATUS_COLORS.burn, text: `${Math.round(u.burns.reduce((a, b) => a + b.dps, 0))}` });
    if (u.poison > 0) chips.push({ color: STATUS_COLORS.poison, text: `${Math.ceil(u.poison)}` });
    if (u.frost > 0) chips.push({ color: STATUS_COLORS.frost, text: `${Math.round(u.frost)}` });
    if (u.bleeds.length) chips.push({ color: STATUS_COLORS.bleed, text: '' });
    if (u.tauntTargetId !== null) chips.push({ color: STATUS_COLORS.taunt, text: '!' });
    let x = -((chips.length - 1) * 24) / 2;
    for (const ch of chips) {
      const c = new Graphics();
      c.roundRect(-11, -9, 22, 18, 4).fill({ color: 0x000000, alpha: 0.7 });
      c.roundRect(-11, -9, 22, 18, 4).stroke({ color: ch.color, width: 1.5 });
      c.x = x;
      this.statusRow.addChild(c);
      if (ch.text) {
        const t = new Text({ text: ch.text, style: new TextStyle({ fontFamily: 'Noto Sans', fontWeight: '800', fontSize: 11, fill: ch.color }) });
        t.anchor.set(0.5);
        t.x = x;
        this.statusRow.addChild(t);
      }
      x += 24;
    }
  }

  get headY(): number {
    return -UNIT_HEIGHT * this.baseScale * 0.85 + (this.unit.flying ? -HOVER_LIFT * this.baseScale : 0);
  }
  get chestY(): number {
    return -UNIT_HEIGHT * this.baseScale * 0.5 + (this.unit.flying ? -HOVER_LIFT * this.baseScale : 0);
  }
  /** Half width of the visible body in design px. */
  get halfWidth(): number {
    return Math.max(30, this.visualW / 2);
  }
  /** Full height of the visible body in design px. */
  get bodyHeight(): number {
    return UNIT_HEIGHT * this.baseScale;
  }

  /** Attack: with a sheet, time the animation so its hit frame lands when the sim applies damage. */
  attackAnim(ranged: boolean, hitDelay = 0.22): void {
    const dir = this.body.scale.x >= 0 ? 1 : -1;
    const def = this.pack?.def.animations.attack;
    if (def && this.anim) {
      const hitFrame = def.hitFrame ?? Math.round(def.frames * 0.45);
      const fps = Math.min(60, Math.max(def.fps, hitFrame / Math.max(0.12, hitDelay)));
      this.playAnim('attack', { fps });
      gsap.fromTo(this.body, { x: 0 }, { x: (ranged ? 4 : 10) * dir, duration: hitDelay, ease: 'power2.in', yoyo: true, repeat: 1, overwrite: 'auto' });
      return;
    }
    const tl = gsap.timeline();
    if (ranged) {
      tl.to(this.body, { x: -10 * dir, duration: 0.08, ease: 'power2.out' }).to(this.body, { x: 0, duration: 0.25, ease: 'power2.out' });
      tl.to(this.body.scale, { y: 1.06, duration: 0.08, yoyo: true, repeat: 1 }, 0);
    } else {
      tl.to(this.body, { x: 26 * dir, duration: 0.09, ease: 'power3.out' }).to(this.body, { x: 0, duration: 0.3, ease: 'power2.out' });
      tl.to(this.body.scale, { y: 0.94, duration: 0.07, yoyo: true, repeat: 1 }, 0);
    }
  }

  castAnim(): void {
    if (!this.playAnim('cast') && !this.playAnim('attack', { fps: 30 })) {
      const tl = gsap.timeline();
      tl.to(this.body.scale, { y: 1.12, duration: 0.15, ease: 'power2.out' }).to(this.body.scale, { y: 1, duration: 0.25, ease: 'back.out(2)' });
    }
    this.pulseAura(0xffffff, 0.9, 0.5);
  }

  /** Hit reaction: brightness flash, knock-back, and the hurt clip when the unit is otherwise idle. */
  hurtAnim(crit: boolean, fromX?: number): void {
    this.flash(crit ? 2.2 : 1.6, crit ? 0.14 : 0.09);
    // knock away from the attacker when we know where the hit came from
    const away = fromX !== undefined ? (fromX < this.x ? 1 : -1) : this.body.scale.x >= 0 ? -1 : 1;
    if (this.currentAnim === 'idle' || this.currentAnim === 'walk') this.playAnim('hurt', { fps: 36 });
    gsap.fromTo(this.body, { x: (crit ? 12 : 6) * away }, { x: 0, duration: crit ? 0.26 : 0.18, ease: 'power2.out', overwrite: 'auto' });
    if (crit) gsap.fromTo(this.body.scale, { y: 0.9 }, { y: 1, duration: 0.22, ease: 'back.out(3)', overwrite: 'auto' });
  }

  flash(brightness: number, duration: number): void {
    this.brightness.reset();
    this.brightness.brightness(brightness, false);
    this.brightness.enabled = true;
    gsap.delayedCall(duration, () => {
      this.brightness.enabled = false;
    });
  }

  /** Tints the body for a moment (frost = blue, poison = green...). */
  tintFlash(color: number, duration = 0.35): void {
    const targets = this.body.children as (Sprite | Container)[];
    for (const c of targets) if ('tint' in c) (c as Sprite).tint = color;
    gsap.delayedCall(duration, () => {
      for (const c of targets) if ('tint' in c && !c.destroyed) (c as Sprite).tint = 0xffffff;
    });
  }

  pulseAura(color: number, alpha: number, duration: number): void {
    const g = this.aura;
    this.drawAura(color);
    gsap.fromTo(
      g,
      { alpha },
      {
        alpha: this.auraAlpha,
        duration,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => this.drawAura(this.auraColor),
      },
    );
  }

  setAura(color: number, alpha: number): void {
    this.auraColor = color;
    this.auraAlpha = alpha;
    this.drawAura(color);
  }

  dieAnim(): void {
    this.dead = true;
    this.bars.visible = false;
    const dir = this.body.scale.x >= 0 ? 1 : -1;
    if (!this.playAnim('death')) gsap.to(this.body, { rotation: -0.35 * dir, y: this.body.y + 10, duration: 0.5, ease: 'power2.in' });
    gsap.to(this, { alpha: 0, duration: 0.7, delay: 0.5, ease: 'power1.in' });
    gsap.to(this.shadow, { alpha: 0, duration: 0.5 });
    gsap.to(this.aura, { alpha: 0, duration: 0.3 });
    this.brightness.reset();
    this.brightness.desaturate();
    this.brightness.enabled = true;
  }

  reviveAnim(): void {
    this.dead = false;
    this.bars.visible = true;
    this.brightness.enabled = false;
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.body);
    this.body.rotation = 0;
    this.body.y = 0;
    this.alpha = 1;
    this.shadow.alpha = this.unit.flying ? 0.55 : 0.9;
    this.playAnim('idle');
    gsap.fromTo(this.body.scale, { y: 0.4 }, { y: 1, duration: 0.5, ease: 'back.out(2)' });
  }

  spawnAnim(delay = 0): void {
    this.alpha = 0;
    gsap.to(this, { alpha: 1, duration: 0.3, delay, overwrite: 'auto' });
    gsap.fromTo(this.body.scale, { y: 0.6 }, { y: 1, duration: 0.45, delay, ease: 'back.out(2)', overwrite: 'auto' });
  }
}

export function parseColor(hex: string): number {
  const h = hex.replace('#', '');
  return parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
}

export function darken(c: number, f: number): number {
  const r = Math.round(((c >> 16) & 255) * f);
  const g = Math.round(((c >> 8) & 255) * f);
  const b = Math.round((c & 255) * f);
  return (r << 16) | (g << 8) | b;
}

export { loadUnitTexture };
