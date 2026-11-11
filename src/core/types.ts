/**
 * Shared data model for Nine Heavens.
 * Content (heroes, items, relics, enemies) is pure data built from these types;
 * the battle simulation interprets EffectDef / ActionDef at runtime.
 */

export type ClassId = 'sword' | 'body' | 'talisman' | 'alchemist' | 'shadow' | 'martial' | 'array';

/** 0 = Qi Condensation (C), 1 = Foundation (B), 2 = Golden Core (A), 3 = Nascent Soul (S) */
export type Rank = 0 | 1 | 2 | 3;

export type StatKey =
  | 'hp'
  | 'qi'
  | 'attack'
  | 'attackSpeed'
  | 'spirit'
  | 'crit'
  | 'defense'
  | 'range'
  | 'qiRegen'
  | 'omnivamp'
  | 'moveSpeed';

export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = [
  'hp',
  'qi',
  'attack',
  'attackSpeed',
  'spirit',
  'crit',
  'defense',
  'range',
  'qiRegen',
  'omnivamp',
  'moveSpeed',
];

export type Side = 'ally' | 'enemy';
export type DamageKind = 'physical' | 'magic' | 'true';
export type Rarity = 'common' | 'rare' | 'epic' | 'unique';
export type Keyword =
  | 'Surge'
  | 'Enlightenment'
  | 'Meditation'
  | 'Companion'
  | 'Crit'
  | 'Shield'
  | 'Burn'
  | 'Poison'
  | 'Frost'
  | 'Lightning'
  | 'Taunt'
  | 'Omnivamp'
  | 'Heal'
  | 'Execute'
  | 'Qi'
  /** Zhong Ming's stored damage (the `resonance` counter). */
  | 'Resonance'
  /** Wen Yan's delayed talismans (the `delay` action's seal mark). */
  | 'Seal';

export type StatusKind = 'burn' | 'poison' | 'frost' | 'stun' | 'taunt' | 'bleed' | 'weaken' | 'sunder';

/** Multiplicative scaling expression evaluated against the SOURCE unit (ratios, e.g. spirit: 0.4 = 40% Spirit). */
export interface Scale {
  base?: number;
  attack?: number;
  spirit?: number;
  maxHp?: number;
  missingHp?: number;
  shield?: number;
  defense?: number;
  crit?: number;
  attackSpeed?: number;
  maxQi?: number;
  /** Multiplied by the unit's rank (0..3). */
  perRank?: number;
  /** Multiplied by a named counter on the unit (e.g. casts, stacks). */
  counter?: { key: string; mult: number };
  /** Target's max HP ratio (for % max HP damage). */
  targetMaxHp?: number;
  /** Ratio of the triggering amount (damage dealt / heal / shield) when fired by a trigger. */
  triggerAmount?: number;
  /** Ratio of current (not max) HP. */
  currentHp?: number;
}

export type TargetKind =
  | 'self'
  | 'target'
  | 'triggerTarget'
  | 'nearestEnemy'
  | 'lowestHpEnemy'
  | 'highestHpEnemy'
  | 'randomEnemy'
  | 'farthestEnemy'
  | 'allEnemies'
  | 'nearestEnemies'
  | 'enemiesAroundTarget'
  | 'enemiesAdjacent'
  | 'lineThroughTarget'
  | 'lowestHpAlly'
  | 'randomAlly'
  | 'allAllies'
  | 'otherAllies'
  | 'alliesAdjacent'
  | 'frontAllies'
  | 'backAllies'
  | 'allUnits';

export type TargetSel = TargetKind | { kind: TargetKind; count?: number; radius?: number; includeSelf?: boolean };

export type TriggerDef =
  | { on: 'combatStart' }
  | { on: 'surge'; duration: number }
  | { on: 'enlightenment'; at: number }
  | { on: 'interval'; every: number; after?: number }
  | { on: 'autoAttack' }
  | { on: 'hit' }
  | { on: 'crit' }
  | { on: 'cast' }
  | { on: 'kill' }
  | { on: 'damaged' }
  | { on: 'shieldGained' }
  | { on: 'allyDied' }
  | { on: 'death' }
  | { on: 'healed' }
  | { on: 'statusApplied'; status: StatusKind }
  | { on: 'hpBelow'; pct: number }
  | { on: 'surgeEnd' }
  | { on: 'stonesEarned' }
  | { on: 'passive' };

