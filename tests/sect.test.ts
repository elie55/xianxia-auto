import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { itemPool, newRun, relicPool, rollShop, type FightRecord, type RunState } from '@/core/run';
import { ITEMS, ITEM_BY_ID, SHOP_ITEMS, UNIQUE_ITEMS } from '@/content/items';
import { RELICS, RESEARCH_RELICS, SHOP_RELICS } from '@/content/relics';
import { HEIRLOOM_ITEMS, HEIRLOOM_RECIPES, heirloomItemId } from '@/content/heirlooms';
import { cumulativeXp } from '@/meta/renown';
import {
  BOUNTIES,
  BOUNTY_BY_ID,
  RECIPES,
  STUDIES,
  canAfford,
  computeRunPurse,
  isOpen,
  levelCap,
  levelCost,
  refillBounties,
  runSectFor,
  sectHasNews,
  sectOf,
  studyRelics,
} from '@/meta/sect';

function realmHistory(realm: number, floor = 0): FightRecord[] {
  const kinds = ['fight', 'fight', 'challenge', 'fight', 'single', 'elite', 'fight', 'fight', 'boss'];
  return kinds.map((kind, node) => ({ realm, floor, node, kind, won: true, dealt: 1000, stones: 20 }));
}

function wonRun(tier: number): RunState {
  const s = newRun(tier, 77);
  s.history = [...realmHistory(1), ...realmHistory(2)];
  s.stats.stonesEarned = 500;
  s.nodes = { events: 4, rests: 2 };
  return s;
}

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

describe('What a run pays the sect', () => {
  it('pays a Mortal victory as the design doc says', () => {
    expect(computeRunPurse(wonRun(0))).toEqual({ funds: 125, herbs: 14, cores: 8, jade: 6 });
  });
  it('multiplies by the contract, and guardians leave more jade from Nascent Soul up', () => {
    expect(computeRunPurse(wonRun(3))).toEqual({ funds: 181, herbs: 20, cores: 11, jade: 8 });
    // tier 4: 4 jade per guardian, x1.6
    expect(computeRunPurse(wonRun(4)).jade).toBe(12);
  });
  it('pays Ladder floors in jade', () => {
    const s = wonRun(0);
    s.history!.push(...realmHistory(3, 1), ...realmHistory(3, 2));
    expect(computeRunPurse(s).jade).toBe(6 + 2 * 2);
  });
  it('pays nothing for a run with nothing done', () => {
    expect(computeRunPurse(newRun(0, 3))).toEqual({ funds: 0, herbs: 0, cores: 0, jade: 0 });
  });
});

describe('Seals, studies and heirlooms in a run', () => {
  it('keeps studied-only Insights out until studied, and sealed entries out always', () => {
    const plain = newRun(0, 5);
    expect(relicPool(plain).some((r) => r.research)).toBe(false);
    const sealedItem = SHOP_ITEMS[0].id;
    const sealedRelic = SHOP_RELICS[0].id;
    const s = newRun(0, 5, { seals: [sealedItem, sealedRelic], research: ['five_phases'] });
    expect(itemPool(s).some((i) => i.id === sealedItem)).toBe(false);
    expect(relicPool(s).some((r) => r.id === sealedRelic)).toBe(false);
    expect(relicPool(s).filter((r) => r.research).map((r) => r.id).sort()).toEqual(studyRelics('five_phases').map((r) => r.id).sort());
  });
  it('never offers a sealed Treasure or an unstudied Insight in many shops', () => {
    const sealed = SHOP_ITEMS.slice(0, 6).map((i) => i.id);
    const s = newRun(0, 11, { seals: sealed, research: [] });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      s.stats.fights = i;
      rollShop(s);
      for (const o of s.shop!.items) if (o) seen.add(o.itemId);
      for (const o of s.shop!.relics) if (o) seen.add(o.relicId);
    }
    for (const id of sealed) expect(seen.has(id)).toBe(false);
    for (const r of RESEARCH_RELICS) expect(seen.has(r.id)).toBe(false);
  });
  it('starts the run with the carried heirloom, which only the Forge makes', () => {
    const s = newRun(0, 9, { seals: [], research: [], heirloom: { id: 'jade_seal', level: 2 } });
    expect(s.inventory).toContain(heirloomItemId('jade_seal', 2));
    expect(ITEM_BY_ID[heirloomItemId('jade_seal', 2)]?.heirloom).toBe('jade_seal');
    for (const h of HEIRLOOM_ITEMS) {
      expect(ITEMS.includes(h)).toBe(false);
      expect(SHOP_ITEMS.includes(h)).toBe(false);
      expect(UNIQUE_ITEMS.includes(h)).toBe(false);
    }
    expect(HEIRLOOM_ITEMS.length).toBe(HEIRLOOM_RECIPES.length * 3);
  });
  it('every study names three real Insights, every Insight one real study', () => {
    for (const st of STUDIES) expect(studyRelics(st.id).length).toBe(3);
    for (const r of RELICS.filter((x) => x.research)) expect(STUDIES.some((st) => st.id === r.research)).toBe(true);
  });
});

