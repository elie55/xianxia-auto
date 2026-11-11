import type { MetaSave } from '@/app/store';
import { heroByUid, type RunState } from '@/core/run';
import { HEROES, HERO_BY_ID } from '@/content/heroes';
import { MASTERY_PASSIVES } from '@/content/mastery';
import { MASTERY_THRESHOLDS, MAX_MASTERY, MASTER_TITLES, masteryLevel } from '@/meta/mastery';
import { sectOf } from '@/meta/sect';

/**
 * The Hall of Ancestors (docs/META_PROGRESSION.md 6.9): the sect's memory. A victory raises a statue of its champion,
 * mastered disciples stand gilded, and the best Ladder ascents and the achievements are kept. It changes no fight.
 */

/** A statue in the Hall of Victories. */
export interface VictoryRecord {
  /** When the run ended (ms). */
  at: number;
  /** The contract cleared. */
  tier: number;
  /** The champion: the disciple who dealt the most damage. */
  mvp: string;
  dealt: number;
  /** The party at the end of the run. */
  team: string[];
  pure?: boolean;
  /** The Ladder floor reached when the run went on after the contract. */
  floor?: number;
  minutes?: number;
}

/** Victories the Hall keeps (the newest). */
export const HALL_VICTORIES = 60;

/** The statue a won run raises, or none (no champion recorded). */
export function victoryRecord(s: RunState, at = Date.now()): VictoryRecord | null {
  const best = Object.entries(s.heroTotals ?? {})
    .map(([uid, t]) => ({ h: heroByUid(s, uid), dealt: t.dealt }))
    .filter((x) => x.h)
    .sort((a, b) => b.dealt - a.dealt)[0];
  if (!best?.h) return null;
  const team = s.party.map((uid) => (uid ? heroByUid(s, uid)?.defId : undefined)).filter((id): id is string => !!id);
  const minutes = Math.round((s.stats.elapsedMs || 0) / 60000);
  return {
    at,
    tier: s.tier,
    mvp: best.h.defId,
    dealt: Math.round(best.dealt),
    team,
    ...(s.sect?.pure ? { pure: true } : {}),
    ...(s.realm === 3 && s.floor > 0 ? { floor: s.floor } : {}),
    ...(minutes > 0 ? { minutes } : {}),
  };
}

/** The Hall's victories with a new one first, the oldest dropped past the cap. */
export function addVictory(list: VictoryRecord[] | undefined, rec: VictoryRecord | null): VictoryRecord[] {
  const cur = (list ?? []).filter((v) => HERO_BY_ID[v.mvp]);
  return rec ? [rec, ...cur].slice(0, HALL_VICTORIES) : cur;
}

/** Victories won before the Hall kept their statues. */
export function unrecordedVictories(m: MetaSave): number {
  return Math.max(0, (m.runsWon ?? 0) - (m.hall?.victories?.length ?? 0));
}

export type StatueKind = 'gold' | 'bronze' | 'empty';

/** A disciple's place in the Hall of Masters. */
export interface MasterEntry {
  id: string;
  wins: number;
  level: number;
  /** Wins still needed for the next level (0 at mastery V). */
  toNext: number;
  statue: StatueKind;
  title?: string;
  passive?: string;
}

/**
 * Every disciple the sect knows (the launch roster, the exclusive disciples it recruited and any with mastery), the
 * most mastered first.
 */
export function hallOfMasters(m: MetaSave): MasterEntry[] {
  const recruited = new Set(sectOf(m).disciples);
  const mastery = m.mastery ?? {};
  return HEROES.filter((h) => !h.exclusive || recruited.has(h.id) || mastery[h.id])
    .map((h) => {
      const wins = mastery[h.id] ?? 0;
      const level = masteryLevel(wins);
      const statue: StatueKind = level >= MAX_MASTERY ? 'gold' : level >= 3 ? 'bronze' : 'empty';
      return {
        id: h.id,
        wins,
        level,
        toNext: level >= MAX_MASTERY ? 0 : MASTERY_THRESHOLDS[level] - wins,
        statue,
        ...(level >= 3 ? { title: MASTER_TITLES[h.id] } : {}),
        ...(level >= MAX_MASTERY ? { passive: MASTERY_PASSIVES[h.id]?.name } : {}),
      };
    })
    .sort((a, b) => b.wins - a.wins || a.id.localeCompare(b.id));
}
