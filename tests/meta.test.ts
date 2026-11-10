import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import type { BattleResult } from '@/battle/sim/battle';
import {
  acceptChallenge,
  battleConfig,
  buyHero,
  chooseReward,
  chooseUpgrade,
  draftPick,
  finishBattle,
  finishEvent,
  finishRewardPick,
  ladderFloorOf,
  newRun,
  nextRealm,
  pickFromPending,
  proceedFromResult,
  proceedFromShop,
  resetItemQuests,
  resolveEventChoice,
  rewind,
  startBattle,
  type FightRecord,
  type RunState,
} from '@/core/run';
import { onRunEvent, type RunEvent } from '@/core/runEvents';
import { Battle } from '@/battle/sim/battle';
import { Rng } from '@/core/rng';
import { EVENT_BY_ID } from '@/content/events';
import { HEROES } from '@/content/heroes';
import { ITEMS } from '@/content/items';
import { RELICS } from '@/content/relics';
import { ENEMIES } from '@/content/enemies';
import { computeRunRenown, contractMultiplier, cumulativeXp, levelOf, rankOf, xpToNext } from '@/meta/renown';
import { ACHIEVEMENTS, ACH_BY_ID, achievementXp, earnedBy } from '@/meta/achievementDefs';
import { migrateMeta, RETRO_RENOWN_CAP_LEVEL } from '@/meta/migrate';
import { RENOWN_TRACK, cosmetic } from '@/meta/cosmetics';
import { unlockedCosmetics } from '@/meta/unlocks';

const baseMeta = (over: Partial<MetaSave> = {}): MetaSave => ({
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

/** One realm's fights as the timeline lays them out: 5 fights, a challenge, a trial, an elite and the guardian. */
function realmHistory(realm: number, floor = 0): FightRecord[] {
  const kinds = ['fight', 'fight', 'challenge', 'fight', 'single', 'elite', 'fight', 'fight', 'boss'];
  return kinds.map((kind, node) => ({ realm, floor, node, kind, won: true, dealt: 1000, stones: 20 }));
}

function wonRun(tier: number): RunState {
  const s = newRun(tier, 1234);
  s.history = [...realmHistory(1), ...realmHistory(2)];
  return s;
}

const fakeResult = (over: Partial<BattleResult> = {}): BattleResult =>
  ({ winner: 'ally', duration: 20, survivors: 3, units: [], quest: { damage: 0 }, stonesBonus: 0, permanentBuffs: [], killedBoss: false, ...over }) as unknown as BattleResult;

describe('Sect Renown curve', () => {
  it('matches the design doc totals', () => {
    expect(cumulativeXp(10)).toBe(1080);
    expect(cumulativeXp(30)).toBe(9180);
    expect(cumulativeXp(50)).toBe(27380);
    expect(xpToNext(29)).toBe(690);
    expect(xpToNext(49)).toBe(1100);
  });
  it('turns XP into levels', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, need: 120 });
    expect(levelOf(1079).level).toBe(9);
    expect(levelOf(1080).level).toBe(10);
    expect(levelOf(27380)).toMatchObject({ level: 50, frac: 1 });
    expect(levelOf(10 ** 9).level).toBe(50);
    expect(rankOf(1).name).toBe('Humble Sect');
    expect(rankOf(29).name).toBe('Established Sect');
    expect(rankOf(50).name).toBe('Immortal Sect');
  });
  it('has one reward on every level from 2 to 50, all known cosmetics', () => {
    expect(RENOWN_TRACK.map((r) => r.level)).toEqual(Array.from({ length: 49 }, (_, i) => i + 2));
    for (const r of RENOWN_TRACK) expect(cosmetic(r.kind, r.id), `${r.kind}:${r.id}`).toBeTruthy();
  });
});

