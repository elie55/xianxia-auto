import { describe, expect, it } from 'vitest';
import { Battle, STONES_SCALE_CAP } from '@/battle/sim/battle';
import type { Unit } from '@/battle/sim/unit';
import { buildEnemyUnit, buildHeroUnit, heroAbility, type HeroState, type TeamContext } from '@/core/builder';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RECRUIT_BY_HERO } from '@/meta/sect';
import { battleConfig, draftPick, enterNode, heroPool, newRun } from '@/core/run';

/** Jin Ding, the fourth exclusive disciple (Renown 35): her cauldron turns the run's Spirit Stones into healing. */
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const jd = (daoPathId?: string): HeroState => ({ uid: 'jd', defId: 'jin_ding', rank: 1, insightIds: [], items: [], permanent: [], daoPathId });
const ally = (defId: string, uid: string): HeroState => ({ uid, defId, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID[defId].daoPaths[0].id });

/** Jin Ding with two wounded allies and a stunned wolf, the run holding `stones` Spirit Stones. */
function ward(stones: number, path?: string) {
  const b = new Battle({
    seed: 1,
    stonesHeld: stones,
    allies: [buildHeroUnit(jd(path), ctx, 1, offsetToAxial(1, 2), true), buildHeroUnit(ally('shan_tie', 'st'), ctx, 2, offsetToAxial(3, 1), true), buildHeroUnit(ally('li_jian', 'lj'), ctx, 3, offsetToAxial(2, 3), true)],
    enemies: [buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 0, 100, offsetToAxial(7, 2))],
  });
  for (const u of b.units) u.stunUntil = 99;
  const [me, tank, sword] = ['jin_ding', 'shan_tie', 'li_jian'].map((id) => b.units.find((u) => u.defId === id)!);
  tank.hp = tank.maxHp - 700;
  sword.hp = Math.round(sword.maxHp * 0.3);
  me.hp = me.maxHp;
  return { b, me, tank, sword };
}
const cast = (b: Battle, me: Unit, path?: string) => b.executeActions(heroAbility(jd(path)).actions, me, {});
const healOf = (me: Unit, stones: number, perStone = 2) => Math.round(me.stat('spirit') * 0.6 + Math.min(stones, STONES_SCALE_CAP) * perStone);

describe('Jin Ding, Golden Elixir', () => {
  it('is an exclusive Alchemist and Body Refiner the sect recruits at Renown 35', () => {
    const def = HERO_BY_ID.jin_ding;
    expect(def.exclusive).toBe(true);
    expect(def.classes).toEqual(['alchemist', 'body']);
    expect(RECRUIT_BY_HERO.jin_ding).toMatchObject({ renown: 35, cost: { funds: 450, jade: 10 } });
    expect(heroPool(newRun(0, 3)).some((h) => h.id === 'jin_ding')).toBe(false);
    expect(heroPool(newRun(0, 3, { seals: [], research: [], disciples: ['jin_ding'] })).some((h) => h.id === 'jin_ding')).toBe(true);
  });

  it('heals every ally for 60% Spirit + 2 per Spirit Stone held, and the most wounded twice', () => {
    const { b, me, tank, sword } = ward(30);
    const t0 = tank.hp;
    const s0 = sword.hp;
    cast(b, me);
    const one = healOf(me, 30);
    expect(tank.hp - t0).toBe(one);
    // Li Jian is the most wounded (30% HP): healed twice
    expect(sword.hp - s0).toBe(2 * one);
  });

  it('counts Spirit Stones up to 60, and stones earned in the fight count too', () => {
    const poor = ward(0);
    const t0 = poor.tank.hp;
    cast(poor.b, poor.me);
    const rich = ward(500);
    const t1 = rich.tank.hp;
    cast(rich.b, rich.me);
    expect(rich.tank.hp - t1 - (poor.tank.hp - t0)).toBe(2 * STONES_SCALE_CAP);
    const earning = ward(10);
    earning.b.stonesBonus = 5;
    expect(earning.b.stonesCounted).toBe(15);
  });

  it('Transmutation turns healing past full HP into a shield, up to 20% of Max HP', () => {
    const { b, me, tank } = ward(60);
    // combat start sets the passive's counter
    b.tick(0.05);
    tank.hp = tank.maxHp;
    cast(b, me);
    expect(tank.shield).toBe(Math.round(Math.min(healOf(me, 60), tank.maxHp * 0.2)));
    cast(b, me);
    expect(tank.shield).toBeLessThanOrEqual(Math.ceil(tank.maxHp * 0.2));
  });

  it('Gilded Skin gives every ally a shield of 5% of her Max HP and lets Transmutation reach 35%', () => {
    const { b, me, tank } = ward(0, 'jin_gilded_skin');
    b.tick(0.05);
    expect(me.counter('overhealShield')).toBe(35);
    const s0 = tank.shield;
    cast(b, me, 'jin_gilded_skin');
    // the tank is not healed past full here, so its new shield is the Gilded Skin one alone
    expect(tank.shield - s0).toBe(Math.round(me.maxHp * 0.05));
  });

  it('Bottomless Cauldron costs 50 Qi and feeds the others 10 Qi; Golden Market heals 3 per Stone and sells 3 pills per fight', () => {
    expect(heroAbility(jd('jin_bottomless')).qiCost).toBe(50);
    const deep = ward(0, 'jin_bottomless');
    const q0 = deep.tank.qi;
    cast(deep.b, deep.me, 'jin_bottomless');
    expect(deep.tank.qi - q0).toBe(10);
    expect(deep.me.qi).toBe(0);

    const market = ward(20, 'jin_golden_market');
    const t0 = market.tank.hp;
    cast(market.b, market.me, 'jin_golden_market');
    expect(market.tank.hp - t0).toBe(healOf(market.me, 20, 3));
    // the cast trigger sells a pill each time, at most three times in a fight
    market.b.tick(0.05);
    for (let i = 0; i < 5; i++) market.b.fire(market.me, 'cast', {});
    expect(market.b.stonesBonus).toBe(3);
  });

  it('the run hands its Spirit Stones to the fight, and she casts in a real fight', () => {
    const s = newRun(0, 4);
    draftPick(s, 'li_jian', s.draft!.blessings[0]);
    s.currentEvent = null;
    s.nodeIndex = 0;
    enterNode(s);
    s.stones = 42;
    expect(battleConfig(s)!.stonesHeld).toBe(42);

    const tank = buildHeroUnit(ally('shan_tie', 'st'), ctx, 1, offsetToAxial(3, 2), true);
    const me = buildHeroUnit(jd('jin_bottomless'), ctx, 2, offsetToAxial(2, 2), true);
    const wolves = [offsetToAxial(4, 1), offsetToAxial(4, 2), offsetToAxial(4, 3)].map((p, i) => buildEnemyUnit(ENEMY_BY_ID.spirit_wolf, 4, 100 + i, p));
    const b = new Battle({ seed: 4, stonesHeld: 30, allies: [tank, me], enemies: wolves });
    b.run();
    expect(b.drainEvents().some((e) => e.type === 'cast' && e.id === 2)).toBe(true);
  });
});
