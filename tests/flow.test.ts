import { describe, expect, it } from 'vitest';
import { enterNode, isFinalGuardianWon, newRun, nextRealm, proceedFromResult, type RunState } from '@/core/run';

/** A run standing on the guardian node of the given realm, just after winning (or losing) that fight. */
function afterGuardian(realm: 1 | 2, won = true): RunState {
  const s = newRun(0, 11);
  if (realm === 2) nextRealm(s);
  s.nodeIndex = s.timeline.length - 1;
  enterNode(s);
  s.pendingRankUps = [];
  s.lastResult = { winner: won ? 'ally' : 'enemy' } as RunState['lastResult'];
  s.phase = 'result';
  return s;
}

describe('After the last fight of the run', () => {
  it('a won Realm II guardian goes straight to the Realm Cleared screen, with no shop', () => {
    const s = afterGuardian(2);
    expect(s.currentEncounter?.kind).toBe('boss');
    expect(isFinalGuardianWon(s)).toBe(true);
    proceedFromResult(s);
    expect(s.phase).toBe('realmCleared');
  });
  it('the Realm I guardian still opens the shop before Realm II', () => {
    const s = afterGuardian(1);
    expect(isFinalGuardianWon(s)).toBe(false);
    proceedFromResult(s);
    expect(s.phase).toBe('shop');
  });
});
