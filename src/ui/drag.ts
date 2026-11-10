import { signal } from '@preact/signals';
import { toDesign } from '@/app/scale';

export type DragPayload = { kind: 'hero'; uid: string; fromBoard?: boolean } | { kind: 'item'; itemId: string; fromHero?: string };

export interface DragState {
  payload: DragPayload;
  x: number;
  y: number;
  over: string | null;
  started: boolean;
  /** Click-to-place: picked up with a click, follows the pointer until the next click drops it. */
  carry?: boolean;
}

export const drag = signal<DragState | null>(null);

type DropHandler = (payload: DragPayload, target: string | null, clientX: number, clientY: number) => void;
let dropHandler: DropHandler | null = null;
let hoverHandler: ((payload: DragPayload, clientX: number, clientY: number) => string | null) | null = null;

export function setDropHandlers(onDrop: DropHandler | null, onHover: typeof hoverHandler): void {
  dropHandler = onDrop;
  hoverHandler = onHover;
}

/** Call from a pointerdown handler on a draggable element. Drag it, or click it to pick it up and click again to place it. */
export function startDrag(payload: DragPayload, e: PointerEvent): void {
  if (e.button !== 0 || drag.peek()?.carry) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const d = toDesign(startX, startY);
  drag.value = { payload, x: d.x, y: d.y, over: null, started: false };

  const move = (ev: PointerEvent) => {
    const cur = drag.value;
    if (!cur) return;
    const p = toDesign(ev.clientX, ev.clientY);
    const moved = cur.started || Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6;
    const over = moved ? findDropTarget(ev.clientX, ev.clientY) ?? hoverHandler?.(payload, ev.clientX, ev.clientY) ?? null : null;
    drag.value = { ...cur, x: p.x, y: p.y, over, started: moved };
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    const cur = drag.value;
    if (!cur) return;
    if (!cur.started) {
      // a click without moving: carry it instead (click-to-place); the next click drops it
      if (ev.type === 'pointerup') carry(payload, ev);
      else drag.value = null;
      return;
    }
    drag.value = null;
    const target = findDropTarget(ev.clientX, ev.clientY);
    dropHandler?.(payload, target, ev.clientX, ev.clientY);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** Click-to-place: the payload follows the pointer; a left click drops it where it is, right click or Escape cancels. */
function carry(payload: DragPayload, ev: PointerEvent): void {
  const p = toDesign(ev.clientX, ev.clientY);
  drag.value = { payload, x: p.x, y: p.y, over: hoverHandler?.(payload, ev.clientX, ev.clientY) ?? null, started: true, carry: true };
  const move = (e: PointerEvent) => {
    const cur = drag.value;
    if (!cur?.carry) return;
    const q = toDesign(e.clientX, e.clientY);
    const over = findDropTarget(e.clientX, e.clientY) ?? hoverHandler?.(payload, e.clientX, e.clientY) ?? null;
    drag.value = { ...cur, x: q.x, y: q.y, over };
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('contextmenu', menu, true);
  };
  const down = (e: PointerEvent) => {
    // the placing click must not also click whatever lies under it
    e.preventDefault();
    e.stopPropagation();
    cleanup();
    drag.value = null;
    // right click cancels: a drop on nothing puts a lifted disciple back where it stood
    if (e.button !== 0) return void dropHandler?.(payload, null, -1, -1);
    dropHandler?.(payload, findDropTarget(e.clientX, e.clientY), e.clientX, e.clientY);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    cleanup();
    drag.value = null;
    dropHandler?.(payload, null, -1, -1);
  };
  const menu = (e: Event) => e.preventDefault();
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerdown', down, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('contextmenu', menu, true);
}

/** Finds the closest ancestor with data-drop at a client point. */
export function findDropTarget(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const hit = el?.closest('[data-drop]') as HTMLElement | null;
  return hit?.dataset.drop ?? null;
}
