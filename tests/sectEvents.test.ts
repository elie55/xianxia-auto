import { describe, expect, it } from 'vitest';
import type { MetaSave } from '@/app/store';
import { Battle, type BattleResult } from '@/battle/sim/battle';
import { ALLY_MAX_COL, offsetToAxial } from '@/battle/sim/hex';
import { buildEnemyUnit, buildHeroUnit } from '@/core/builder';
import { difficultyMods, draftPick, enterNode, finishBattle, heroPool, newRun, resolveEventChoice, teamContext, type RunSect, type RunState } from '@/core/run';
import { ENEMY_BY_ID, ENEMIES } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { OMEN_BY_ID, SECT_EVENTS, SECT_EVENT_BY_ID } from '@/content/sectEvents';
import { RIVAL_FOES, SECT_FOES } from '@/content/sectFoes';
import { cumulativeXp } from '@/meta/renown';
import { omensFor, runSectFor, sectOf } from '@/meta/sect';
import {
  EVENT_GUARANTEE,
  choiceViews,
  eventAvailable,
  eventScale,
  omenResults,
  omensLeft,
  resolveSectChoice,
  rollSectEvent,
  seclusionCandidates,
} from '@/meta/sectEvents';

/** Sect events between runs (docs/META_PROGRESSION.md 6.8). */
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
const atRenown = (level: number, over: Partial<MetaSave> = {}) => metaWith({ renown: { xp: cumulativeXp(level) }, ...over });

/** A run on its board at a node of Realm I's timeline. */
function runAt(kind: 'elite' | 'trial', sect?: RunSect): RunState {
  const s = newRun(0, 11, sect);
  draftPick(s, 'li_jian', s.draft!.blessings[0]);
  s.currentEvent = null;
  s.nodeIndex = s.timeline.findIndex((n) => n.kind === kind);
  enterNode(s);
  return s;
}
const win = (): BattleResult =>
  ({
    winner: 'ally',
    duration: 20,
    survivors: 1,
    units: [],
    quest: { crits: 0, kills: 0, casts: 0, frost: 0, burn: 0, poison: 0, shield: 0, heal: 0, surge: 0, enlightenment: 0, damage: 0, wins: 1, stones: 0 },
    stonesBonus: 0,
    permanentBuffs: [],
    killedBoss: false,
  }) as BattleResult;

describe('When a sect event comes', () => {
  it('waits for the sect to be founded, then comes about one return in three', () => {
    expect(rollSectEvent(atRenown(1), 1).event).toBeNull();
    let n = 0;
    for (let seed = 1; seed <= 600; seed++) if (rollSectEvent(atRenown(8), seed).event) n++;
    expect(n / 600).toBeGreaterThan(0.27);
    expect(n / 600).toBeLessThan(0.4);
  });

  it('always comes on the fourth return in a row without one, and never repeats the last', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const m = atRenown(8, { sect: { pace: { since: EVENT_GUARANTEE, last: 'patron' } } });
      const r = rollSectEvent(m, seed);
      expect(r.event, `seed ${seed}`).not.toBeNull();
      expect(r.event!.id).not.toBe('patron');
      expect(r.pace).toEqual({ since: 0, last: r.event!.id });
    }
    // a quiet return counts towards the next one
    const quiet = [...Array(60).keys()].map((i) => rollSectEvent(atRenown(8), i + 1)).find((r) => !r.event)!;
    expect(quiet.pace.since).toBe(1);
  });

  it('keeps an undecided event waiting instead of rolling a new one', () => {
    const m = atRenown(8, { sect: { event: { id: 'storm' }, pace: { since: 0, last: 'storm' } } });
    for (let seed = 1; seed <= 20; seed++) expect(rollSectEvent(m, seed)).toEqual({ event: { id: 'storm' }, pace: { since: 0, last: 'storm' }, fresh: false });
  });

  it('opens each event at its Renown, seclusion only for a disciple with mastery to gain, and not twice at once', () => {
    const open = (lvl: number, over: Partial<MetaSave> = {}) => SECT_EVENTS.filter((e) => eventAvailable(e, atRenown(lvl, over))).map((e) => e.id);
    expect(open(2)).toEqual(['patron']);
    expect(open(3)).toEqual(['patron', 'storm']);
    expect(open(6)).toEqual(['patron', 'storm', 'alchemist', 'rival', 'heart_demon']);
    expect(open(6, { mastery: { li_jian: 4 } })).toContain('seclusion');
    // mastery V has nothing left to gain
    expect(seclusionCandidates(atRenown(6, { mastery: { li_jian: 50, shan_tie: 12 } }))).toEqual(['shan_tie']);
    // an accepted challenge is not offered again while it waits
    expect(open(6, { sect: { omens: [{ id: 'rival' }] } })).not.toContain('rival');
  });
});