describe('Run payout', () => {
  it('pays a Mortal victory 520 Renown, plus 5 per discovery', () => {
    const s = wonRun(0);
    expect(computeRunRenown(s).base).toBe(520);
    expect(computeRunRenown(s).total).toBe(520);
    s.discovered = 7;
    expect(computeRunRenown(s).total).toBe(555);
  });
  it('multiplies fights and realms by the contract, not discoveries or achievements', () => {
    const s = wonRun(3);
    s.discovered = 2;
    s.achievementsEarned = ['ACH_ASCENDED'];
    const r = computeRunRenown(s, achievementXp(s.achievementsEarned));
    expect(contractMultiplier(3)).toBe(1.45);
    expect(r.base + r.contractBonus).toBe(754);
    expect(r.total).toBe(754 + 10 + 150);
  });
  it('counts only won fights, and Ladder floors on top of their wardens', () => {
    const s = wonRun(0);
    s.history!.push({ realm: 1, floor: 0, node: 3, kind: 'fight', won: false, dealt: 0, stones: 0 });
    s.history!.push(...realmHistory(3, 1), ...realmHistory(3, 2));
    // each floor: 180 like a realm, plus 40 for the floor
    expect(computeRunRenown(s).base).toBe(520 + 2 * (180 + 40));
  });
  it('pays nothing for a run with no fight won', () => {
    const s = newRun(0, 9);
    s.history = [{ realm: 1, floor: 0, node: 0, kind: 'fight', won: false, dealt: 0, stones: 0 }];
    expect(computeRunRenown(s)).toMatchObject({ total: 0, lines: [] });
  });
});

describe('Achievement triggers', () => {
  const m = baseMeta();
  it('First Step and A Humbling Start', () => {
    const s = newRun(0, 5);
    s.stats.fights = 1;
    const won: RunEvent = { type: 'fightEnd', s, result: fakeResult(), record: { realm: 1, floor: 0, node: 0, kind: 'fight', won: true, dealt: 0, stones: 0 } };
    expect(earnedBy(won, m)).toContain('ACH_FIRST_STEP');
    const lost: RunEvent = { ...won, result: fakeResult({ winner: 'enemy' }), record: { ...won.record, won: false } } as RunEvent;
    expect(earnedBy(lost, m)).toContain('ACH_HUMBLING');
    s.stats.fights = 2;
    expect(earnedBy(lost, m)).not.toContain('ACH_HUMBLING');
  });
  it('clearing Realm II pays the contract, class, no-Treasure and no-reversal achievements', () => {
    const s = newRun(2, 7);
    const swords = ['li_jian', 'long_mu', 'feng_huang'];
    s.roster = swords.map((defId, i) => ({ uid: `u${i}`, defId, rank: 1, insightIds: [], items: [], permanent: [] }));
    s.party = ['u0', 'u1', 'u2', null, null];
    s.realm = 2;
    s.stats.rewinds = 0;
    s.realmDeaths = 0;
    const ids = earnedBy({ type: 'realmCleared', s }, m);
    expect(ids).toEqual(expect.arrayContaining(['ACH_ASCENDED', 'ACH_CONTRACT_2', 'ACH_CLASS_SWORD', 'ACH_EMPTY_HANDS', 'ACH_NO_REVERSAL', 'ACH_UNTOUCHED']));
    s.roster[0].items = ['azure_sword_talisman'];
    s.stats.rewinds = 1;
    s.realmDeaths = 2;
    expect(earnedBy({ type: 'realmCleared', s }, m)).not.toEqual(expect.arrayContaining(['ACH_EMPTY_HANDS']));
    expect(earnedBy({ type: 'realmCleared', s }, m)).not.toContain('ACH_NO_REVERSAL');
    expect(earnedBy({ type: 'realmCleared', s }, m)).not.toContain('ACH_UNTOUCHED');
  });
  it('Ladder floors, rerolls, selling, quests, Spirit Stones', () => {
    const s = newRun(0, 3);
    s.realm = 3;
    s.floor = 10;
    expect(earnedBy({ type: 'realmCleared', s }, m)).toEqual(expect.arrayContaining(['ACH_LADDER_5', 'ACH_LADDER_10']));
    s.rerollsThisShop = 10;
    expect(earnedBy({ type: 'reroll', s }, m)).toEqual(['ACH_FICKLE_FATE']);
    expect(earnedBy({ type: 'sellHero', s, defId: 'li_jian', rank: 3 }, m)).toEqual(['ACH_UNGRATEFUL']);
    expect(earnedBy({ type: 'questDone', s, name: 'x' }, m)).toEqual(['ACH_OATH']);
    s.stones = 150;
    expect(earnedBy({ type: 'state', s }, m)).toContain('ACH_TREASURY');
  });
  it('the Compendium achievements follow the discovery lists', () => {
    const seen = { heroes: HEROES.map((h) => h.id), items: [], relics: [], enemies: [] };
    expect(earnedBy({ type: 'meta', m: baseMeta({ seen }) }, m)).toContain('ACH_CODEX_DISCIPLES');
    const all = { heroes: HEROES.map((h) => h.id), items: ITEMS.map((i) => i.id), relics: RELICS.map((r) => r.id), enemies: ENEMIES.map((e) => e.id) };
    expect(earnedBy({ type: 'meta', m: baseMeta({ seen: all }) }, m)).toEqual(expect.arrayContaining(['ACH_CODEX_ALL', 'ACH_CODEX_FOES', 'ACH_CODEX_INSIGHTS', 'ACH_CODEX_TREASURES']));
  });
  it('every achievement is well formed', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.xp).toBeGreaterThan(0);
      for (const r of a.rewards ?? []) expect(cosmetic(r.kind, r.id), `${a.id} → ${r.kind}:${r.id}`).toBeTruthy();
    }
  });
});

