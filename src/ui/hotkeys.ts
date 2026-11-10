import { run } from '@/app/store';
import { toggleFullscreen } from '@/app/desktop';
import { handleDrop, showMenu } from '@/ui/hud/Hud';

/**
 * Keyboard shortcuts. Controls opt in with data-hotkey="<name>" and a key presses the visible, enabled one, so every
 * shortcut runs exactly what a click runs.
 *   Space  Fight (board) or Proceed (battle result)
 *   Esc    close the pause menu, go Back, or open the pause menu
 *   1 2 3  battle speed
 *   R      reroll the shop        F  freeze the shop
 *   E/Del  sell the disciple or Treasure under the cursor (shop)
 *   F11    fullscreen
 */
let pointerX = -1;
let pointerY = -1;

function press(name: string): boolean {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-hotkey~="${name}"]`)].find((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled);
  if (!el) return false;
  el.click();
  return true;
}

/** E / Delete in the shop: sells the party disciple or the Treasure under the cursor, exactly like dropping it on the sell zone. */
function sellHovered(): boolean {
  if (run.value?.phase !== 'shop' || pointerX < 0) return false;
  const tag = document.elementFromPoint(pointerX, pointerY)?.closest<HTMLElement>('[data-sell]')?.dataset.sell;
  if (!tag) return false;
  const [kind, id, fromHero] = tag.split(':');
  if (kind === 'hero') handleDrop({ kind: 'hero', uid: id }, 'sell', pointerX, pointerY);
  else handleDrop({ kind: 'item', itemId: id, fromHero: fromHero || undefined }, 'sell', pointerX, pointerY);
  return true;
}

function escape(): boolean {
  if (showMenu.value) {
    showMenu.value = false;
    return true;
  }
  return press('back') || press('menu');
}

/** The buttons the arrow keys move between: those of the topmost open dialog, else of the current screen. */
function focusables(): HTMLElement[] {
  const dialogs = [...document.querySelectorAll<HTMLElement>('.modal-backdrop')].filter((d) => d.offsetParent !== null);
  const root = dialogs.at(-1) ?? document.getElementById('ui-root') ?? document.body;
  return [...root.querySelectorAll<HTMLElement>('button:not(:disabled), [role="button"], [tabindex="0"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.height > 0;
  });
}

/** Focuses a button from the keyboard and marks it, so the gold focus ring shows whatever the browser decides. */
function ring(el: HTMLElement): void {
  el.focus({ focusVisible: true } as FocusOptions);
  el.classList.add('kb-focus');
  el.addEventListener('blur', () => el.classList.remove('kb-focus'), { once: true });
}

/** Arrow keys: focus the nearest button in that direction (the first one if nothing is focused yet). Enter clicks it. */
function moveFocus(dir: 'up' | 'down' | 'left' | 'right'): boolean {
  const list = focusables();
  if (!list.length) return false;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !list.includes(cur)) {
    ring(list[0]);
    return true;
  }
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect();
    const x = q.left + q.width / 2 - cx;
    const y = q.top + q.height / 2 - cy;
    const along = dir === 'right' ? x : dir === 'left' ? -x : dir === 'down' ? y : -y;
    const across = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
    if (along <= 4) continue;
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) ring(best);
  return !!best;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement ? !['range', 'checkbox', 'radio', 'button'].includes(t.type) : t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export function installHotkeys(): void {
  window.addEventListener(
    'pointermove',
    (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    },
    { passive: true },
  );
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    let handled = false;
    switch (e.key) {
      case 'F11':
        void toggleFullscreen();
        handled = true;
        break;
      case 'Escape':
        handled = escape();
        break;
      case ' ': {
        // a button focused from the keyboard takes Space as a click; one focused by the mouse is let go first
        const active = document.activeElement as HTMLElement | null;
        if (active?.matches?.(':focus-visible') && active.matches('button, [role="button"]')) return;
        active?.blur?.();
        handled = !e.repeat && (press('fight') || press('proceed'));
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        handled = moveFocus(e.key.slice(5).toLowerCase() as 'up' | 'down' | 'left' | 'right');
        break;
      case '1':
      case '2':
      case '3':
        handled = press(`speed-${e.key}`);
        break;
      case 'r':
      case 'R':
        handled = !e.repeat && press('reroll');
        break;
      case 'f':
      case 'F':
        handled = !e.repeat && press('freeze');
        break;
      case 'e':
      case 'E':
      case 'Delete':
        handled = !e.repeat && sellHovered();
        break;
    }
    if (handled || e.key === ' ') e.preventDefault();
  });
}
