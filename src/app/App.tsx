import { run, screen, toast } from './store';
import { MainMenu } from '@/ui/screens/MainMenu';
import { NewRun } from '@/ui/screens/NewRun';
import { RunScreen } from '@/ui/screens/RunScreen';
import { Settings } from '@/ui/screens/Settings';
import { Credits } from '@/ui/screens/Credits';
import { Compendium } from '@/ui/screens/Compendium';
import { TooltipLayer } from '@/ui/components/Tooltip';
import { TutorialLayer, useTutorialDriver } from '@/ui/tutorial/Tutorial';

export function App() {
  const scr = screen.value;
  const t = toast.value;
  useTutorialDriver();
  return (
    <>
      {scr === 'menu' && <MainMenu />}
      {scr === 'newRun' && <NewRun />}
      {scr === 'run' && run.value && <RunScreen />}
      {scr === 'settings' && <Settings />}
      {scr === 'credits' && <Credits />}
      {scr === 'compendium' && <Compendium />}
      {t && (
        <div key={t.id} class={`toast ${t.kind}`}>
          {t.text}
        </div>
      )}
      <TutorialLayer />
      <TooltipLayer />
    </>
  );
}
