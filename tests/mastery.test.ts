import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, heroAbility, heroDaoPath } from '@/core/builder';
import { generateEncounter } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { addHero, battleConfig, chooseUpgrade, draftPick, enterNode, finishBattle, newRun, prepareRankUp, queueRankUp, startBattle, type RunState } from '@/core/run';
import { HEROES, HERO_BY_ID } from '@/content/heroes';
import { LORE_II, MASTERY_PATHS } from '@/content/mastery';
import { MASTER_TITLES, MASTERY_THRESHOLDS, addMastery, masteryLevel, masteryLevels, masterTitleId } from '@/meta/mastery';
import { TITLES } from '@/meta/cosmetics';
import { howToUnlock, unlockedCosmetics } from '@/meta/unlocks';
import { runSectFor } from '@/meta/sect';

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

describe('Disciple mastery', () => {
  it('reaches levels I to V at 3, 10, 20, 35 and 50 fights won', () => {
    expect(MASTERY_THRESHOLDS).toEqual([3, 10, 20, 35, 50]);
    expect([0, 2, 3, 9, 10, 19, 20, 34, 35, 49, 50, 99].map(masteryLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("adds a run's wins and lists every level reached on the way", () => {
    const { mastery, ups } = addMastery({ li_jian: 8 }, { li_jian: 13, shan_tie: 3, nobody: 4 });
    expect(mastery).toEqual({ li_jian: 21, shan_tie: 3 });
    expect(ups).toEqual([
      { hero: 'li_jian', level: 2 },
      { hero: 'li_jian', level: 3 },
      { hero: 'shan_tie', level: 1 },
    ]);
  });

  it('gives every disciple a second lore page, a title and an exclusive fourth path of its own', () => {
    const ids = new Set<string>();
    for (const h of HEROES) {
      expect(LORE_II[h.id], h.id).toBeTruthy();
      expect(MASTER_TITLES[h.id], h.id).toBeTruthy();
      expect(TITLES.some((t) => t.id === masterTitleId(h.id)), h.id).toBe(true);
      const path = MASTERY_PATHS[h.id];
      expect(path, h.id).toBeTruthy();
      expect(path.desc, h.id).toBeTruthy();
      // a fourth path, not one of the three
      expect(h.daoPaths.some((p) => p.id === path.id), h.id).toBe(false);
      ids.add(path.id);
      // it changes something: stats, effects or the technique
      expect(!!(path.stats || path.statsPct || path.effects?.length || path.ability), h.id).toBe(true);
    }
    expect(ids.size).toBe(HEROES.length);
    expect(Object.keys(MASTERY_PATHS).every((id) => HERO_BY_ID[id])).toBe(true);
  });

  it('every exclusive path plays in a real fight, and its disciple casts with it', () => {
    const ctx = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
    for (const h of HEROES) {
      const me = { uid: h.id, defId: h.id, rank: 1 as const, insightIds: [], items: [], permanent: [], daoPathId: MASTERY_PATHS[h.id].id };
      const tank = h.id === 'shan_tie' ? 'bai_hu' : 'shan_tie';
      const allies = [
        buildHeroUnit({ uid: tank, defId: tank, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID[tank].daoPaths[0].id }, ctx, 1, offsetToAxial(3, 1), true),
        buildHeroUnit(me, ctx, 2, offsetToAxial((h.baseStats.range ?? 1) <= 2 ? 3 : 1, 3), true),
      ];
      const enc = generateEncounter(1, 7, 'elite', 0, new Rng(9));
      const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
      const b = new Battle({ seed: 9, allies, enemies });
      b.run();
      const casts = b.drainEvents().filter((e) => e.type === 'cast' && e.id === 2);
      expect(casts.length, h.id).toBeGreaterThan(0);
    }
  });

  it('unlocks the disciple title at mastery IV and says how', () => {
    expect(unlockedCosmetics(metaWith({ mastery: { li_jian: 34 } })).has(`title:${masterTitleId('li_jian')}`)).toBe(false);
    expect(unlockedCosmetics(metaWith({ mastery: { li_jian: 35 } })).has(`title:${masterTitleId('li_jian')}`)).toBe(true);
    expect(howToUnlock('title', masterTitleId('li_jian'))).toBe('Reach mastery IV with Li Jian.');
  });

  it('sends the mastery levels into every run, a Pure one too', () => {
    const m = metaWith({ mastery: { li_jian: 20, shan_tie: 2 } });
    expect(masteryLevels(m)).toEqual({ li_jian: 3 });
    expect(runSectFor(m, '').mastery).toEqual({ li_jian: 3 });
    expect(runSectFor(m, '', { pure: true }).mastery).toEqual({ li_jian: 3 });
  });
});

describe('Mastery in a run', () => {
  const run = (mastery: Record<string, number> = {}): RunState => newRun(0, 5, { seals: [], research: [], mastery });

  it('counts a fight won for each disciple on the board', () => {
    const s = run();
    draftPick(s, 'li_jian', s.draft!.blessings[0]);
    s.currentEvent = null;
    s.phase = 'board';
    s.nodeIndex = 0;
    enterNode(s);
    const enc = s.currentEncounter!;
    enc.enemies = [{ ...enc.enemies[0], defId: 'spirit_wolf' }];
    enc.level = 0;
    startBattle(s);
    finishBattle(s, new Battle(battleConfig(s)!).run());
    expect(s.masteryWins).toEqual({ li_jian: 1 });
  });

  it('offers the exclusive fourth Dao Path at Foundation from mastery III, and it works as a path', () => {
    const offered = (lvl: number) => {
      const s = run({ li_jian: lvl });
      const h = addHero(s, 'li_jian', 1);
      queueRankUp(s, h.uid);
      prepareRankUp(s);
      return { s, h, ids: s.rankUpChoices!.options.map((o) => o.id) };
    };
    expect(offered(2).ids).not.toContain('li_returning_sword');
    const { s, h, ids } = offered(3);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('li_returning_sword');
    chooseUpgrade(s, 'li_returning_sword');
    expect(h.daoPathId).toBe('li_returning_sword');
    expect(h.insightIds).toHaveLength(0);
    expect(heroDaoPath(h)?.name).toBe('Returning Sword');
    // the Flying Sword gains its returning strike
    expect(heroAbility(h).actions.length).toBe(HERO_BY_ID.li_jian.ability.actions.length + 1);
  });

  it('draws a golden aura from mastery II', () => {
    const s = run({ li_jian: 2 });
    draftPick(s, 'li_jian', s.draft!.blessings[0]);
    s.currentEvent = null;
    s.phase = 'board';
    s.nodeIndex = 0;
    enterNode(s);
    expect(battleConfig(s)!.allies[0].masteryAura).toBe(true);
    const plain = run({ li_jian: 1 });
    draftPick(plain, 'li_jian', plain.draft!.blessings[0]);
    plain.currentEvent = null;
    plain.phase = 'board';
    plain.nodeIndex = 0;
    enterNode(plain);
    expect(battleConfig(plain)!.allies[0].masteryAura).toBeFalsy();
  });
});