describe('Choosing', () => {
  it('pays at once, more for a higher-ranked sect, and Heavenly Jade stays as it is', () => {
    const humble = atRenown(4, { sect: { event: { id: 'patron' } } });
    const r = resolveSectChoice(humble, 'silver');
    expect(r.ok && r.sect.purse.funds).toBe(60);
    expect(r.ok && r.sect.event).toBeNull();
    const rising = atRenown(12, { sect: { event: { id: 'patron' } } });
    expect(eventScale(cumulativeXp(12))).toBe(1.5);
    const r2 = resolveSectChoice(rising, 'silver');
    expect(r2.ok && r2.sect.purse.funds).toBe(90);
    const storm = resolveSectChoice(atRenown(12, { sect: { event: { id: 'storm' } } }), 'jade');
    expect(storm.ok && storm.sect.purse.jade).toBe(2);
  });

  it('charges a pill in Spirit Herbs, refuses when the sect cannot pay, and sends the pill into the next run', () => {
    const poor = atRenown(5, { sect: { event: { id: 'alchemist' }, purse: { funds: 0, herbs: 4, cores: 0, jade: 0 } } });
    expect(choiceViews(poor, { id: 'alchemist' }).map((c) => c.affordable)).toEqual([false, false, true]);
    expect(resolveSectChoice(poor, 'vitality').ok).toBe(false);
    const rich = atRenown(5, { sect: { event: { id: 'alchemist' }, purse: { funds: 0, herbs: 14, cores: 0, jade: 0 } } });
    const r = resolveSectChoice(rich, 'vitality');
    expect(r.ok && r.sect.purse.herbs).toBe(4);
    expect(r.ok && r.sect.omens).toEqual([{ id: 'vitality_pill' }]);
  });

  it('fills in the disciple and the prize', () => {
    const m = atRenown(12, { mastery: { wen_yan: 4 }, sect: { event: { id: 'seclusion', hero: 'wen_yan' } } });
    expect(choiceViews(m, { id: 'seclusion', hero: 'wen_yan' })[0].desc).toContain('Wen Yan sits out your next run');
    const r = resolveSectChoice(m, 'grant');
    expect(r.ok && r.omen).toEqual({ id: 'seclusion', hero: 'wen_yan' });
    const rival = atRenown(12, { sect: { event: { id: 'rival' } } });
    expect(choiceViews(rival, { id: 'rival' })[0].desc).toContain('90 Sect Funds and 5 Heavenly Jade');
    const r2 = resolveSectChoice(rival, 'accept');
    expect(r2.ok && r2.omen).toEqual({ id: 'rival', reward: { jade: 5, funds: 90 } });
  });

  it('gives every event art, a story and two or three choices, each doing something or saying it does nothing', () => {
    for (const e of SECT_EVENTS) {
      expect(e.text.length, e.id).toBeGreaterThan(40);
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.choices.length, e.id).toBeLessThanOrEqual(3);
      for (const c of e.choices) expect(!!(c.gain || c.omen) || c.desc === 'Nothing happens.', `${e.id}.${c.id}`).toBe(true);
    }
    expect(Object.keys(SECT_EVENT_BY_ID)).toHaveLength(SECT_EVENTS.length);
  });
});