describe('Save migration to version 2', () => {
  it('gives a veteran Renown, retroactive achievements and real Ladder floors', () => {
    const m = baseMeta({ runsPlayed: 5, runsWon: 2, bestTierCleared: 1, bestEndless: 17, leaderboard: [{ name: 'Run 4', score: 17, tier: 1, date: 1 }] });
    migrateMeta(m, 1000);
    expect(m.version).toBe(2);
    expect(Object.keys(m.achievements!)).toEqual(expect.arrayContaining(['ACH_CONTRACT_0', 'ACH_CONTRACT_1', 'ACH_ASCENDED', 'ACH_RIFT_SEALED_1', 'ACH_FIRST_STEP']));
    expect(m.achievements!.ACH_LADDER_5).toBeUndefined();
    expect(m.lifetime!.bestFloor).toBe(2);
    expect(m.leaderboard[0].floor).toBe(2);
    const retroXp = achievementXp(Object.keys(m.achievements!));
    expect(m.renown!.xp).toBe(Math.min(2 * 300 + 5 * 80 + retroXp, cumulativeXp(RETRO_RENOWN_CAP_LEVEL)));
    expect(m.lifetime).toMatchObject({ runs: 5, wins: 2 });
    // running it again changes nothing
    const before = JSON.stringify(m);
    migrateMeta(m, 2000);
    expect(JSON.stringify(m)).toBe(before);
  });
  it('caps the retroactive Renown at level 15', () => {
    const m = migrateMeta(baseMeta({ runsPlayed: 200, runsWon: 120, bestTierCleared: 7 }));
    expect(levelOf(m.renown!.xp).level).toBe(RETRO_RENOWN_CAP_LEVEL);
  });
  it('starts a new player at zero, with the default cosmetics unlocked', () => {
    const m = migrateMeta(baseMeta());
    expect(m.renown!.xp).toBe(0);
    expect(m.achievements).toEqual({});
    const open = unlockedCosmetics(m);
    expect(open.has('avatar:seal_sect')).toBe(true);
    expect(open.has('avatar:seal_sword')).toBe(false);
    m.renown!.xp = cumulativeXp(2);
    expect(unlockedCosmetics(m).has('avatar:seal_sword')).toBe(true);
  });
  it('reads Ladder floors from old scores', () => {
    expect(ladderFloorOf(0)).toBe(1);
    expect(ladderFloorOf(11)).toBe(1);
    expect(ladderFloorOf(12)).toBe(2);
    const m = migrateMeta(baseMeta({ runsPlayed: 3, runsWon: 1, bestEndless: 70, leaderboard: [{ name: 'Run 3', score: 70, tier: 0, date: 1 }] }));
    expect(m.lifetime!.bestFloor).toBe(6);
    expect(m.achievements!.ACH_LADDER_5).toBeDefined();
  });
});

