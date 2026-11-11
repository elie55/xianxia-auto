import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { hexDistance, offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RECRUIT_BY_HERO, recruitState } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';
import { cumulativeXp } from '@/meta/renown';

/** Bei Ming, the seventh exclusive disciple (Recruitment Hall level IV): her Snow Qilin fights beside her. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const bm = (daoPathId?: string): HeroState => ({ uid: 'bm', defId: 'bei_ming', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });
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

/** Bei Ming behind Shan Tie, three wolves in front, every unit stunned so only what the test does happens. */
function field(path?: string, mastery = false) {
  const c = mastery ? { ...ctx, masteryPassives: ['bei_ming'] } : ctx;
  const b = new Battle({
    seed: 11,
    allies: [buildHeroUnit(bm(path), c, 1, offsetToAxial(1, 2), true), buildHeroUnit(ally('shan_tie', 'st'), ctx, 2, offsetToAxial(3, 1), true)],
    enemies: [offsetToAxial(4, 2), offsetToAxial(5, 3), offsetToAxial(7, 1)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p)),
  });
  for (const u of b.units) u.stunUntil = 99;
  const me = b.units.find((u) => u.defId === 'bei_ming')!;
  const tank = b.units.find((u) => u.defId === 'shan_tie')!;
  const wolves = b.units.filter((u) => u.side === 'enemy');
  return { b, me, tank, wolves, c };
}
const qilins = (b: Battle, me: Unit) => b.units.filter((u) => u.ownerId === me.id && !u.illusion);
const living = (b: Battle, me: Unit) => qilins(b, me).filter((u) => u.alive);
/** Runs the stunned field to `t` seconds, keeping new units stunned too. */
const runTo = (b: Battle, t: number) => {
  while (b.time < t && !b.over) {
    for (const u of b.units) u.stunUntil = 99;
    b.tick(0.05);
  }
};

