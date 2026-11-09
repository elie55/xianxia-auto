import type { AbilityDef, ClassId, EffectDef, EnemyDef, Hex, Rank, RelicDef, StatKey, Stats, UpgradeDef } from '@/core/types';
import { STAT_KEYS, emptyStats } from '@/core/types';
import type { UnitInit } from '@/battle/sim/unit';
import { HERO_BY_ID } from '@/content/heroes';
import { CLASSES, classInsights } from '@/content/classes';
import { ITEM_BY_ID } from '@/content/items';
import { isFrontForSide } from '@/battle/sim/hex';

export interface PermanentBonus {
  stat: StatKey;
  flat: number;
  pct: number;
}

export interface HeroState {
  uid: string;
  defId: string;
  rank: Rank;
  daoPathId?: string;
  insightIds: string[];
  items: string[];
  permanent: PermanentBonus[];
  /** Combat stats from the last fight for the results screen. */
}

export interface TeamContext {
  relics: RelicDef[];
  itemSlotBonus: number;
  itemSlotsPerRank: boolean;
  warriorBlessing: boolean;
  qualityBlessing: boolean;
}

export const BASE_ITEM_SLOTS = 3;

export function heroDaoPath(h: HeroState): UpgradeDef | undefined {
  if (!h.daoPathId) return undefined;
  return HERO_BY_ID[h.defId]?.daoPaths.find((p) => p.id === h.daoPathId);
}

export function heroInsights(h: HeroState): UpgradeDef[] {
  const all = classInsights(heroClasses(h));
  const byId = new Map(all.map((i) => [i.id, i]));
  return h.insightIds.map((id) => byId.get(id)).filter((x): x is UpgradeDef => !!x);
}

export function heroClasses(h: HeroState): ClassId[] {
  const def = HERO_BY_ID[h.defId];
  const classes = def.classes.slice();
  const path = heroDaoPath(h);
  if (path?.addClass && !classes.includes(path.addClass)) classes.push(path.addClass);
  return classes;
}

export function heroItemSlots(h: HeroState, ctx: TeamContext): number {
  let slots = BASE_ITEM_SLOTS + ctx.itemSlotBonus + (ctx.qualityBlessing ? 2 : 0);
  if (ctx.itemSlotsPerRank) slots = Math.min(slots, h.rank + 1);
  return Math.max(1, Math.min(5, slots));
}

function applyUpgradeStats(flat: Stats, pct: Stats, up: UpgradeDef | undefined): void {
  if (!up) return;
  if (up.stats) for (const k of STAT_KEYS) if (up.stats[k]) flat[k] += up.stats[k]!;
  if (up.statsPct) for (const k of STAT_KEYS) if (up.statsPct[k]) pct[k] += up.statsPct[k]!;
}

/**
 * Computes a hero's pre-combat stats. `pos` is used for row-based relics.
 */
export function heroStats(h: HeroState, ctx: TeamContext, pos: Hex | null): Stats {
  const def = HERO_BY_ID[h.defId];
  const classes = heroClasses(h);
  const base = emptyStats();
  for (const k of STAT_KEYS) if (def.baseStats[k]) base[k] += def.baseStats[k]!;

  const flat = emptyStats();
  const pct = emptyStats();

  // rank growth: primary class full, extra classes half
  for (let r = 1; r <= h.rank; r++) {
    classes.forEach((c, i) => {
      const cls = CLASSES[c];
      const w = i === 0 ? 1 : 0.5;
      for (const k of STAT_KEYS) {
        if (cls.growthPct[k]) pct[k] += cls.growthPct[k]! * w;
        if (cls.growthFlat[k]) flat[k] += cls.growthFlat[k]! * w;
      }
    });
  }

  applyUpgradeStats(flat, pct, heroDaoPath(h));
  for (const ins of heroInsights(h)) applyUpgradeStats(flat, pct, ins);

  const slots = heroItemSlots(h, ctx);
  for (const itemId of h.items.slice(0, slots)) {
    const it = ITEM_BY_ID[itemId];
    if (!it?.stats) continue;
    for (const k of STAT_KEYS) if (it.stats[k]) flat[k] += it.stats[k]!;
  }

  const front = pos ? isFrontForSide(pos, 'ally') : false;
  for (const relic of ctx.relics) {
    const ts = relic.teamStats;
    if (!ts) continue;
    if (ts.class && !classes.includes(ts.class)) continue;
    if (ts.row === 'front' && !front) continue;
    if (ts.row === 'back' && front) continue;
    if (ts.stats) for (const k of STAT_KEYS) if (ts.stats[k]) flat[k] += ts.stats[k]!;
    if (ts.statsPct) for (const k of STAT_KEYS) if (ts.statsPct[k]) pct[k] += ts.statsPct[k]!;
  }

  for (const p of h.permanent) {
    flat[p.stat] += p.flat;
    pct[p.stat] += p.pct;
  }
  if (ctx.warriorBlessing) {
    pct.attack += 5;
    pct.spirit += 5;
  }

  const out = emptyStats();
  for (const k of STAT_KEYS) out[k] = (base[k] + flat[k]) * (1 + pct[k] / 100);
  out.hp = Math.round(out.hp);
  return out;
}

