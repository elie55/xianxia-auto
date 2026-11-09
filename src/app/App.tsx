import { run, screen, toast } from './store';
import { MainMenu } from '@/ui/screens/MainMenu';
import { NewRun } from '@/ui/screens/NewRun';
import { RunScreen } from '@/ui/screens/RunScreen';
import { Settings } from '@/ui/screens/Settings';
import { Credits } from '@/ui/screens/Credits';
import { TooltipLayer } from '@/ui/components/Tooltip';

export function App() {
  const scr = screen.value;
  const t = toast.value;
  return (
    <>
      {scr === 'menu' && <MainMenu />}
      {scr === 'newRun' && <NewRun />}
      {scr === 'run' && run.value && <RunScreen />}
      {scr === 'settings' && <Settings />}
      {scr === 'credits' && <Credits />}
      {t && (
        <div key={t.id} class={`toast ${t.kind}`}>
          {t.text}
        </div>
      )}
      <TooltipLayer />
    </>
  );
}