describe('Omens in the next run', () => {
  it('go with the next run, a Pure one leaving the boons for later', () => {
    const omens = [{ id: 'vitality_pill' as const }, { id: 'rival' as const, reward: { jade: 5 } }, { id: 'seclusion' as const, hero: 'shan_tie' }];
    expect(omensFor(omens, false)).toEqual(omens);
    expect(omensFor(omens, true).map((o) => o.id)).toEqual(['rival', 'seclusion']);
    expect(omensLeft(omens, omensFor(omens, true))).toEqual([{ id: 'vitality_pill' }]);
    const m = atRenown(8, { sect: { omens } });
    expect(runSectFor(m, '', { pure: true }).omens?.map((o) => o.id)).toEqual(['rival', 'seclusion']);
    expect(sectOf(metaWith({ sect: { omens: [{ id: 'nonsense' }, { id: 'seclusion' }] } })).omens).toEqual([]);
  });

  it('a disciple in seclusion is in no draft and no shop', () => {
    const s = newRun(0, 5, { seals: [], research: [], omens: [{ id: 'seclusion', hero: 'li_jian' }] });
    expect(heroPool(s).some((h) => h.id === 'li_jian')).toBe(false);
    expect(s.draft!.heroes).not.toContain('li_jian');
  });

  it('the Crimson Cloud disciples wait at Realm I in place of the elite', () => {
    const s = runAt('elite', { seals: [], research: [], omens: [{ id: 'rival', reward: { jade: 5, funds: 60 } }] });
    expect(s.currentEncounter!.enemies.map((e) => e.defId).sort()).toEqual([...RIVAL_FOES].sort());
    expect(s.currentEncounter!.kind).toBe('elite');
    const plain = runAt('elite');
    expect(plain.currentEncounter!.enemies.some((e) => RIVAL_FOES.includes(e.defId))).toBe(false);
  });

  it('the Heart Demon waits at the Heavenly Trial, and its champion grows when it falls', () => {
    const s = runAt('trial', { seals: [], research: [], omens: [{ id: 'heart_demon' }] });
    expect(s.currentEvent!.eventId).toBe('heart_demon_trial');
    resolveEventChoice(s, 'duel');
    expect(s.currentEncounter!.enemies.map((e) => e.defId)).toEqual(['heart_demon']);
    expect(s.fightReward).toMatchObject({ single: true, actions: [] });
    const champ = s.roster[0];
    s.singleChampion = champ.uid;
    finishBattle(s, win());
    expect(champ.permanent).toEqual(expect.arrayContaining([{ stat: 'attack', flat: 0, pct: 20 }, { stat: 'spirit', flat: 0, pct: 20 }, { stat: 'hp', flat: 0, pct: 20 }]));
    expect(s.history!.at(-1)).toMatchObject({ won: true, foe: 'heart_demon' });
    expect(runAt('trial').currentEvent!.eventId).toBe('heavenly_trial');
  });

  it('pills and the storm change the run', () => {
    const base = newRun(0, 3);
    const pill = newRun(0, 3, { seals: [], research: [], omens: [{ id: 'vitality_pill' }, { id: 'qi_pill' }, { id: 'storm' }] });
    const h = { uid: 'x', defId: 'shan_tie', rank: 1 as const, insightIds: [], items: [], permanent: [] };
    const hp = (s: RunState, blessing = false) => buildHeroUnit(h, { ...teamContext(s), vitalityBlessing: blessing }, 1, null, true).stats.hp;
    // +12% Max HP adds to the other percentages, so it gives 1.5 times what the +8% Vitality blessing does
    expect((hp(pill) - hp(base)) / (hp(base, true) - hp(base))).toBeCloseTo(1.5, 5);
    expect(buildHeroUnit(h, teamContext(pill), 1, null, true).effects?.some((e) => e.id === 'omen_qi_pill')).toBe(true);
    expect(difficultyMods(pill).tribulationAt).toBe(difficultyMods(base).tribulationAt + 10);
  });
});

