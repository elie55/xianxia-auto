import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture, Assets } from 'pixi.js';
import gsap from 'gsap';
import { signal } from '@preact/signals';
import type { Hex } from '@/core/types';
import { Battle, TICK, type BattleResult } from '@/battle/sim/battle';
import { Unit, type UnitInit } from '@/battle/sim/unit';
import type { BattleEvent } from '@/battle/sim/events';
import {
  ALLY_MAX_COL,
  BOARD_COLS,
  BOARD_ROWS,
  ENEMY_MIN_COL,
  HEX_SIZE,
  HEX_SQUASH,
  hexLayout,
  HEX_W,
  allHexes,
  axialToOffset,
  hexEquals,
  hexToPixel,
  pixelToHex,
  inBounds,
} from '@/battle/sim/hex';
import { DESIGN_H, DESIGN_W, viewport, type Viewport } from '@/app/scale';
import { UnitView, parseColor } from './UnitView';
import { VfxLayer, PROJECTILE_STYLES, STATUS_COLORS, CLASS_FX_COLOR } from './Vfx';
import { FloatingTextLayer, type NumberKind } from './FloatingText';
import { audio } from '@/audio/AudioManager';
import { meta } from '@/app/store';

export type ViewMode = 'idle' | 'placement' | 'battle';

const STAT_SHORT: Record<string, string> = {
  hp: 'HP',
  qi: 'QI',
  attack: 'ATK',
  attackSpeed: 'SPD',
  spirit: 'SPR',
  crit: 'CRIT',
  defense: 'DEF',
  range: 'RNG',
  qiRegen: 'REGEN',
  omnivamp: 'VAMP',
  moveSpeed: 'MOVE',
};

/** Flipbook sheets (4×4 frames on black, played additively) under public/assets/art/fx. */
const FLIPBOOK_SHEETS = ['fx_qi_cast', 'fx_fire_burst', 'fx_frost_burst', 'fx_lightning_strike', 'fx_heal_bloom', 'fx_shadow_burst', 'fx_slash_arc', 'fx_poison_cloud', 'fx_water_splash', 'fx_death_burst', 'fx_impact_hit', 'fx_blood_burst', 'fx_buff_rise'];

/** Which flipbook plays for an ability VFX key, on top of the procedural effect. */
const FLIPBOOK_FOR: Record<string, { sheet: string; scale?: number; tint?: number; ground?: boolean; fps?: number; directional?: boolean }> = {
  lotus_fire: { sheet: 'fx_fire_burst', scale: 1.3 },
  lotus_bloom: { sheet: 'fx_fire_burst', scale: 1.2 },
  phoenix_strike: { sheet: 'fx_fire_burst', scale: 1.5 },
  fire_slash: { sheet: 'fx_slash_arc', tint: 0xff9a4a, scale: 1.1, directional: true },
  frost_burst: { sheet: 'fx_frost_burst', scale: 1.2 },
  frost_array: { sheet: 'fx_frost_burst', scale: 1.6, ground: true },
  water_burst: { sheet: 'fx_water_splash', scale: 1.2 },
  tidal_breath: { sheet: 'fx_water_splash', scale: 1.5 },
  lightning: { sheet: 'fx_lightning_strike', scale: 1.2, ground: true, fps: 30 },
  lightning_arc: { sheet: 'fx_lightning_strike', scale: 1.1, ground: true, fps: 30 },
  thunder_call: { sheet: 'fx_lightning_strike', scale: 1.5, ground: true, fps: 30 },
  sun_arrow: { sheet: 'fx_lightning_strike', tint: 0xffd27f, scale: 1.1, ground: true, fps: 30 },
  heal_bloom: { sheet: 'fx_heal_bloom', scale: 1.2, ground: true },
  sutra: { sheet: 'fx_heal_bloom', tint: 0xf3cf78, scale: 1.3, ground: true },
  moon_pulse: { sheet: 'fx_heal_bloom', tint: 0xbfe4ff, scale: 1.3, ground: true },
  shadow_slash: { sheet: 'fx_slash_arc', tint: 0xb57cff, scale: 1.1, directional: true },
  shadow_blink: { sheet: 'fx_shadow_burst', scale: 1.1 },
  blood_nova: { sheet: 'fx_blood_burst', scale: 1.8, ground: true },
  blood_burst: { sheet: 'fx_blood_burst', scale: 1.1 },
  poison_puff: { sheet: 'fx_poison_cloud', tint: 0x9fe85a, scale: 1.1 },
  cinnabar_smoke: { sheet: 'fx_poison_cloud', tint: 0xff8a6a, scale: 1.2 },
  sword_slash: { sheet: 'fx_slash_arc', scale: 1.1, directional: true },
  claw: { sheet: 'fx_slash_arc', tint: 0xffd27f, scale: 0.9, directional: true },
  tail_sweep: { sheet: 'fx_slash_arc', tint: 0x9fe0ff, scale: 1.3, directional: true },
  spear_sweep: { sheet: 'fx_slash_arc', tint: 0x5ad6a5, scale: 1.2, directional: true },
  flying_sword: { sheet: 'fx_slash_arc', tint: 0xe8f1ff, scale: 1.2, directional: true },
  sword_shard: { sheet: 'fx_slash_arc', tint: 0xe8f1ff, scale: 0.8, directional: true },
  tiger_roar: { sheet: 'fx_impact_hit', tint: 0xffd27f, scale: 1.7, ground: true },
  impact: { sheet: 'fx_impact_hit', scale: 0.9 },
  fist_flurry: { sheet: 'fx_impact_hit', tint: 0xffd27f, scale: 0.7 },
};

export class BattleView {
  readonly app = new Application();
  private ready = false;
  /** Becomes true once the Pixi application is initialised and mounted. */
  readonly isReady = signal(false);

  get canvasEl(): HTMLCanvasElement | null {
    return this.ready ? (this.app.canvas as HTMLCanvasElement) : null;
  }
  private bgLayer = new Container();
  private bgSprite: Sprite | null = null;
  /** The arena painting drawn in the design frame, so its floor always meets the hexes whatever the window shape. */
  private bgPainting: Sprite | null = null;
  private bgGradient = new Graphics();
  private world = new Container();
  private arenaLayer = new Container();
  private ground = new Graphics();
  private hexLayer = new Graphics();
  private highlightLayer = new Graphics();
  private unitLayer = new Container();
  private fx = new VfxLayer();
  private texts = new FloatingTextLayer();
  private overlay = new Graphics();
  private flashOverlay = new Graphics();
  private tribulationLabel: Text | null = null;

  mode: ViewMode = 'idle';
  battle: Battle | null = null;
  speed = 1;
  paused = false;
  private acc = 0;
  private views = new Map<number, UnitView>();
  private shakeAmt = 0;
  /** Milliseconds of simulation freeze left (impact "hit-stop"). Rendering keeps running. */
  private hitStopMs = 0;
  private realm = 1;
  private elapsed = 0;
  onEnd: ((r: BattleResult) => void) | null = null;
  onTime: ((t: number) => void) | null = null;
  private ended = false;

  readonly boardOrigin = { x: 0, y: 0 };

