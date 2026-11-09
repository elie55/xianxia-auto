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
import { VfxLayer, PROJECTILE_STYLES, STATUS_COLORS } from './Vfx';
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
  private tribulationLabel: Text | null = null;

  mode: ViewMode = 'idle';
  battle: Battle | null = null;
  speed = 1;
  paused = false;
  private acc = 0;
  private views = new Map<number, UnitView>();
  private shakeAmt = 0;
  private realm = 1;
  private elapsed = 0;
  private endTimer = 0;
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
    this.overlay.alpha = 0;

    // board origin: center the board horizontally, place vertically in the middle band
    const w = HEX_W * (BOARD_COLS - 1) + HEX_W / 2;
    const h = HEX_SIZE * 1.5 * HEX_SQUASH * (BOARD_ROWS - 1);
    this.boardOrigin.x = DESIGN_W / 2 - w / 2;
    this.boardOrigin.y = 655 - h / 2;
    this.arenaLayer.position.set(this.boardOrigin.x, this.boardOrigin.y);
    this.unitLayer.position.set(this.boardOrigin.x, this.boardOrigin.y);
    this.fx.position.set(this.boardOrigin.x, this.boardOrigin.y);
    this.texts.position.set(this.boardOrigin.x, this.boardOrigin.y);

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

  // ───────────────────────── arena ─────────────────────────

  async setRealm(realm: number): Promise<void> {
    this.realm = realm;
    this.drawBackground(viewport.value);
    this.drawGround();
    const key = realm === 1 ? 'realm1_bamboo' : realm === 2 ? 'realm2_abyss' : 'realm3_ladder';
    const tex = await Assets.load<Texture>(`./assets/art/bg/${key}.jpg`).catch(() => null);
    if (this.bgSprite) {
      this.bgSprite.destroy();
      this.bgSprite = null;
    }
    if (tex) {
      const s = new Sprite(tex);
      this.bgSprite = s;
      this.bgLayer.addChild(s);
      this.fitBackground(viewport.value);
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
    // simple vertical bands as a gradient fallback
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = lerpColor(lerpColor(colors[0], colors[1], Math.min(1, t * 1.6)), colors[2], Math.max(0, t - 0.55) * 2.2);
      g.rect(0, (v.height * i) / steps, v.width, v.height / steps + 2).fill({ color: c });
    }
    // soft vignette
    g.rect(0, 0, v.width, v.height).fill({ color: 0x000000, alpha: 0.0 });
    this.fitBackground(v);
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const w = HEX_W * (BOARD_COLS - 1) + HEX_W / 2;
    const h = HEX_SIZE * 1.5 * HEX_SQUASH * (BOARD_ROWS - 1);
    const cx = w / 2;
    const cy = h / 2;
    const col = this.realm === 1 ? 0x1d4a3d : this.realm === 2 ? 0x4a1d24 : 0x1f2c55;
    const painted = !!this.bgSprite;
    g.ellipse(cx, cy + 10, w * 0.78, h * 1.35).fill({ color: 0x000000, alpha: painted ? 0.22 : 0.35 });
    g.ellipse(cx, cy, w * 0.72, h * 1.2).fill({ color: painted ? 0x000000 : col, alpha: painted ? 0.18 : 0.75 });
    g.ellipse(cx, cy, w * 0.72, h * 1.2).stroke({ color: 0xd4a84b, width: 2, alpha: painted ? 0.28 : 0.35 });
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
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * HEX_SQUASH);
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

  /** Finds the hero uid rendered at a design-space point (placement mode). */
  heroAtDesign(x: number, y: number): string | null {
    const lx = x - this.boardOrigin.x;
    const ly = y - this.boardOrigin.y;
    let best: { uid: string; d: number } | null = null;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.side !== 'ally' || !u.heroUid || !u.pos) continue;
      const p = hexToPixel(u.pos);
      const dx = lx - p.x;
      const dy = ly - (p.y - 70);
      const d = Math.hypot(dx, dy * 0.8);
      if (d < 70 && (!best || d < best.d)) best = { uid: u.heroUid, d };
    }
    return best?.uid ?? null;
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
    // remove stale
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
    this.endTimer = 0;
    this.drawHexes(false);
    gsap.globalTimeline.timeScale(speed);
    for (const u of battle.units) this.addView(u, false);
    for (const v of this.views.values()) v.spawnAnim(Math.random() * 0.2);
    // consume initial events (spawns etc.) on first tick
  }

  setSpeed(s: number): void {
    this.speed = s;
    gsap.globalTimeline.timeScale(this.mode === 'battle' ? s : 1);
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  stopBattle(): void {
    this.battle = null;
    this.mode = 'idle';
    gsap.globalTimeline.timeScale(1);
    this.overlay.alpha = 0;
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
      this.acc += dt * this.speed;
      let guard = 0;
      while (this.acc >= TICK && guard++ < 40) {
        b.tick(TICK);
        this.acc -= TICK;
        if (b.over) break;
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

    // update unit views
    const simTime = b ? b.time : this.elapsed;
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
        v.y = a.y + (c.y - a.y) * t - Math.sin(t * Math.PI) * 10;
      } else if (b) {
        const p = hexToPixel(u.pos);
        v.x = p.x;
        v.y = p.y;
      }
      v.setFacing(u.facing);
      v.zIndex = v.y + (u.boss ? 1 : 0);
      v.update(this.elapsed, 1);
    }
  }

  shake(amount: number): void {
    if (!meta.value.settings.screenShake) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  private viewOf(id: number): UnitView | undefined {
    return this.views.get(id);
  }

  private handleEvent(e: BattleEvent): void {
    const showNumbers = meta.value.settings.showDamage;
    switch (e.type) {
      case 'spawn': {
        if (!this.views.has(e.unit.id) && this.battle) {
          const u = this.battle.unit(e.unit.id);
          if (u) this.addView(u, true);
        }
        break;
      }
      case 'move': {
        const v = this.viewOf(e.id);
        if (v) {
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
          this.fx.burst(a.x, a.y - 60, 0xb57cff, { count: 12, speed: 90, size: 16 });
        }
        const bpos = hexToPixel(e.to);
        this.fx.burst(bpos.x, bpos.y - 60, 0xb57cff, { count: 12, speed: 90, size: 16 });
        audio.sfx('blink');
        break;
      }
      case 'attack': {
        const v = this.viewOf(e.id);
        const t = this.viewOf(e.targetId);
        if (!v) break;
        v.attackAnim(e.ranged, e.hitDelay);
        if (e.ranged && t) {
          const style = PROJECTILE_STYLES[e.projectile ?? 'spirit_bolt'] ?? PROJECTILE_STYLES.spirit_bolt;
          this.fx.projectile(v.x, v.y + v.chestY, t.x, t.y + t.chestY, e.hitDelay, style);
          audio.sfx(e.projectile === 'flying_sword' ? 'sword' : 'swing', { volume: 0.5 });
        } else {
          audio.sfx(v.unit.classes.includes('sword') ? 'sword' : 'swing', { volume: 0.45 });
        }
        break;
      }
      case 'cast': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.castAnim();
        this.fx.ring(v.x, v.y, v.unit.side === 'ally' ? 0x6fe3c4 : 0xff6b5a, 80, 3, 0.6, HEX_SQUASH);
        this.fx.flash(v.x, v.y + v.chestY, v.unit.accent ? parseColor(v.unit.accent) : 0xffffff, 160, 0.4);
        if (v.unit.boss) {
          this.shake(8);
          audio.sfx('boss_roar', { volume: 0.6 });
        }
        audio.sfx('cast', { volume: 0.5 });
        if (!this.texts) break;
        this.texts.spawn(v.x, v.y + v.headY - 20, e.name.toUpperCase(), 'label', { size: 15 });
        break;
      }
      case 'damage': {
        const v = this.viewOf(e.id);
        if (!v) break;
        if (e.dot) {
          if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `${e.amount}`, (e.dot === 'tribulation' ? 'tribulation' : e.dot) as NumberKind, { dot: true });
          if (e.dot === 'burn') this.fx.embers(v.x, v.y, STATUS_COLORS.burn, 3);
          if (e.dot === 'poison') this.fx.burst(v.x, v.y - 50, STATUS_COLORS.poison, { count: 3, speed: 30, size: 10, life: 0.5 });
          if (e.dot === 'tribulation') {
            this.fx.strike(v.x, v.y, 0xfff27a);
            this.shake(3);
          }
          if (e.hp <= 0) {
            /* death event follows */
          }
          break;
        }
        v.hurtAnim(e.crit);
        const kind: NumberKind = e.crit ? 'crit' : e.absorbed >= e.amount ? 'shield' : e.kind === 'true' ? 'true' : e.kind === 'magic' ? 'magic' : 'physical';
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, e.crit ? `${e.amount}!` : `${e.amount}`, kind, { crit: e.crit });
        this.fx.burst(v.x, v.y + v.chestY, e.crit ? 0xffd84a : e.kind === 'magic' ? 0xb57cff : 0xffffff, { count: e.crit ? 14 : 6, speed: e.crit ? 140 : 70, size: e.crit ? 20 : 12, life: 0.4 });
        if (e.absorbed > 0) this.fx.ring(v.x, v.y + v.chestY, 0xbfe4ff, 50, 2, 0.3, 1);
        if (e.crit) {
          this.shake(v.unit.boss ? 10 : 5);
          audio.sfx('hit_crit', { volume: 0.7 });
        } else audio.sfx('hit_melee', { volume: 0.4 });
        break;
      }
      case 'heal': {
        const v = this.viewOf(e.id);
        if (!v || e.amount <= 0) break;
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `+${e.amount}`, 'heal');
        this.fx.burst(v.x, v.y - 50, 0x8dff9a, { count: 6, speed: 40, size: 12, life: 0.6, gravity: -40 });
        audio.sfx('heal', { volume: 0.35, throttleMs: 300 });
        break;
      }
      case 'shield': {
        const v = this.viewOf(e.id);
        if (!v) break;
        if (showNumbers) this.texts.spawn(v.x, v.y + v.headY, `+${e.amount}`, 'shield', { size: 20 });
        this.fx.ring(v.x, v.y + v.chestY, 0xbfe4ff, 70, 3, 0.5, 1);
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
            audio.sfx('fire', { volume: 0.4, throttleMs: 400 });
            break;
          case 'frost':
            this.fx.burst(v.x, v.y - 50, color, { count: 8, speed: 60, size: 12, life: 0.5 });
            audio.sfx('frost', { volume: 0.3, throttleMs: 600 });
            break;
          case 'poison':
            this.fx.burst(v.x, v.y - 50, color, { count: 6, speed: 40, size: 14, life: 0.6, gravity: -30 });
            audio.sfx('poison', { volume: 0.3, throttleMs: 500 });
            break;
          case 'stun':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, 'STUN', 'label', { size: 14 });
            this.fx.burst(v.x, v.y + v.headY, 0xfff27a, { count: 6, speed: 50, size: 10, life: 0.5 });
            break;
          case 'taunt':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, 'TAUNTED', 'label', { size: 14 });
            break;
          case 'sunder':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, `-${e.stacks} DEF`, 'label', { size: 13 });
            break;
          case 'weaken':
            if (showNumbers) this.texts.spawn(v.x, v.y + v.headY - 10, `WEAKENED`, 'label', { size: 13 });
            break;
          default:
            break;
        }
        break;
      }
      case 'cleanse': {
        const v = this.viewOf(e.id);
        if (v) this.fx.ring(v.x, v.y + v.chestY, 0xffffff, 60, 2, 0.4, 1);
        break;
      }
      case 'death': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.dieAnim();
        this.fx.burst(v.x, v.y + v.chestY, v.unit.side === 'ally' ? 0x9fd5ff : 0x8a3a3a, { count: 16, speed: 110, size: 18, life: 0.7, gravity: 30 });
        audio.sfx('death', { volume: 0.5 });
        if (v.unit.boss) this.shake(14);
        break;
      }
      case 'revive': {
        const v = this.viewOf(e.id);
        if (!v) break;
        v.reviveAnim();
        this.fx.pillar(v.x, v.y, 0xff8a3c, 260, 0.8);
        this.texts.spawn(v.x, v.y + v.headY - 20, 'REBORN', 'label', { size: 20 });
        break;
      }
      case 'buff': {
        const v = this.viewOf(e.id);
        if (!v || !showNumbers) break;
        const label = e.label ?? `${e.flat ? (e.flat > 0 ? '+' : '') + e.flat : (e.pct > 0 ? '+' : '') + e.pct + '%'} ${STAT_SHORT[e.stat] ?? e.stat}`;
        this.texts.spawn(v.x, v.y + v.headY - 24, label, 'buff', { size: 14 });
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
          this.fx.ring(v.x, v.y, 0xffb86b, 90, 3, 0.6, HEX_SQUASH);
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
          audio.sfx('tribulation', { volume: 0.7 });
        }
        break;
      }
      case 'stones': {
        const v = this.viewOf(e.sourceId);
        if (v) this.texts.spawn(v.x, v.y + v.headY - 30, `+${e.amount} ◆`, 'stones', { size: 18 });
        audio.sfx('stones', { volume: 0.5 });
        break;
      }
      case 'qi':
        break;
      case 'end': {
        audio.sfx(e.winner === 'ally' ? 'victory' : 'defeat', { volume: 0.7 });
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
    switch (key) {
      case 'lightning':
      case 'lightning_arc':
      case 'thunder_call':
        this.fx.strike(p.x, p.y + chest, 0xfff27a);
        audio.sfx('lightning', { volume: 0.5, throttleMs: 120 });
        this.shake(3);
        break;
      case 'sword_slash':
      case 'fire_slash':
      case 'shadow_slash':
      case 'spear_line':
      case 'arrow_pierce':
      case 'sword_shard':
      case 'claw': {
        const color = key === 'fire_slash' ? 0xff8a3c : key === 'shadow_slash' ? 0xb57cff : key === 'claw' ? 0xffd27f : 0xe8f1ff;
        this.fx.slash(p.x, p.y + chest, facing, color, key === 'claw' ? 50 : 70);
        break;
      }
      case 'impact':
        this.fx.burst(p.x, p.y + chest, 0xffffff, { count: 10, speed: 120, size: 16, life: 0.4 });
        this.shake(3);
        break;
      case 'fist_flurry':
        this.fx.burst(p.x, p.y + chest, 0xffd27f, { count: 6, speed: 80, size: 12, life: 0.3 });
        break;
      case 'heal_bloom':
      case 'sutra':
        this.fx.pillar(p.x, p.y, 0x8dff9a, 180, 0.6);
        break;
      case 'shield_pop':
      case 'stone_aura':
      case 'obsidian':
        this.fx.ring(p.x, p.y + chest, key === 'obsidian' ? 0x9a8ad0 : 0xbfe4ff, 80, 4, 0.5, 1);
        break;
      case 'lotus_fire':
      case 'lotus_bloom':
      case 'phoenix_strike':
      case 'ghost_fire':
        this.fx.embers(p.x, p.y, key === 'ghost_fire' ? 0x7ff0e1 : 0xff8a3c, 14);
        this.fx.ring(p.x, p.y, key === 'ghost_fire' ? 0x7ff0e1 : 0xff6b3c, 70, 3, 0.6, HEX_SQUASH);
        audio.sfx('fire', { volume: 0.5, throttleMs: 200 });
        break;
      case 'frost_array':
      case 'frost_burst':
      case 'freeze':
      case 'water_burst':
      case 'tidal_breath':
        this.fx.burst(p.x, p.y + chest, 0xa8e4ff, { count: 14, speed: 110, size: 16, life: 0.6 });
        this.fx.ring(p.x, p.y, 0xa8e4ff, 90, 3, 0.6, HEX_SQUASH);
        audio.sfx('frost', { volume: 0.4, throttleMs: 200 });
        break;
      case 'shadow_blink':
        this.fx.burst(p.x, p.y + chest, 0xb57cff, { count: 14, speed: 100, size: 16, life: 0.5 });
        break;
      case 'tiger_roar':
      case 'tiger_form':
        this.fx.ring(p.x, p.y, 0xffb347, 140, 5, 0.7, HEX_SQUASH);
        this.shake(6);
        audio.sfx('boss_roar', { volume: 0.4 });
        break;
      case 'moon_pulse':
        this.fx.ring(p.x, p.y, 0xc9d8ff, 220, 4, 0.9, HEX_SQUASH);
        this.fx.flash(p.x, p.y + chest, 0xc9d8ff, 200, 0.5);
        break;
      case 'cinnabar_smoke':
      case 'poison_puff':
        this.fx.burst(p.x, p.y + chest, 0x9fe85a, { count: 16, speed: 90, size: 22, life: 0.8, gravity: -30 });
        break;
      case 'phoenix_rebirth':
        this.fx.pillar(p.x, p.y, 0xff8a3c, 300, 1);
        this.fx.burst(p.x, p.y + chest, 0xffb347, { count: 24, speed: 160, size: 20, life: 0.9 });
        this.shake(6);
        break;
      case 'enrage':
        this.fx.flash(p.x, p.y + chest, 0xff2e4d, 260, 0.6);
        this.fx.ring(p.x, p.y, 0xff2e4d, 150, 5, 0.7, HEX_SQUASH);
        this.shake(8);
        break;
      case 'summon':
        this.fx.pillar(p.x, p.y, 0xb57cff, 200, 0.7);
        break;
      case 'gale_thrust':
      case 'spear_sweep':
        this.fx.slash(p.x, p.y + chest, facing, 0x5ad6a5, 80);
        break;
      case 'sun_arrow':
        this.fx.flash(p.x, p.y + chest, 0xffe9a0, 140, 0.3);
        break;
      case 'flying_sword':
        this.fx.flash(p.x, p.y + chest, 0x9fe0ff, 120, 0.3);
        break;
      case 'tail_sweep':
        this.fx.slash(p.x, p.y + chest, facing, 0x4fc3c7, 120);
        this.shake(6);
        break;
      case 'blood_nova':
      case 'blood_burst':
        this.fx.burst(p.x, p.y + chest, 0xff2e4d, { count: 18, speed: 140, size: 20, life: 0.7 });
        this.fx.ring(p.x, p.y, 0xff2e4d, 200, 5, 0.8, HEX_SQUASH);
        this.shake(8);
        break;
      default:
        this.fx.flash(p.x, p.y + chest, 0xffffff, 100, 0.3);
    }
  }

  /** Design-space position of a unit's head (for DOM overlays). */
  unitScreenPos(id: number): { x: number; y: number } | null {
    const v = this.viewOf(id);
    if (!v) return null;
    return { x: v.x + this.boardOrigin.x, y: v.y + this.boardOrigin.y };
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
