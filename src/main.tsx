import './styles/base.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/run.css';
import './styles/polish.css';
import { render } from 'preact';
import { App } from '@/app/App';
import { installScaling } from '@/app/scale';
import { installDesktop } from '@/app/desktop';
import { installSettingsEffects } from '@/app/settingsFx';
import { installHotkeys } from '@/ui/hotkeys';
import { applyDebugQuery } from '@/app/debug';
import { startPreload } from '@/app/preload';
import { installUiSounds } from '@/ui/flourish';
import { installDiscovery } from '@/app/discovery';

const uiRoot = document.getElementById('ui-root')!;
installScaling(uiRoot);
installDesktop();
installSettingsEffects();
const qa = new URLSearchParams(location.search);
// QA URLs (?demo, ?screen, &noanim) skip the loading veil; assets still load in the background
startPreload(qa.has('demo') || qa.has('screen') || qa.has('noanim'));
installUiSounds();
installHotkeys();
installDiscovery();
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
