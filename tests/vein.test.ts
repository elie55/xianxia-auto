import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import {
  battleConfig,
  currentRewindCost,
  draftPick,
  enterNode,
  finishBattle,
  newRun,
  rerollCost,
  resolveEventChoice,
  rewind,
  rollShop,
  startBattle,
  type RunSect,
  type RunState,
} from '@/core/run';
import { ITEM_BY_ID } from '@/content/items';
import { VEIN_NODES, veinAddBlocked, veinPoints, veinRemoveBlocked, veinSpent, veinValid } from '@/content/vein';
import { cumulativeXp } from '@/meta/renown';
import { isOpen, runSectFor, sectOf, sectToDo } from '@/meta/sect';

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

const run = (vein?: Record<string, number>, seed = 13): RunState => newRun(0, seed, { seals: [], research: [], vein } as RunSect);

describe('The Spirit Vein web', () => {
  it('has three rings of nodes, 2 points per level, 10 at level V', () => {
    expect(new Set(VEIN_NODES.map((n) => n.ring))).toEqual(new Set([1, 2, 3]));
    expect(veinPoints(1)).toBe(2);
    expect(veinPoints(5)).toBe(10);
    // everything together costs more than 10 points, so the web is a set of choices
    const pairs = [...new Set(VEIN_NODES.filter((n) => n.pair).map((n) => n.pair))];
    const all = VEIN_NODES.reduce((a, n) => a + (n.pair ? 0 : n.max * n.cost), 0) + pairs.reduce((a, p) => a + Math.max(...VEIN_NODES.filter((n) => n.pair === p).map((n) => n.max * n.cost)), 0);
    expect(all).toBeGreaterThan(10);
  });

  it('opens the Trunk after 3 points in the Root and the Crown after 6', () => {
    expect(veinAddBlocked({}, 'gate', 10)).toContain('Needs 3');
    expect(veinAddBlocked({ stones: 3 }, 'gate', 10)).toBeNull();
    expect(veinAddBlocked({ stones: 3, gate: 1 }, 'second_chance', 10)).toContain('Needs 6');
    expect(veinAddBlocked({ stones: 3, reversal: 1, gate: 1, tales: 1 }, 'second_chance', 10)).toBeNull();
  });

  it('takes one side of a pair, caps ranks and points', () => {
    expect(veinAddBlocked({ stones: 3, gate: 1 }, 'blessings', 10)).toContain('Wide Gate');
    expect(veinAddBlocked({ stones: 3 }, 'stones', 10)).toBe('Fully taken');
    expect(veinAddBlocked({ stones: 2 }, 'reroll', 2)).toContain('No points');
    expect(veinValid({ stones: 3, gate: 1, blessings: 1 })).toBe(false);
  });

  it('will not let a Root point go while the Trunk rests on it', () => {
    expect(veinRemoveBlocked({ stones: 3, gate: 1 }, 'stones')).toContain('outer rings');
    expect(veinRemoveBlocked({ stones: 3, gate: 1 }, 'gate')).toBeNull();
    expect(veinRemoveBlocked({ stones: 1 }, 'reroll')).toBe('Nothing to remove');
  });
});

describe('What the sect sends', () => {
  const xp = cumulativeXp(11);
  it('opens at Renown 11 and asks for its points to be placed', () => {
    expect(isOpen('vein', cumulativeXp(10))).toBe(false);
    expect(isOpen('vein', xp)).toBe(true);
    expect(sectToDo(metaWith({ renown: { xp } }))).toContain('The Spirit Vein has 2 points to place.');
  });

  it('sends the web into a run, adds Wide Gate to the free draft rerolls, and a Pure run goes without', () => {
    const m = metaWith({ renown: { xp }, sect: { buildings: { pavilion: 1, forge: 1, vein: 2 }, vein: { stones: 3, gate: 1 } } });
    expect(sectOf(m).vein).toEqual({ stones: 3, gate: 1 });
    const sent = runSectFor(m, '');
    expect(sent.vein).toEqual({ stones: 3, gate: 1 });
    expect(sent.freeRerolls).toBe(1);
    expect(runSectFor(m, '', { pure: true }).vein).toBeUndefined();
    // a web the save cannot hold (two sides of a pair) is refunded
    const broken = metaWith({ renown: { xp }, sect: { vein: { stones: 3, gate: 1, blessings: 1 } } });
    expect(sectOf(broken).vein).toEqual({});
    expect(veinSpent(sectOf(broken).vein)).toBe(0);
  });
});

