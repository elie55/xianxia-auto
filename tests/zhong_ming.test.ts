import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { hexDistance, offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RECRUIT_BY_HERO } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';

/** Zhong Ming, the second exclusive disciple (Renown 20): she stores damage taken as Resonance and rings it out. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const zm = (daoPathId?: string): HeroState => ({ uid: 'zm', defId: 'zhong_ming', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });

/** Zhong Ming on the board and three wolves: one beside her, one 3 hexes away, one 5 hexes off. */
function arena(path?: string) {
  const me = offsetToAxial(3, 2);
  const spots = [offsetToAxial(4, 2), offsetToAxial(6, 2), offsetToAxial(7, 0)];
  const b = new Battle({
    seed: 1,
    allies: [buildHeroUnit(zm(path), ctx, 1, me, true)],
    enemies: spots.map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 0, 100 + i, p)),
  });
  const z = b.units.find((u) => u.defId === 'zhong_ming')!;
  const [near, mid, far] = [100, 101, 102].map((id) => b.units.find((u) => u.id === id)!);
  return { b, z, near, mid, far, dist: (u: typeof near) => hexDistance(me, u.pos!) };
}

describe('Zhong Ming, the Golden Bell', () => {
  it('is an exclusive Body Refiner and Martial Artist the sect recruits at Renown 20', () => {
    const def = HERO_BY_ID.zhong_ming;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['body', 'martial']);
    expect(RECRUIT_BY_HERO.zhong_ming.renown).toBe(20);
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'zhong_ming')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['zhong_ming'] })).some((h) => h.id === 'zhong_ming')).toBe(true);
  });

  it('stores 40% of the damage she takes as Resonance, 60% on Bronze Skin', () => {
    const plain = arena();
    plain.b.dealDamage(plain.near, plain.z, 200, 'true');
    expect(plain.z.counter('resonance')).toBeCloseTo(80);
    const bronze = arena('zhong_bronze_skin');
    bronze.b.dealDamage(bronze.near, bronze.z, 200, 'true');
    expect(bronze.z.counter('resonance')).toBeCloseTo(120);
  });

  it('rings the stored Resonance out on every enemy within 2 hexes, then spends it', () => {
    const { b, z, near, mid, far, dist } = arena();
    expect([dist(near), dist(mid), dist(far)]).toEqual([1, 3, 5]);
    const quiet = arena();
    quiet.b.executeActions(heroAbility(zm()).actions, quiet.z, {});
    const plainHit = quiet.near.maxHp - quiet.near.hp;
    z.addCounter('resonance', 500);
    b.executeActions(heroAbility(zm()).actions, z, {});
    // the 500 Resonance adds 60% (300 before the wolf's Defense) to the plain strike
    expect(near.maxHp - near.hp).toBeGreaterThan(plainHit + 150);
    expect(mid.hp).toBe(mid.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(z.counter('resonance')).toBe(0);
  });

  it('Thunderous Peal reaches 3 hexes and stuns', () => {
    const { b, z, mid, far } = arena('zhong_thunder_peal');
    b.executeActions(heroAbility(zm('zhong_thunder_peal')).actions, z, {});
    expect(mid.hp).toBeLessThan(mid.maxHp);
    expect(mid.stunUntil).toBeGreaterThan(b.time);
    expect(far.hp).toBe(far.maxHp);
  });

  it('Echoing Fists turns auto-attacks into echoes of 15% of the Resonance', () => {
    const { b, z, near } = arena('zhong_echoing_fists');
    z.addCounter('resonance', 1000);
    b.fire(z, 'autoAttack', { target: near, amount: 1 });
    // 15% of 1,000 Resonance, as physical damage the wolf's Defense reduces
    expect(near.maxHp - near.hp).toBeGreaterThan(60);
    expect(z.counter('resonance')).toBe(1000);
  });

  it('casts in a real fight, and her technique carries her signature effect', () => {
    const keys = heroAbility(zm()).actions.flatMap((a) => (a.do === 'vfx' ? [a.key] : []));
    expect(keys).toContain('sig_zhong_ming');
    const tank = buildHeroUnit(zm('zhong_bronze_skin'), ctx, 1, offsetToAxial(3, 2), true);
    const wolves = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p));
    const b = new Battle({ seed: 4, allies: [tank], enemies: wolves });
    b.run();
    const events = b.drainEvents();
    expect(events.some((e) => e.type === 'cast' && e.id === 1)).toBe(true);
  });
});
