import { meta } from './store';

/**
 * True when effects should stay calm: the "Reduce flashes and motion" setting (which follows the operating system's
 * reduced-motion preference until the player sets it) or the ?noanim QA flag that freezes entrance animations.
 */
export function reducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.body.classList.contains('no-anim')) return true;
  const set = meta.value.settings.reduceMotion;
  if (set !== undefined) return set;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