describe('When the run ends', () => {
  const ended = (omens: RunSect['omens'], foes: string[]): RunState => {
    const s = newRun(0, 9, { seals: [], research: [], omens });
    s.history = foes.map((foe, node) => ({ realm: 1, floor: 0, node, kind: 'elite', won: true, dealt: 1, stones: 1, foe }));
    return s;
  };

  it('pays the challenge won and the Heart Demon beaten, not the ones missed', () => {
    const won = omenResults(ended([{ id: 'rival', reward: { jade: 5, funds: 60 } }, { id: 'heart_demon' }], ['crimson_senior', 'heart_demon']), {});
    expect(won.purse).toEqual({ jade: 7, funds: 60 });
    expect(won.results.map((r) => r.id)).toEqual(['rival', 'heart_demon']);
    const missed = omenResults(ended([{ id: 'rival', reward: { jade: 5 } }], ['moss_golem']), {});
    expect(missed.purse).toEqual({});
    expect(missed.results).toEqual([]);
  });

  it('brings a disciple back from seclusion one mastery level higher', () => {
    const r = omenResults(ended([{ id: 'seclusion', hero: 'wen_yan' }], []), { wen_yan: 5, li_jian: 7 });
    expect(r.mastery).toEqual({ wen_yan: 10, li_jian: 7 });
    expect(r.ups).toEqual([{ hero: 'wen_yan', level: 2 }]);
  });
});

describe('The new foes', () => {
  it('are known foes the encounter generator never draws on its own', () => {
    for (const f of SECT_FOES) {
      expect(ENEMY_BY_ID[f.id], f.id).toBe(f);
      expect(f.realm).toBe(1);
      expect(f.theme).toBeUndefined();
    }
    expect(ENEMIES.filter((e) => e.elite && RIVAL_FOES.includes(e.id)).map((e) => e.id)).toEqual(['crimson_senior']);
    // the rivals cost about what Realm I's elite fight does
    const cost = RIVAL_FOES.reduce((a, id) => a + ENEMY_BY_ID[id].cost, 0);
    expect(cost).toBeGreaterThanOrEqual(9);
    expect(cost).toBeLessThanOrEqual(11);
    expect(OMEN_BY_ID.rival.boon).toBeUndefined();
    expect(HERO_BY_ID.li_jian).toBeTruthy();
  });

  it('the Heart Demon takes the shape of the champion it faces, and its doubt grows', () => {
    const ctx = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
    const tank = { uid: 'st', defId: 'shan_tie', rank: 1 as const, insightIds: [], items: [], permanent: [], daoPathId: HERO_BY_ID.shan_tie.daoPaths[0].id };
    const b = new Battle({ seed: 1, allies: [buildHeroUnit(tank, ctx, 1, offsetToAxial(ALLY_MAX_COL, 2), true)], enemies: [buildEnemyUnit(ENEMY_BY_ID.heart_demon, 6, 100, offsetToAxial(7, 2))] });
    const champ = b.units.find((u) => u.side === 'ally')!;
    const demon = b.units.find((u) => u.defId === 'heart_demon')!;
    expect(demon.maxHp).toBeLessThan(champ.maxHp);
    b.tick(0.05);
    expect(demon.maxHp).toBe(champ.maxHp);
    expect(demon.hp).toBe(demon.maxHp);
    expect(demon.stat('defense')).toBeCloseTo(champ.stat('defense') * 0.7, 3);
    const attack = demon.stat('attack');
    while (b.time < 6.2 && !b.over) b.tick(0.05);
    expect(demon.stat('attack')).toBeGreaterThan(attack * 1.1);
  });
});
