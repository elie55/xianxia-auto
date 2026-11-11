import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import type { BattleEvent } from '@/battle/sim/events';
import { offsetToAxial } from '@/battle/sim/hex';
import { buildEnemyUnit, buildHeroUnit, heroStats, type HeroState } from '@/core/builder';
import { generateEncounter } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { addHero, difficultyMods, newRun, rerollCost, rollShop, teamContext, type FightRecord, type RunSect, type RunState } from '@/core/run';
import { ENEMY_BY_ID } from '@/content/enemies';
import { DOCTRINES, DOCTRINE_BY_ID } from '@/content/doctrines';
import { HEROES } from '@/content/heroes';
import { computeRunRenown, cumulativeXp } from '@/meta/renown';
import { DOCTRINE_LIST, DOCTRINE_TERMS, computeRunPurse, isOpen, runSectFor, sectOf, sectToDo } from '@/meta/sect';

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

const sect = (doctrine?: string, extra: Partial<RunSect> = {}): RunSect => ({ seals: [], research: [], doctrine, ...extra });
const run = (doctrine?: string, seed = 11, extra: Partial<RunSect> = {}) => newRun(0, seed, sect(doctrine, extra));

function wonRun(s: RunState): RunState {
  const kinds = ['fight', 'fight', 'challenge', 'fight', 'single', 'elite', 'fight', 'fight', 'boss'];
  const realm = (r: number): FightRecord[] => kinds.map((kind, node) => ({ realm: r, floor: 0, node, kind, won: true, dealt: 1000, stones: 20 }));
  s.history = [...realm(1), ...realm(2)];
  s.stats.stonesEarned = 500;
  s.nodes = { events: 4, rests: 2 };
  return s;
}

describe('The Doctrine Hall', () => {
  it('teaches the nine doctrines of the design doc, each with an upside, a cost and a price', () => {
    expect(DOCTRINES).toHaveLength(9);
    for (const d of DOCTRINES) {
      expect(d.upside, d.id).toBeTruthy();
      expect(d.cost, d.id).toBeTruthy();
      expect(DOCTRINE_TERMS[d.id], d.id).toBeTruthy();
    }
    // every hall level teaches something, and level I teaches two
    for (const lvl of [1, 2, 3, 4, 5]) expect(DOCTRINE_LIST.some((d) => d.hall === lvl), `level ${lvl}`).toBe(true);
    expect(DOCTRINE_LIST.filter((d) => d.hall === 1)).toHaveLength(2);
  });

  it('opens at Renown 7 and offers what it can teach and the sect can afford', () => {
    expect(isOpen('doctrine', cumulativeXp(6))).toBe(false);
    expect(isOpen('doctrine', cumulativeXp(7))).toBe(true);
    const m = metaWith({ renown: { xp: cumulativeXp(7) }, sect: { purse: { funds: 200, herbs: 0, cores: 0, jade: 5 } } });
    expect(sectOf(m).buildings.doctrine).toBe(1);
    const todo = sectToDo(m).filter((t) => t.includes('Doctrine Hall can teach'));
    expect(todo).toHaveLength(2);
  });

  it('sends a learned doctrine into a run, never an unlearned one, and a Pure run leaves it and the heirloom at home', () => {
    const m = metaWith({ renown: { xp: cumulativeXp(9) }, sect: { doctrines: ['herbs'], heirlooms: [{ id: 'jade_seal', level: 2 }] } });
    expect(runSectFor(m, 'jade_seal', { doctrine: 'herbs' }).doctrine).toBe('herbs');
    expect(runSectFor(m, 'jade_seal', { doctrine: 'wandering' }).doctrine).toBeUndefined();
    const pure = runSectFor(m, 'jade_seal', { doctrine: 'herbs', pure: true });
    expect(pure.pure).toBe(true);
    expect(pure.doctrine).toBeUndefined();
    expect(pure.heirloom).toBeUndefined();
    // before the hall opens, nothing is sent
    const early = metaWith({ renown: { xp: cumulativeXp(6) }, sect: { doctrines: ['herbs'] } });
    expect(runSectFor(early, '', { doctrine: 'herbs' }).doctrine).toBeUndefined();
  });
});