describe('Bei Ming, Keeper of the Snow Qilin', () => {
  it('is an exclusive Array Master and Alchemist who answers the call at Recruitment Hall level IV', () => {
    const def = HERO_BY_ID.bei_ming;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['array', 'alchemist']);
    expect(RECRUIT_BY_HERO.bei_ming).toMatchObject({ hall: 4, cost: { funds: 450, jade: 10 } });
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'bei_ming')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['bei_ming'] })).some((h) => h.id === 'bei_ming')).toBe(true);
    const xp = cumulativeXp(40);
    expect(recruitState(metaWith({ renown: { xp }, sect: { buildings: { recruit: 3 } } as MetaSave['sect'] }), 'bei_ming')).toBe('locked');
    expect(recruitState(metaWith({ renown: { xp }, sect: { buildings: { recruit: 4 } } as MetaSave['sect'] }), 'bei_ming')).toBe('waiting');
  });

  it('brings her Snow Qilin at the start of the fight: 60% of her Max HP, 90% of her Spirit as Attack, her Defense + 10', () => {
    const { b, me } = field();
    runTo(b, 0.1);
    const [q] = qilins(b, me);
    expect(qilins(b, me)).toHaveLength(1);
    expect(q.name).toBe('Snow Qilin');
    expect(q.illusion).toBe(false);
    expect(q.isSummon && q.alive && q.onBoard).toBe(true);
    expect(q.maxHp).toBe(Math.round(me.maxHp * 0.6));
    expect(q.stat('attack')).toBeCloseTo(me.stat('spirit') * 0.9, 5);
    expect(q.stat('defense')).toBeCloseTo(me.stat('defense') + 10, 5);
    expect(q.maxQi).toBe(0);
    expect(hexDistance(q.pos!, me.pos!)).toBeLessThanOrEqual(3);
  });

  it("its blows apply 2 Frost, its deeds count for her, and support meant for allies passes it by", () => {
    const { b, me, tank, wolves } = field();
    runTo(b, 0.1);
    const [q] = qilins(b, me);
    const dealt = me.tracker.damageDealt;
    b.dealDamage(q, wolves[0], 50, 'true', { attack: true });
    expect(wolves[0].frost).toBe(2);
    expect(me.tracker.damageDealt - dealt).toBe(50);
    // the most wounded ally is still a disciple, never the beast
    q.hp = 1;
    tank.hp = tank.maxHp - 10;
    expect(b.resolveTargets('lowestHpAlly', me, {})).toEqual([tank]);
  });

  it('a fallen Snow Qilin reforms beside her 8 s later, one at a time', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    const [q] = qilins(b, me);
    b.dealDamage(wolves[0], q, 99999, 'true');
    expect(q.alive).toBe(false);
    runTo(b, b.time + 7.9);
    expect(living(b, me)).toHaveLength(0);
    runTo(b, b.time + 0.3);
    expect(living(b, me)).toHaveLength(1);
    expect(living(b, me)[0].maxHp).toBe(Math.round(me.maxHp * 0.6));
  });

  it('Elder Qilin brings it back in 4 s, and the 8 s timer does not add a second one', () => {
    const { b, me, wolves } = field('bei_elder_qilin');
    runTo(b, 0.1);
    b.dealDamage(wolves[0], qilins(b, me)[0], 99999, 'true');
    runTo(b, b.time + 4.2);
    expect(living(b, me)).toHaveLength(1);
    runTo(b, b.time + 5);
    expect(living(b, me)).toHaveLength(1);
  });

  it('Heaven-Binding Array strikes the enemies around the Qilin, heals it, and opens on her target without it', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    const [q] = qilins(b, me);
    q.hp = Math.round(q.maxHp / 2);
    const near = wolves.filter((w) => hexDistance(w.pos!, q.pos!) <= 2);
    const far = wolves.filter((w) => hexDistance(w.pos!, q.pos!) > 2);
    expect(near.length).toBeGreaterThan(0);
    const hp0 = wolves.map((w) => w.hp);
    b.executeActions(heroAbility(bm()).actions, me, { ability: true, target: wolves[0] });
    for (const w of near) {
      expect(w.hp).toBeLessThan(hp0[wolves.indexOf(w)]);
      expect(w.frost).toBe(6);
    }
    for (const w of far) expect(w.frost).toBe(0);
    expect(q.hp).toBe(Math.round(q.maxHp / 2) + Math.round(q.maxHp * 0.25));

    // without the Qilin, the array opens around her target
    const lone = field();
    runTo(lone.b, 0.1);
    lone.b.dealDamage(lone.wolves[1], qilins(lone.b, lone.me)[0], 99999, 'true');
    lone.b.executeActions(heroAbility(bm()).actions, lone.me, { ability: true, target: lone.wolves[2] });
    expect(lone.wolves[2].frost).toBe(6);
  });

  it('Binding Array stuns what it strikes; Frost Nova bursts where a falling Qilin stood', () => {
    const bind = field('bei_binding_array');
    runTo(bind.b, 0.1);
    for (const u of bind.b.units) u.stunUntil = 0;
    bind.b.executeActions(heroAbility(bm('bei_binding_array')).actions, bind.me, { ability: true, target: bind.wolves[0] });
    const [q] = qilins(bind.b, bind.me);
    const struck = bind.wolves.filter((w) => hexDistance(w.pos!, q.pos!) <= 2);
    expect(struck.length).toBeGreaterThan(0);
    for (const w of struck) expect(w.stunUntil).toBeCloseTo(bind.b.time + 1, 5);

    const nova = field('bei_frost_nova');
    runTo(nova.b, 0.1);
    const [nq] = qilins(nova.b, nova.me);
    const beside = nova.wolves.filter((w) => hexDistance(w.pos!, nq.pos!) <= 1);
    expect(beside.length).toBeGreaterThan(0);
    const hp0 = beside.map((w) => w.hp);
    nova.b.dealDamage(nova.wolves[2], nq, 99999, 'true');
    beside.forEach((w, i) => {
      expect(w.hp).toBeLessThan(hp0[i]);
      expect(w.frost).toBe(6);
    });
  });

  it('the Qilin vanishes when she falls, and mastery V (Moonlit Bond) quickens it', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    const [q] = qilins(b, me);
    b.dealDamage(wolves[0], me, 99999, 'true');
    expect(q.alive).toBe(false);
    runTo(b, b.time + 10);
    expect(living(b, me)).toHaveLength(0);

    const bond = field(undefined, true);
    runTo(bond.b, 0.1);
    const [bq] = qilins(bond.b, bond.me);
    const as0 = bq.stat('attackSpeed');
    bond.b.executeActions(heroAbility(bm(), bond.c).actions, bond.me, { ability: true, target: bond.wolves[0] });
    expect(bq.stat('attackSpeed')).toBeCloseTo(as0 + 30, 5);
  });

  it('fights a real battle with her Qilin', () => {
    const tank = buildHeroUnit(ally('shan_tie', 'st'), ctx, 1, offsetToAxial(3, 2), true);
    const me = buildHeroUnit(bm('bei_frost_nova'), ctx, 2, offsetToAxial(1, 2), true);
    // she starts with her Qi full, so the short fight sees her cast
    me.stats.qi = 60;
    const wolves = [offsetToAxial(5, 1), offsetToAxial(5, 2), offsetToAxial(5, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 3, 100 + i, p));
    const b = new Battle({ seed: 13, allies: [tank, me], enemies: wolves });
    const res = b.run();
    expect(b.units.some((u) => u.ownerId === 2 && !u.illusion)).toBe(true);
    expect(b.drainEvents().some((e) => e.type === 'cast' && e.id === 2)).toBe(true);
    expect(res.units.some((u) => u.name === 'Snow Qilin')).toBe(false);
  });
});
