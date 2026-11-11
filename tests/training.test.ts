import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import { heroStats, type HeroState } from '@/core/builder';
import { battleConfig, buyHero, draftPick, enterNode, finishBattle, newRun, rollShop, startBattle, teamContext, type RunSect, type RunState } from '@/core/run';
import { ALL_BLESSINGS, BLESSINGS, TRAINING_BLESSINGS } from '@/content/difficulties';
import { ITEM_BY_ID } from '@/content/items';
import { RELIC_BY_ID } from '@/content/relics';
import { cumulativeXp } from '@/meta/renown';
import { blessingCountFor, isOpen, runSectFor, trainedBlessings } from '@/meta/sect';

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

const ALL = TRAINING_BLESSINGS.map((b) => b.id);
const run = (extra: Partial<RunSect> = {}, seed = 17): RunState => newRun(0, seed, { seals: [], research: [], blessings: ALL, ...extra });

/** Starts a run on the given blessing, whatever the draft rolled. */
function blessed(apply: string, seed = 17): RunState {
  const s = run({}, seed);
  draftPick(s, s.draft!.heroes[0], apply);
  return s;
}

describe('The Training Grounds', () => {
  it('teach six blessings over their levels, and the draft shows a fourth at level V', () => {
    expect(TRAINING_BLESSINGS).toHaveLength(6);
    expect(ALL_BLESSINGS).toHaveLength(BLESSINGS.length + 6);
    expect(trainedBlessings(1)).toEqual(['spoils', 'armory']);
    expect(trainedBlessings(4)).toHaveLength(6);
    expect(blessingCountFor(4)).toBe(3);
    expect(blessingCountFor(5)).toBe(4);
    expect(isOpen('training', cumulativeXp(12))).toBe(false);
    expect(isOpen('training', cumulativeXp(13))).toBe(true);
  });

  it('send their blessings into every run, a Pure one too (they add choices, not power)', () => {
    const m = metaWith({ renown: { xp: cumulativeXp(13) }, sect: { buildings: { pavilion: 1, forge: 1, training: 2 } } });
    expect(runSectFor(m, '').blessings).toEqual(['spoils', 'armory', 'vitality']);
    expect(runSectFor(m, '', { pure: true }).blessings).toEqual(['spoils', 'armory', 'vitality']);
    expect(runSectFor(metaWith({ renown: { xp: cumulativeXp(12) } }), '').blessings).toEqual([]);
  });

  it("the opening draft draws from the wider pool and shows as many as the grounds allow", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) for (const b of run({}, seed).draft!.blessings) seen.add(b);
    for (const id of ALL) expect(seen.has(id), id).toBe(true);
    expect(run({ blessingCount: 4 }).draft!.blessings).toHaveLength(4);
    // without the grounds, only the six launch blessings
    const plain = new Set<string>();
    for (let seed = 1; seed < 60; seed++) for (const b of newRun(0, seed).draft!.blessings) plain.add(b);
    for (const id of ALL) expect(plain.has(id), id).toBe(false);
  });
});

describe('What each Training Grounds blessing does', () => {
  it('Sect Armory: two common Treasures to start', () => {
    const s = blessed('armory');
    expect(s.inventory.filter((id) => ITEM_BY_ID[id]?.rarity === 'common')).toHaveLength(2);
  });

  it('Enlightened Start: a common Dao Insight to start', () => {
    const s = blessed('insight');
    expect(s.relics).toHaveLength(1);
    expect(RELIC_BY_ID[s.relics[0].id].rarity).toBe('common');
  });

  it('Vital Breath and Swift Wind Steps: +8% Max HP, +8 Attack Speed', () => {
    const h: HeroState = { uid: 'x', defId: 'li_jian', rank: 0, insightIds: [], items: [], permanent: [] };
    const base = heroStats(h, teamContext(blessed('wealth')), null);
    expect(heroStats(h, teamContext(blessed('vitality')), null).hp).toBe(Math.round(base.hp * 1.08));
    expect(heroStats(h, teamContext(blessed('swift')), null).attackSpeed).toBe(base.attackSpeed + 8);
  });

  it('Rising Talent: the first disciple bought joins at Foundation, the next ones do not', () => {
    const s = blessed('ascendant');
    s.stones = 500;
    s.phase = 'shop';
    rollShop(s);
    const owned = new Set(s.roster.map((h) => h.defId));
    const offers = s.shop!.heroes.filter((h) => h && !owned.has(h.defId) && h.rank === 0);
    expect(offers.length).toBeGreaterThanOrEqual(2);
    buyHero(s, offers[0]!.key);
    buyHero(s, offers[1]!.key);
    const bought = s.roster.slice(1);
    expect(bought[0].rank).toBe(1);
    expect(bought[1].rank).toBe(0);
  });

  it('Spoils of War: an elite pays 10 more, a regular fight does not', () => {
    const fightAt = (apply: string, node: number) => {
      const s = blessed(apply, 3);
      s.currentEvent = null;
      s.phase = 'board';
      s.nodeIndex = node;
      enterNode(s);
      // one weak foe, so the lone disciple wins: the node keeps its kind
      const enc = s.currentEncounter!;
      enc.enemies = [{ ...enc.enemies[0], defId: 'spirit_wolf' }];
      enc.level = 0;
      startBattle(s);
      finishBattle(s, new Battle(battleConfig(s)!).run());
      return s.lastBreakdown!;
    };
    expect(fightAt('spoils', 0).blessing).toBeUndefined();
    // node 7 of Realm I is the elite
    expect(fightAt('spoils', 7).blessing).toBe(10);
    expect(fightAt('wealth', 7).blessing).toBeUndefined();
  });
});
