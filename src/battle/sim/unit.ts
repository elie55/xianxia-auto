import type { AbilityDef, ClassId, EffectDef, Hex, Rank, Scale, Side, SpriteLook, StatKey, Stats } from '@/core/types';
import { STAT_KEYS } from '@/core/types';

export interface StatMod {
  stat: StatKey;
  flat: number;
  pct: number;
  expiresAt?: number;
  untilSurgeEnd?: string; // effect id of the surge window
  unique?: string;
  source: string;
}

export interface ShieldInstance {
  amount: number;
  until: number; // Infinity = lasting
}

export interface BurnInstance {
  dps: number;
  until: number;
  sourceId: number;
}

export interface UnitTracker {
  damageDealt: number;
  damageTaken: number;
  healing: number;
  shielding: number;
  crits: number;
  kills: number;
  casts: number;
  bestHit: number;
}

export interface UnitInit {
  id: number;
  side: Side;
  defId: string;
  name: string;
  hanzi?: string;
  classes: ClassId[];
  rank: Rank;
  stats: Stats;
  attackInterval?: number;
  attackScale?: Scale;
  ability?: AbilityDef;
  effects?: EffectDef[];
  pos: Hex | null;
  onBoard: boolean;
  targeting?: 'nearest' | 'lowestHp' | 'farthest' | 'random';
  heroUid?: string;
  companion?: string;
  /** Disciple mastery II: the arena draws this disciple's aura in gold. */
  masteryAura?: boolean;
  /** Disciple mastery V: it fights with its permanent passive (named in the arena tooltip). */
  masteryPassive?: boolean;
  sprite: string;
  scale?: number;
  projectile?: string;
  accent?: string;
  boss?: boolean;
  elite?: boolean;
  /** Visual-only: the unit hovers instead of standing. */
  flying?: boolean;
  /** Visual-only: recolour of a variant that reuses another foe's sprite. */
  look?: SpriteLook;
  /** Visual-only: portrait key for the tracker. */
  portrait?: string;
  /** Item slot count for "items per rank" difficulty, informational. */
  isSummon?: boolean;
  /** A Reflection (the `clone` action): the unit it copies, which its damage and kills count for. */
  ownerId?: number;
  /** Battle time at which a Reflection fades. */
  expiresAt?: number;
  /** Non-stat tunables set by items/upgrades. */
  extras?: Partial<Record<'surgeBonus' | 'enlightenmentBonus' | 'shatterPct' | 'burnHealPct' | 'companionMult' | 'permafrost', number>>;
}

export class Unit {
  readonly id: number;
  readonly side: Side;
  readonly defId: string;
  readonly name: string;
  readonly hanzi?: string;
  readonly classes: ClassId[];
  readonly rank: Rank;
  readonly heroUid?: string;
  readonly companion?: string;
  readonly sprite: string;
  readonly look?: SpriteLook;
  readonly visualScale: number;
  readonly projectile?: string;
  readonly accent?: string;
  readonly boss: boolean;
  readonly elite: boolean;
  readonly flying: boolean;
  readonly portrait?: string;
  readonly isSummon: boolean;
  /** Set on a Reflection (the `clone` action): the id of the unit it copies. */
  readonly ownerId: number | null;
  /** When a Reflection fades (Infinity for every other unit). */
  readonly expiresAt: number;
  readonly targeting: 'nearest' | 'lowestHp' | 'farthest' | 'random';
  readonly attackInterval: number;
  readonly attackScale: Scale;
  ability?: AbilityDef;
  effectDefs: EffectDef[];

  /** Pre-combat stats (after items, insights, relics). */
  readonly base: Stats;
  private mods: StatMod[] = [];
  private cache: Stats;
  private dirty = true;

  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  shields: ShieldInstance[] = [];

  pos: Hex | null;
  onBoard: boolean;
  alive = true;
  deathTime = -1;
  revived = false;

  targetId: number | null = null;
  attackCooldown = 0;
  castUntil = 0;
  moving: { from: Hex; to: Hex; start: number; end: number } | null = null;
  facing: 1 | -1;

