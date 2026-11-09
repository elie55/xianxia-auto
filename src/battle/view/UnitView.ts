import { Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import gsap from 'gsap';
import type { Unit } from '@/battle/sim/unit';
import { STATUS_COLORS } from './Vfx';

const UNIT_HEIGHT = 150;

/** Attempts to load a static sprite texture for a unit; caches misses. */
const texCache = new Map<string, Promise<Texture | null>>();
export function loadUnitTexture(sprite: string): Promise<Texture | null> {
  let p = texCache.get(sprite);
  if (!p) {
    p = Assets.load<Texture>(`./assets/art/sprites/${sprite}.png`).catch(() => null);
    texCache.set(sprite, p);
  }
  return p;
}

export class UnitView extends Container {
  readonly unit: Unit;
  private body = new Container();
  private figure: Container | Sprite | null = null;
  private shadow = new Graphics();
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
  dead = false;
  barWidth: number;

  constructor(unit: Unit) {
    super();
    this.unit = unit;
    this.baseScale = unit.visualScale * (unit.boss ? 1 : 1);
    this.barWidth = unit.boss ? 160 : unit.elite ? 100 : 74;

    this.shadow.ellipse(0, 0, 34 * this.baseScale, 12 * this.baseScale).fill({ color: 0x000000, alpha: 0.45 });
    this.addChild(this.shadow);

    this.aura = new Graphics();
    this.auraColor = unit.side === 'ally' ? 0x3fbf9f : 0xd2382c;
    this.aura.ellipse(0, 0, 38 * this.baseScale, 14 * this.baseScale).stroke({ color: this.auraColor, width: 3, alpha: 0.9 });
    this.aura.alpha = 0;
    this.addChild(this.aura);

    this.addChild(this.body);
    this.body.filters = [this.brightness];
    this.brightness.enabled = false;

    this.buildPlaceholder();
    void this.tryLoadSprite();

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

  private async tryLoadSprite(): Promise<void> {
    const tex = await loadUnitTexture(this.unit.sprite);
    if (!tex || this.destroyed) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    const h = UNIT_HEIGHT * this.baseScale;
    const sc = h / s.texture.height;
    s.scale.set(sc);
    this.body.removeChildren();
    this.figure = s;
    this.body.addChild(s);
  }

  /** Procedural "paper cutout" cultivator used until real art is loaded. */
  private buildPlaceholder(): void {
    const u = this.unit;
    const c = new Container();
    const accent = parseColor(u.accent ?? (u.side === 'ally' ? '#3fbf9f' : '#d2382c'));
    const s = this.baseScale;
    const g = new Graphics();
    if (u.side === 'ally') {
      // robe
      g.moveTo(-26 * s, 0).lineTo(26 * s, 0).lineTo(16 * s, -78 * s).lineTo(-16 * s, -78 * s).closePath().fill({ color: accent });
      g.moveTo(-26 * s, 0).lineTo(26 * s, 0).lineTo(20 * s, -24 * s).lineTo(-20 * s, -24 * s).closePath().fill({ color: 0x000000, alpha: 0.25 });
      // sash
      g.rect(-17 * s, -50 * s, 34 * s, 7 * s).fill({ color: 0xf3cf78 });
      // shoulders
      g.ellipse(0, -80 * s, 22 * s, 9 * s).fill({ color: darken(accent, 0.75) });
      // head
      g.circle(0, -100 * s, 17 * s).fill({ color: 0xf1d2b0 });
      // hair
      g.arc(0, -102 * s, 17 * s, Math.PI, Math.PI * 2).fill({ color: 0x1b1a24 });
      g.rect(-17 * s, -104 * s, 34 * s, 6 * s).fill({ color: 0x1b1a24 });
      // topknot
      g.circle(0, -121 * s, 6 * s).fill({ color: 0x1b1a24 });
      // weapon hint
      if (u.classes.includes('sword')) g.moveTo(22 * s, -70 * s).lineTo(40 * s, -130 * s).stroke({ color: 0xdfe9ea, width: 3 * s });
      if (u.classes.includes('martial')) g.moveTo(-30 * s, -20 * s).lineTo(-30 * s, -140 * s).stroke({ color: 0xb08a5a, width: 4 * s });
      if (u.classes.includes('talisman') || u.classes.includes('array')) g.circle(30 * s, -90 * s, 8 * s).fill({ color: 0xffe066, alpha: 0.9 });
    } else {
      const dark = u.boss ? 0x3b1020 : 0x2a1a24;
      // beast / demon body
      g.ellipse(0, -40 * s, 36 * s, 42 * s).fill({ color: dark });
      g.ellipse(0, -40 * s, 30 * s, 34 * s).fill({ color: darken(accent, 0.5), alpha: 0.7 });
      // head
      g.circle(0, -92 * s, 20 * s).fill({ color: dark });
      // horns
      g.moveTo(-12 * s, -106 * s).lineTo(-26 * s, -134 * s).lineTo(-4 * s, -110 * s).closePath().fill({ color: accent });
      g.moveTo(12 * s, -106 * s).lineTo(26 * s, -134 * s).lineTo(4 * s, -110 * s).closePath().fill({ color: accent });
      // eyes
      g.circle(-7 * s, -94 * s, 3.5 * s).fill({ color: 0xff6b5a });
      g.circle(7 * s, -94 * s, 3.5 * s).fill({ color: 0xff6b5a });
      // claws
      g.moveTo(-34 * s, -30 * s).lineTo(-48 * s, -8 * s).stroke({ color: accent, width: 3 * s });
      g.moveTo(34 * s, -30 * s).lineTo(48 * s, -8 * s).stroke({ color: accent, width: 3 * s });
    }
    c.addChild(g);
    const glyph = new Text({
      text: (u.hanzi ?? u.name).slice(0, 1),
      style: new TextStyle({ fontFamily: 'Ma Shan Zheng', fontSize: 26 * s, fill: '#ffffff', stroke: { color: '#000000', width: 3 } }),
    });
    glyph.anchor.set(0.5);
    glyph.x = 0;
    glyph.y = u.side === 'ally' ? -40 * s : -42 * s;
    c.addChild(glyph);
    this.figure = c;
    this.body.addChild(c);
  }

  setFacing(f: 1 | -1): void {
    this.body.scale.x = f;
  }

  /** Called every frame. */
  update(time: number, idleSpeed = 1): void {
    if (this.dead) return;
    const u = this.unit;
    // idle bob
    const bob = Math.sin(time * 2.2 * idleSpeed + this.bob) * 2;
    this.body.y = bob;
    this.aura.alpha = this.auraAlpha + Math.sin(time * 3 + this.bob) * 0.1;
    this.refreshBars();
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
    // segment ticks every 500 hp for bosses
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
      q.rect(-w / 2, 3, w * Math.min(1, u.qi / u.maxQi), qh).fill({ color: 0x5ab8ff });
    }
    // statuses
    this.statusRow.removeChildren();
    const chips: { color: number; text: string }[] = [];
    if (u.burns.length) chips.push({ color: STATUS_COLORS.burn, text: `${Math.round(u.burns.reduce((a, b) => a + b.dps, 0))}` });
    if (u.poison > 0) chips.push({ color: STATUS_COLORS.poison, text: `${Math.ceil(u.poison)}` });
    if (u.frost > 0) chips.push({ color: STATUS_COLORS.frost, text: `${Math.round(u.frost)}` });
    if (u.bleeds.length) chips.push({ color: STATUS_COLORS.bleed, text: '' });
    if (u.tauntTargetId !== null) chips.push({ color: STATUS_COLORS.taunt, text: '!' });
    if (u.isDisabled(Infinity) === false && (u.stunUntil > 0 || u.frozenUntil > 0)) {
      /* no-op */
    }
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
    return -UNIT_HEIGHT * this.baseScale * 0.85;
  }
  get chestY(): number {
    return -UNIT_HEIGHT * this.baseScale * 0.5;
  }

  /** Lunge toward facing direction. */
  attackAnim(ranged: boolean): void {
    const dir = this.body.scale.x >= 0 ? 1 : -1;
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
    const tl = gsap.timeline();
    tl.to(this.body.scale, { y: 1.12, duration: 0.15, ease: 'power2.out' }).to(this.body.scale, { y: 1, duration: 0.25, ease: 'back.out(2)' });
    this.pulseAura(0xffffff, 0.9, 0.5);
  }

  hurtAnim(crit: boolean): void {
    this.flash(crit ? 2.2 : 1.6, crit ? 0.14 : 0.09);
    const dir = this.body.scale.x >= 0 ? 1 : -1;
    gsap.fromTo(this.body, { x: -6 * dir }, { x: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
  }

  flash(brightness: number, duration: number): void {
    this.brightness.reset();
    this.brightness.brightness(brightness, false);
    this.brightness.enabled = true;
    gsap.delayedCall(duration, () => {
      this.brightness.enabled = false;
    });
  }

  pulseAura(color: number, alpha: number, duration: number): void {
    const g = this.aura;
    g.clear();
    g.ellipse(0, 0, 38 * this.baseScale, 14 * this.baseScale).stroke({ color, width: 3, alpha: 0.9 });
    gsap.fromTo(g, { alpha }, { alpha: this.auraAlpha, duration, ease: 'power2.out', overwrite: 'auto', onComplete: () => {
      g.clear();
      g.ellipse(0, 0, 38 * this.baseScale, 14 * this.baseScale).stroke({ color: this.auraColor, width: 3, alpha: 0.9 });
    } });
  }

  setAura(color: number, alpha: number): void {
    this.auraColor = color;
    this.auraAlpha = alpha;
    this.aura.clear();
    this.aura.ellipse(0, 0, 38 * this.baseScale, 14 * this.baseScale).stroke({ color, width: 3, alpha: 0.9 });
  }

  dieAnim(): void {
    this.dead = true;
    this.bars.visible = false;
    const dir = this.body.scale.x >= 0 ? 1 : -1;
    gsap.to(this.body, { rotation: -0.35 * dir, y: 10, duration: 0.5, ease: 'power2.in' });
    gsap.to(this, { alpha: 0, duration: 0.7, delay: 0.3, ease: 'power1.in' });
    gsap.to(this.shadow, { alpha: 0, duration: 0.5 });
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
    this.shadow.alpha = 1;
    gsap.fromTo(this.body.scale, { y: 0.4 }, { y: 1, duration: 0.5, ease: 'back.out(2)' });
  }

  spawnAnim(delay = 0): void {
    this.alpha = 0;
    this.body.scale.y = 0.6;
    gsap.to(this, { alpha: 1, duration: 0.3, delay });
    gsap.to(this.body.scale, { y: 1, duration: 0.45, delay, ease: 'back.out(2)' });
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
