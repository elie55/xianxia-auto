import type { BattleResult } from '@/battle/sim/battle';
import type { FightRecord, RunState } from '@/core/run';

/**
 * Facts the run state machine reports as they happen. The meta layer (achievements, lifetime stats) listens; the core
 * rules only emit and never decide rewards, so run.ts stays free of meta-progression logic.
 */
export type RunEvent =
  | { type: 'fightEnd'; s: RunState; result: BattleResult; record: FightRecord }
  /** The realm guardian (or a Ladder warden) fell; s.realm and s.floor still name the realm just cleared. */
  | { type: 'realmCleared'; s: RunState }
  | { type: 'rankUp'; s: RunState; uid: string; rank: number }
  | { type: 'reroll'; s: RunState }
  | { type: 'sellHero'; s: RunState; defId: string; rank: number }
  | { type: 'questDone'; s: RunState; name: string };

type Listener = (e: RunEvent) => void;
const listeners = new Set<Listener>();

export function onRunEvent(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function emitRunEvent(e: RunEvent): void {
  for (const l of listeners) {
    try {
      l(e);
    } catch (err) {
      // a listener must never break the run itself
      console.error('[runEvents]', err);
    }
  }
}
