import { effect, signal, untracked } from '@preact/signals';
import { act, meta, run, saveRun, updateMeta } from '@/app/store';
import { endRun, endlessScore, type RunState } from '@/core/run';
import { onRunEvent, type RunEvent } from '@/core/runEvents';
import { ACH_BY_ID, achievementXp, earnedBy } from '@/meta/achievementDefs';
import { defaultLifetime, migrateMeta } from '@/meta/migrate';
import { computeRunRenown, levelOf } from '@/meta/renown';
import { BOUNTY_BY_ID, SECT_OPENS, addPurse, computeRunPurse, nextHeirloomLevel, refillBounties, sectOf } from '@/meta/sect';
import { addMastery } from '@/meta/mastery';
import { omenResults, rollSectEvent } from '@/meta/sectEvents';

/** Achievements earned but not shown yet: the toast layer shows them one by one. */
export const achievementToasts = signal<string[]>([]);

/**
 * Records new achievements. During a run their Renown XP waits for the run's payout (so the run-end screen shows it);
 * outside a run it is banked at once.
 */
function unlock(ids: string[], s: RunState | null): void {
  const have = untracked(() => meta.value.achievements) ?? {};
  const fresh = [...new Set(ids)].filter((id) => !have[id] && ACH_BY_ID[id]);
  if (!fresh.length) return;
  const now = Date.now();
  const live = !!s && s.phase !== 'runEnd' && !s.metaPaid;
  if (live) {
    (s.achievementsEarned ??= []).push(...fresh);
    saveRun();
  }
  untracked(() =>
    updateMeta((m) => {
      m.achievements ??= {};
      for (const id of fresh) m.achievements[id] = now;
      if (!live) m.renown = { xp: (m.renown?.xp ?? 0) + achievementXp(fresh) };
    }),
  );
  achievementToasts.value = [...achievementToasts.peek(), ...fresh];
}

function onEvent(e: RunEvent): void {
  const s = e.s;
  // cross-run facts some achievements need
  if (e.type === 'fightEnd' && e.record.won && e.record.kind === 'challenge' && s.activeChallenge) {
    const id = s.activeChallenge.id;
    untracked(() =>
      updateMeta((m) => {
        const l = (m.lifetime ??= defaultLifetime());
        if (!l.challengesWon.includes(id)) l.challengesWon.push(id);
      }),
    );
  }
  if (e.type === 'realmCleared' && s.realm === 2) {
    const ids = s.party.filter((u): u is string => !!u).map((uid) => s.roster.find((h) => h.uid === uid)?.defId).filter((x): x is string => !!x);
    untracked(() =>
      updateMeta((m) => {
        const l = (m.lifetime ??= defaultLifetime());
        for (const id of ids) if (!l.winnersWith.includes(id)) l.winnersWith.push(id);
      }),
    );
  }
  unlock(earnedBy(e, untracked(() => meta.value)), s);
}

/** Save v2 migration, run-event listening and the state checks behind achievements. Call once at boot. */
export function installMeta(): void {
  updateMeta((m) => {
    migrateMeta(m);
    // an open Sect always shows three bounties
    if (levelOf(m.renown?.xp ?? 0).level >= SECT_OPENS) {
      const sect = sectOf(m);
      if (sect.bounties.active.length < 3) {
        sect.bounties = refillBounties(sect.bounties.active, sect.bounties.done);
        m.sect = sect;
      }
    }
  });
  onRunEvent(onEvent);
  // facts of the live run (Spirit Stones held, a Nascent Soul disciple)
  effect(() => {
    const s = run.value;
    if (!s || s.phase === 'runEnd') return;
    unlock(earnedBy({ type: 'state', s }, untracked(() => meta.value)), s);
  });
  // facts of the save (Compendium complete, contracts cleared, Ladder record, challenges, winners)
  effect(() => {
    const m = meta.value;
    unlock(earnedBy({ type: 'meta', m }, m), untracked(() => run.value));
  });
}

/**
 * Pays a finished run once: Sect Renown, run counters, lifetime stats and the Ladder record. Stores the payout on the
 * run for the run-end rewards view. Safe to call again (s.metaPaid).
 */
