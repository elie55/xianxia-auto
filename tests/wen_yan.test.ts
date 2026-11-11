import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RECRUIT_BY_HERO } from '@/meta/sect';
import { heroPool, newRun } from '@/core/run';

/** Wen Yan, the third exclusive disciple (Renown 25): his talismans explode 1.5 s after he seals them. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const wy = (daoPathId?: string): HeroState => ({ uid: 'wy', defId: 'wen_yan', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });

/** Wen Yan at the back and five wolves; everyone is stunned, so only the talismans act. */
function arena(path?: string) {
  const spots = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3), offsetToAxial(6, 0), offsetToAxial(7, 4)];
  const b = new Battle({
    seed: 1,
    allies: [buildHeroUnit(wy(path), ctx, 1, offsetToAxial(1, 2), true)],
    enemies: spots.map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 0, 100 + i, p)),
  });
  for (const u of b.units) u.stunUntil = 99;
  const w = b.units.find((u) => u.defId === 'wen_yan')!;
  const wolves = b.units.filter((u) => u.side === 'enemy');
  return { b, w, wolves };
}
const until = (b: Battle, t: number) => {
  while (b.time < t) b.tick();
};
const hurt = (u: Unit) => u.maxHp - u.hp;

describe('Wen Yan, Paper Thunder', () => {
  it('is an exclusive Talisman Master and Array Master the sect recruits at Renown 25', () => {
    const def = HERO_BY_ID.wen_yan;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['talisman', 'array']);
    expect(RECRUIT_BY_HERO.wen_yan.renown).toBe(25);
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'wen_yan')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['wen_yan'] })).some((h) => h.id === 'wen_yan')).toBe(true);
  });

  it('seals the 3 nearest enemies, and each talisman explodes 1.5 s later', () => {
    const { b, w, wolves } = arena();
    b.executeActions(heroAbility(wy()).actions, w, {});
    const sealed = wolves.filter((u) => u.seals.length);
    expect(sealed).toHaveLength(3);
    until(b, 1.4);
    expect(wolves.every((u) => u.hp === u.maxHp)).toBe(true);
    until(b, 1.6);
    for (const u of sealed) {
      expect(u.hp, `wolf ${u.id}`).toBeLessThan(u.maxHp);
      expect(u.seals).toHaveLength(0);
    }
  });

  it('a talisman burns out if its enemy dies first', () => {
    const { b, w, wolves } = arena();
    b.executeActions(heroAbility(wy()).actions, w, {});
    const sealed = wolves.filter((u) => u.seals.length);
    for (const u of sealed) b.dealDamage(w, u, 99999, 'true');
    until(b, 1.6);
    // the two far wolves were never sealed and nothing exploded next to them
    for (const u of wolves.filter((x) => !sealed.includes(x))) expect(hurt(u)).toBe(0);
  });

  it('Ten Thousand Seals seals 5, Quick Fuse explodes after 0.75 s, Thunder Seal stuns', () => {
    const many = arena('wen_ten_thousand_seals');
    many.b.executeActions(heroAbility(wy('wen_ten_thousand_seals')).actions, many.w, {});
    expect(many.wolves.filter((u) => u.seals.length)).toHaveLength(5);

    const quick = arena('wen_quick_fuse');
    expect(heroAbility(wy('wen_quick_fuse')).qiCost).toBe(50);
    quick.b.executeActions(heroAbility(wy('wen_quick_fuse')).actions, quick.w, {});
    until(quick.b, 0.85);
    expect(quick.wolves.filter((u) => hurt(u) > 0).length).toBeGreaterThanOrEqual(3);

    const stun = arena('wen_thunder_seal');
    for (const u of stun.wolves) u.stunUntil = 0;
    stun.b.executeActions(heroAbility(wy('wen_thunder_seal')).actions, stun.w, {});
    until(stun.b, 1.55);
    expect(stun.wolves.filter((u) => u.stunUntil > stun.b.time).length).toBeGreaterThanOrEqual(3);
  });

  it('casts in a real fight, and his talismans carry his signature effect', () => {
    const keys = JSON.stringify(heroAbility(wy()).actions);
    expect(keys).toContain('sig_wen_yan');
    const tank = buildHeroUnit({ uid: 'st', defId: 'shan_tie', rank: 1, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID.shan_tie.daoPaths[0].id }, ctx, 1, offsetToAxial(3, 2), true);
    const me = buildHeroUnit(wy('wen_ten_thousand_seals'), ctx, 2, offsetToAxial(1, 2), true);
    const wolves = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 2, 100 + i, p));
    const b = new Battle({ seed: 4, allies: [tank, me], enemies: wolves });
    b.run();
    expect(b.drainEvents().some((e) => e.type === 'cast' && e.id === 2)).toBe(true);
  });
});
