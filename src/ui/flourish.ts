import gsap from 'gsap';
import { toDesign } from '@/app/scale';
import { audio } from '@/audio/AudioManager';

/** Everything that plays the soft hover tick. */
const HOVER =
  '.btn:not([disabled]), .hero-card.clickable, .shop-row:not(.sold), .pick-card, .upgrade-card, .reward-card, .event-choice:not(.disabled), .codex-tab, .codex-card, .team-size-offer, .champion-pick, .blessing-card, .speed-btn';

let hovered: Element | null = null;

/** A soft tick when the mouse enters a button, card or choice (once per element). */
export function installUiSounds(): void {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = (e.target as Element | null)?.closest?.(HOVER) ?? null;
    if (el === hovered) return;
    hovered = el;
    if (el) audio.sfx('ui_hover', { volume: 0.22, throttleMs: 45 });
  });
}

function layer(): HTMLElement {
  let l = document.getElementById('flourish-layer');
  if (!l) {
    l = document.createElement('div');
    l.id = 'flourish-layer';
    document.getElementById('ui-root')!.appendChild(l);
  }
  return l;
}

/** Centre of an element in design space. */
function centre(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return toDesign(r.left + r.width / 2, r.top + r.height / 2);
}

/** Gold ring burst at a design-space point. */
export function burstAt(x: number, y: number, color = 'var(--gold-bright)'): void {
  const b = document.createElement('div');
  b.className = 'flourish-burst';
  b.style.left = `${x}px`;
  b.style.top = `${y}px`;
  b.style.setProperty('--c', color);
  layer().appendChild(b);
  setTimeout(() => b.remove(), 700);
}

/**
 * Purchase flourish: a copy of the bought thing (the first match of `pick` inside `source`) arcs from the shop to
 * the element `findTarget` returns once the purchase has re-rendered, then bursts there and makes it pop.
 */
export function flyTo(source: Element | null, findTarget: () => Element | null, opts: { pick?: string; size?: number } = {}): void {
  if (!source) return;
  const from = centre(source);
  const art = (opts.pick ? source.querySelector(opts.pick) : null) ?? source;
  const size = opts.size ?? 96;
  const ghost = document.createElement('div');
  ghost.className = 'flourish-ghost';
  const clone = art.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-drop');
  clone.removeAttribute('data-offer');
  ghost.appendChild(clone);
  ghost.style.width = ghost.style.height = `${size}px`;
  ghost.style.left = `${from.x - size / 2}px`;
  ghost.style.top = `${from.y - size / 2}px`;
  layer().appendChild(ghost);
  // the destination only exists once the purchase has re-rendered
  setTimeout(() => {
    const target = findTarget();
    const to = target ? centre(target) : { x: from.x, y: from.y - 140 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const peak = Math.min(0, dy) - 90;
    const land = () => {
      ghost.remove();
      burstAt(to.x, to.y);
      if (!target) return;
      target.classList.remove('flourish-pop');
      void (target as HTMLElement).offsetWidth;
      target.classList.add('flourish-pop');
      setTimeout(() => target.classList.remove('flourish-pop'), 500);
    };
    const tl = gsap.timeline({ onComplete: land });
    tl.to(ghost, { x: dx, duration: 0.62, ease: 'power1.inOut' }, 0)
      .to(ghost, { y: peak, duration: 0.28, ease: 'power2.out' }, 0)
      .to(ghost, { y: dy, duration: 0.34, ease: 'power2.in' }, 0.28)
      .to(ghost, { scale: 0.45, rotation: dx > 0 ? 14 : -14, duration: 0.62, ease: 'power1.in' }, 0);
    // safety net if the timeline cannot tick (hidden window): never leave a ghost behind
    setTimeout(() => ghost.isConnected && land(), 1500);
  }, 60);
}