  async mount(parent: HTMLElement): Promise<void> {
    if (this.ready) return;
    await this.app.init({ resizeTo: window, backgroundAlpha: 1, background: 0x070e0f, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
    parent.appendChild(this.app.canvas);
    this.app.stage.addChild(this.bgLayer);
    this.bgLayer.addChild(this.bgGradient);
    this.app.stage.addChild(this.world);
    this.world.addChild(this.arenaLayer);
    this.arenaLayer.addChild(this.ground);
    this.arenaLayer.addChild(this.hexLayer);
    this.arenaLayer.addChild(this.highlightLayer);
    this.unitLayer.sortableChildren = true;
    this.world.addChild(this.unitLayer);
    this.world.addChild(this.fx);
    this.world.addChild(this.texts);
    this.world.addChild(this.overlay);
    this.world.addChild(this.flashOverlay);
    this.overlay.alpha = 0;
    this.flashOverlay.alpha = 0;
    this.flashOverlay.blendMode = 'add';

    this.layoutBoard();

    this.ready = true;
    this.isReady.value = true;
    this.applyViewport(viewport.value);
    viewport.subscribe((v) => this.applyViewport(v));
    this.drawGround();
    this.drawHexes();
    this.app.ticker.add((t) => this.frame(t.deltaMS));
    await document.fonts.load('800 32px "Noto Sans"').catch(() => undefined);
    await document.fonts.load('700 20px Cinzel').catch(() => undefined);
    await document.fonts.load('400 26px "Ma Shan Zheng"').catch(() => undefined);
    void this.fx.loadFlipbooks(FLIPBOOK_SHEETS);
  }

  private applyViewport(v: Viewport): void {
    this.world.scale.set(v.scale);
    this.world.position.set(v.offsetX, v.offsetY);
    this.drawBackground(v);
    this.drawVignette(v);
  }

  setVisible(v: boolean): void {
    const c = this.canvasEl;
    if (c) c.style.visibility = v ? 'visible' : 'hidden';
  }

  /**
   * Board placement per arena painting, measured on the 1920×1080 paintings: the vertical centre of the five rows and
   * the row squash that keeps the back row on the painted floor (the abyss platform and the ladder terrace only
   * occupy the lower third of their paintings).
   */
  private static readonly ARENA_LAYOUT: Record<number, { centerY: number; squash: number }> = {
    1: { centerY: 740, squash: 0.62 },
    2: { centerY: 790, squash: 0.52 },
    3: { centerY: 775, squash: 0.56 },
  };

  /** Centres the board horizontally and drops it onto the current arena's floor; standing units follow. */
  private layoutBoard(): void {
    const cfg = BattleView.ARENA_LAYOUT[this.realm] ?? { centerY: 740, squash: HEX_SQUASH };
    hexLayout.squash = cfg.squash;
    const w = HEX_W * (BOARD_COLS - 1) + HEX_W / 2;
    const h = HEX_SIZE * 1.5 * cfg.squash * (BOARD_ROWS - 1);
    this.boardOrigin.x = DESIGN_W / 2 - w / 2;
    this.boardOrigin.y = cfg.centerY - h / 2;
    for (const layer of [this.arenaLayer, this.unitLayer, this.fx, this.texts]) layer.position.set(this.boardOrigin.x, this.boardOrigin.y);
    for (const v of this.views.values()) {
      if (!v.unit.pos) continue;
      const p = hexToPixel(v.unit.pos);
      v.position.set(p.x, p.y);
    }
  }

  /** Skill banner: the ability name sweeps in above the caster in the class colour, then drifts up and fades. */
  private castBanner(x: number, y: number, name: string, color: number): void {
    const label = new Text({
      text: name.toUpperCase(),
      style: new TextStyle({
        fontFamily: 'Cinzel, serif',
        fontWeight: '800',
        fontSize: 30,
        letterSpacing: 5,
        fill: color,
        stroke: { color: 0x05090a, width: 7, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.9, blur: 8, distance: 3, angle: Math.PI / 2 },
      }),
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    label.alpha = 0;
    label.scale.set(1.7);
    this.texts.addChild(label);
    const tl = gsap.timeline({ onComplete: () => label.destroy() });
    tl.to(label, { alpha: 1, duration: 0.14, ease: 'power2.out' }, 0)
      .to(label.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2.5)' }, 0)
      .to(label, { y: y - 34, duration: 1.1, ease: 'power1.out' }, 0.25)
      .to(label, { alpha: 0, duration: 0.4, ease: 'power1.in' }, 0.95);
  }

  // ───────────────────────── arena ─────────────────────────

  async setRealm(realm: number): Promise<void> {
    this.realm = realm;
    this.layoutBoard();
    this.drawBackground(viewport.value);
    this.drawGround();
    const key = realm === 1 ? 'realm1_bamboo' : realm === 2 ? 'realm2_abyss' : 'realm3_ladder';
    const tex = await Assets.load<Texture>(`./assets/art/bg/${key}.jpg`).catch(() => null);
    if (this.bgSprite) {
      this.bgSprite.destroy();
      this.bgSprite = null;
    }
    if (this.bgPainting) {
      this.bgPainting.destroy();
      this.bgPainting = null;
    }
    if (tex) {
      // a dimmed cover copy fills whatever a wide or tall window leaves outside the 16:9 frame …
      const backdrop = new Sprite(tex);
      backdrop.tint = 0x56646b;
      this.bgSprite = backdrop;
      this.bgLayer.addChild(backdrop);
      this.fitBackground(viewport.value);
      // … while the crisp painting shares the board's frame, so the painted floor always meets the hexes
      const painting = new Sprite(tex);
      painting.width = DESIGN_W;
      painting.height = DESIGN_H;
      this.bgPainting = painting;
      this.world.addChildAt(painting, 0);
    }
    this.drawVignette(viewport.value);
    this.drawGround();
    this.drawHexes(this.mode === 'placement');
  }

  private vignette = new Graphics();

  /** Dark gradient bands at the top and bottom so the HUD stays readable over paintings. */
  private drawVignette(v: Viewport): void {
    const g = this.vignette;
    if (!g.parent) this.bgLayer.addChild(g);
    g.clear();
    const steps = 12;
    const topH = v.height * 0.2;
    const botH = v.height * 0.3;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      g.rect(0, (topH * i) / steps, v.width, topH / steps + 1).fill({ color: 0x050b0c, alpha: 0.6 * (1 - t) });
      g.rect(0, v.height - botH + (botH * i) / steps, v.width, botH / steps + 1).fill({ color: 0x050b0c, alpha: 0.7 * t });
    }
    g.rect(0, 0, v.width, v.height).fill({ color: 0x0a1a1c, alpha: 0.12 });
  }

  private fitBackground(v: Viewport): void {
    const s = this.bgSprite;
    if (!s) return;
    const sc = Math.max(v.width / s.texture.width, v.height / s.texture.height);
    s.scale.set(sc);
    s.position.set((v.width - s.texture.width * sc) / 2, (v.height - s.texture.height * sc) / 2);
  }

  private drawBackground(v: Viewport): void {
    const g = this.bgGradient;
    g.clear();
    const colors = this.realm === 1 ? [0x0f2a2a, 0x163d35, 0x0a1a19] : this.realm === 2 ? [0x2a0d14, 0x4a1420, 0x160609] : [0x101a33, 0x27345e, 0x0a0f1f];
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = lerpColor(lerpColor(colors[0], colors[1], Math.min(1, t * 1.6)), colors[2], Math.max(0, t - 0.55) * 2.2);
      g.rect(0, (v.height * i) / steps, v.width, v.height / steps + 2).fill({ color: c });
    }
    this.fitBackground(v);
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const w = HEX_W * (BOARD_COLS - 1) + HEX_W / 2;
    const h = HEX_SIZE * 1.5 * hexLayout.squash * (BOARD_ROWS - 1);
    const cx = w / 2;
    const cy = h / 2;
    const col = this.realm === 1 ? 0x1d4a3d : this.realm === 2 ? 0x4a1d24 : 0x1f2c55;
    // A painted arena is its own floor: draw nothing over it. The ellipses are only a fallback stage
    // for when the background painting is missing.
    if (this.bgSprite) return;
    g.ellipse(cx, cy + 10, w * 0.78, h * 1.35).fill({ color: 0x000000, alpha: 0.35 });
    g.ellipse(cx, cy, w * 0.72, h * 1.2).fill({ color: col, alpha: 0.75 });
    g.ellipse(cx, cy, w * 0.72, h * 1.2).stroke({ color: 0xd4a84b, width: 2, alpha: 0.35 });
    g.ellipse(cx, cy, w * 0.66, h * 1.08).stroke({ color: 0xd4a84b, width: 1, alpha: 0.18 });
  }

  private drawHexes(highlightZone = this.mode === 'placement'): void {
    const g = this.hexLayer;
    g.clear();
    for (const h of allHexes()) {
      const { col } = axialToOffset(h);
      const p = hexToPixel(h);
      const ally = col <= ALLY_MAX_COL;
      const enemy = col >= ENEMY_MIN_COL;
      const fill = ally ? 0x3fbf9f : enemy ? 0xd2382c : 0xd4a84b;
      const painted = !!this.bgSprite;
      const alpha = highlightZone ? (ally ? (painted ? 0.1 : 0.16) : enemy ? 0.05 : 0.02) : painted ? 0.02 : 0.05;
      this.hexPath(g, p.x, p.y, HEX_SIZE - 3).fill({ color: fill, alpha });
      this.hexPath(g, p.x, p.y, HEX_SIZE - 3).stroke({ color: fill, width: 1.2, alpha: highlightZone ? (ally ? 0.5 : 0.22) : 0.1 });
    }
  }

  private hexPath(g: Graphics, x: number, y: number, r: number): Graphics {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (Math.PI / 3) * i;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * hexLayout.squash);
    }
    return g.poly(pts);
  }