  // statuses
  burns: BurnInstance[] = [];
  bleeds: BurnInstance[] = [];
  /** Talisman seals waiting to explode on this unit (Wen Yan's delayed talismans, the `delay` action's `mark`). */
  seals: { until: number; sourceId: number }[] = [];
  poison = 0;
  poisonSourceId = -1;
  frost = 0;
  frostUntil = 0;
  permafrost = false;
  stunUntil = 0;
  frozenUntil = 0;
  tauntTargetId: number | null = null;
  tauntUntil = 0;
  dotAccumulator = 0;

  counters: Record<string, number> = {};
  tracker: UnitTracker = {
    damageDealt: 0,
    damageTaken: 0,
    healing: 0,
    shielding: 0,
    crits: 0,
    kills: 0,
    casts: 0,
    bestHit: 0,
  };

  /** Extra seconds added to Surge windows / subtracted from Enlightenment timers. */
  surgeBonus = 0;
  enlightenmentBonus = 0;
  /** Frozen enemies take +X% damage (Shatter). */
  shatterPct = 0;
  /** Burn applied by this unit heals allies for this % (Lotus Heart). */
  burnHealPct = 0;
  /** Dao Companion scaling multiplier. */
  companionMult = 1;
  /** Healing this unit gives is +X% stronger (Hundred Herbs Valley doctrine). */
  healPct = 0;
  /** Its first auto attack of the fight is a Crit (Shadow Pavilion doctrine); cleared once it lands. */
  firstHitCrit = false;
  /** Disciple mastery II: drawn with a golden aura. */
  masteryAura = false;
  /** Disciple mastery V: carries its permanent passive. */
  masteryPassive = false;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.side = init.side;
    this.defId = init.defId;
    this.name = init.name;
    this.hanzi = init.hanzi;
    this.classes = init.classes.slice();
    this.rank = init.rank;
    this.heroUid = init.heroUid;
    this.companion = init.companion;
    this.sprite = init.sprite;
    this.look = init.look;
    this.visualScale = init.scale ?? 1;
    this.projectile = init.projectile;
    this.accent = init.accent;
    this.boss = !!init.boss;
    this.elite = !!init.elite;
    this.flying = !!init.flying;
    this.masteryAura = !!init.masteryAura;
    this.masteryPassive = !!init.masteryPassive;
    this.portrait = init.portrait;
    this.isSummon = !!init.isSummon;
    this.ownerId = init.ownerId ?? null;
    this.expiresAt = init.expiresAt ?? Infinity;
    this.targeting = init.targeting ?? (init.classes.includes('shadow') ? 'lowestHp' : 'nearest');
    this.attackInterval = init.attackInterval ?? 1.0;
    this.attackScale = init.attackScale ?? { attack: 1 };
    this.ability = init.ability;
    this.effectDefs = (init.effects ?? []).slice();
    this.base = { ...init.stats };
    if (this.base.moveSpeed <= 0) this.base.moveSpeed = 2.2;
    if (this.base.range <= 0) this.base.range = 1;
    this.cache = { ...this.base };
    this.maxHp = Math.max(1, Math.round(this.base.hp));
    this.hp = this.maxHp;
    this.maxQi = init.ability ? init.ability.qiCost : 0;
    this.qi = Math.min(this.maxQi, Math.max(0, this.base.qi));
    this.pos = init.pos;
    this.onBoard = init.onBoard;
    this.facing = init.side === 'ally' ? 1 : -1;
    if (init.extras) {
      this.surgeBonus = init.extras.surgeBonus ?? 0;
      this.enlightenmentBonus = init.extras.enlightenmentBonus ?? 0;
      this.shatterPct = init.extras.shatterPct ?? 0;
      this.burnHealPct = init.extras.burnHealPct ?? 0;
      this.companionMult = init.extras.companionMult ?? 1;
      this.permafrost = !!init.extras.permafrost;
    }
  }

  // ───────────────────────── stats ─────────────────────────

  private recompute(): void {
    const flat: Partial<Record<StatKey, number>> = {};
    const pct: Partial<Record<StatKey, number>> = {};
    for (const m of this.mods) {
      flat[m.stat] = (flat[m.stat] ?? 0) + m.flat;
      pct[m.stat] = (pct[m.stat] ?? 0) + m.pct;
    }
    const prevMax = this.maxHp;
    for (const k of STAT_KEYS) {
      const v = (this.base[k] + (flat[k] ?? 0)) * (1 + (pct[k] ?? 0) / 100);
      this.cache[k] = v;
    }
    // clamp some stats
    if (this.cache.attackSpeed < -90) this.cache.attackSpeed = -90;
    if (this.cache.defense < 0) this.cache.defense = 0;
    if (this.cache.range < 1) this.cache.range = 1;
    if (this.cache.moveSpeed < 0.3) this.cache.moveSpeed = 0.3;
    const newMax = Math.max(1, Math.round(this.cache.hp));
    if (newMax !== prevMax) {
      const delta = newMax - prevMax;
      this.maxHp = newMax;
      if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
      else this.hp = Math.min(this.hp, this.maxHp);
    }
    this.dirty = false;
  }

  stat(k: StatKey): number {
    if (this.dirty) this.recompute();
    return this.cache[k];
  }

  get attacksPerSecond(): number {
    const aps = (1 / this.attackInterval) * (1 + this.stat('attackSpeed') / 100) * (1 - Math.min(60, this.frost) / 100);
    return Math.min(5, Math.max(0.1, aps));
  }

  get moveSpeed(): number {
    return this.stat('moveSpeed') * (1 - Math.min(60, this.frost) / 100);
  }

  get range(): number {
    return Math.max(1, Math.round(this.stat('range')));
  }

  get isRanged(): boolean {
    return this.range >= 2;
  }

  get shield(): number {
    let s = 0;
    for (const sh of this.shields) s += sh.amount;
    return s;
  }

  get hpPct(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  hasClass(c: ClassId): boolean {
    return this.classes.includes(c);
  }

  addClass(c: ClassId): void {
    if (!this.classes.includes(c)) this.classes.push(c);
  }

  /** True while a modifier with this unique id is active (the HUD reads it, e.g. a boss's enrage). */
  hasMod(unique: string): boolean {
    return this.mods.some((m) => m.unique === unique);
  }

  addMod(mod: StatMod): boolean {
    if (mod.unique) {
      const existing = this.mods.find((m) => m.unique === mod.unique);
      if (existing) {
        existing.flat = mod.flat;
        existing.pct = mod.pct;
        existing.expiresAt = mod.expiresAt;
        this.dirty = true;
        return false;
      }
    }
    this.mods.push(mod);
    this.dirty = true;
    return true;
  }

  countMods(source: string): number {
    let n = 0;
    for (const m of this.mods) if (m.source === source) n++;
    return n;
  }

  removeModsWhere(pred: (m: StatMod) => boolean): number {
    const before = this.mods.length;
    this.mods = this.mods.filter((m) => !pred(m));
    if (this.mods.length !== before) this.dirty = true;
    return before - this.mods.length;
  }

  expire(now: number): void {
    const before = this.mods.length;
    this.mods = this.mods.filter((m) => m.expiresAt === undefined || m.expiresAt > now);
    if (this.mods.length !== before) this.dirty = true;
    if (this.shields.length) this.shields = this.shields.filter((s) => s.until > now && s.amount > 0.5);
    if (this.burns.length) this.burns = this.burns.filter((b) => b.until > now);
    if (this.bleeds.length) this.bleeds = this.bleeds.filter((b) => b.until > now);
    if (this.frost > 0 && !this.permafrost && now >= this.frostUntil) this.frost = 0;
    if (this.tauntTargetId !== null && now >= this.tauntUntil) this.tauntTargetId = null;
  }

  get isStunned(): boolean {
    return this.stunUntil > 0 || this.frozenUntil > 0;
  }

  isDisabled(now: number): boolean {
    return now < this.stunUntil || now < this.frozenUntil;
  }

  /** Remove `amount` from shields; returns absorbed amount. */
  absorb(amount: number): number {
    if (this.shields.length === 0) return 0;
    this.shields.sort((a, b) => a.until - b.until);
    let left = amount;
    for (const sh of this.shields) {
      if (left <= 0) break;
      const take = Math.min(sh.amount, left);
      sh.amount -= take;
      left -= take;
    }
    this.shields = this.shields.filter((s) => s.amount > 0.5);
    return amount - left;
  }

  addCounter(key: string, n: number): number {
    this.counters[key] = (this.counters[key] ?? 0) + n;
    return this.counters[key];
  }

  counter(key: string): number {
    return this.counters[key] ?? 0;
  }

  snapshotStats(): Stats {
    if (this.dirty) this.recompute();
    return { ...this.cache };
  }
}