describe('What each doctrine does to a run', () => {
  it('Hundred Herbs Valley: 10 fewer starting Spirit Stones', () => {
    expect(run().stones).toBe(30);
    expect(run('herbs').stones).toBe(20);
  });

  it('Frost Lattice: one reserve slot fewer', () => {
    const s = run('frost');
    expect(s.reserveSize).toBe(0);
    expect(s.reserve).toHaveLength(0);
  });

  it("Merchant's Way: one more Treasure in the shop; Sword Peak: one Dao Insight fewer", () => {
    const base = run(undefined, 5);
    rollShop(base);
    const merchant = run('merchant', 5);
    rollShop(merchant);
    expect(merchant.shop!.items.length).toBe(base.shop!.items.length + 1);
    const sword = run('sword', 5);
    rollShop(sword);
    expect(sword.shop!.relics.length).toBe(base.shop!.relics.length - 1);
  });

  it('Talisman Court: every Treasure costs 2 more; Thousand Fists: rerolls cost 1 more', () => {
    const base = run(undefined, 9);
    rollShop(base);
    const court = run('talisman', 9);
    rollShop(court);
    // same seed, same Treasures; only the price moves
    expect(court.shop!.items.map((i) => i?.itemId)).toEqual(base.shop!.items.map((i) => i?.itemId));
    court.shop!.items.forEach((it, i) => expect(it!.price).toBe(base.shop!.items[i]!.price + 2));
    expect(rerollCost(run('fists'))).toBe(rerollCost(base) + 1);
  });

  it('Shadow Pavilion: foes have 5% more HP', () => {
    expect(difficultyMods(run('shadow')).enemyHpPct).toBe(difficultyMods(run()).enemyHpPct + 5);
  });

  it('Sword Peak: Sword Cultivators join at Foundation, other disciples do not', () => {
    const s = run('sword');
    expect(addHero(s, 'li_jian', 0).rank).toBe(1);
    expect(addHero(s, 'shan_tie', 0).rank).toBe(0);
    expect(addHero(run(), 'li_jian', 0).rank).toBe(0);
  });

  it("Iron Mountain: Body Refiners +15% Max HP, everyone -10 Attack Speed; Thousand Fists: Martial Artists +15 Attack Speed", () => {
    const h = (defId: string): HeroState => ({ uid: defId, defId, rank: 0, insightIds: [], items: [], permanent: [] });
    const stat = (s: RunState, defId: string) => heroStats(h(defId), teamContext(s), null);
    const base = run();
    const iron = run('iron');
    expect(stat(iron, 'shan_tie').hp).toBe(Math.round(stat(base, 'shan_tie').hp * 1.15));
    expect(stat(iron, 'li_jian').hp).toBe(stat(base, 'li_jian').hp);
    expect(stat(iron, 'li_jian').attackSpeed).toBe(stat(base, 'li_jian').attackSpeed - 10);
    const fists = run('fists');
    expect(stat(fists, 'tie_quan').attackSpeed).toBe(stat(base, 'tie_quan').attackSpeed + 15);
    expect(stat(fists, 'li_jian').attackSpeed).toBe(stat(base, 'li_jian').attackSpeed);
  });

  it('a doctrine never shows up as a Dao Insight the run owns', () => {
    const s = run('iron');
    expect(s.relics).toHaveLength(0);
    expect(teamContext(s).relics.every((r) => r.id.startsWith('doctrine_'))).toBe(true);
  });
});

