import './styles/base.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/run.css';
import { render } from 'preact';
import { App } from '@/app/App';
import { installScaling } from '@/app/scale';
import { applyDebugQuery } from '@/app/debug';

const uiRoot = document.getElementById('ui-root')!;
installScaling(uiRoot);
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
