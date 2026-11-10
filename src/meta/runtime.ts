import { effect, signal, untracked } from '@preact/signals';
import { act, meta, run, saveRun, updateMeta } from '@/app/store';
import { endRun, endlessScore, type RunState } from '@/core/run';
import { onRunEvent, type RunEvent } from '@/core/runEvents';
import { ACH_BY_ID, achievementXp, earnedBy } from '@/meta/achievementDefs';
import { defaultLifetime, migrateMeta } from '@/meta/migrate';
import { computeRunRenown } from '@/meta/renown';

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
      m.leaderboard.push({ name: `Run ${m.runsPlayed}`, score, tier: s.tier, date: Date.now(), floor: s.floor });
      m.leaderboard.sort((a, b) => b.score - a.score);
      m.leaderboard = m.leaderboard.slice(0, 20);
    }
    m.renown = { xp: before + pay.total };
  });
  s.payout = { xpBefore: before, xpAfter: before + pay.total, total: pay.total, lines: pay.lines, achievements: earned.slice() };
}

/** Ends the run (victory or defeat) and pays it: every run-ending button goes through here. */
export function concludeRun(victory: boolean): void {
  act((st) => {
    endRun(st, victory);
    finishRunMeta(st);
  });
}
