import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { reducedMotion } from '@/app/motion';

/** A number that counts up from 0 after `delay` seconds (shows the final value at once with reduced motion). */
export function CountUp({ to, delay = 0, duration = 0.8 }: { to: number; delay?: number; duration?: number }) {
  const [v, setV] = useState(reducedMotion() ? to : 0);
  useEffect(() => {
    if (reducedMotion()) return void setV(to);
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / (duration * 1000)));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // a hidden window may never animate: land on the value anyway
    const done = setTimeout(() => setV(to), (delay + duration + 0.4) * 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [to]);
  return <>{v}</>;
}

let uid = 0;

/**
 * A calligraphy brush stroke that paints itself across the screen, a gold title with a glint sweeping over it, and a
 * vermilion seal stamped at the end of the stroke. Used for victory, defeat, a sealed rift and the end of a run.
 * The stroke is drawn in SVG: a tapered path whose edges are roughened into bristle streaks by a turbulence filter.
 */
export function BrushBanner({ title, seal, tone = 'won', sub, size = 'lg' }: { title: string; seal?: string; tone?: 'won' | 'lost' | 'gold'; sub?: ComponentChildren; size?: 'lg' | 'xl' }) {
  const id = `bb${++uid}`;
  return (
    <div class={`brush-banner tone-${tone} size-${size}`}>
      <svg class="bb-stroke" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id={`${id}-rough`} x="-5%" y="-30%" width="110%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.28" numOctaves="3" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="bb-ink-a" />
            <stop offset="0.5" class="bb-ink-b" />
            <stop offset="1" class="bb-ink-a" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" class="bb-edge-off" />
            <stop offset="0.25" class="bb-edge-on" />
            <stop offset="0.75" class="bb-edge-on" />
            <stop offset="1" class="bb-edge-off" />
          </linearGradient>
        </defs>
        <g filter={`url(#${id}-rough)`}>
          {/* the main stroke: thin entry on the left, full body, a lifted dry tail on the right */}
          <path
            class="bb-body"
            fill={`url(#${id}-ink)`}
            d="M 34 118 C 110 70, 260 50, 430 46 C 640 40, 860 40, 1030 56 C 1110 63, 1162 80, 1178 98 C 1150 108, 1096 118, 1034 134 C 850 166, 620 162, 420 156 C 250 152, 120 146, 34 118 Z"
          />
          {/* dry-brush streaks along the stroke */}
          <path class="bb-dry" d="M 120 128 C 380 150, 760 150, 1100 120" />
          <path class="bb-dry thin" d="M 90 84 C 400 58, 800 56, 1120 82" />
          <path class="bb-dry thin" d="M 260 140 C 520 160, 840 158, 1040 134" />
          {/* a faint gold rim along the top edge */}
          <path class="bb-rim" stroke={`url(#${id}-edge)`} d="M 60 104 C 160 66, 300 52, 440 49 C 650 43, 870 44, 1040 60" />
        </g>
        <g class="bb-splats">
          <circle cx="1188" cy="78" r="5" />
          <circle cx="1170" cy="132" r="3.5" />
          <circle cx="22" cy="104" r="4" />
          <circle cx="1196" cy="112" r="2.5" />
        </g>
      </svg>
      <div class="bb-line">
        <div class="bb-title display" data-text={title}>
          {title}
        </div>
        {seal && (
          <div class="bb-seal">
            <span class="brush">{seal}</span>
          </div>
        )}
      </div>
      {sub && <div class="bb-sub">{sub}</div>}
    </div>
  );
}

/** Painted star pips (gold, with empty sockets up to `max`). */
export function StarPips({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div class="star-pips" aria-label={`${count} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} class={`star-pip ${i < count ? 'on' : ''}`} />
      ))}
    </div>
  );
}