describe('Buildings, the board and the save', () => {
  it('caps building levels by the sect rank and prices them by the doc', () => {
    expect(levelCap(0)).toBe(1);
    expect(levelCap(cumulativeXp(10))).toBe(2);
    expect(levelCap(cumulativeXp(40))).toBe(5);
    expect(levelCost(2, 'herbs')).toEqual({ funds: 100, herbs: 10 });
    expect(levelCost(4, 'cores')).toEqual({ funds: 450, cores: 45, jade: 5 });
    expect(isOpen('pavilion', cumulativeXp(2))).toBe(false);
    expect(isOpen('pavilion', cumulativeXp(3))).toBe(true);
    expect(isOpen('forge', cumulativeXp(5))).toBe(true);
  });
  it('keeps three bounties up and cycles through the whole pool', () => {
    let board = refillBounties([], []);
    expect(board.active).toHaveLength(3);
    const metAll = new Set<string>();
    for (let i = 0; i < BOUNTIES.length + 3; i++) {
      const met = board.active[0];
      metAll.add(met);
      board = refillBounties(board.active.slice(1), [...board.done, met]);
      expect(board.active).toHaveLength(3);
      expect(new Set(board.active).size).toBe(3);
    }
    expect(metAll.size).toBe(BOUNTIES.length);
  });
  it('checks bounties against a finished run', () => {
    const s = wonRun(1);
    expect(BOUNTY_BY_ID.realm_one.met(s)).toBe(true);
    expect(BOUNTY_BY_ID.two_elites.met(s)).toBe(true);
    expect(BOUNTY_BY_ID.trial.met(s)).toBe(true);
    s.realm = 2;
    expect(BOUNTY_BY_ID.above_mortals.met(s)).toBe(true);
    expect(BOUNTY_BY_ID.cuts.met(s)).toBe(false);
  });
  it('reads older saves with defaults and sends seals, studies and the heirloom into a run', () => {
    const m = metaWith({ renown: { xp: cumulativeXp(6) } });
    expect(sectOf(m).buildings).toEqual({ pavilion: 1, forge: 1 });
    m.sect = { seals: ['monk_beads'], research: ['five_phases'], heirlooms: [{ id: 'founder_sword', level: 2 }], purse: { funds: 0, herbs: 0, cores: 0, jade: 0 } };
    expect(runSectFor(m, 'founder_sword')).toEqual({ seals: ['monk_beads'], research: ['five_phases'], heirloom: { id: 'founder_sword', level: 2 } });
    // a closed Forge sends no heirloom
    expect(runSectFor(metaWith({ renown: { xp: cumulativeXp(3) }, sect: m.sect }), 'founder_sword').heirloom).toBeUndefined();
  });
  it('lights the menu dot only when something can be done', () => {
    const m = metaWith({ renown: { xp: cumulativeXp(5) } });
    expect(sectHasNews(m)).toBe(false);
    m.sect = { purse: { funds: 80, herbs: 0, cores: 6, jade: 0 } };
    expect(canAfford(sectOf(m).purse, RECIPES[0].cost)).toBe(true);
    expect(sectHasNews(m)).toBe(true);
  });
});
