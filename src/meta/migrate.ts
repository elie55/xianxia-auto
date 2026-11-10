import type { LifetimeStats, MetaProfile, MetaSave } from '@/app/store';
import { ladderFloorOf } from '@/core/run';
import { achievementXp, earnedBy } from '@/meta/achievementDefs';
import { DEFAULT_COSMETICS } from '@/meta/cosmetics';
import { cumulativeXp } from '@/meta/renown';

export const META_VERSION = 2;
/** Older saves earn Renown for the runs they already played, up to Renown 15. */
export const RETRO_RENOWN_CAP_LEVEL = 15;

export const defaultProfile = (): MetaProfile => ({
  sectName: 'Nameless Sect',
  avatar: DEFAULT_COSMETICS.avatar,
  title: DEFAULT_COSMETICS.title,
  frame: DEFAULT_COSMETICS.frame,
  banner: DEFAULT_COSMETICS.banner,
});

export const defaultLifetime = (): LifetimeStats => ({
  runs: 0,
  wins: 0,
  fights: 0,
  fightsWon: 0,
  kills: 0,
  crits: 0,
  damage: 0,
  bestHit: 0,
  stonesEarned: 0,
  bestFloor: 0,
  playMs: 0,
  challengesWon: [],
  winnersWith: [],
});

/**
 * Brings a save up to version 2 (Sect Renown, achievements, the profile, lifetime stats). Mutates and returns `m`.
 * A save that already played runs gets Renown for them (300 per victory, 80 per run, plus its retroactive
 * achievements, capped at Renown 15), the contract and Ladder achievements its records prove, and lifetime totals from
 * its counters. Running it again changes nothing.
 */
export function migrateMeta(m: MetaSave, now = Date.now()): MetaSave {
  m.profile = { ...defaultProfile(), ...(m.profile ?? {}) };
  m.lifetime = { ...defaultLifetime(), ...(m.lifetime ?? {}) };
  m.achievements ??= {};
  if ((m.version ?? 1) >= META_VERSION && m.renown) return m;

  const life = m.lifetime;
  life.runs = Math.max(life.runs, m.runsPlayed);
  life.wins = Math.max(life.wins, m.runsWon);
  const floors = m.leaderboard.map((e) => e.floor ?? ladderFloorOf(e.score));
  if (m.bestEndless > 0) floors.push(ladderFloorOf(m.bestEndless));
  life.bestFloor = Math.max(life.bestFloor, ...floors, 0);
  for (const e of m.leaderboard) e.floor ??= ladderFloorOf(e.score);

  const retro = earnedBy({ type: 'meta', m }, m).filter((id) => !m.achievements![id]);
  for (const id of retro) m.achievements[id] = now;
  if (!m.renown) {
    const xp = m.runsWon * 300 + m.runsPlayed * 80 + achievementXp(retro);
    m.renown = { xp: Math.min(xp, cumulativeXp(RETRO_RENOWN_CAP_LEVEL)) };
  }
  m.version = META_VERSION;
  return m;
}
