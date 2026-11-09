import { hasSavedRun, loadRun, meta, screen, setRun, showToast } from '@/app/store';
import { resetItemQuests } from '@/core/run';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';
import { useEffect } from 'preact/hooks';

const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);

export function MainMenu() {
  useEffect(() => {
    audio.playMusic('menu');
  }, []);
  const m = meta.value;
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
  return (
    <div class="screen menu-screen">
      <div class="menu-bg">
        <div class="menu-keyart" />
        <div class="menu-mist" />
        <div class="menu-particles">
          {Array.from({ length: 24 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.7) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s`, width: 2 + (i % 3) * 2 }} />
          ))}
        </div>
        <div class="watermark menu-watermark">九重天</div>
      </div>
      <div class="menu-version">v0.1.0 · pre-alpha</div>
      <div class="menu-left anim-rise">
        <div class="menu-logo">
          <div class="menu-logo-mark">
            <Icon name="logo_yinyang" size={74} color="var(--gold-bright)" />
          </div>
          <div>
            <div class="menu-sub brush">九重天</div>
            <h1 class="display menu-title">
              Nine
              <br />
              Heavens
            </h1>
            <div class="menu-tagline">A XIANXIA AUTO-BATTLER · CLIMB THE HEAVENLY LADDER</div>
          </div>
        </div>
        <div class="menu-buttons stagger">
          {hasSavedRun.value && (
            <button class="btn primary big" onClick={continueRun}>
              <span class="btn-glyph">续</span> Continue Run
            </button>
          )}
          <button
            class={`btn big ${hasSavedRun.value ? '' : 'primary'}`}
            onClick={() => {
              audio.sfx('ui_confirm');
              screen.value = 'newRun';
            }}
          >
            <span class="btn-glyph">始</span> New Run
          </button>
          <button
            class="btn big ghost"
            onClick={() => {
              audio.sfx('ui_click');
              screen.value = 'compendium';
            }}
          >
            <span class="btn-glyph">典</span> Compendium
          </button>
          <button
            class="btn big ghost"
            onClick={() => {
              audio.sfx('ui_click');
              screen.value = 'settings';
            }}
          >
            <span class="btn-glyph">设</span> Settings
          </button>
          <button
            class="btn big ghost"
            onClick={() => {
              audio.sfx('ui_click');
              screen.value = 'credits';
            }}
          >
            <span class="btn-glyph">谢</span> Credits
          </button>
          {isElectron && (
            <button class="btn big ghost" onClick={() => window.close()}>
              <span class="btn-glyph">出</span> Quit
            </button>
          )}
        </div>
        <div class="menu-stats muted">
          Runs: {m.runsPlayed} · Victories: {m.runsWon} · Best Ladder floor: {m.bestEndless}
        </div>
      </div>
    </div>
  );
}