  setHighlight(hex: Hex | null, valid = true): void {
    const g = this.highlightLayer;
    g.clear();
    if (!hex) return;
    const p = hexToPixel(hex);
    this.hexPath(g, p.x, p.y, HEX_SIZE - 2).fill({ color: valid ? 0x6fe3c4 : 0xff6b5a, alpha: 0.35 });
    this.hexPath(g, p.x, p.y, HEX_SIZE - 2).stroke({ color: valid ? 0x6fe3c4 : 0xff6b5a, width: 3, alpha: 0.95 });
  }

  /** Design-space point → hex (or null when outside the board). */
  hexAtDesign(x: number, y: number): Hex | null {
    const h = pixelToHex(x - this.boardOrigin.x, y - this.boardOrigin.y);
    return inBounds(h) ? h : null;
  }

  /** Design-space position of a hex center. */
  hexCenterDesign(h: Hex): { x: number; y: number } {
    const p = hexToPixel(h);
    return { x: p.x + this.boardOrigin.x, y: p.y + this.boardOrigin.y };
  }

  /** Design-space bounds of the ally placement zone (for tutorial highlights). */
  allyZoneDesign(): { x: number; y: number; w: number; h: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const h of allHexes()) {
      const { col } = axialToOffset(h);
      if (col > ALLY_MAX_COL) continue;
      const p = this.hexCenterDesign(h);
      minX = Math.min(minX, p.x - HEX_W / 2);
      maxX = Math.max(maxX, p.x + HEX_W / 2);
      minY = Math.min(minY, p.y - HEX_SIZE * hexLayout.squash);
      maxY = Math.max(maxY, p.y + HEX_SIZE * hexLayout.squash);
    }
    return { x: minX, y: minY - 90, w: maxX - minX, h: maxY - minY + 100 };
  }

  private lifted: UnitView | null = null;

  /** Placement: lifts a hero's sprite so it follows the pointer while the player drags it across the arena. */
  liftHero(uid: string): void {
    if (this.lifted?.unit.heroUid === uid) return;
    const v = [...this.views.values()].find((x) => x.unit.heroUid === uid);
    if (!v) return;
    this.lifted = v;
    gsap.killTweensOf(v);
    gsap.to(v.scale, { x: 1.08, y: 1.08, duration: 0.15, ease: 'power2.out', overwrite: 'auto' });
  }

  /** Moves the lifted sprite under a design-space pointer position. */
  moveLifted(designX: number, designY: number): void {
    const v = this.lifted;
    if (!v) return;
    v.x = designX - this.boardOrigin.x;
    v.y = designY - this.boardOrigin.y + 36;
  }

  /** Drops the lifted sprite onto `hex` (its new home) or back onto the hex it came from. */
  dropLifted(hex: Hex | null): void {
    const v = this.lifted;
    if (!v) return;
    this.lifted = null;
    if (hex) v.unit.pos = hex;
    gsap.to(v.scale, { x: 1, y: 1, duration: 0.15, overwrite: 'auto' });
    if (v.unit.pos) {
      const p = hexToPixel(v.unit.pos);
      gsap.to(v, { x: p.x, y: p.y, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      this.fx.dust(p.x, p.y);
    }
  }

  /** The live sim unit fighting for a hero (by run uid), or null when none is on the board. */
  unitForHero(uid: string): Unit | null {
    for (const v of this.views.values()) if (v.unit.heroUid === uid) return v.unit;
    return null;
  }

  /** Finds the hero uid rendered at a design-space point (placement mode). */
  heroAtDesign(x: number, y: number): string | null {
    const u = this.unitAtDesign(x, y);
    return u && u.side === 'ally' && u.heroUid ? u.heroUid : null;
  }

  /** Finds any unit (ally or enemy) whose body covers a design-space point. */
  unitAtDesign(x: number, y: number): Unit | null {
    const lx = x - this.boardOrigin.x;
    const ly = y - this.boardOrigin.y;
    let best: { u: Unit; d: number } | null = null;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.onBoard || !u.pos || !v.visible || v.dead) continue;
      const hw = v.halfWidth;
      const hh = v.bodyHeight;
      const dx = lx - v.x;
      const dy = ly - (v.y - hh * 0.5);
      if (Math.abs(dx) > hw || Math.abs(dy) > hh * 0.55) continue;
      const d = Math.hypot(dx / hw, dy / (hh * 0.55));
      if (!best || d < best.d) best = { u, d };
    }
    return best?.u ?? null;
  }

  // ───────────────────────── placement ─────────────────────────

  showPlacement(allies: UnitInit[], enemies: UnitInit[]): void {
    this.stopBattle();
    this.mode = 'placement';
    this.clearUnits();
    this.drawHexes(true);
    const list = [...allies, ...enemies];
    for (const init of list) {
      const u = new Unit(init);
      this.addView(u, false);
    }
    this.overlay.alpha = 0;
  }

  /** Updates the ally positions in placement mode without rebuilding everything. */
  updatePlacement(allies: UnitInit[], enemies: UnitInit[]): void {
    if (this.mode !== 'placement') return this.showPlacement(allies, enemies);
    const wanted = new Map<number, UnitInit>();
    for (const i of [...allies, ...enemies]) wanted.set(i.id, i);
    for (const [id, v] of this.views) {
      const w = wanted.get(id);
      if (!w || w.defId !== v.unit.defId) {
        v.destroy();
        this.views.delete(id);
      }
    }
    for (const init of wanted.values()) {
      const v = this.views.get(init.id);
      if (!v) {
        this.addView(new Unit(init), true);
      } else if (init.pos && v.unit.pos && !hexEquals(init.pos, v.unit.pos)) {
        v.unit.pos = init.pos;
        const p = hexToPixel(init.pos);
        gsap.to(v, { x: p.x, y: p.y, duration: 0.25, ease: 'power2.out' });
        this.fx.dust(p.x, p.y);
      } else if (init.pos && !v.unit.pos) {
        v.unit.pos = init.pos;
      }
    }
  }

  private addView(u: Unit, animate: boolean): UnitView {
    const v = new UnitView(u);
    if (u.pos) {
      const p = hexToPixel(u.pos);
      v.position.set(p.x, p.y);
    }
    v.setFacing(u.facing);
    v.visible = u.onBoard && !!u.pos;
    this.unitLayer.addChild(v);
    this.views.set(u.id, v);
    if (animate) v.spawnAnim();
    return v;
  }

  private clearUnits(): void {
    for (const v of this.views.values()) v.destroy({ children: true });
    this.views.clear();
    this.unitLayer.removeChildren();
    this.fx.removeChildren();
    this.texts.removeChildren();
  }

  // ───────────────────────── battle ─────────────────────────

  startBattle(battle: Battle, speed: number): void {
    this.stopBattle();
    this.clearUnits();
    this.battle = battle;
    this.mode = 'battle';
    this.speed = speed;
    this.paused = false;
    this.acc = 0;
    this.ended = false;
    this.hitStopMs = 0;
    this.drawHexes(false);
    gsap.globalTimeline.timeScale(speed);
    this.fx.timeScale = speed;
    for (const u of battle.units) this.addView(u, false);
    for (const v of this.views.values()) v.spawnAnim(Math.random() * 0.2);
  }

  setSpeed(s: number): void {
    this.speed = s;
    gsap.globalTimeline.timeScale(this.mode === 'battle' ? s : 1);
    this.fx.timeScale = this.mode === 'battle' ? s : 1;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  stopBattle(): void {
    this.battle = null;
    this.mode = 'idle';
    gsap.globalTimeline.timeScale(1);
    this.fx.timeScale = 1;
    this.overlay.alpha = 0;
    this.flashOverlay.alpha = 0;
    if (this.tribulationLabel) {
      this.tribulationLabel.destroy();
      this.tribulationLabel = null;
    }
  }

  private frame(deltaMS: number): void {
    const dt = Math.min(0.1, deltaMS / 1000);
    this.elapsed += dt;
    // camera shake
    if (this.shakeAmt > 0.2) {
      const v = viewport.value;
      this.world.position.set(v.offsetX + (Math.random() - 0.5) * this.shakeAmt, v.offsetY + (Math.random() - 0.5) * this.shakeAmt * 0.6);
      this.shakeAmt *= Math.pow(0.001, dt);
    } else if (this.shakeAmt !== 0) {
      this.shakeAmt = 0;
      const v = viewport.value;
      this.world.position.set(v.offsetX, v.offsetY);
    }

    const b = this.battle;
    if (b && this.mode === 'battle' && !this.paused && !this.ended) {
      if (this.hitStopMs > 0) {
        this.hitStopMs -= deltaMS;
      } else {
        this.acc += dt * this.speed;
        let guard = 0;
        while (this.acc >= TICK && guard++ < 40) {
          b.tick(TICK);
          this.acc -= TICK;
          if (b.over) break;
        }
      }
      for (const e of b.drainEvents()) this.handleEvent(e);
      this.onTime?.(b.time);
      if (b.over && !this.ended) {
        this.ended = true;
        gsap.delayedCall(1.1, () => {
          const r = b.result();
          this.onEnd?.(r);
        });
      }
    }

    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.onBoard || !u.pos) {
        v.visible = false;
        continue;
      }
      v.visible = true;
      if (b && u.moving) {
        const t = Math.min(1, Math.max(0, (b.time - u.moving.start) / (u.moving.end - u.moving.start)));
        const a = hexToPixel(u.moving.from);
        const c = hexToPixel(u.moving.to);
        v.x = a.x + (c.x - a.x) * t;
        v.y = a.y + (c.y - a.y) * t - Math.sin(t * Math.PI) * (v.hasWalk || u.flying ? 3 : 10);
      } else if (b) {
        const p = hexToPixel(u.pos);
        v.x = p.x;
        v.y = p.y;
      }
      v.setFacing(u.facing);
      v.setMoving(!!(b && u.moving));
      v.zIndex = v.y + (u.boss ? 1 : 0) + (v === this.lifted ? 10000 : 0);
      v.update(this.elapsed, 1);
    }
  }

  shake(amount: number): void {
    if (!meta.value.settings.screenShake) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  /** Freezes the simulation for a few milliseconds so a heavy hit "lands". */
  hitStop(ms: number): void {
    if (!meta.value.settings.screenShake) return;
    this.hitStopMs = Math.max(this.hitStopMs, ms);
  }

  /** Brief full-screen tint (boss abilities, tribulation strikes). */
  screenFlash(color: number, alpha = 0.25, duration = 0.35): void {
    const g = this.flashOverlay;
    g.clear();
    g.rect(-400, -400, DESIGN_W + 800, DESIGN_H + 800).fill({ color, alpha: 1 });
    gsap.killTweensOf(g);
    g.alpha = alpha;
    gsap.to(g, { alpha: 0, duration, ease: 'power2.out' });
  }

  private viewOf(id: number): UnitView | undefined {
    return this.views.get(id);
  }

  private weaponColor(v: UnitView): number {
    for (const c of v.unit.classes) if (CLASS_FX_COLOR[c]) return CLASS_FX_COLOR[c];
    return v.unit.accent ? parseColor(v.unit.accent) : v.unit.side === 'ally' ? 0xe8f1ff : 0xff8a7a;
  }

  private handleEvent(e: BattleEvent): void {
    const showNumbers = meta.value.settings.showDamage;
    switch (e.type) {
      case 'spawn': {
        if (!this.views.has(e.unit.id) && this.battle) {
          const u = this.battle.unit(e.unit.id);
          if (u) {
            const v = this.addView(u, true);
            this.fx.glyph(v.x, v.y, 0xb57cff, 50, 0.6);
          }
        }
        break;
      }
      case 'move': {
        const v = this.viewOf(e.id);
        if (v && !v.unit.flying) {
          const p = hexToPixel(e.from);
          this.fx.dust(p.x, p.y);
        }
        break;
      }
      case 'blink': {
        const v = this.viewOf(e.id);
        if (!v) break;
        if (e.from) {
          const a = hexToPixel(e.from);
          this.fx.smoke(a.x, a.y, 0x6a3fb5, 6, 40);
          this.fx.burst(a.x, a.y - 60, 0xb57cff, { count: 10, speed: 90, size: 16 });
        }
        const bpos = hexToPixel(e.to);
        this.fx.burst(bpos.x, bpos.y - 60, 0xb57cff, { count: 12, speed: 90, size: 16 });
        this.fx.smoke(bpos.x, bpos.y, 0x6a3fb5, 6, 40);
        audio.sfx('blink');
        break;
      }
      case 'attack': {
        const v = this.viewOf(e.id);
        const t = this.viewOf(e.targetId);
        if (!v) break;
        v.attackAnim(e.ranged, e.hitDelay);
        const color = this.weaponColor(v);
        if (e.ranged && t) {
          const style = PROJECTILE_STYLES[e.projectile ?? 'spirit_bolt'] ?? PROJECTILE_STYLES.spirit_bolt;
          this.fx.projectile(v.x, v.y + v.chestY, t.x, t.y + t.chestY, e.hitDelay, style);
          audio.sfx(e.projectile === 'flying_sword' ? 'sword' : 'swing', { volume: 0.5 });
        } else {
          // melee: the weapon arc lands on the target exactly when the sim applies the hit
          if (t) {
            const facing = v.unit.facing as 1 | -1;
            gsap.delayedCall(Math.max(0.05, e.hitDelay - 0.04), () => {
              if (t.destroyed) return;
              this.fx.slash(t.x - facing * 10, t.y + t.chestY, facing, color, 58 + (v.unit.boss ? 40 : 0), (Math.random() - 0.5) * 0.6);
            });
          }
          audio.sfx(v.unit.classes.includes('sword') ? 'sword' : 'swing', { volume: 0.45 });
        }
        break;
      }
      case 'cast': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.castAnim();
        const accent = v.unit.accent ? parseColor(v.unit.accent) : v.unit.side === 'ally' ? 0x6fe3c4 : 0xff6b5a;
        // skill unleash: a beat of freeze-frame, a tinted screen flash, a rising qi pillar and a glyph under the caster
        this.hitStop(v.unit.boss ? 110 : 80);
        this.screenFlash(accent, v.unit.boss ? 0.22 : 0.14, 0.32);
        v.tintFlash(0xffffff, 0.25);
        this.fx.ring(v.x, v.y, accent, 96, 4, 0.7, hexLayout.squash);
        this.fx.glyph(v.x, v.y, accent, 78, 0.9);
        if (!this.fx.flipbook('fx_qi_cast', v.x, v.y + 12, { scale: Math.max(0.9, v.bodyHeight / 190), anchorY: 0.92, tint: accent, fps: 26 })) this.fx.pillar(v.x, v.y, accent, 200, 0.5);
        this.fx.flash(v.x, v.y + v.chestY, accent, 180, 0.4);
        this.castBanner(v.x, v.y + v.headY - 36, e.name, accent);
        if (v.unit.boss) {
          this.shake(8);
          this.hitStop(70);
          this.screenFlash(0x3a0a12, 0.35, 0.5);
          this.fx.shockwave(v.x, v.y, accent, 170, 0.6);
          audio.sfx('boss_roar', { volume: 0.6 });
        }
        audio.sfx('cast', { volume: 0.5 });
        break;
      }
      case 'damage': {
        const v = this.viewOf(e.id);
        if (!v) break;
        const src = this.viewOf(e.sourceId);
        if (e.dot) {
          if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `${e.amount}`, (e.dot === 'tribulation' ? 'tribulation' : e.dot) as NumberKind, { dot: true });
          if (e.dot === 'burn') this.fx.embers(v.x, v.y, STATUS_COLORS.burn, 3);
          if (e.dot === 'poison') this.fx.burst(v.x, v.y - 50, STATUS_COLORS.poison, { count: 3, speed: 30, size: 10, life: 0.5 });
          if (e.dot === 'bleed') this.fx.burst(v.x, v.y + v.chestY, STATUS_COLORS.bleed, { count: 3, speed: 50, size: 10, life: 0.4, gravity: 30 });
          if (e.dot === 'tribulation') {
            this.fx.strike(v.x, v.y, 0xfff27a);
            this.fx.flipbook('fx_lightning_strike', v.x, v.y + 6, { scale: 1.1, anchorY: 0.92, fps: 30 });
            this.screenFlash(0xfff27a, 0.12, 0.25);
            this.shake(3);
          }
          break;
        }
        v.hurtAnim(e.crit, src?.x);
        const kind: NumberKind = e.crit ? 'crit' : e.absorbed >= e.amount ? 'shield' : e.kind === 'true' ? 'true' : e.kind === 'magic' ? 'magic' : 'physical';
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, e.crit ? `${e.amount}!` : `${e.amount}`, kind, { crit: e.crit });
        const dir = src ? (v.x >= src.x ? 1 : -1) : -v.unit.facing;
        const hitColor = e.crit ? 0xffd84a : e.kind === 'magic' ? 0xb57cff : e.kind === 'true' ? 0xffd9a1 : 0xfff1c0;
        this.fx.sparks(v.x - dir * 8, v.y + v.chestY, dir, hitColor, e.crit ? 11 : 5, e.crit ? 340 : 220);
        this.fx.flash(v.x, v.y + v.chestY, hitColor, e.crit ? 150 : 70, e.crit ? 0.35 : 0.2);
        if (e.absorbed > 0) this.fx.dome(v.x, v.y, 0xbfe4ff, v.halfWidth + 14, v.bodyHeight);
        if (e.crit) {
          this.shake(v.unit.boss ? 10 : 5);
          this.hitStop(v.unit.boss ? 60 : 38);
          this.fx.shockwave(v.x, v.y, hitColor, 70, 0.4);
          audio.sfx('hit_crit', { volume: 0.7 });
        } else audio.sfx('hit_melee', { volume: 0.4 });
        break;
      }
      case 'heal': {
        const v = this.viewOf(e.id);
        if (!v || e.amount <= 0) break;
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `+${e.amount}`, 'heal');
        this.fx.motes(v.x, v.y, 0x8dff9a, 8, 120);
        this.fx.ring(v.x, v.y, 0x8dff9a, 50, 2, 0.5, hexLayout.squash);
        audio.sfx('heal', { volume: 0.35, throttleMs: 300 });
        break;
      }
      case 'shield': {
        const v = this.viewOf(e.id);
        if (!v) break;
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `+${e.amount}`, 'shield', { size: 20 });
        this.fx.dome(v.x, v.y, 0xbfe4ff, v.halfWidth + 16, v.bodyHeight);
        audio.sfx('shield', { volume: 0.35, throttleMs: 300 });
        break;
      }
      case 'status': {
        const v = this.viewOf(e.id);
        if (!v) break;
        const color = STATUS_COLORS[e.status] ?? 0xffffff;
        switch (e.status) {
          case 'burn':
            this.fx.embers(v.x, v.y, color, 8);
            v.tintFlash(0xffb080, 0.3);
            audio.sfx('fire', { volume: 0.4, throttleMs: 400 });
            break;
          case 'frost':
            this.fx.shards(v.x, v.y, color, 5, 0.6);
            v.tintFlash(0xa8e4ff, 0.45);
            audio.sfx('frost', { volume: 0.3, throttleMs: 600 });
            break;
          case 'poison':
            this.fx.smoke(v.x, v.y, color, 5, 40);
            v.tintFlash(0xb8ff90, 0.4);
            audio.sfx('poison', { volume: 0.3, throttleMs: 500 });
            break;
          case 'stun':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, 'STUN', 'label', { size: 14 });
            this.fx.burst(v.x, v.y + v.headY, 0xfff27a, { count: 6, speed: 50, size: 10, life: 0.5 });
            this.fx.motes(v.x, v.y + v.headY - 10, 0xfff27a, 5, 30);
            break;
          case 'taunt':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, 'TAUNTED', 'label', { size: 14 });
            this.fx.ring(v.x, v.y, 0xffd27f, 60, 3, 0.5, hexLayout.squash);
            break;
          case 'sunder':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, `-${e.stacks} DEF`, 'label', { size: 13 });
            this.fx.sparks(v.x, v.y + v.chestY, 1, 0xff9f7a, 3, 160);
            this.fx.sparks(v.x, v.y + v.chestY, -1, 0xff9f7a, 3, 160);
            break;
          case 'weaken':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, `WEAKENED`, 'label', { size: 13 });
            this.fx.smoke(v.x, v.y, 0x7a6a9a, 4, 30);
            break;
          default:
            break;
        }
        break;
      }
      case 'cleanse': {
        const v = this.viewOf(e.id);
        if (v) {
          this.fx.ring(v.x, v.y + v.chestY, 0xffffff, 60, 2, 0.4, 1);
          this.fx.motes(v.x, v.y, 0xffffff, 6, 90);
        }
        break;
      }
      case 'death': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.dieAnim();
        const col = v.unit.side === 'ally' ? 0x9fd5ff : 0xff6b5a;
        this.fx.flipbook('fx_death_burst', v.x, v.y + v.chestY, { scale: Math.max(0.9, v.bodyHeight / 170), tint: v.unit.side === 'ally' ? 0xbfe4ff : 0xff8a7a, fps: 22 });
        this.fx.burst(v.x, v.y + v.chestY, v.unit.side === 'ally' ? 0x9fd5ff : 0x8a3a3a, { count: 16, speed: 110, size: 18, life: 0.7, gravity: 30 });
        this.fx.wisp(v.x, v.y + v.chestY, col);
        if (!v.unit.flying) this.fx.dust(v.x, v.y);
        audio.sfx('death', { volume: 0.5 });
        this.hitStop(v.unit.boss ? 220 : 55);
        if (v.unit.boss) {
          this.shake(14);
          this.screenFlash(0xffffff, 0.45, 0.8);
          this.fx.shockwave(v.x, v.y, 0xff6b5a, 260, 0.9);
          this.fx.shards(v.x, v.y, 0xff9a8a, 14, 1.2);
        } else if (v.unit.elite) {
          this.shake(6);
          this.fx.shockwave(v.x, v.y, col, 120, 0.5);
        }
        break;
      }
      case 'revive': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.reviveAnim();
        this.fx.fireColumn(v.x, v.y, 0xff8a3c, 260, 18);
        this.fx.flipbook('fx_buff_rise', v.x, v.y + 8, { scale: 1.3, anchorY: 0.95, tint: 0xffd27f, fps: 20 });
        this.fx.motes(v.x, v.y, 0xffd27f, 10, 160);
        this.texts.spawn(v.x, v.y + v.headY - 20, 'REBORN', 'label', { size: 20 });
        break;
      }
      case 'buff': {
        const v = this.viewOf(e.id);
        if (!v || !showNumbers) break;
        const label = e.label ?? `${e.flat ? (e.flat > 0 ? '+' : '') + e.flat : (e.pct > 0 ? '+' : '') + e.pct + '%'} ${STAT_SHORT[e.stat] ?? e.stat}`;
        this.texts.spawn(v.x, v.y + v.headY - 24, label, 'buff', { size: 14 });
        if (e.flat > 0 || e.pct > 0) this.fx.motes(v.x, v.y, 0xf3cf78, 4, 70);
        break;
      }
      case 'vfx': {
        this.playVfx(e.key, e.id, e.targetId, e.pos ?? undefined);
        break;
      }
      case 'surge': {
        const v = this.viewOf(e.id);
        if (!v) break;
        if (e.start) {
          v.setAura(0xffb86b, 0.7);
          this.texts.spawn(v.x, v.y + v.headY - 24, `SURGE · ${e.name.toUpperCase()}`, 'label', { size: 14 });
          this.fx.ring(v.x, v.y, 0xffb86b, 90, 3, 0.6, hexLayout.squash);
          this.fx.fireColumn(v.x, v.y, 0xffb86b, 140, 8);
          this.fx.flipbook('fx_buff_rise', v.x, v.y + 8, { scale: Math.max(0.9, v.bodyHeight / 180), anchorY: 0.95, tint: 0xffb86b, fps: 22 });
        } else {
          v.setAura(v.unit.side === 'ally' ? 0x3fbf9f : 0xd2382c, 0.35);
        }
        break;
      }
      case 'enlightenment': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.setAura(0xc9a7ff, 0.7);
        this.fx.pillar(v.x, v.y, 0xc9a7ff, 240, 0.8);
        this.fx.motes(v.x, v.y, 0xc9a7ff, 14, 220);
        this.fx.glyph(v.x, v.y, 0xc9a7ff, 70, 1.2);
        this.fx.flipbook('fx_buff_rise', v.x, v.y + 8, { scale: Math.max(1.0, v.bodyHeight / 160), anchorY: 0.95, tint: 0xc9a7ff, fps: 20 });
        this.texts.spawn(v.x, v.y + v.headY - 24, `ENLIGHTENMENT · ${e.name.toUpperCase()}`, 'label', { size: 14 });
        audio.sfx('rankup', { volume: 0.4 });
        break;
      }
      case 'companion': {
        const [a, b] = e.ids.map((id) => this.viewOf(id));
        if (a && b) {
          const g = new Graphics();
          g.moveTo(a.x, a.y + a.chestY).lineTo(b.x, b.y + b.chestY).stroke({ color: 0xff9ad5, width: 3, alpha: 0.9 });
          g.blendMode = 'add';
          this.fx.addChild(g);
          gsap.to(g, { alpha: 0, duration: 1.2, onComplete: () => g.destroy() });
          this.fx.motes(a.x, a.y, 0xff9ad5, 6, 120);
          this.fx.motes(b.x, b.y, 0xff9ad5, 6, 120);
          this.texts.spawn((a.x + b.x) / 2, (a.y + b.y) / 2 - 120, 'DAO COMPANIONS', 'label', { size: 18 });
        }
        break;
      }
      case 'tribulation': {
        if (e.start) {
          this.overlay.clear();
          this.overlay.rect(-200, -200, DESIGN_W + 400, DESIGN_H + 400).fill({ color: 0x3a0a12, alpha: 0.35 });
          gsap.to(this.overlay, { alpha: 1, duration: 1 });
          const t = new Text({ text: 'HEAVENLY TRIBULATION', style: new TextStyle({ fontFamily: 'Cinzel', fontWeight: '900', fontSize: 46, fill: '#fff27a', letterSpacing: 8, stroke: { color: '#000', width: 6 } }) });
          t.anchor.set(0.5);
          t.position.set(DESIGN_W / 2 - this.boardOrigin.x, 180 - this.boardOrigin.y);
          this.texts.addChild(t);
          this.tribulationLabel = t;
          gsap.fromTo(t.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.5, ease: 'power3.out' });
          gsap.to(t, { alpha: 0.5, duration: 0.8, yoyo: true, repeat: -1 });
          this.shake(10);
          this.screenFlash(0xfff27a, 0.3, 0.6);
          for (let i = 0; i < 4; i++) gsap.delayedCall(i * 0.12, () => this.fx.strike((Math.random() - 0.2) * (DESIGN_W - this.boardOrigin.x * 2), 120 + Math.random() * 260, 0xfff27a));
          audio.sfx('tribulation', { volume: 0.7 });
        }
        break;
      }
      case 'stones': {
        const v = this.viewOf(e.sourceId);
        if (v) {
          this.texts.spawn(v.x, v.y + v.headY - 30, `+${e.amount} ◆`, 'stones', { size: 18 });
          this.fx.motes(v.x, v.y + v.chestY, 0xf3cf78, 5, 60);
        }
        audio.sfx('stones', { volume: 0.5 });
        break;
      }
      case 'qi': {
        const v = this.viewOf(e.id);
        if (v && e.maxQi > 0 && e.qi >= e.maxQi) {
          const accent = v.unit.accent ? parseColor(v.unit.accent) : 0x8fd5ff;
          v.pulseAura(accent, 0.7, 0.45);
          this.fx.motes(v.x, v.y, 0x8fd5ff, 5, 110);
        }
        break;
      }
      case 'end': {
        audio.sfx(e.winner === 'ally' ? 'victory' : 'defeat', { volume: 0.7 });
        if (e.winner === 'ally') this.screenFlash(0xf3cf78, 0.18, 0.9);
        break;
      }
    }
  }

  private playVfx(key: string, id?: number, targetId?: number, pos?: Hex): void {
    const src = id !== undefined ? this.viewOf(id) : undefined;
    const tgt = targetId !== undefined ? this.viewOf(targetId) : undefined;
    const at = tgt ?? src;
    const p = pos ? hexToPixel(pos) : at ? { x: at.x, y: at.y } : null;
    if (!p) return;
    const chest = at ? at.chestY : -70;
    const facing = src ? (src.unit.facing as 1 | -1) : 1;
    const from = src ? { x: src.x, y: src.y + src.chestY } : { x: p.x - facing * 160, y: p.y + chest };
    const fb = FLIPBOOK_FOR[key];
    if (fb) {
      const size = at ? Math.max(0.8, at.bodyHeight / 180) : 1;
      this.fx.flipbook(fb.sheet, p.x, fb.ground ? p.y + 6 : p.y + chest, { scale: (fb.scale ?? 1) * size, tint: fb.tint, anchorY: fb.ground ? 0.92 : 0.5, fps: fb.fps ?? 24, flipX: facing < 0 && !!fb.directional });
    }
    switch (key) {
      case 'lightning':
      case 'lightning_arc':
        this.fx.strike(p.x, p.y + chest, 0xfff27a);
        if (src && tgt) this.fx.lightning(from.x, from.y, p.x, p.y + chest, 0xfff27a);
        audio.sfx('lightning', { volume: 0.5, throttleMs: 120 });
        this.shake(3);
        break;
      case 'thunder_call':
        for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.09, () => this.fx.strike(p.x + (i - 1) * 50, p.y + (i === 1 ? chest : 0), 0xfff27a));
        this.screenFlash(0xfff27a, 0.16, 0.3);
        audio.sfx('lightning', { volume: 0.6, throttleMs: 120 });
        this.shake(5);
        break;
      case 'sword_slash':
      case 'fire_slash':
      case 'shadow_slash':
      case 'claw': {
        const color = key === 'fire_slash' ? 0xff8a3c : key === 'shadow_slash' ? 0xb57cff : key === 'claw' ? 0xffd27f : 0xe8f1ff;
        this.fx.slash(p.x, p.y + chest, facing, color, key === 'claw' ? 50 : 76, -0.2);
        gsap.delayedCall(0.08, () => this.fx.slash(p.x, p.y + chest, facing, color, key === 'claw' ? 50 : 70, 0.35));
        this.fx.sparks(p.x, p.y + chest, facing, color, 6, 240);
        if (key === 'fire_slash') this.fx.embers(p.x, p.y, 0xff8a3c, 8);
        if (key === 'shadow_slash') this.fx.smoke(p.x, p.y, 0x5a2d9a, 5, 40);
        break;
      }
      case 'spear_line':
      case 'arrow_pierce':
      case 'gale_thrust':
      case 'spear_sweep': {
        const color = key === 'arrow_pierce' ? 0xffe9a0 : 0x5ad6a5;
        this.fx.beam(from.x, from.y, p.x + facing * 90, p.y + chest, color, 22, 0.4);
        this.fx.sparks(p.x, p.y + chest, facing, color, 6, 260);
        break;
      }
      case 'sword_shard':
        this.fx.shards(p.x, p.y, 0xe8f1ff, 10, 1);
        this.fx.sparks(p.x, p.y + chest, facing, 0xe8f1ff, 6, 260);
        break;
      case 'impact':
        this.fx.burst(p.x, p.y + chest, 0xffffff, { count: 10, speed: 120, size: 16, life: 0.4 });
        this.fx.shockwave(p.x, p.y, 0xffd27f, 90, 0.45);
        this.shake(4);
        break;
      case 'fist_flurry':
        for (let i = 0; i < 4; i++) gsap.delayedCall(i * 0.06, () => this.fx.sparks(p.x + (Math.random() - 0.5) * 30, p.y + chest + (Math.random() - 0.5) * 40, facing, 0xffd27f, 4, 220));
        this.fx.burst(p.x, p.y + chest, 0xffd27f, { count: 6, speed: 80, size: 12, life: 0.3 });
        break;
      case 'heal_bloom':
      case 'sutra':
        this.fx.pillar(p.x, p.y, 0x8dff9a, 180, 0.6);
        this.fx.motes(p.x, p.y, 0x8dff9a, 12, 160);
        if (key === 'sutra') this.fx.glyph(p.x, p.y, 0xf3cf78, 60, 0.8);
        break;
      case 'shield_pop':
      case 'stone_aura':
      case 'obsidian':
        this.fx.dome(p.x, p.y, key === 'obsidian' ? 0x9a8ad0 : 0xbfe4ff, (at?.halfWidth ?? 40) + 18, at?.bodyHeight ?? 150);
        this.fx.ring(p.x, p.y, key === 'obsidian' ? 0x9a8ad0 : 0xbfe4ff, 80, 4, 0.5, hexLayout.squash);
        break;
      case 'lotus_fire':
      case 'lotus_bloom':
      case 'phoenix_strike':
      case 'ghost_fire': {
        const color = key === 'ghost_fire' ? 0x7ff0e1 : 0xff8a3c;
        this.fx.fireColumn(p.x, p.y, color, key === 'phoenix_strike' ? 240 : 180, 14);
        this.fx.ring(p.x, p.y, key === 'ghost_fire' ? 0x7ff0e1 : 0xff6b3c, 70, 3, 0.6, hexLayout.squash);
        audio.sfx('fire', { volume: 0.5, throttleMs: 200 });
        break;
      }
      case 'frost_array':
      case 'frost_burst':
      case 'freeze':
        this.fx.shards(p.x, p.y, 0xa8e4ff, key === 'frost_array' ? 14 : 9, 1);
        this.fx.ring(p.x, p.y, 0xa8e4ff, 90, 3, 0.6, hexLayout.squash);
        if (key === 'frost_array') this.fx.glyph(p.x, p.y, 0xa8e4ff, 80, 1);
        audio.sfx('frost', { volume: 0.4, throttleMs: 200 });
        break;
      case 'water_burst':
      case 'tidal_breath':
        this.fx.beam(from.x, from.y, p.x + facing * 140, p.y + chest, 0x6ac8ff, 46, 0.55);
        this.fx.burst(p.x, p.y + chest, 0xa8e4ff, { count: 14, speed: 110, size: 16, life: 0.6 });
        this.fx.shards(p.x, p.y, 0x9fd5ff, 6, 0.8);
        this.fx.shockwave(p.x, p.y, 0x6ac8ff, 110, 0.5);
        audio.sfx('frost', { volume: 0.4, throttleMs: 200 });
        break;
      case 'shadow_blink':
        this.fx.smoke(p.x, p.y, 0x5a2d9a, 8, 50);
        this.fx.burst(p.x, p.y + chest, 0xb57cff, { count: 14, speed: 100, size: 16, life: 0.5 });
        break;
      case 'tiger_roar':
      case 'tiger_form':
        this.fx.shockwave(p.x, p.y, 0xffb347, 160, 0.7);
        this.screenFlash(0xffb347, 0.14, 0.4);
        this.shake(6);
        audio.sfx('boss_roar', { volume: 0.4 });
        break;
      case 'moon_pulse':
        this.fx.ring(p.x, p.y, 0xc9d8ff, 220, 4, 0.9, hexLayout.squash);
        this.fx.flash(p.x, p.y + chest, 0xc9d8ff, 220, 0.5);
        this.fx.motes(p.x, p.y, 0xc9d8ff, 14, 200);
        this.screenFlash(0xc9d8ff, 0.1, 0.5);
        break;
      case 'cinnabar_smoke':
      case 'poison_puff':
        this.fx.smoke(p.x, p.y, 0x9fe85a, 12, 80);
        this.fx.burst(p.x, p.y + chest, 0x9fe85a, { count: 8, speed: 60, size: 18, life: 0.7, gravity: -30 });
        break;
      case 'phoenix_rebirth':
        this.fx.fireColumn(p.x, p.y, 0xff8a3c, 320, 24);
        this.fx.burst(p.x, p.y + chest, 0xffb347, { count: 24, speed: 160, size: 20, life: 0.9 });
        this.fx.shockwave(p.x, p.y, 0xff8a3c, 150, 0.6);
        this.screenFlash(0xff8a3c, 0.2, 0.6);
        this.shake(6);
        break;
      case 'enrage':
        this.fx.flash(p.x, p.y + chest, 0xff2e4d, 260, 0.6);
        this.fx.ring(p.x, p.y, 0xff2e4d, 150, 5, 0.7, hexLayout.squash);
        this.fx.fireColumn(p.x, p.y, 0xff2e4d, 200, 12);
        this.screenFlash(0xff2e4d, 0.22, 0.6);
        this.shake(8);
        break;
      case 'summon':
        this.fx.glyph(p.x, p.y, 0xb57cff, 70, 1);
        this.fx.pillar(p.x, p.y, 0xb57cff, 200, 0.7);
        break;
      case 'sun_arrow':
        this.fx.beam(from.x, from.y, p.x, p.y + chest, 0xffe9a0, 18, 0.35);
        this.fx.flash(p.x, p.y + chest, 0xffe9a0, 140, 0.3);
        break;
      case 'flying_sword':
        this.fx.flash(p.x, p.y + chest, 0x9fe0ff, 120, 0.3);
        this.fx.slash(p.x, p.y + chest, facing, 0x9fe0ff, 70, 0.2);
        this.fx.sparks(p.x, p.y + chest, facing, 0x9fe0ff, 6, 260);
        break;
      case 'tail_sweep':
        this.fx.slash(p.x, p.y + chest, facing, 0x4fc3c7, 130, 0.1);
        this.fx.shockwave(p.x, p.y, 0x4fc3c7, 130, 0.5);
        this.shake(6);
        break;
      case 'blood_nova':
      case 'blood_burst':
        this.fx.burst(p.x, p.y + chest, 0xff2e4d, { count: 18, speed: 140, size: 20, life: 0.7 });
        this.fx.shockwave(p.x, p.y, 0xff2e4d, key === 'blood_nova' ? 260 : 120, 0.8);
        this.fx.smoke(p.x, p.y, 0x7a0f22, 10, 90);
        if (key === 'blood_nova') this.screenFlash(0x7a0f22, 0.35, 0.7);
        this.shake(8);
        break;
      default:
        this.fx.flash(p.x, p.y + chest, 0xffffff, 100, 0.3);
    }
  }

  /** Design-space position of a unit's feet (for DOM overlays). */
  unitScreenPos(id: number): { x: number; y: number } | null {
    const v = this.viewOf(id);
    if (!v) return null;
    return { x: v.x + this.boardOrigin.x, y: v.y + this.boardOrigin.y };
  }

  /** Design-space anchor above a unit's head (for DOM tooltips). */
  unitHeadDesign(id: number): { x: number; y: number } | null {
    const v = this.viewOf(id);
    if (!v) return null;
    return { x: v.x + this.boardOrigin.x, y: v.y + v.headY - 30 + this.boardOrigin.y };
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

let instance: BattleView | null = null;
export function getBattleView(): BattleView {
  if (!instance) instance = new BattleView();
  return instance;
}
