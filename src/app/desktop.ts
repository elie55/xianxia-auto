import { signal } from '@preact/signals';
import { meta, updateMeta } from './store';

/** The bridge exposed by electron/preload.cjs; absent when the game runs in a browser. */
interface DesktopBridge {
  isElectron: true;
  quit(): void;
  toggleFullscreen(): Promise<boolean>;
}

const bridge = (window as unknown as { nineHeavens?: DesktopBridge }).nineHeavens;

/** True in the Windows desktop build. */
export const isDesktop = !!bridge?.isElectron || /Electron/i.test(navigator.userAgent);

const fillsScreen = () => Math.abs(window.innerWidth - screen.width) < 2 && Math.abs(window.innerHeight - screen.height) < 2;

/** Whether the game fills the screen: window fullscreen in the desktop build, the Fullscreen API in a browser. */
export const fullscreen = signal(!!document.fullscreenElement || fillsScreen());

/** Closes the game (desktop build). The run is saved after every action, so nothing is lost. */
export function quitGame(): void {
  if (bridge) bridge.quit();
  else window.close();
}

/** Switches between window and fullscreen, and remembers the choice for the next launch. */
export async function toggleFullscreen(): Promise<void> {
  let on: boolean;
  if (bridge) {
    on = await bridge.toggleFullscreen();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
    on = false;
  } else {
    await document.documentElement.requestFullscreen().catch(() => undefined);
    on = !!document.fullscreenElement;
  }
  fullscreen.value = on;
  updateMeta((m) => {
    m.settings.fullscreen = on;
  });
}

/** Keeps the fullscreen flag honest (resizes, OS shortcuts) and restores the saved display mode at start-up. */
export function installDesktop(): void {
  const sync = () => {
    fullscreen.value = !!document.fullscreenElement || fillsScreen();
  };
  window.addEventListener('resize', sync);
  document.addEventListener('fullscreenchange', sync);
  if (bridge && meta.peek().settings.fullscreen && !fullscreen.peek()) void toggleFullscreen();
}
