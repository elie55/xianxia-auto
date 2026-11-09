/**
 * Headless balance simulator: plays many bot runs through the real state machine and
 * reports how far they get, win rates per node, and fight durations.
 *
 *   npm run sim -- --runs 40 --tier 0
 */
import { Battle } from '../src/battle/sim/battle';
import {
  acceptChallenge,
  battleConfig,
  buyHero,
  buyItem,
  buyRelic,
  chooseReward,
  chooseUpgrade,
  currentRewindCost,
  draftPick,
  equipItem,
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
} from '../src/core/run';
import { EVENT_BY_ID } from '../src/content/events';
import { Rng } from '../src/core/rng';
import { heroItemSlots } from '../src/core/builder';
import { teamContext } from '../src/core/run';

const args = process.argv.slice(2);
const arg = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const RUNS = arg('runs', 30);
const TIER = arg('tier', 0);

interface Outcome {
  seed: number;
  realm: number;
  node: number;
  fights: number;
  wins: number;
  losses: number;
  rewinds: number;
  victory: boolean;
  roster: number;
  avgRank: number;
  durations: number[];
  lossNodes: string[];
}

function play(seed: number): Outcome {
  resetItemQuests();
  const s = newRun(TIER, seed);
  const bot = new Rng(seed * 7 + 3);
  draftPick(s, s.draft!.heroes[bot.int(0, 2)], s.draft!.blessings[bot.int(0, 2)]);
  const durations: number[] = [];
  const lossNodes: string[] = [];
  let losses = 0;
  let steps = 0;
  while (s.phase !== 'runEnd' && steps++ < 1500) {
    switch (s.phase) {
      case 'rankUp':
        chooseUpgrade(s, bot.pick(s.rankUpChoices!.options).id);
        break;
      case 'event': {
        const ev = EVENT_BY_ID[s.currentEvent!.eventId];
        if (!s.currentEvent!.outcome) {
          const choice = bot.pick(ev.choices);
          const ok = resolveEventChoice(s, choice.id, choice.needsHero ? bot.pick(s.roster).uid : undefined);
          if (!ok) resolveEventChoice(s, ev.choices[ev.choices.length - 1].id, s.roster[0].uid);
        } else if (s.pendingPick) {
          const p = s.pendingPick;
          pickFromPending(s, p.kind === 'item' ? p.items![0].id : p.relics![0].id);
        } else {
          if (s.fightReward?.single) s.singleChampion = bestHero(s);
          finishEvent(s);
        }
        break;
      }
      case 'challenge':
        acceptChallenge(s, bot.chance(40) ? s.challengeOffers![0].id : null);
        break;
      case 'board':
        if (s.fightReward?.single && !s.singleChampion) s.singleChampion = bestHero(s);
        startBattle(s);
        break;
      case 'battle': {
        const b = new Battle(battleConfig(s)!);
        const r = b.run();
        durations.push(r.duration);
        finishBattle(s, r);
        break;
      }
      case 'defeat':
        losses++;
        lossNodes.push(`R${s.realm}N${s.nodeIndex + 1}`);
        if (!rewind(s)) s.phase = 'runEnd';
        break;
      case 'result':
        proceedFromResult(s);
        break;
      case 'reward':
        if (s.pendingReward) chooseReward(s, bot.pick(s.pendingReward).id);
        else if (s.pendingPick) {
          pickFromPending(s, s.pendingPick.kind === 'item' ? s.pendingPick.items![0].id : s.pendingPick.relics![0].id);
          if (!s.pendingPick) finishRewardPick(s);
        } else finishRewardPick(s);
        break;
      case 'shop':
        shopBot(s, bot);
        proceedFromShop(s);
        break;
      case 'realmCleared':
        if (s.realm >= 2) {
          s.victory = true;
          s.phase = 'runEnd';
        } else nextRealm(s);
        break;
      default:
        throw new Error(`unhandled phase ${s.phase}`);
    }
  }
  return {
    seed,
    realm: s.realm,
    node: s.nodeIndex + 1,
    fights: s.stats.fights,
    wins: s.stats.wins,
    losses,
    rewinds: s.stats.rewinds,
    victory: s.victory,
    roster: s.roster.length,
    avgRank: s.roster.reduce((a, h) => a + h.rank, 0) / Math.max(1, s.roster.length),
    durations,
    lossNodes,
  };
}

