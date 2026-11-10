import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { toDesign, DESIGN_W, DESIGN_H } from '@/app/scale';
import { meta } from '@/app/store';

interface TipState {
  x: number;
  y: number;
  content: ComponentChildren;
  anchor: 'right' | 'left' | 'above' | 'below';
}

export const tooltip = signal<TipState | null>(null);

let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * The element the open tooltip belongs to, and where the pointer last was. A tooltip closes on mouseleave, but when its
 * element is removed or covered while the pointer rests on it (the breakthrough screen opening over the party bar, a
 * screen change after a click) no mouseleave ever fires and the tooltip stayed stuck on screen. While a tooltip is
 * open, a light watch closes it once its element is gone or no longer under the pointer.
 */
let anchorEl: Element | null = null;
let lastPointer: { x: number; y: number } | null = null;
let watch: ReturnType<typeof setInterval> | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { passive: true, capture: true });
}

function stillHovered(): boolean {
  if (!anchorEl) return true;
  if (!anchorEl.isConnected) return false;
  if (!lastPointer) return true;
  const hit = document.elementFromPoint(lastPointer.x, lastPointer.y);
  return !!hit && (hit === anchorEl || anchorEl.contains(hit));
}

function startWatch(): void {
  if (watch) return;
  watch = setInterval(() => {
    if (!tooltip.peek() && !pending) {
      clearInterval(watch!);
      watch = null;
      return;
    }
    if (!stillHovered()) hideTooltip();
  }, 150);
}

/** Opens a tooltip after the player's Tooltip delay setting (immediately when a tooltip is already open). */
function open(state: TipState): void {
  if (pending) clearTimeout(pending);
  pending = null;
  startWatch();
  const delay = meta.peek().settings.tooltipDelay ?? 0;
  if (delay <= 0 || tooltip.peek()) {
    tooltip.value = state;
    return;
  }
  pending = setTimeout(() => {
    pending = null;
    // the element may have gone during the delay
    if (stillHovered()) tooltip.value = state;
  }, delay);
}

export function showTooltip(e: MouseEvent | PointerEvent, content: ComponentChildren, anchor: TipState['anchor'] = 'right'): void {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  anchorEl = el;
  lastPointer = { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  const tl = toDesign(r.left, r.top);
  const br = toDesign(r.right, r.bottom);
  open({ x: anchor === 'left' ? tl.x : anchor === 'right' ? br.x : (tl.x + br.x) / 2, y: anchor === 'below' ? br.y : anchor === 'above' ? tl.y : tl.y, content, anchor });
}

export function hideTooltip(): void {
  if (pending) clearTimeout(pending);
  pending = null;
  anchorEl = null;
  tooltip.value = null;
}

/** Shows a tooltip anchored at a design-space point (used for canvas units): it belongs to whatever is under the pointer. */
export function showTooltipAtDesign(x: number, y: number, content: ComponentChildren, anchor: TipState['anchor'] = 'above'): void {
  anchorEl = lastPointer ? document.elementFromPoint(lastPointer.x, lastPointer.y) : null;
  open({ x, y, content, anchor });
}

/** Props helper: spread onto an element to attach a tooltip. */
export function tip(content: ComponentChildren | (() => ComponentChildren), anchor: TipState['anchor'] = 'right') {
  return {
    onMouseEnter: (e: MouseEvent) => showTooltip(e, typeof content === 'function' ? content() : content, anchor),
    onMouseLeave: hideTooltip,
    onMouseDown: hideTooltip,
  };
}

export function TooltipLayer() {
  const t = tooltip.value;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!t || !ref.current) {
      setPos(null);
      return;
    }
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    let left = t.x + 14;
    let top = t.y;
    if (t.anchor === 'left') left = t.x - w - 14;
    if (t.anchor === 'above') {
      left = t.x - w / 2;
      top = t.y - h - 12;
    }
    if (t.anchor === 'below') {
      left = t.x - w / 2;
      top = t.y + 12;
    }
    left = Math.max(8, Math.min(DESIGN_W - w - 8, left));
    top = Math.max(8, Math.min(DESIGN_H - h - 8, top));
    setPos({ left, top });
  }, [t]);
  if (!t) return null;
  return (
    <div ref={ref} class="tooltip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
      {t.content}
    </div>
  );
}