describe('What each node does in a run', () => {
  it('Spirit Spring: +5 starting Spirit Stones a rank; Open Courtyard: one more reserve slot', () => {
    expect(run().stones).toBe(30);
    expect(run({ stones: 3 }).stones).toBe(45);
    expect(run({ courtyard: 1 }).reserveSize).toBe(2);
  });

  it("Patient Eye: each shop's first reroll is free", () => {
    const s = run({ reroll: 1 });
    rollShop(s);
    expect(rerollCost(s)).toBe(0);
    s.rerollsThisShop = 1;
    expect(rerollCost(s)).toBeGreaterThan(0);
  });

  it('Haggler and Recruiter\'s Eye: a Spirit Stone off Treasures and disciples', () => {
    const base = run(undefined, 21);
    rollShop(base);
    const haggle = run({ haggler: 1 }, 21);
    rollShop(haggle);
    // commons keep their price; rare and epic ones are a Spirit Stone cheaper
    haggle.shop!.items.forEach((it, i) => expect(it!.price).toBe(ITEM_BY_ID[it!.itemId].rarity === 'common' ? base.shop!.items[i]!.price : Math.max(1, base.shop!.items[i]!.price - 1)));
    const recruit = run({ recruiter: 1 }, 21);
    rollShop(recruit);
    recruit.shop!.heroes.forEach((h, i) => expect(h!.price).toBe(Math.max(1, base.shop!.heroes[i]!.price - 1)));
  });

  it('Many Blessings: the opening draft offers 4 blessings', () => {
    expect(run().draft!.blessings).toHaveLength(3);
    expect(run({ blessings: 1 }).draft!.blessings).toHaveLength(4);
  });

  it("Elder's Gift: the first disciple brings a common Treasure", () => {
    const s = run({ parcel: 1 });
    draftPick(s, s.draft!.heroes[0], s.draft!.blessings[0]);
    const commons = s.inventory.filter((id) => ITEM_BY_ID[id]?.rarity === 'common');
    expect(commons.length).toBeGreaterThanOrEqual(1);
  });

  it('Echo of Time: 5 fewer Spirit Stones; Second Chance: 15 fewer for the first reversal of the run', () => {
    expect(currentRewindCost(run({ reversal: 1 }))).toBe(currentRewindCost(run()) - 5);
    const s = run({ second_chance: 1 });
    const plain = run();
    expect(currentRewindCost(s)).toBe(currentRewindCost(plain) - 15);
    expect(rewind(s)).toBe(true);
    expect(rewind(plain)).toBe(true);
    // only the first one
    expect(currentRewindCost(s)).toBe(currentRewindCost(plain));
  });

  it("Campfire Tales: the Sect Rest's stories pay 10 more", () => {
    const stories = (vein?: Record<string, number>) => {
      const s = run(vein);
      s.currentEvent = { eventId: 'sect_rest', outcome: null, chosen: null };
      const before = s.stones;
      const out = resolveEventChoice(s, 'gamble');
      return { gained: s.stones - before, shown: out?.stonesDelta };
    };
    expect(stories({ tales: 1 }).gained).toBe(stories().gained + 10);
    expect(stories({ tales: 1 }).shown).toBe(25);
  });

  it('Battle Spoils: every fight won pays one more Spirit Stone', () => {
    const firstFight = (vein?: Record<string, number>) => {
      const s = run(vein, 3);
      draftPick(s, s.draft!.heroes[0], s.draft!.blessings[0]);
      s.currentEvent = null;
      s.phase = 'board';
      s.nodeIndex = 0;
      enterNode(s);
      startBattle(s);
      finishBattle(s, new Battle(battleConfig(s)!).run());
      return s.lastBreakdown!;
    };
    const plain = firstFight();
    const spoils = firstFight({ spoils: 1 });
    if (plain.base > 0) {
      expect(spoils.vein).toBe(1);
      expect(spoils.total).toBe(plain.total + 1);
    }
  });
});