export type ConditionDef =
  | { if: 'shielded' }
  | { if: 'notShielded' }
  | { if: 'chance'; pct: number }
  | { if: 'targetHpBelow'; pct: number }
  | { if: 'targetHpAbove'; pct: number }
  | { if: 'selfHpBelow'; pct: number }
  | { if: 'hasClass'; class: ClassId }
  | { if: 'targetHasStatus'; status: StatusKind }
  | { if: 'frontRow' }
  | { if: 'backRow' }
  | { if: 'companionPresent' }
  | { if: 'isMelee' }
  | { if: 'isRanged' }
  | { if: 'triggerWasCrit' }
  | { if: 'triggerWasAbility' }
  | { if: 'counterAtLeast'; key: string; value: number };

export type ActionDef =
  | {
      do: 'buff';
      stat: StatKey;
      flat?: number;
      pct?: number;
      scale?: Scale;
      duration?: number;
      target?: TargetSel;
      /** when true, the buff is tied to the Surge window and removed when it ends */
      untilSurgeEnd?: boolean;
      /** cap on how many times this exact buff can stack per unit */
      maxStacks?: number;
      /** tag so a single-instance buff refreshes instead of stacking */
      unique?: string;
    }
  | {
      do: 'damage';
      target: TargetSel;
      scale: Scale;
      kind?: DamageKind;
      canCrit?: boolean;
      /** counts as an auto-attack (triggers autoAttack/hit effects, grants Qi) */
      asAttack?: boolean;
      vfx?: string;
      /** visual projectile key; delays the hit by travel time */
      projectile?: string;
    }
  | { do: 'heal'; target: TargetSel; scale: Scale; cleanse?: boolean; vfx?: string }
  | { do: 'shield'; target: TargetSel; scale: Scale; lasting?: boolean; duration?: number; vfx?: string }
  | {
      do: 'status';
      target: TargetSel;
      status: StatusKind;
      stacks?: number;
      /** for burn/bleed: damage per second */
      scale?: Scale;
      duration?: number;
    }
  | { do: 'cleanse'; target: TargetSel }
  | { do: 'qi'; target: TargetSel; amount: number; pctMax?: number }
  | { do: 'revive'; pct: number }
  | { do: 'blink'; target: TargetSel }
  | { do: 'repeat'; times: number; interval: number; actions: ActionDef[] }
  /**
   * Actions that run `seconds` later, once for each target picked now, with that target as `target` (Wen Yan's
   * talismans). `mark: 'seal'` shows a talisman seal on the target meanwhile. If the target dies first, nothing happens.
   */
  | { do: 'delay'; seconds: number; target?: TargetSel; mark?: 'seal'; actions: ActionDef[] }
  | { do: 'convertStat'; from: StatKey; to: StatKey; ratio: number }
  /**
   * A named counter on the unit: `add` a fixed amount, plus `scale` (e.g. a share of the triggering damage), or `set`
   * it outright (Zhong Ming's Resonance stores damage taken, and her technique releases it and sets it back to 0).
   */
  | { do: 'counter'; key: string; add?: number; scale?: Scale; set?: number; target?: TargetSel }
  | { do: 'stones'; amount: number }
  | { do: 'permanentBuff'; stat: StatKey; flat?: number; pct?: number; target?: TargetSel }
  | { do: 'summon'; enemyId: string; count: number }
  | { do: 'vfx'; key: string; target?: TargetSel }
  | { do: 'custom'; id: string; params?: Record<string, number | string> };

export interface EffectDef {
  id: string;
  name?: string;
  /** Rich description. Keywords inside [brackets] are colorized by the UI. */
  desc: string;
  trigger: TriggerDef;
  actions: ActionDef[];
  conditions?: ConditionDef[];
  /** Works from the reserve (Backup). */
  meditation?: boolean;
  /** Fires at most once per combat. */
  once?: boolean;
  /** Seconds between activations. */
  cooldown?: number;
  /** For team-scope effects (relics): which units receive the effect. */
  scope?: 'self' | 'team' | 'class' | 'enemies';
  class?: ClassId;
  keywords?: Keyword[];
}

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  /** Qi needed to cast (also max Qi for the unit unless overridden). */
  qiCost: number;
  castTime?: number;
  actions: ActionDef[];
  animation?: 'attack' | 'cast';
  vfx?: string;
  keywords?: Keyword[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  /** Grants a second class. */
  addClass?: ClassId;
  stats?: Partial<Stats>;
  statsPct?: Partial<Stats>;
  effects?: EffectDef[];
  /** Replaces or augments the active ability. */
  ability?: Partial<AbilityDef> & { extraActions?: ActionDef[] };
  /** For Insights: class pool this belongs to. */
  classPool?: ClassId;
  keywords?: Keyword[];
  icon?: string;
}

