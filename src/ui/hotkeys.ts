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
      case ' ':
        // a focused button would also take the Space press as a click
        (document.activeElement as HTMLElement | null)?.blur?.();
        handled = !e.repeat && (press('fight') || press('proceed'));
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
