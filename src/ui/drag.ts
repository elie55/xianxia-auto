import { signal } from '@preact/signals';
import { toDesign } from '@/app/scale';

export type DragPayload = { kind: 'hero'; uid: string; fromBoard?: boolean } | { kind: 'item'; itemId: string; fromHero?: string };

export interface DragState {
  payload: DragPayload;
  x: number;
  y: number;
  over: string | null;
  started: boolean;
}

export const drag = signal<DragState | null>(null);

type DropHandler = (payload: DragPayload, target: string | null, clientX: number, clientY: number) => void;
let dropHandler: DropHandler | null = null;
let hoverHandler: ((payload: DragPayload, clientX: number, clientY: number) => string | null) | null = null;

export function setDropHandlers(onDrop: DropHandler | null, onHover: typeof hoverHandler): void {
  dropHandler = onDrop;
  hoverHandler = onHover;
}

/** Call from a pointerdown handler on a draggable element. */
export function startDrag(payload: DragPayload, e: PointerEvent): void {
  if (e.button !== 0) return;
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
    drag.value = null;
    if (!cur || !cur.started) return;
    const target = findDropTarget(ev.clientX, ev.clientY);
    dropHandler?.(payload, target, ev.clientX, ev.clientY);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** Finds the closest ancestor with data-drop at a client point. */
export function findDropTarget(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const hit = el?.closest('[data-drop]') as HTMLElement | null;
  return hit?.dataset.drop ?? null;
}
