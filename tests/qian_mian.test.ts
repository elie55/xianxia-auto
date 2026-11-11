import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { hexDistance, offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RECRUIT_BY_HERO } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';

/** Qian Mian, the fifth exclusive disciple (Renown 45): his mirror Reflections fight beside him and shatter when they end. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const qm = (daoPathId?: string): HeroState => ({ uid: 'qm', defId: 'qian_mian', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });
const ally = (defId: string, uid: string): HeroState => ({ uid, defId, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID[defId].daoPaths[0].id });

/** Qian Mian beside Shan Tie, three stunned wolves in front (the middle one wounded), every unit stunned. */
function field(path?: string, mastery = false) {
  const c = mastery ? { ...ctx, masteryPassives: ['qian_mian'] } : ctx;
  const b = new Battle({
    seed: 3,
    allies: [buildHeroUnit(qm(path), c, 1, offsetToAxial(2, 2), true), buildHeroUnit(ally('shan_tie', 'st'), ctx, 2, offsetToAxial(2, 3), true)],
    enemies: [offsetToAxial(5, 1), offsetToAxial(5, 2), offsetToAxial(5, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p)),
  });
  for (const u of b.units) u.stunUntil = 99;
  const me = b.units.find((u) => u.defId === 'qian_mian')!;
  const tank = b.units.find((u) => u.defId === 'shan_tie')!;
  const wolves = b.units.filter((u) => u.side === 'enemy');
  wolves[1].hp = Math.round(wolves[1].maxHp * 0.4);
  return { b, me, tank, wolves, c };
}
const cast = (b: Battle, me: Unit, path?: string, c = ctx) => b.executeActions(heroAbility(qm(path), c).actions, me, { ability: true });
const reflections = (b: Battle, me: Unit) => b.units.filter((u) => u.ownerId === me.id);
/** Lets the stunned field run until `t` seconds (Reflections spawned later are stunned too). */
const runTo = (b: Battle, t: number) => {
  while (b.time < t && !b.over) {
    for (const u of b.units) u.stunUntil = 99;
    b.tick(0.05);
  }
};

