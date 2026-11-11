import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID, RAGE_MAX } from '@/content/heroes';
import { RECRUIT_BY_HERO, recruitState, sectToDo } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';
import { cumulativeXp } from '@/meta/renown';
import type { MetaSave } from '@/app/store';

/** Xiu Luo, the sixth exclusive disciple (Recruitment Hall level II): every blow he takes builds Rage. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const xl = (daoPathId?: string): HeroState => ({ uid: 'xl', defId: 'xiu_luo', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });
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

/** Xiu Luo facing three wolves (one beside him, one two hexes away, one far), every unit stunned. */
function field(path?: string, mastery = false) {
  const c = mastery ? { ...ctx, masteryPassives: ['xiu_luo'] } : ctx;
  const b = new Battle({
    seed: 5,
    allies: [buildHeroUnit(xl(path), c, 1, offsetToAxial(3, 2), true)],
    enemies: [offsetToAxial(4, 2), offsetToAxial(5, 2), offsetToAxial(7, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p)),
  });
  for (const u of b.units) u.stunUntil = 99;
  const me = b.units.find((u) => u.defId === 'xiu_luo')!;
  const wolves = b.units.filter((u) => u.side === 'enemy');
  return { b, me, wolves, c };
}
const blows = (b: Battle, from: Unit, to: Unit, n: number) => {
  for (let i = 0; i < n; i++) b.dealDamage(from, to, 1, 'true');
};

describe('Xiu Luo, Six Arms of the Asura', () => {
  it('is an exclusive Martial Artist and Sword Cultivator who answers the call at Recruitment Hall level II', () => {
    const def = HERO_BY_ID.xiu_luo;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['martial', 'sword']);
    expect(RECRUIT_BY_HERO.xiu_luo).toMatchObject({ hall: 2, cost: { funds: 200, jade: 5 } });
    expect(RECRUIT_BY_HERO.xiu_luo.renown).toBeUndefined();
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'xiu_luo')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['xiu_luo'] })).some((h) => h.id === 'xiu_luo')).toBe(true);
  });

  it('waits for the Recruitment Hall to reach level II, whatever the Renown', () => {
    const xp = cumulativeXp(40);
    expect(recruitState(metaWith({ renown: { xp } }), 'xiu_luo')).toBe('locked');
    const raised = metaWith({ renown: { xp }, sect: { buildings: { recruit: 2 } } as MetaSave['sect'] });
    expect(recruitState(raised, 'xiu_luo')).toBe('waiting');
    // the Recruitment Hall itself opens at Renown 8
    expect(recruitState(metaWith({ renown: { xp: cumulativeXp(7) }, sect: { buildings: { recruit: 2 } } as MetaSave['sect'] }), 'xiu_luo')).toBe('locked');
    // raising the hall says who it brings
    const rich = metaWith({ renown: { xp: cumulativeXp(10) }, sect: { purse: { funds: 1000, herbs: 100, cores: 100, jade: 10 } } as MetaSave['sect'] });
    expect(sectToDo(rich)).toContain('The Recruitment Hall can rise to level II, and Xiu Luo will answer its call.');
  });

  it('builds 2 Rage per blow taken, up to 20, each worth +1% Attack, +2 Attack Speed and +0.5% Omnivamp', () => {
    const { b, me, wolves } = field();
    b.tick(0.05);
    const atk0 = me.stat('attack');
    const as0 = me.stat('attackSpeed');
    const vamp0 = me.stat('omnivamp');
    blows(b, wolves[0], me, 4);
    expect(me.counter('rage')).toBe(8);
    expect(me.stat('attack')).toBeCloseTo(atk0 * 1.08, 5);
    expect(me.stat('attackSpeed')).toBeCloseTo(as0 + 16, 5);
    expect(me.stat('omnivamp')).toBeCloseTo(vamp0 + 4, 5);
    blows(b, wolves[0], me, 30);
    expect(me.counter('rage')).toBe(RAGE_MAX);
    expect(me.stat('attackSpeed')).toBeCloseTo(as0 + 2 * RAGE_MAX, 5);
    // damage over time is not a blow
    const fresh = field();
    fresh.b.tick(0.05);
    fresh.b.applyStatus(fresh.wolves[0], fresh.me, 'burn', 1, 3, 5);
    for (let i = 0; i < 40; i++) fresh.b.tick(0.05);
    expect(fresh.me.counter('rage')).toBe(0);
  });

  it('Six Arms of the Asura gains 5 Rage and strikes its target six times for 45% Attack', () => {
    const { b, me, wolves } = field();
    b.tick(0.05);
    wolves[0].hp = 99999;
    b.drainEvents();
    b.executeActions(heroAbility(xl()).actions, me, { ability: true, target: wolves[0] });
    expect(me.counter('rage')).toBe(5);
    for (let i = 0; i < 20; i++) b.tick(0.05);
    const hits = b.drainEvents().filter((e) => e.type === 'damage' && e.sourceId === me.id && e.id === wolves[0].id);
    expect(hits).toHaveLength(6);
  });

  it("Boiling Blood builds 3 Rage per blow; Asura's Roar taunts the enemies beside him; Unchained adds 30% damage at full Rage", () => {
    const boil = field('xiu_boiling_blood');
    boil.b.tick(0.05);
    blows(boil.b, boil.wolves[0], boil.me, 3);
    expect(boil.me.counter('rage')).toBe(9);

    const roar = field('xiu_asura_roar');
    roar.b.tick(0.05);
    roar.b.executeActions(heroAbility(xl('xiu_asura_roar')).actions, roar.me, { ability: true, target: roar.wolves[0] });
    expect(roar.wolves[0].tauntTargetId).toBe(roar.me.id);
    expect(roar.wolves[0].tauntUntil).toBeCloseTo(roar.b.time + 2, 5);
    // the wolves two hexes away and farther are out of reach
    expect(roar.wolves[1].tauntTargetId).toBeNull();
    expect(roar.wolves[2].tauntTargetId).toBeNull();

    const free = field('xiu_unchained');
    free.b.tick(0.05);
    free.wolves[0].hp = 99999;
    free.b.drainEvents();
    free.b.dealDamage(free.me, free.wolves[0], 100, 'true');
    expect(free.b.drainEvents().filter((e) => e.type === 'damage' && e.sourceId === free.me.id)).toHaveLength(1);
    blows(free.b, free.wolves[0], free.me, RAGE_MAX);
    free.b.drainEvents();
    free.b.dealDamage(free.me, free.wolves[0], 100, 'true');
    const dealt = free.b.drainEvents().filter((e) => e.type === 'damage' && e.sourceId === free.me.id).map((e) => (e.type === 'damage' ? e.amount : 0));
    expect(dealt).toEqual([100, 30]);
  });

  it('mastery V (Undying Grudge) starts every fight with 10 Rage', () => {
    const { b, me } = field(undefined, true);
    b.tick(0.05);
    expect(me.counter('rage')).toBe(10);
  });

  it('builds Rage and casts in a real fight', () => {
    const me = buildHeroUnit(xl('xiu_unchained'), ctx, 1, offsetToAxial(3, 2), true);
    const wolves = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 3, 100 + i, p));
    const b = new Battle({ seed: 9, allies: [me], enemies: wolves });
    b.run();
    const hero = b.units.find((u) => u.defId === 'xiu_luo')!;
    expect(hero.counter('rage')).toBeGreaterThan(0);
    expect(b.drainEvents().some((e) => e.type === 'cast' && e.id === 1)).toBe(true);
  });
});
