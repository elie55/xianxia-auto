import { hasSavedRun, loadRun, meta, screen, setRun, showToast } from '@/app/store';
import { resetItemQuests } from '@/core/run';
import { audio } from '@/audio/AudioManager';
import { useEffect, useRef } from 'preact/hooks';
import { isDesktop, quitGame } from '@/app/desktop';
import { SectPlate } from '@/ui/components/MetaBits';
import { isOpen, sectHasNews } from '@/meta/sect';
import { ladderFloorOf } from '@/core/run';


/** Falling cherry petals: position, timing, drift and spin per petal (deterministic so it never reshuffles). */
const PETALS = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 47 + 13) % 100,
  delay: (i * 1.37) % 14,
  duration: 12 + (i % 6) * 2.2,
  drift: (i % 2 ? 1 : -1) * (60 + ((i * 29) % 140)),
  rot: (i * 53) % 360,
  size: 9 + (i % 4) * 3,
}));

/** Golden motes rising from the stairway. */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: 30 + ((i * 37) % 40),
  delay: (i * 0.9) % 10,
  duration: 9 + (i % 5) * 2,
  size: 2 + (i % 3) * 2,
}));

/**
 * Welcome screen: the painted Nine Heavens logo over the celestial stairway, the main actions as painted plaques,
 * slow parallax on the key art, drifting mist, falling petals and a breathing glow on the great gate.
 */
export function MainMenu() {
  useEffect(() => {
    audio.playMusic('menu');
  }, []);
  const m = meta.value;
  const rootRef = useRef<HTMLDivElement>(null);
  // the key art, mist and logo drift a few pixels against the pointer (CSS reads --px / --py)
  const onMove = (e: PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };
  const continueRun = () => {
    const s = loadRun();
    if (!s) {
      showToast('No saved run found', 'error');
      return;
    }
    resetItemQuests();
    setRun(s);
    screen.value = 'run';
    audio.sfx('ui_confirm');
  };
  const go = (to: 'newRun' | 'compendium' | 'settings' | 'credits' | 'renown' | 'sect', sfx = 'ui_click') => {
    audio.sfx(sfx);
    screen.value = to;
  };
  const saved = hasSavedRun.value;
  // the Ladder record as a floor (older saves only kept the score, which counts nodes)
  const bestFloor = m.lifetime?.bestFloor || (m.leaderboard.length ? ladderFloorOf(m.bestEndless) : 0);
  return (
    <div class="screen menu-screen v2" ref={rootRef} onPointerMove={onMove}>
      <div class="menu-bg">
        <div class="menu-keyart" />
        <div class="menu-gate-glow" />
        <div class="menu-cloud one" />
        <div class="menu-cloud two" />
        <div class="menu-motes">
          {MOTES.map((p, i) => (
            <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
          ))}
        </div>
        <div class="menu-petals">
          {PETALS.map((p, i) => (
            <i
              key={i}
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.7,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ['--drift' as string]: `${p.drift}px`,
                ['--rot' as string]: `${p.rot}deg`,
              }}
            />
          ))}
        </div>
        <div class="menu-shade" />
      </div>

      <SectPlate class="menu-plate" onClick={() => go('renown')} />

      <div class="menu-logo-wrap">
        <div class="menu-logo-halo" />
        <div class="menu-logo-img" role="img" aria-label="Nine Heavens" />
        <div class="menu-tagline">
          <i class="menu-rule" />
          A Xianxia Auto-Battler · Climb the Heavenly Ladder
          <i class="menu-rule flip" />
        </div>
      </div>

      <div class="menu-actions">
        <div class="menu-primary stagger">
          {saved && (
            <button class="btn primary big menu-hero-btn" onClick={continueRun}>
              <span class="btn-glyph">续</span> Continue Run
            </button>
          )}
          <button class={`btn big menu-hero-btn ${saved ? '' : 'primary'}`} onClick={() => go('newRun', 'ui_confirm')}>
            <span class="btn-glyph">始</span> New Run
          </button>
        </div>
        <div class="menu-secondary stagger">
          {isOpen('hall', m.renown?.xp ?? 0) && (
            <button class="btn small menu-sect-btn" onClick={() => go('sect')}>
              <span class="btn-glyph">宗</span> The Sect
              {sectHasNews(m) && <i class="menu-news-dot" aria-label="Something can be built" />}
            </button>
          )}
          <button class="btn small" onClick={() => go('compendium')}>
            <span class="btn-glyph">典</span> Compendium
          </button>
          <button class="btn small" onClick={() => go('settings')}>
            <span class="btn-glyph">设</span> Settings
          </button>
          <button class="btn small" onClick={() => go('credits')}>
            <span class="btn-glyph">谢</span> Credits
          </button>
          {isDesktop && (
            <button class="btn small danger" onClick={quitGame}>
              <span class="btn-glyph">出</span> Quit
            </button>
          )}
        </div>
      </div>

      <div class="menu-stats">
        <span>
          Runs <b>{m.runsPlayed}</b>
        </span>
        <span>
          Victories <b>{m.runsWon}</b>
        </span>
        <span>
          Best Ladder floor <b>{bestFloor || 'None'}</b>
        </span>
      </div>
      <div class="menu-version">v0.1.0 · pre-alpha</div>
    </div>
  );
}
