import { effect } from '@preact/signals';
import { Howler } from 'howler';
import { Ticker } from 'pixi.js';
import { meta } from './store';
import { reducedMotion } from './motion';
import { getBattleView } from '@/battle/view/BattleView';

/**
 * Settings that act outside any one screen: master volume, muting while the window is in the background, the
 * frame-rate cap, the reduced-motion class (CSS) and the colour-vision palette (CSS hooks; the battle view reads
 * battle/view/palette.ts directly).
 */
export function installSettingsEffects(): void {
  effect(() => {
    Howler.volume(Math.max(0, Math.min(1, meta.value.settings.master ?? 1)));
  });

  const applyMute = () => {
    const away = document.hidden || !document.hasFocus();
    Howler.mute(!!meta.peek().settings.muteUnfocused && away);
  };
  window.addEventListener('blur', applyMute);
  window.addEventListener('focus', applyMute);
  document.addEventListener('visibilitychange', applyMute);
  effect(() => {
    void meta.value.settings.muteUnfocused;
    applyMute();
  });

  // frame cap: the battle renderer and the shared ticker that drives the sprite animations
  const applyCap = (cap: number, tries = 0) => {
    Ticker.shared.maxFPS = cap;
    const ticker = getBattleView()?.app?.ticker;
    if (ticker) ticker.maxFPS = cap;
    else if (tries < 20) setTimeout(() => applyCap(cap, tries + 1), 500);
  };
  effect(() => applyCap(meta.value.settings.frameCap ?? 0));

  // reduced motion follows the OS preference until the player sets it
  const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const applyMotion = () => document.documentElement.classList.toggle('reduce-motion', reducedMotion());
  media?.addEventListener?.('change', applyMotion);
  effect(() => {
    void meta.value.settings.reduceMotion;
    applyMotion();
  });

  effect(() => {
    document.documentElement.dataset.palette = meta.value.settings.palette ?? 'default';
  });
}
