import { describe, expect, it } from 'vitest';
import {
  acceptChallenge,
  battleConfig,
  buyHero,
  buyItem,
  buyRelic,
  chooseReward,
  chooseUpgrade,
  draftPick,
  enterNode,
  equipItem,
  equipItemAt,
  finishBattle,
  finishEvent,
  finishRewardPick,
  newRun,
  nextRealm,
  pickFromPending,
  proceedFromResult,
  proceedFromShop,
  resetItemQuests,
  resolveEventChoice,
  rewind,
  startBattle,
  type RunState,
} from '@/core/run';
import { Battle } from '@/battle/sim/battle';
import { EVENT_BY_ID } from '@/content/events';
import { Rng } from '@/core/rng';
import { ITEMS } from '@/content/items';

/** A simple greedy bot that plays a whole run through the state machine. */
function playRun(seed: number, tier = 0, maxSteps = 600): { s: RunState; steps: number; fights: number; realmReached: number } {
  resetItemQuests();
  const s = newRun(tier, seed);
  const bot = new Rng(seed * 31 + 7);
  let steps = 0;
  let fights = 0;
  draftPick(s, s.draft!.heroes[0], s.draft!.blessings[0]);
  while (s.phase !== 'runEnd' && steps++ < maxSteps) {
    switch (s.phase) {
      case 'rankUp': {
        const c = s.rankUpChoices!;
        expect(c.options.length).toBeGreaterThan(0);
        chooseUpgrade(s, bot.pick(c.options).id);
        break;
      }
      case 'event': {
        const ev = EVENT_BY_ID[s.currentEvent!.eventId];
        if (!s.currentEvent!.outcome) {
          const choices = ev.choices.filter((c) => !c.available || c.available({ stones: s.stones } as never));
          const choice = bot.pick(choices.length ? choices : ev.choices);
          const uid = choice.needsHero ? s.roster[0].uid : undefined;
          const out = resolveEventChoice(s, choice.id, uid);
          if (!out) {
            // unavailable choice → take the first available
            resolveEventChoice(s, ev.choices[ev.choices.length - 1].id, s.roster[0].uid);
          }
        } else if (s.pendingPick) {
          const p = s.pendingPick;
          const id = p.kind === 'item' ? p.items![0].id : p.relics![0].id;
          pickFromPending(s, id);
        } else {
          if (s.fightReward?.single) s.singleChampion = s.roster[0].uid;
          finishEvent(s);
        }
        break;
      }
      case 'challenge':
        acceptChallenge(s, bot.chance(50) ? s.challengeOffers![0].id : null);
        break;
      case 'board': {
        if (s.fightReward?.single && !s.singleChampion) s.singleChampion = s.party.find(Boolean) ?? s.roster[0].uid;
        startBattle(s);
        break;
      }
      case 'battle': {
        const cfg = battleConfig(s)!;
        expect(cfg.allies.length).toBeGreaterThan(0);
        expect(cfg.enemies.length).toBeGreaterThan(0);
        const b = new Battle(cfg);
        const res = b.run();
        fights++;
        finishBattle(s, res);
        break;
      }
      case 'defeat': {
        if (!rewind(s)) {
          s.phase = 'runEnd';
        }
        break;
      }
      case 'result':
        proceedFromResult(s);
        break;
      case 'reward': {
        if (s.pendingReward) chooseReward(s, s.pendingReward[0].id);
        else if (s.pendingPick) {
          pickFromPending(s, s.pendingPick.kind === 'item' ? s.pendingPick.items![0].id : s.pendingPick.relics![0].id);
          if (!s.pendingPick) finishRewardPick(s);
        } else finishRewardPick(s);
        break;
      }
      case 'shop': {
        // equip everything we can
        for (const it of s.inventory.slice()) {
          const h = s.roster.find((x) => x.items.length < 3);
          if (h) equipItem(s, it, h.uid);
        }
        // buy greedily: heroes first if slots, then items, then relics
        let bought = true;
        let guard = 0;
        while (bought && guard++ < 10) {
          bought = false;
          const sh = s.shop!;
          const hero = sh.heroes.find((h) => h && h.price <= s.stones);
          if (hero && (s.party.includes(null) || s.reserve.includes(null) || s.roster.some((r) => r.defId === hero.defId && r.rank < 3))) {
            if (buyHero(s, hero.key).ok) bought = true;
          }
          const item = sh.items.find((i) => i && i.price <= s.stones);
          if (item && s.inventory.length < s.inventorySize && buyItem(s, item.key).ok) bought = true;
          const relic = sh.relics.find((r) => r && r.price <= s.stones);
          if (relic && buyRelic(s, relic.key).ok) bought = true;
        }
        proceedFromShop(s);
        break;
      }
      case 'realmCleared': {
        if (s.realm >= 2) {
          s.phase = 'runEnd';
          s.victory = true;
        } else nextRealm(s);
        break;
      }
      default:
        throw new Error(`unhandled phase ${s.phase}`);
    }
  }
  return { s, steps, fights, realmReached: s.realm };
}

