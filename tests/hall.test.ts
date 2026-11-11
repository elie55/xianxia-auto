import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { addHero, draftPick, newRun } from '@/core/run';
import { HEROES } from '@/content/heroes';
import { cumulativeXp } from '@/meta/renown';
import { BUILDING_BY_ID, isOpen } from '@/meta/sect';
import { HALL_VICTORIES, addVictory, hallOfMasters, unrecordedVictories, victoryRecord, type VictoryRecord } from '@/meta/hall';

/** The Hall of Ancestors (docs/META_PROGRESSION.md 6.9). */
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

describe('The Hall of Ancestors', () => {
  it('opens at Renown 17, free and without levels', () => {
    const b = BUILDING_BY_ID.ancestors;
    expect(b.unlock).toBe(17);
    expect(b.upgradable).toBe(false);
    expect(isOpen('ancestors', cumulativeXp(16))).toBe(false);
    expect(isOpen('ancestors', cumulativeXp(17))).toBe(true);
  });

  it("raises a statue of a victory's champion: the disciple who dealt the most damage, with the run's party", () => {
    const s = newRun(2, 7, { seals: [], research: [], pure: true });
    draftPick(s, 'li_jian', s.draft!.blessings[0]);
    const tank = addHero(s, 'shan_tie', 1);
    const healer = addHero(s, 'mei_yao', 1);
    s.party = [s.roster[0].uid, tank.uid, healer.uid, null, null];
    s.heroTotals = {
      [s.roster[0].uid]: { dealt: 9000, taken: 100, healed: 0, kills: 9, crits: 3, bestHit: 800, fights: 20 },
      [tank.uid]: { dealt: 12000.4, taken: 9000, healed: 0, kills: 4, crits: 0, bestHit: 300, fights: 20 },
      [healer.uid]: { dealt: 800, taken: 50, healed: 9000, kills: 0, crits: 0, bestHit: 90, fights: 20 },
      // a disciple sold during the run is not in the roster any more
      gone: { dealt: 99999, taken: 0, healed: 0, kills: 0, crits: 0, bestHit: 0, fights: 1 },
    };
    s.stats.elapsedMs = 31 * 60000;
    expect(victoryRecord(s, 1000)).toEqual({ at: 1000, tier: 2, mvp: 'shan_tie', dealt: 12000, team: ['li_jian', 'shan_tie', 'mei_yao'], pure: true, minutes: 31 });
    // a run that climbed the Ladder after the contract keeps its floor
    s.realm = 3;
    s.floor = 4;
    expect(victoryRecord(s, 1000)?.floor).toBe(4);
  });

  it('keeps the newest victories first, up to the cap, and counts the older ones by number', () => {
    const rec = (at: number): VictoryRecord => ({ at, tier: 0, mvp: 'li_jian', dealt: 1, team: ['li_jian'] });
    let list: VictoryRecord[] = [];
    for (let i = 1; i <= HALL_VICTORIES + 5; i++) list = addVictory(list, rec(i));
    expect(list).toHaveLength(HALL_VICTORIES);
    expect(list[0].at).toBe(HALL_VICTORIES + 5);
    expect(addVictory(list, null)).toHaveLength(HALL_VICTORIES);
    expect(unrecordedVictories(metaWith({ runsWon: 7, hall: { victories: [rec(1), rec(2)] } }))).toBe(5);
    expect(unrecordedVictories(metaWith({ runsWon: 0 }))).toBe(0);
  });

  it('stands every disciple the sect knows on a pedestal: gilded at mastery V, bronze at III and IV', () => {
    const list = hallOfMasters(metaWith({ mastery: { li_jian: 50, shan_tie: 22, mei_yao: 4 }, sect: { disciples: ['ling_shuang'] } }));
    const by = Object.fromEntries(list.map((e) => [e.id, e]));
    expect(list[0].id).toBe('li_jian');
    expect(by.li_jian).toMatchObject({ statue: 'gold', level: 5, toNext: 0, title: 'Master of the Flying Sword', passive: 'Returning Sword' });
    expect(by.shan_tie).toMatchObject({ statue: 'bronze', level: 3, toNext: 13 });
    expect(by.mei_yao).toMatchObject({ statue: 'empty', level: 1, toNext: 6 });
    // exclusive disciples stand there once recruited
    expect(by.ling_shuang).toBeTruthy();
    expect(by.wen_yan).toBeUndefined();
    expect(list.length).toBe(HEROES.filter((h) => !h.exclusive).length + 1);
  });
});
