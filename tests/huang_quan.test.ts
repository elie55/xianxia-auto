import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { hexDistance, offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID, JIANGSHI_MAX } from '@/content/heroes';
import { RECRUIT_BY_HERO, recruitGate, recruitState } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';
import { cumulativeXp, rankOf } from '@/meta/renown';

/** Huang Quan, the eighth exclusive disciple (Renown 50, the Immortal Sect): the fallen rise as his Jiangshi. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const hq = (daoPathId?: string): HeroState => ({ uid: 'hq', defId: 'huang_quan', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });
const ally = (defId: string, uid: string): HeroState => ({ uid, defId, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID[defId].daoPaths[0].id });
const metaWith = (over: Partial<MetaSave>): MetaSave => ({
  unlockedTier: 0,
  runsPlayed: 0,
  runsWon: 0,
  bestEndless: 0,
  bestTierCleared: -1,
  leaderboard: [],
  settings: { music: 0.6, sfx: 0.8, autoBattle: false, battleSpeed: 1, screenShake: true, showDamage: true },
  seenTutorial: false,
  tutorialSeen: [],
  tutorialDisabled: false,
  ...over,
});

/** Where the wolves stand: the first two side by side, so a Jiangshi rising on the first stands beside the second. */
const SPOTS = [offsetToAxial(4, 2), offsetToAxial(5, 2), offsetToAxial(7, 1), offsetToAxial(6, 3), offsetToAxial(7, 3), offsetToAxial(6, 0)];

/** Huang Quan behind Shan Tie, `count` wolves in front, every unit stunned so only what the test does happens. */
function field(path?: string, mastery = false, count = 3) {
  const c = mastery ? { ...ctx, masteryPassives: ['huang_quan'] } : ctx;
  const b = new Battle({
    seed: 11,
    allies: [buildHeroUnit(hq(path), c, 1, offsetToAxial(1, 2), true), buildHeroUnit(ally('shan_tie', 'st'), ctx, 2, offsetToAxial(3, 1), true)],
    enemies: SPOTS.slice(0, count).map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p)),
  });
  for (const u of b.units) u.stunUntil = 99;
  const me = b.units.find((u) => u.defId === 'huang_quan')!;
  const tank = b.units.find((u) => u.defId === 'shan_tie')!;
  const wolves = b.units.filter((u) => u.side === 'enemy');
  return { b, me, tank, wolves, c };
}
const living = (b: Battle, me: Unit) => b.units.filter((u) => u.ownerId === me.id && !u.illusion && u.alive);
/** Runs the stunned field to `t` seconds, keeping new units stunned too. */
const runTo = (b: Battle, t: number) => {
  while (b.time < t && !b.over) {
    for (const u of b.units) u.stunUntil = 99;
    b.tick(0.05);
  }
};
const slay = (b: Battle, by: Unit, u: Unit) => b.dealDamage(by, u, 99999, 'true');