describe('run state machine', () => {
  it('plays complete runs without crashing (several seeds)', () => {
    const outcomes: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const { s, steps, fights, realmReached } = playRun(seed);
      expect(steps).toBeLessThan(600);
      expect(fights).toBeGreaterThan(0);
      outcomes.push(`seed ${seed}: realm ${realmReached} node ${s.nodeIndex} fights ${fights} wins ${s.stats.wins} stones ${s.stones} victory ${s.victory}`);
    }
    // eslint-disable-next-line no-console
    console.log(outcomes.join('\n'));
  });

  it('draft, starter kit and first fight flow', () => {
    resetItemQuests();
    const s = newRun(0, 1234);
    expect(s.phase).toBe('chooseHero');
    expect(s.draft!.heroes).toHaveLength(3);
    draftPick(s, s.draft!.heroes[1], s.draft!.blessings[0]);
    expect(['event', 'rankUp']).toContain(s.phase);
    if (s.phase === 'rankUp') chooseUpgrade(s, s.rankUpChoices!.options[0].id);
    expect(s.currentEvent!.eventId).toBe('starter_kit');
    resolveEventChoice(s, 'stones');
    expect(s.stones).toBeGreaterThanOrEqual(60);
    finishEvent(s);
    expect(s.phase).toBe('board');
    expect(s.currentEncounter).not.toBeNull();
    expect(s.nodeIndex).toBe(0);
  });

  /** Plays the opening up to the first fight's board. */
  function toFirstBoard(seed: number): RunState {
    resetItemQuests();
    const s = newRun(0, seed);
    draftPick(s, s.draft!.heroes[0], s.draft!.blessings[0]);
    if (s.phase === 'rankUp') chooseUpgrade(s, s.rankUpChoices!.options[0].id);
    resolveEventChoice(s, 'stones');
    finishEvent(s);
    expect(s.phase).toBe('board');
    return s;
  }

  /** Loses the current fight, reverses time and leaves the shop. */
  function loseAndReverse(s: RunState): void {
    startBattle(s);
    const res = new Battle(battleConfig(s)!).run();
    res.winner = 'enemy';
    finishBattle(s, res);
    expect(s.phase).toBe('defeat');
    s.stones = 500;
    expect(rewind(s)).toBe(true);
    expect(s.phase).toBe('shop');
    proceedFromShop(s);
    if (s.phase === 'rankUp') chooseUpgrade(s, s.rankUpChoices!.options[0].id);
  }

  it('a Time Reversal replays the lost fight instead of moving on', () => {
    const s = toFirstBoard(99);
    const node = s.nodeIndex;
    const enemies = s.currentEncounter!.enemies.map((e) => e.defId).join(',');
    loseAndReverse(s);
    expect(s.phase).toBe('board');
    expect(s.nodeIndex).toBe(node);
    expect(s.currentEncounter!.enemies.map((e) => e.defId).join(',')).toBe(enemies);
    expect(s.stats.wins).toBe(0);
    expect(s.retryNode).toBeFalsy();
  });

  it('a Time Reversal after losing to the boss does not clear the realm', () => {
    const s = toFirstBoard(77);
    s.nodeIndex = s.timeline.findIndex((n) => n.kind === 'boss');
    enterNode(s);
    expect(s.currentEncounter!.kind).toBe('boss');
    loseAndReverse(s);
    expect(s.phase).toBe('board');
    expect(s.nodeIndex).toBe(s.timeline.findIndex((n) => n.kind === 'boss'));
    expect(s.currentEncounter!.kind).toBe('boss');
  });

  it('a Treasure dropped on a socket replaces that socket, not the last one', () => {
    const s = toFirstBoard(77);
    const h = s.roster[0];
    const [a, b, c2, fromBag, fromOther] = ITEMS.slice(0, 5).map((it) => it.id);
    h.items = [a, b, c2];
    s.inventory = [fromBag];
    // from the inventory onto the first socket: the first Treasure goes back to the inventory
    expect(equipItemAt(s, fromBag, h.uid, 0)).toBe(true);
    expect(h.items).toEqual([fromBag, b, c2]);
    expect(s.inventory).toEqual([a]);
    // from another disciple onto the middle socket: the two Treasures trade places
    const other = { ...h, uid: 'other', items: [fromOther] };
    s.roster.push(other);
    expect(equipItemAt(s, fromOther, h.uid, 1, 'other')).toBe(true);
    expect(h.items).toEqual([fromBag, fromOther, c2]);
    expect(other.items).toEqual([b]);
    // within one disciple: two sockets swap
    expect(equipItemAt(s, c2, h.uid, 0, h.uid)).toBe(true);
    expect(h.items).toEqual([c2, fromOther, fromBag]);
  });
});
