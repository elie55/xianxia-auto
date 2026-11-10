import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import type { BattleEvent } from '@/battle/sim/events';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { ENEMY_BY_ID } from '@/content/enemies';
import { offsetToAxial } from '@/battle/sim/hex';
import { Rng } from '@/core/rng';
import { generateEncounter } from '@/core/encounters';
import { HEIRLOOM_ITEMS, HEIRLOOM_RECIPES, heirloomItemId } from '@/content/heirlooms';
import { ITEMS, ITEM_BY_ID } from '@/content/items';

const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };

const hero = (defId: string, items: string[] = []): HeroState => ({ uid: defId, defId, rank: 0, insightIds: [], items, permanent: [] });

/** Disciples get ids 1, 2, 3… in order, at the given [col, row] (ally columns 0–3, front = 2–3). */
type Member = { h: HeroState; at: [number, number] };

/** An early Realm I fight, so the disciples live long enough for the effects to show. `setup` runs before the fight. */
function fight(team: Member[], seed: number, setup?: (b: Battle) => void) {
  const enc = generateEncounter(1, 2, 'fight', 0, new Rng(seed));
  const allies = team.map((m, i) => buildHeroUnit(m.h, ctx, i + 1, offsetToAxial(...m.at), true));
  const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
  const b = new Battle({ seed, allies, enemies });
  setup?.(b);
  b.run();
  return b.drainEvents();
}

const unit = (b: Battle, id: number) => b.units.find((u) => u.id === id)!;
const of = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) => events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

describe('Heirloom Treasures', () => {
  it('every level of every heirloom exists, says what it does and stays out of the shop list', () => {
    for (const r of HEIRLOOM_RECIPES)
      for (const lvl of [1, 2, 3]) {
        const it = ITEM_BY_ID[heirloomItemId(r.id, lvl)];
        expect(it, `${r.id} ${lvl}`).toBeTruthy();
        expect(it.icon).toBe(r.icon);
        expect(it.desc).toBeTruthy();
        expect(it.effects?.length).toBeGreaterThan(0);
      }
    const shop = new Set(ITEMS.map((i) => i.id));
    expect(HEIRLOOM_ITEMS.some((i) => shop.has(i.id))).toBe(false);
  });

  it("their effects are the sect's own: no shop Treasure uses them", () => {
    const sig = (e: NonNullable<(typeof ITEMS)[number]['effects']>[number]) => e.id;
    const heirloomEffects = new Set(HEIRLOOM_ITEMS.flatMap((i) => (i.effects ?? []).map(sig)));
    for (const it of ITEMS) for (const e of it.effects ?? []) expect(heirloomEffects.has(sig(e)), it.id).toBe(false);
    // the shapes they rely on are not on any shop Treasure either
    const json = JSON.stringify(ITEMS.map((i) => i.effects ?? []));
    expect(json).not.toContain('"allyDied"');
    expect(json).not.toContain('"allAllies"');
    expect(json).not.toContain('"lowestHpAlly"');
  });

  it("Ancestral Jade Seal shields every ally from the bearer's life when the fight starts", () => {
    let bearerMaxHp = 0;
    const events = fight(
      [
        { h: hero('li_jian', [heirloomItemId('jade_seal', 1)]), at: [3, 2] },
        { h: hero('hong_lian'), at: [1, 1] },
        { h: hero('mei_yao'), at: [1, 3] },
      ],
      5,
      (b) => (bearerMaxHp = unit(b, 1).maxHp),
    );
    const ward = of(events, 'shield').filter((e) => e.t < 0.1 && e.amount === Math.round(bearerMaxHp * 0.05));
    expect(new Set(ward.map((e) => e.id))).toEqual(new Set([1, 2, 3]));
  });

  it("Wandering Elder's Gourd tends the most wounded ally, not just its bearer", () => {
    let expected = 0;
    const events = fight(
      [
        { h: hero('li_jian', [heirloomItemId('elder_gourd', 1)]), at: [2, 2] },
        { h: hero('long_mu'), at: [3, 2] },
        { h: hero('hong_lian'), at: [0, 2] },
      ],
      2,
      (b) => {
        const hurt = unit(b, 3);
        hurt.hp = Math.round(hurt.maxHp * 0.25);
        const bearer = unit(b, 1);
        expected = Math.round(bearer.maxHp * 0.04 + bearer.stat('spirit') * 0.4);
      },
    );
    const drink = of(events, 'heal').find((e) => e.sourceId === 1 && Math.abs(e.t - 3) < 0.05);
    expect(drink?.id).toBe(3);
    expect(drink?.amount).toBe(expected);
  });

  it('Storm-Calling Banner rallies every ally and calls lightning when its bearer casts', () => {
    const events = fight(
      [
        { h: hero('hong_lian', [heirloomItemId('storm_banner', 1)]), at: [1, 2] },
        { h: hero('li_jian'), at: [3, 1] },
        { h: hero('long_mu'), at: [3, 3] },
      ],
      3,
      (b) => (unit(b, 1).qi = unit(b, 1).maxQi),
    );
    const cast = of(events, 'cast').find((e) => e.id === 1);
    expect(cast).toBeTruthy();
    const during = (t: number) => t >= cast!.t && t <= cast!.t + cast!.castTime;
    const alive = new Set([1, 2, 3].filter((id) => !of(events, 'death').some((d) => d.id === id && d.t <= cast!.t)));
    const rallied = of(events, 'buff').filter((e) => e.stat === 'attackSpeed' && e.flat === 12 && during(e.t));
    expect(new Set(rallied.map((e) => e.id))).toEqual(alive);
    expect(of(events, 'vfx').some((e) => e.key === 'lightning' && e.id === 1 && during(e.t))).toBe(true);
  });

  it("Sect Founder's Sword grows each time an ally falls, up to three times", () => {
    // four allies burn down on the first damage tick, while the bearer stands at the back
    const doomed = (b: Battle) => [2, 3, 4, 5].forEach((id) => b.applyStatus(unit(b, 100), unit(b, id), 'burn', 1, 2, 99999));
    const events = fight(
      [
        { h: hero('shan_tie', [heirloomItemId('founder_sword', 1)]), at: [0, 2] },
        { h: hero('mei_yao'), at: [3, 0] },
        { h: hero('hong_lian'), at: [3, 1] },
        { h: hero('li_jian'), at: [3, 3] },
        { h: hero('long_mu'), at: [3, 4] },
      ],
      4,
      doomed,
    );
    const deaths = of(events, 'death');
    const bearerDeath = deaths.find((d) => d.id === 1)?.t ?? Infinity;
    const allyFalls = deaths.filter((d) => d.id >= 2 && d.id <= 5 && d.t < bearerDeath);
    expect(allyFalls.length).toBe(4);
    const resolve = of(events, 'buff').filter((e) => e.id === 1 && e.stat === 'attack' && e.pct === 10);
    expect(resolve.map((e) => e.t)).toEqual(allyFalls.slice(0, 3).map((d) => d.t));
    const speed = of(events, 'buff').filter((e) => e.id === 1 && e.stat === 'attackSpeed' && e.flat === 10);
    expect(speed.length).toBe(3);
  });
});