describe('Huang Quan, the Corpse Immortal', () => {
  it('is an exclusive Talisman Master and Shadow Walker who answers the call at Renown 50, the Immortal Sect', () => {
    const def = HERO_BY_ID.huang_quan;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['talisman', 'shadow']);
    const r = RECRUIT_BY_HERO.huang_quan;
    expect(r).toMatchObject({ renown: 50, cost: { funds: 600, jade: 15 } });
    expect(r.hall).toBeUndefined();
    expect(recruitGate(r)).toBe('Renown 50');
    expect(rankOf(50).name).toBe('Immortal Sect');
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'huang_quan')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['huang_quan'] })).some((h) => h.id === 'huang_quan')).toBe(true);
    expect(recruitState(metaWith({ renown: { xp: cumulativeXp(49) } }), 'huang_quan')).toBe('locked');
    expect(recruitState(metaWith({ renown: { xp: cumulativeXp(50) } }), 'huang_quan')).toBe('waiting');
  });

  it('raises a Jiangshi from each enemy that falls: 30% of his Max HP, 50% of his Spirit as Attack, his Defense', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    expect(living(b, me)).toHaveLength(0);
    const corpse = { ...wolves[0].pos! };
    slay(b, me, wolves[0]);
    const [j] = living(b, me);
    expect(j.name).toBe('Jiangshi');
    expect(j.isSummon && j.onBoard && !j.illusion).toBe(true);
    expect(j.pos).toEqual(corpse);
    expect(j.maxHp).toBe(Math.round(me.maxHp * 0.3));
    expect(j.stat('attack')).toBeCloseTo(me.stat('spirit') * 0.5, 5);
    expect(j.stat('defense')).toBeCloseTo(me.stat('defense'), 5);
    expect(j.maxQi).toBe(0);
    expect(j.ownerTip).toBe('Jiangshi of {owner}');
  });

  it('its deeds count for him, its blows carry no Poison, and support meant for allies passes it by', () => {
    const { b, me, tank, wolves } = field();
    runTo(b, 0.1);
    slay(b, me, wolves[0]);
    const [j] = living(b, me);
    const dealt = me.tracker.damageDealt;
    b.dealDamage(j, wolves[1], 40, 'true', { attack: true });
    // (three Jiangshi adding Poison on every blow piled it up without end: Poison loses only 1 stack a second)
    expect(wolves[1].poison).toBe(0);
    expect(me.tracker.damageDealt - dealt).toBe(40);
    j.hp = 1;
    tank.hp = tank.maxHp - 10;
    expect(b.resolveTargets('lowestHpAlly', me, {})).toEqual([tank]);
  });

  it('commands at most 3 at once: a corpse rises again once one of his Jiangshi is gone', () => {
    const { b, me, wolves } = field(undefined, false, 6);
    runTo(b, 0.1);
    for (const w of wolves.slice(0, 4)) slay(b, me, w);
    expect(living(b, me)).toHaveLength(JIANGSHI_MAX);
    // a destroyed Jiangshi raises nothing for anyone
    slay(b, wolves[5], living(b, me)[0]);
    expect(living(b, me)).toHaveLength(2);
    slay(b, me, wolves[4]);
    expect(living(b, me)).toHaveLength(3);
  });

  it('Night Parade of Corpses strikes and poisons around his target, raises 2 beside it and heals the ones he has', () => {
    const { b, me, wolves } = field(undefined, false, 4);
    runTo(b, 0.1);
    slay(b, me, wolves[3]);
    const [first] = living(b, me);
    first.hp = Math.round(first.maxHp / 2);
    const target = wolves[0];
    const near = wolves.slice(0, 3).filter((w) => hexDistance(w.pos!, target.pos!) <= 1);
    const far = wolves.slice(0, 3).filter((w) => hexDistance(w.pos!, target.pos!) > 1);
    expect(near.length).toBeGreaterThan(1);
    const hp0 = near.map((w) => w.hp);
    b.executeActions(heroAbility(hq()).actions, me, { ability: true, target });
    near.forEach((w, i) => {
      expect(w.hp).toBeLessThan(hp0[i]);
      expect(w.poison).toBe(3);
    });
    for (const w of far) expect(w.poison).toBe(0);
    expect(first.hp).toBe(Math.round(first.maxHp / 2) + Math.round(first.maxHp * 0.3));
    const risen = living(b, me).filter((j) => j !== first);
    expect(risen).toHaveLength(2);
    for (const j of risen) expect(hexDistance(j.pos!, target.pos!)).toBe(1);
  });

  it('Army of the Dead commands 5 and the technique raises 3', () => {
    const { b, me, wolves } = field('huang_army_of_the_dead', false, 6);
    runTo(b, 0.1);
    b.executeActions(heroAbility(hq('huang_army_of_the_dead')).actions, me, { ability: true, target: wolves[0] });
    expect(living(b, me)).toHaveLength(3);
    for (const w of wolves.slice(2, 5)) slay(b, me, w);
    expect(living(b, me)).toHaveLength(5);
  });

  it('Bronze Corpses rise with 20% more of his Max HP and 25 more Defense', () => {
    const { b, me, wolves } = field('huang_bronze_corpses');
    runTo(b, 0.1);
    slay(b, me, wolves[0]);
    const [j] = living(b, me);
    expect(j.maxHp).toBe(Math.round(me.maxHp * 0.5));
    expect(j.stat('defense')).toBeCloseTo(me.stat('defense') + 25, 5);
  });

  it('Corpse Burst: a falling Jiangshi bursts in corpse gas on the enemies beside it', () => {
    const { b, me, wolves } = field('huang_corpse_burst');
    runTo(b, 0.1);
    slay(b, me, wolves[0]);
    const [j] = living(b, me);
    const beside = wolves.filter((w) => w.alive && hexDistance(w.pos!, j.pos!) <= 1);
    expect(beside.length).toBeGreaterThan(0);
    const hp0 = beside.map((w) => w.hp);
    slay(b, wolves[2], j);
    expect(j.alive).toBe(false);
    beside.forEach((w, i) => {
      expect(w.hp).toBeLessThan(hp0[i]);
      expect(w.poison).toBe(4);
    });
  });

  it('his Jiangshi crumble when he falls, and mastery V (Ancestral Coffin) starts him with one', () => {
    const { b, me, wolves } = field(undefined, false, 4);
    runTo(b, 0.1);
    slay(b, me, wolves[0]);
    slay(b, me, wolves[1]);
    const mine = living(b, me);
    expect(mine).toHaveLength(2);
    slay(b, wolves[2], me);
    for (const j of mine) expect(j.alive).toBe(false);
    // the dead raise nothing for a fallen master
    slay(b, wolves[2], wolves[3]);
    expect(living(b, me)).toHaveLength(0);

    const coffin = field(undefined, true);
    runTo(coffin.b, 0.1);
    const [first] = living(coffin.b, coffin.me);
    expect(first).toBeDefined();
    expect(hexDistance(first.pos!, coffin.me.pos!)).toBeLessThanOrEqual(3);
  });

  it('fights a real battle with his Jiangshi', () => {
    const tank = buildHeroUnit(ally('shan_tie', 'st'), ctx, 1, offsetToAxial(3, 2), true);
    const me = buildHeroUnit(hq('huang_corpse_burst'), ctx, 2, offsetToAxial(1, 2), true);
    // he starts with his Qi full, so the short fight sees him cast
    me.stats.qi = 60;
    const wolves = [offsetToAxial(5, 1), offsetToAxial(5, 2), offsetToAxial(5, 3), offsetToAxial(6, 2)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 3, 100 + i, p));
    const b = new Battle({ seed: 13, allies: [tank, me], enemies: wolves });
    const res = b.run();
    expect(b.drainEvents().some((e) => e.type === 'cast' && e.id === 2)).toBe(true);
    expect(b.units.filter((u) => u.ownerId === 2 && !u.illusion).length).toBeGreaterThanOrEqual(2);
    expect(res.units.some((u) => u.name === 'Jiangshi')).toBe(false);
  });
});
