import './styles/base.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/run.css';
import './styles/polish.css';
import { render } from 'preact';
import { App } from '@/app/App';
import { installScaling } from '@/app/scale';
import { installDesktop } from '@/app/desktop';
import { installHotkeys } from '@/ui/hotkeys';
import { applyDebugQuery } from '@/app/debug';
import { startPreload } from '@/app/preload';
import { installUiSounds } from '@/ui/flourish';

const uiRoot = document.getElementById('ui-root')!;
installScaling(uiRoot);
installDesktop();
const qa = new URLSearchParams(location.search);
// QA URLs (?demo, ?screen, &noanim) skip the loading veil; assets still load in the background
startPreload(qa.has('demo') || qa.has('screen') || qa.has('noanim'));
installUiSounds();
installHotkeys();
applyDebugQuery();
render(<App />, uiRoot);

// Prevent the browser context menu / pinch zoom inside the game.
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false },
);