export interface HeroDef {
  id: string;
  name: string;
  hanzi: string;
  title: string;
  classes: ClassId[];
  baseStats: Partial<Stats>;
  /** Seconds between auto-attacks at 0 Attack Speed. */
  attackInterval?: number;
  ability: AbilityDef;
  passives?: EffectDef[];
  daoPaths: UpgradeDef[];
  companion?: string;
  tags: Keyword[];
  /** Short flavour line for the card back. */
  lore: string;
  /** Asset keys. */
  portrait: string;
  sprite: string;
  accent: string;
  projectile?: string;
  /** Sprite scale multiplier in the arena. */
  scale?: number;
  /**
   * An exclusive disciple (docs/META_PROGRESSION.md, section 7): never in a run's draft or shop until the sect has
   * recruited them in the Recruitment Hall (src/meta/sect.ts RECRUITS).
   */
  exclusive?: boolean;
}

export interface QuestDef {
  id: string;
  desc: string;
  type:
    | 'crits'
    | 'wins'
    | 'kills'
    | 'casts'
    | 'frost'
    | 'burn'
    | 'poison'
    | 'shield'
    | 'heal'
    | 'surge'
    | 'enlightenment'
    | 'stones'
    | 'damage';
  goal: number;
  reward: ActionDef[];
  rewardDesc: string;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  icon: string;
  desc?: string;
  stats?: Partial<Stats>;
  effects?: EffectDef[];
  quest?: QuestDef;
  price?: number;
  keywords?: Keyword[];
  /** Heirloom Treasures are crafted in the sect's Artifact Forge and brought into a run (recipe id, src/content/heirlooms.ts). */
  heirloom?: string;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  icon: string;
  desc: string;
  /** Team-wide stat bonus with optional filters. */
  teamStats?: { class?: ClassId; row?: 'front' | 'back'; stats?: Partial<Stats>; statsPct?: Partial<Stats> };
  /** Effects applied to each unit in scope. */
  effects?: EffectDef[];
  quest?: QuestDef;
  /** Run-level modifiers. */
  run?: {
    partySize?: number;
    reserveSize?: number;
    stonesPerFight?: number;
    rerollDiscount?: number;
    shopItems?: number;
    shopRelics?: number;
    itemSlots?: number;
    shopDiscountPct?: number;
  };
  price?: number;
  keywords?: Keyword[];
  /** Appears only in the team-size section of the shop. */
  teamSize?: boolean;
  /** Locked until this Scripture Pavilion study is researched (src/meta/sect.ts); never offered before. */
  research?: string;
}

/** A recolour applied to a sprite: hue rotation in degrees, saturation and brightness as factors (1 = unchanged). */
export interface SpriteLook {
  hue?: number;
  saturate?: number;
  brightness?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hanzi?: string;
  baseStats: Partial<Stats>;
  attackInterval?: number;
  ability?: AbilityDef;
  passives?: EffectDef[];
  sprite: string;
  scale?: number;
  boss?: boolean;
  elite?: boolean;
  /** Hovers above the ground (bats, lanterns, dragons): anchored to its idle pose and bobbing. */
  flying?: boolean;
  targeting?: 'nearest' | 'lowestHp' | 'farthest' | 'random';
  projectile?: string;
  /** Power budget cost used by the encounter generator. */
  cost: number;
  realm: 1 | 2 | 'any';
  /** The contract battlefield this foe belongs to (src/content/themes.ts). Unset: the Mortal realms and the Ladder. */
  theme?: string;
  /** Recolour of a variant that reuses another foe's sprite. */
  look?: SpriteLook;
  accent?: string;
  classes?: ClassId[];
  /** Stones dropped (bonus). */
  bounty?: number;
}

export interface Hex {
  q: number;
  r: number;
}