describe('Qian Mian, Mirror Flower, Water Moon', () => {
  it('is an exclusive Shadow Walker and Martial Artist the sect recruits at Renown 45', () => {
    const def = HERO_BY_ID.qian_mian;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['shadow', 'martial']);
    expect(RECRUIT_BY_HERO.qian_mian).toMatchObject({ renown: 45, cost: { funds: 550, jade: 12 } });
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'qian_mian')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['qian_mian'] })).some((h) => h.id === 'qian_mian')).toBe(true);
  });

  it('leaves 2 Reflections with 40% of his Attack and 35% of his Max HP, then blinks behind the lowest-HP enemy', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    const hp0 = wolves[1].hp;
    cast(b, me);
    const rs = reflections(b, me);
    expect(rs).toHaveLength(2);
    for (const r of rs) {
      expect(r.alive && r.onBoard && r.isSummon).toBe(true);
      expect(r.heroUid).toBeUndefined();
      expect(r.maxQi).toBe(0);
      expect(r.stat('attack')).toBeCloseTo(me.stat('attack') * 0.4, 5);
      expect(r.maxHp).toBe(Math.round(me.maxHp * 0.35));
      expect(r.stat('crit')).toBe(me.stat('crit'));
      expect(r.expiresAt).toBeCloseTo(b.time + 6, 5);
    }
    // he stands beside the wounded wolf now and has struck it
    expect(hexDistance(me.pos!, wolves[1].pos!)).toBe(1);
    expect(wolves[1].hp).toBeLessThan(hp0);
  });

  it('Reflections fade after 6 s and shatter on the enemies beside them (Shattered Mirror)', () => {
    const { b, me, wolves } = field();
    runTo(b, 0.1);
    cast(b, me);
    const rs = reflections(b, me);
    // walk a wolf up to each Reflection so the shards have someone to hit
    const near = wolves.filter((w) => w !== wolves[1]);
    const hp0 = near.map((w) => w.hp);
    for (let i = 0; i < rs.length; i++) {
      const spot = [rs[i].pos!].flatMap((p) => [{ q: p.q + 1, r: p.r }, { q: p.q + 1, r: p.r - 1 }, { q: p.q, r: p.r + 1 }]).find((h) => !b.unitAt(h));
      if (spot) near[i].pos = spot;
    }
    b.drainEvents();
    runTo(b, b.time + 6.2);
    expect(rs.every((r) => !r.alive)).toBe(true);
    const events = b.drainEvents();
    expect(events.filter((e) => e.type === 'death' && e.vanish && rs.some((r) => r.id === e.id))).toHaveLength(2);
    expect(near.some((w, i) => w.hp < hp0[i])).toBe(true);
    expect(events.some((e) => e.type === 'damage' && e.sourceId === me.id)).toBe(true);
  });

  it("a destroyed Reflection shatters too; its blows and the blows it takes count for him, and it never counts as a fallen ally", () => {
    const { b, me, tank, wolves } = field();
    runTo(b, 0.1);
    b.addEffect(tank, { id: 'mourn', desc: '', trigger: { on: 'allyDied' }, actions: [{ do: 'counter', key: 'fallen', add: 1 }] });
    cast(b, me);
    const [r1, r2] = reflections(b, me);
    const dealt = me.tracker.damageDealt;
    b.dealDamage(r1, wolves[0], 100, 'true');
    expect(me.tracker.damageDealt - dealt).toBe(100);
    expect(r1.tracker.damageDealt).toBe(0);
    const taken = me.tracker.damageTaken;
    b.dealDamage(wolves[0], r2, 99999, 'true');
    expect(r2.alive).toBe(false);
    expect(me.tracker.damageTaken - taken).toBe(99999);
    expect(tank.counter('fallen')).toBe(0);
    // Reflections leave no record of their own
    expect(b.result().units.some((u) => u.id === r1.id || u.id === r2.id)).toBe(false);
  });

  it('his Reflections vanish when he falls', () => {
    const { b, me, tank, wolves } = field();
    runTo(b, 0.1);
    b.addEffect(tank, { id: 'mourn', desc: '', trigger: { on: 'allyDied' }, actions: [{ do: 'counter', key: 'fallen', add: 1 }] });
    cast(b, me);
    const rs = reflections(b, me);
    const wolvesHp = wolves.map((w) => w.hp);
    b.dealDamage(wolves[0], me, 99999, 'true');
    expect(me.alive).toBe(false);
    expect(rs.every((r) => !r.alive)).toBe(true);
    // they leave quietly: no shards from a fallen master
    expect(wolves.map((w) => w.hp)).toEqual(wolvesHp);
    expect(tank.counter('fallen')).toBe(1);
  });

  it('Hall of Mirrors leaves 3 Reflections; Unbroken Mirror makes them 60% HP for 10 s; The Moon Returns gives 15 Qi per shatter', () => {
    const hall = field('qian_hall_of_mirrors');
    runTo(hall.b, 0.1);
    cast(hall.b, hall.me, 'qian_hall_of_mirrors');
    expect(reflections(hall.b, hall.me)).toHaveLength(3);

    const unbroken = field('qian_unbroken_mirror');
    runTo(unbroken.b, 0.1);
    cast(unbroken.b, unbroken.me, 'qian_unbroken_mirror');
    for (const r of reflections(unbroken.b, unbroken.me)) {
      expect(r.maxHp).toBe(Math.round(unbroken.me.maxHp * 0.6));
      expect(r.expiresAt).toBeCloseTo(unbroken.b.time + 10, 5);
    }

    const moon = field('qian_moon_returns');
    runTo(moon.b, 0.1);
    cast(moon.b, moon.me, 'qian_moon_returns');
    moon.me.qi = 0;
    for (const r of reflections(moon.b, moon.me)) moon.b.dealDamage(moon.wolves[0], r, 99999, 'true');
    expect(moon.me.qi).toBe(30);
  });

  it('mastery V (Moon in the Water) leaves one more Reflection beside the target', () => {
    const { b, me, wolves, c } = field(undefined, true);
    runTo(b, 0.1);
    b.executeActions(heroAbility(qm(), c).actions, me, { ability: true, target: wolves[0] });
    const rs = reflections(b, me);
    expect(rs).toHaveLength(3);
    expect(rs.some((r) => hexDistance(r.pos!, wolves[0].pos!) === 1)).toBe(true);
  });

  it('casts in a real fight: Reflections step out and the fight still ends', () => {
    const tank = buildHeroUnit(ally('shan_tie', 'st'), ctx, 1, offsetToAxial(3, 2), true);
    const me = buildHeroUnit(qm('qian_hall_of_mirrors'), ctx, 2, offsetToAxial(2, 2), true);
    const wolves = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3), offsetToAxial(5, 2)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 4, 100 + i, p));
    const b = new Battle({ seed: 7, allies: [tank, me], enemies: wolves });
    const res = b.run();
    const events = b.drainEvents();
    expect(events.some((e) => e.type === 'cast' && e.id === 2)).toBe(true);
    expect(b.units.some((u) => u.ownerId === 2)).toBe(true);
    expect(res.units).toHaveLength(b.units.filter((u) => u.ownerId === null).length);
    expect(res.winner).toBeDefined();
  });
});