export function finishRunMeta(s: RunState): void {
  if (s.metaPaid) return;
  s.metaPaid = true;
  const earned = s.achievementsEarned ?? [];
  const pay = computeRunRenown(s, achievementXp(earned));
  const before = meta.peek().renown?.xp ?? 0;
  const won = !!s.victory;
  const totals = Object.values(s.heroTotals ?? {});
  // the sect's share: Funds and materials, the bounties met (only those already on the board), the heirloom's growth
  const purse = computeRunPurse(s);
  const sect0 = sectOf(meta.peek());
  const boardOpen = levelOf(before).level >= SECT_OPENS;
  const met = boardOpen ? sect0.bounties.active.filter((id) => BOUNTY_BY_ID[id]?.met(s)) : [];
  const carried = s.sect?.heirloom;
  const owned = carried && sect0.heirlooms.find((h) => h.id === carried.id);
  const heirloomUp = won && owned && owned.level < nextHeirloomLevel(owned.level) ? { id: owned.id, level: nextHeirloomLevel(owned.level) } : undefined;
  // disciple mastery: the run's wins with each disciple on the board
  const mastered = addMastery(meta.peek().mastery, s.masteryWins);
  // the omens sect events sent into the run: a challenge won, the Heart Demon beaten, a disciple back from seclusion
  const omens = omenResults(s, mastered.mastery);
  let sectEvent: string | undefined;
  updateMeta((m) => {
    m.runsPlayed++;
    if (won) m.runsWon++;
    const l = (m.lifetime ??= defaultLifetime());
    l.runs++;
    if (won) l.wins++;
    l.fights += s.stats.fights;
    l.fightsWon += s.stats.wins;
    l.kills += totals.reduce((a, t) => a + t.kills, 0);
    l.crits += totals.reduce((a, t) => a + t.crits, 0);
    l.damage += Math.round(s.stats.damage);
    l.bestHit = Math.max(l.bestHit, Math.round(s.stats.bestHit));
    l.stonesEarned += s.stats.stonesEarned;
    l.playMs += s.stats.elapsedMs || Math.max(0, Date.now() - s.stats.startedAt);
    if (s.realm === 3) {
      const score = endlessScore(s);
      l.bestFloor = Math.max(l.bestFloor, s.floor);
      m.bestEndless = Math.max(m.bestEndless, score);
      m.leaderboard.push({ name: `Run ${m.runsPlayed}`, score, tier: s.tier, date: Date.now(), floor: s.floor, ...(s.sect?.pure ? { pure: true } : {}) });
      m.leaderboard.sort((a, b) => b.score - a.score);
      m.leaderboard = m.leaderboard.slice(0, 20);
    }
    m.renown = { xp: before + pay.total };
    m.mastery = omens.mastery;
    const sect = sectOf(m);
    sect.purse = addPurse(sect.purse, purse);
    for (const id of met) sect.purse = addPurse(sect.purse, BOUNTY_BY_ID[id].reward);
    sect.purse = addPurse(sect.purse, omens.purse);
    if (heirloomUp) sect.heirlooms = sect.heirlooms.map((h) => (h.id === heirloomUp.id ? { ...h, level: heirloomUp.level } : h));
    // the board fills once the Sect is open (new bounties wait for the next run)
    if (levelOf(m.renown.xp).level >= SECT_OPENS) sect.bounties = refillBounties(sect.bounties.active.filter((id) => !met.includes(id)), [...sect.bounties.done, ...met]);
    m.sect = sect;
    // about one return in three, something happens at the sect (it waits there for the player's choice)
    const roll = rollSectEvent(m, s.seed);
    m.sect = { ...sectOf(m), event: roll.event, pace: roll.pace };
    if (roll.fresh && roll.event) sectEvent = roll.event.id;
  });
  s.payout = {
    xpBefore: before,
    xpAfter: before + pay.total,
    total: pay.total,
    lines: pay.lines,
    achievements: earned.slice(),
    purse,
    bounties: met,
    heirloomUp,
    masteryUp: [...mastered.ups, ...omens.ups],
    omens: omens.results,
    sectEvent,
  };
}

/** Ends the run (victory or defeat) and pays it: every run-ending button goes through here. */
export function concludeRun(victory: boolean): void {
  act((st) => {
    endRun(st, victory);
    finishRunMeta(st);
  });
}