export type NodeKind = 'fight' | 'elite' | 'boss' | 'event' | 'challenge' | 'trial' | 'rest';

export interface NodeDef {
  kind: NodeKind;
  index: number;
  /** Optional fixed event id. */
  eventId?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  desc: string;
  /** Cost in stones, if any. */
  cost?: number;
  /** Requires a hero selection. */
  needsHero?: boolean;
  /** Disabled when false. */
  available?: (ctx: EventContext) => boolean;
  /** Resolves the choice. */
  resolve: (ctx: EventContext, heroUid?: string) => EventOutcome;
}

export interface EventOutcome {
  text: string;
  /** If present, the event leads straight into a fight with this special encounter. */
  fight?: { encounterId: string; reward?: ActionDef[]; rewardDesc?: string; single?: boolean };
  /** Chooser payloads for follow-up UI. */
  pickItem?: ItemDef[];
  pickRelic?: RelicDef[];
  stonesDelta?: number;
}

export interface EventContext {
  stones: number;
  partyCount: number;
  rosterCount: number;
  realm: number;
  rng: { next(): number; chance(p: number): boolean; pick<T>(a: readonly T[]): T; pickN<T>(a: readonly T[], n: number): T[] };
  /** Mutators exposed to events. */
  addStones: (n: number) => void;
  addItemToInventory: (item: ItemDef) => void;
  addRelic: (relic: RelicDef) => void;
  permanentHeroBuff: (heroUid: string, stat: StatKey, flat?: number, pct?: number) => void;
  rankUpHero: (heroUid: string) => void;
  heroes: { uid: string; name: string; rank: Rank; classes: ClassId[] }[];
  rollItems: (count: number, rarity?: Rarity) => ItemDef[];
  rollRelics: (count: number, rarity?: Rarity) => RelicDef[];
}

export interface EventDef {
  id: string;
  title: string;
  hanzi?: string;
  text: string;
  art: string;
  choices: EventChoice[];
  /** Appears only at this node kind. */
  only?: NodeKind;
  realm?: 1 | 2 | 'any';
  weight?: number;
}

export interface DifficultyDef {
  tier: number;
  name: string;
  short: string;
  hanzi: string;
  desc: string;
  /** Modifier applied to the run (stacks with lower tiers). */
  mod: {
    startCombatHpLossPct?: number;
    enemyHpPct?: number;
    stonesPerSurvivorDelta?: number;
    itemSlotsPerRank?: boolean;
    enemyDamagePct?: number;
    shopPricePct?: number;
    tribulationAt?: number;
    bossExtraAbility?: boolean;
  };
}

export interface BlessingDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  apply: 'quality' | 'stability' | 'bazaar' | 'wealth' | 'scholar' | 'warrior' | 'spoils' | 'armory' | 'vitality' | 'swift' | 'insight' | 'ascendant';
  /** Taught by the Training Grounds at this level (src/meta/sect.ts); the six launch blessings have none. */
  training?: number;
}

export const RANK_NAMES: Record<Rank, { name: string; short: string; hanzi: string }> = {
  0: { name: 'Qi Condensation', short: 'C', hanzi: '炼' },
  1: { name: 'Foundation', short: 'B', hanzi: '筑' },
  2: { name: 'Golden Core', short: 'A', hanzi: '丹' },
  3: { name: 'Nascent Soul', short: 'S', hanzi: '婴' },
};

export const HERO_PRICE_BY_RANK: Record<Rank, number> = { 0: 15, 1: 25, 2: 35, 3: 50 };

export const ITEM_PRICE_BY_RARITY: Record<Rarity, number> = { common: 5, rare: 12, epic: 20, unique: 15 };
export const RELIC_PRICE_BY_RARITY: Record<Rarity, number> = { common: 8, rare: 15, epic: 30, unique: 20 };

export function emptyStats(): Stats {
  return {
    hp: 0,
    qi: 0,
    attack: 0,
    attackSpeed: 0,
    spirit: 0,
    crit: 0,
    defense: 0,
    range: 0,
    qiRegen: 0,
    omnivamp: 0,
    moveSpeed: 0,
  };
}

export function addStats(a: Stats, b: Partial<Stats>, mult = 1): Stats {
  for (const k of STAT_KEYS) {
    const v = b[k];
    if (v) a[k] += v * mult;
  }
  return a;
}
