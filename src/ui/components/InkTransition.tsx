import { useEffect, useRef, useState } from 'preact/hooks';
import { run, screen } from '@/app/store';
import { reducedMotion } from '@/app/motion';
import type { Phase } from '@/core/run';

/**
 * Ink-wash transitions between the major screens: when the menu, shop, events, rewards, a breakthrough, a cleared
 * realm or the end of a run comes up, a veil of ink covering the window opens from a few blots with ragged brush
 * edges and reveals it. The state change itself is never delayed (the new screen is already underneath), so the
 * game never waits on the effect. Placement, the fight and its result share one group: no veil inside a fight.
 */
const GROUP: Partial<Record<Phase, string>> = {
  chooseHero: 'draft',
  board: 'arena',
  battle: 'arena',
  result: 'arena',
  defeat: 'arena',
  shop: 'shop',
  event: 'event',
  rankUp: 'rankUp',
  reward: 'reward',
  challenge: 'challenge',
  realmCleared: 'cleared',
  runEnd: 'end',
};

export function InkTransition() {
  const scr = screen.value;
  const phase = run.value?.phase;
  const key = scr === 'run' ? `run:${(phase && GROUP[phase]) ?? phase}` : scr;
  const last = useRef<string | null>(null);
  const [play, setPlay] = useState(0);
  useEffect(() => {
    if (last.current !== null && last.current !== key) setPlay((n) => n + 1);
    last.current = key;
  }, [key]);
  if (!play) return null;
  const calm = reducedMotion();
  return (
    <div key={play} class={`ink-veil ${calm ? 'calm' : ''}`} aria-hidden="true" onAnimationEnd={(e) => e.target === e.currentTarget && setPlay(0)}>
      <svg class="ink-defs" width="0" height="0" aria-hidden="true">
        <filter id="ink-rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div class="ink-wash" />
    </div>
  );
}