export function heroAbility(h: HeroState): AbilityDef {
  const def = HERO_BY_ID[h.defId];
  const path = heroDaoPath(h);
  let ab: AbilityDef = { ...def.ability, actions: def.ability.actions.slice() };
  if (path?.ability) {
    const { extraActions, ...rest } = path.ability;
    ab = { ...ab, ...rest, actions: rest.actions ? rest.actions.slice() : ab.actions };
    if (extraActions) ab.actions = ab.actions.concat(extraActions);
  }
  return ab;
}

export function heroEffects(h: HeroState, ctx: TeamContext): EffectDef[] {
  const def = HERO_BY_ID[h.defId];
  const classes = heroClasses(h);
  const out: EffectDef[] = [];
  if (def.passives) out.push(...def.passives);
  const path = heroDaoPath(h);
  if (path?.effects) out.push(...path.effects);
  for (const ins of heroInsights(h)) if (ins.effects) out.push(...ins.effects);
  const slots = heroItemSlots(h, ctx);
  for (const itemId of h.items.slice(0, slots)) {
    const it = ITEM_BY_ID[itemId];
    if (it?.effects) out.push(...it.effects);
  }
  for (const relic of ctx.relics) {
    if (!relic.effects) continue;
    for (const ef of relic.effects) {
      if (ef.scope === 'class' && ef.class && !classes.includes(ef.class)) continue;
      out.push(ef);
    }
  }
  return out;
}

export function buildHeroUnit(h: HeroState, ctx: TeamContext, id: number, pos: Hex | null, onBoard: boolean): UnitInit {
  const def = HERO_BY_ID[h.defId];
  const classes = heroClasses(h);
  const stats = heroStats(h, ctx, pos);
  return {
    id,
    side: 'ally',
    defId: h.defId,
    name: def.name,
    hanzi: def.hanzi,
    classes,
    rank: h.rank,
    stats,
    attackInterval: def.attackInterval,
    attackScale: CLASSES[classes[0]].attackScale,
    ability: heroAbility(h),
    effects: heroEffects(h, ctx),
    pos,
    onBoard,
    heroUid: h.uid,
    companion: def.companion,
    sprite: def.sprite,
    scale: def.scale,
    projectile: def.projectile,
    accent: def.accent,
    portrait: def.portrait,
  };
}

/** Enemy scaling per Tribulation Level. */
export function enemyStats(def: EnemyDef, level: number, enemyHpPct = 0): Stats {
  const s = emptyStats();
  for (const k of STAT_KEYS) if (def.baseStats[k]) s[k] += def.baseStats[k]!;
  const hpMult = (1 + 0.14 * level) * (1 + enemyHpPct / 100);
  const dmgMult = 1 + 0.09 * level;
  s.hp = Math.round(s.hp * hpMult);
  s.attack = Math.round(s.attack * dmgMult);
  s.spirit = Math.round(s.spirit * dmgMult);
  s.defense = Math.round(s.defense + 2 * level);
  s.crit = s.crit + 0.5 * level;
  return s;
}

export function buildEnemyUnit(def: EnemyDef, level: number, id: number, pos: Hex | null, enemyHpPct = 0): UnitInit {
  return {
    id,
    side: 'enemy',
    defId: def.id,
    name: def.name,
    hanzi: def.hanzi,
    classes: def.classes ?? [],
    rank: 0,
    stats: enemyStats(def, level, enemyHpPct),
    attackInterval: def.attackInterval,
    attackScale: { attack: 1 },
    ability: def.ability,
    effects: def.passives ?? [],
    pos,
    onBoard: true,
    targeting: def.targeting,
    sprite: def.sprite,
    scale: def.scale,
    projectile: def.projectile,
    accent: def.accent,
    boss: def.boss,
    elite: def.elite,
  };
}