describe('Run events from a played run', () => {
  it('reports every fight and realm clear, and the payout matches the history', () => {
    const events: RunEvent[] = [];
    const off = onRunEvent((e) => events.push(e));
    try {
      resetItemQuests();
      const s = newRun(0, 4242);
      const bot = new Rng(99);
      draftPick(s, s.draft!.heroes[0], s.draft!.blessings[0]);
      let steps = 0;
      while (s.phase !== 'runEnd' && steps++ < 900) {
        switch (s.phase) {
          case 'rankUp':
            chooseUpgrade(s, s.rankUpChoices!.options[0].id);
            break;
          case 'event': {
            const ev = EVENT_BY_ID[s.currentEvent!.eventId];
            if (!s.currentEvent!.outcome) {
              if (!resolveEventChoice(s, ev.choices[ev.choices.length - 1].id, s.roster[0].uid)) resolveEventChoice(s, ev.choices[0].id, s.roster[0].uid);
            } else if (s.pendingPick) pickFromPending(s, s.pendingPick.kind === 'item' ? s.pendingPick.items![0].id : s.pendingPick.relics![0].id);
            else {
              if (s.fightReward?.single) s.singleChampion = s.roster[0].uid;
              finishEvent(s);
            }
            break;
          }
          case 'challenge':
            acceptChallenge(s, bot.chance(50) ? s.challengeOffers![0].id : null);
            break;
          case 'board':
            if (s.fightReward?.single && !s.singleChampion) s.singleChampion = s.party.find(Boolean) ?? s.roster[0].uid;
            startBattle(s);
            break;
          case 'battle':
            finishBattle(s, new Battle(battleConfig(s)!).run());
            break;
          case 'defeat':
            if (!rewind(s)) s.phase = 'runEnd';
            break;
          case 'result':
            proceedFromResult(s);
            break;
          case 'reward':
            if (s.pendingReward) chooseReward(s, s.pendingReward[0].id);
            else if (s.pendingPick) {
              pickFromPending(s, s.pendingPick.kind === 'item' ? s.pendingPick.items![0].id : s.pendingPick.relics![0].id);
              if (!s.pendingPick) finishRewardPick(s);
            } else finishRewardPick(s);
            break;
          case 'shop': {
            const hero = s.shop!.heroes.find((h) => h && h.price <= s.stones);
            if (hero && (s.party.includes(null) || s.reserve.includes(null))) buyHero(s, hero.key);
            proceedFromShop(s);
            break;
          }
          case 'realmCleared':
            if (s.realm >= 2) s.phase = 'runEnd';
            else nextRealm(s);
            break;
          default:
            throw new Error(`unhandled phase ${s.phase}`);
        }
      }
      const fights = events.filter((e) => e.type === 'fightEnd');
      expect(fights.length).toBe(s.stats.fights);
      expect(fights.filter((e) => e.type === 'fightEnd' && e.record.won).length).toBe(s.stats.wins);
      const clears = events.filter((e) => e.type === 'realmCleared').length;
      expect(clears).toBe((s.history ?? []).filter((h) => h.won && h.kind === 'boss').length);
      const pay = computeRunRenown(s);
      expect(pay.total).toBeGreaterThan(0);
      expect(pay.total).toBe(pay.lines.reduce((a, l) => a + l.xp, 0));
      // every achievement an event earns is a real one
      for (const e of events) for (const id of earnedBy(e, baseMeta())) expect(ACH_BY_ID[id]).toBeTruthy();
    } finally {
      off();
    }
  });
});
