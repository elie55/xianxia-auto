import type { ComponentChildren } from 'preact';
import { InkTransition } from '@/ui/components/InkTransition';
import { useErrorBoundary } from 'preact/hooks';
import { run, screen, toast } from './store';
import { MainMenu } from '@/ui/screens/MainMenu';
import { NewRun } from '@/ui/screens/NewRun';
import { RunScreen } from '@/ui/screens/RunScreen';
import { Settings } from '@/ui/screens/Settings';
import { Credits } from '@/ui/screens/Credits';
import { Compendium } from '@/ui/screens/Compendium';
import { TooltipLayer } from '@/ui/components/Tooltip';
import { TutorialLayer, useTutorialDriver } from '@/ui/tutorial/Tutorial';
import { LoadingVeil } from '@/ui/components/LoadingVeil';
import { AchievementToast } from '@/ui/components/AchievementToast';
import { RenownScreen } from '@/ui/screens/Renown';

export function App() {
  const scr = screen.value;
  const t = toast.value;
  useTutorialDriver();
  return (
    <>
      {/* fills the window around the 16:9 frame with the current screen's own painting (polish.css, WINDOW BLEED) */}
      <div class="screen-bleed" aria-hidden="true" />
      <ScreenGuard key={scr}>
        {scr === 'menu' && <MainMenu />}
        {scr === 'newRun' && <NewRun />}
        {scr === 'run' && run.value && <RunScreen />}
        {scr === 'settings' && <Settings />}
        {scr === 'credits' && <Credits />}
        {scr === 'compendium' && <Compendium />}
        {scr === 'renown' && <RenownScreen />}
      </ScreenGuard>
      {t && (
        <div key={t.id} class={`toast ${t.kind}`}>
          {t.text}
        </div>
      )}
      <InkTransition />
      <AchievementToast />
      <TutorialLayer />
      <TooltipLayer />
      <LoadingVeil />
    </>
  );
}

/**
 * If a screen throws while rendering, show a recovery panel instead of an empty interface.
 * The saved run is left untouched, so "Continue Run" still works once the cause is gone.
 */
function ScreenGuard({ children }: { children: ComponentChildren }) {
  const [error, reset] = useErrorBoundary((e) => console.error('[Nine Heavens] screen crashed', e));
  if (!error) return <>{children}</>;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div class="screen center crash-screen">
      <div class="panel crash-panel">
        <div class="brush crash-hanzi">乱</div>
        <div class="display crash-title">The qi went astray</div>
        <p class="muted">Something broke while drawing this screen. Your run is saved.</p>
        <code class="crash-detail">{message}</code>
        <div class="row" style={{ gap: 14, justifyContent: 'center' }}>
          <button class="btn primary" onClick={() => reset()}>
            Try again
          </button>
          <button
            class="btn ghost"
            onClick={() => {
              screen.value = 'menu';
              reset();
            }}
          >
            Return to the sect
          </button>
        </div>
      </div>
    </div>
  );
}