describe('Doctrines in battle', () => {
  const hero = (defId: string): HeroState => ({ uid: defId, defId, rank: 0, insightIds: [], items: [], permanent: [] });
  const fight = (doctrine: string | undefined, team: [string, [number, number]][], seed: number) => {
    const ctx = teamContext(run(doctrine));
    const enc = generateEncounter(1, 2, 'fight', 0, new Rng(seed));
    const allies = team.map(([id, at], i) => buildHeroUnit(hero(id), ctx, i + 1, offsetToAxial(...at), true));
    const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
    const b = new Battle({ seed, allies, enemies });
    b.run();
    return b.drainEvents();
  };
  const of = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) => events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

  it("Shadow Pavilion: a Shadow Walker's first attack is a Crit", () => {
    for (const seed of [3, 4, 5]) {
      const events = fight('shadow', [['ying_wu', [3, 1]]], seed);
      const first = of(events, 'damage').find((e) => e.sourceId === 1 && !e.dot);
      expect(first?.crit, `seed ${seed}`).toBe(true);
    }
  });

  it('Hundred Herbs Valley: healing is 15% stronger (lifesteal is not)', () => {
    const heal = (doctrine?: string, silent = false) => {
      const ctx = teamContext(run(doctrine));
      const enc = generateEncounter(1, 2, 'fight', 0, new Rng(21));
      const allies = [buildHeroUnit(hero('mei_yao'), ctx, 1, offsetToAxial(1, 1), true), buildHeroUnit(hero('shan_tie'), ctx, 2, offsetToAxial(3, 1), true)];
      const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
      const b = new Battle({ seed: 21, allies, enemies });
      b.tick();
      const [healer, tank] = [b.units.find((u) => u.id === 1)!, b.units.find((u) => u.id === 2)!];
      tank.hp = 1;
      return b.heal(healer, tank, 100, { silentTrigger: silent });
    };
    expect(heal()).toBe(100);
    expect(heal('herbs')).toBe(115);
    expect(heal('herbs', true)).toBe(100);
  });

  it("Talisman Court: a Talisman Master starts the fight with 15 Qi", () => {
    const qi = (doctrine?: string) => {
      const ctx = teamContext(run(doctrine));
      const enc = generateEncounter(1, 2, 'fight', 0, new Rng(8));
      const allies = [buildHeroUnit(hero('hong_lian'), ctx, 1, offsetToAxial(1, 1), true)];
      const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
      const b = new Battle({ seed: 8, allies, enemies });
      b.tick();
      return b.units.find((u) => u.id === 1)!.qi;
    };
    expect(qi('talisman')).toBe(qi() + 15);
  });
});

describe('What a doctrine or a Pure run pays', () => {
  it('Wandering Cultivator: +20% Sect Renown on fights and realms, +20% Sect Funds', () => {
    const plain = computeRunRenown(wonRun(run()));
    const wander = computeRunRenown(wonRun(run('wandering')));
    const earned = plain.base + plain.contractBonus;
    expect(wander.total - plain.total).toBe(Math.round(earned * 0.2));
    expect(wander.lines.some((l) => l.key === 'doctrine')).toBe(true);
    expect(computeRunPurse(wonRun(run('wandering'))).funds).toBe(Math.floor(computeRunPurse(wonRun(run())).funds * 1.2));
  });

  it('a Pure run pays +20% Sect Renown, not more Funds', () => {
    const plain = computeRunRenown(wonRun(run()));
    const pure = computeRunRenown(wonRun(run(undefined, 11, { pure: true })));
    expect(pure.total - plain.total).toBe(Math.round((plain.base + plain.contractBonus) * 0.2));
    expect(pure.lines.find((l) => l.key === 'pure')?.label).toContain('Pure');
    expect(computeRunPurse(wonRun(run(undefined, 11, { pure: true }))).funds).toBe(computeRunPurse(wonRun(run())).funds);
  });

  it('every class a doctrine favours has disciples to follow it', () => {
    for (const d of DOCTRINES) {
      expect(DOCTRINE_BY_ID[d.id]).toBe(d);
      if (d.class) expect(HEROES.some((h) => h.classes.includes(d.class!)), d.id).toBe(true);
    }
  });
});