function bestHero(s: RunState): string {
  return s.roster.slice().sort((a, b) => b.rank - a.rank)[0].uid;
}

/** Reasonable greedy shopping: fill the party, then rank up, then items, then relics. */
function shopBot(s: RunState, bot: Rng): void {
  const ctx = teamContext(s);
  // keep enough Spirit Stones for one Time Reversal, like a careful player would
  const reserve = s.nodeIndex >= 4 ? currentRewindCost(s) : 0;
  const stones = s.stones;
  s.stones = Math.max(0, stones - reserve);
  for (const it of s.inventory.slice()) {
    const h = s.roster.find((x) => x.items.length < heroItemSlots(x, ctx));
    if (h) equipItem(s, it, h.uid);
  }
  let guard = 0;
  let bought = true;
  while (bought && guard++ < 12) {
    bought = false;
    const sh = s.shop!;
    const partyFree = s.party.includes(null);
    // prefer heroes that rank up owned ones or fill the party
    const heroOffers = sh.heroes.filter((h): h is NonNullable<typeof h> => !!h && h.price <= s.stones);
    const rankUp = heroOffers.find((h) => s.roster.some((r) => r.defId === h.defId && r.rank < 3));
    const fresh = heroOffers.find((h) => !s.roster.some((r) => r.defId === h.defId));
    const pick = rankUp ?? (partyFree || s.reserve.includes(null) ? fresh : undefined);
    if (pick && buyHero(s, pick.key).ok) {
      bought = true;
      continue;
    }
    const item = sh.items.find((i) => i && i.price <= s.stones && s.inventory.length < s.inventorySize);
    if (item && s.stones >= item.price + 5 && buyItem(s, item.key).ok) {
      bought = true;
      continue;
    }
    const relic = sh.relics.find((r) => r && r.price <= s.stones);
    if (relic && s.stones >= relic.price + 10 && buyRelic(s, relic.key).ok) {
      bought = true;
      continue;
    }
    if (s.stones >= 25 && bot.chance(30)) {
      const ts = sh.teamSize.find((r) => r && r.price <= s.stones - 10);
      if (ts && buyRelic(s, ts.key).ok) bought = true;
    }
  }
  for (const it of s.inventory.slice()) {
    const h = s.roster.find((x) => x.items.length < heroItemSlots(x, ctx));
    if (h) equipItem(s, it, h.uid);
  }
  s.stones += reserve;
}

const outcomes: Outcome[] = [];
for (let i = 1; i <= RUNS; i++) outcomes.push(play(1000 + i * 17));

const victories = outcomes.filter((o) => o.victory).length;
const reachedR2 = outcomes.filter((o) => o.realm >= 2).length;
const lossCounts = new Map<string, number>();
for (const o of outcomes) for (const n of o.lossNodes) lossCounts.set(n, (lossCounts.get(n) ?? 0) + 1);
const allDur = outcomes.flatMap((o) => o.durations);
const avgDur = allDur.reduce((a, b) => a + b, 0) / Math.max(1, allDur.length);

console.log(`Tier ${TIER} · ${RUNS} runs`);
console.log(`victories: ${victories} (${Math.round((victories / RUNS) * 100)}%) · reached realm 2: ${reachedR2}`);
console.log(`avg fights: ${(outcomes.reduce((a, o) => a + o.fights, 0) / RUNS).toFixed(1)} · avg losses: ${(outcomes.reduce((a, o) => a + o.losses, 0) / RUNS).toFixed(2)} · avg roster: ${(outcomes.reduce((a, o) => a + o.roster, 0) / RUNS).toFixed(1)} · avg rank: ${(outcomes.reduce((a, o) => a + o.avgRank, 0) / RUNS).toFixed(2)}`);
console.log(`avg fight duration: ${avgDur.toFixed(1)}s · >50s fights: ${allDur.filter((d) => d > 50).length}/${allDur.length}`);
console.log('losses by node:', [...lossCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
const ends = new Map<string, number>();
for (const o of outcomes) {
  const k = o.victory ? 'VICTORY' : `R${o.realm}N${o.node}`;
  ends.set(k, (ends.get(k) ?? 0) + 1);
}
console.log('run endings:', [...ends.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
