import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { toDesign, DESIGN_W, DESIGN_H } from '@/app/scale';

interface TipState {
  x: number;
  y: number;
  content: ComponentChildren;
  anchor: 'right' | 'left' | 'above' | 'below';
}

export const tooltip = signal<TipState | null>(null);

export function showTooltip(e: MouseEvent | PointerEvent, content: ComponentChildren, anchor: TipState['anchor'] = 'right'): void {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const tl = toDesign(r.left, r.top);
  const br = toDesign(r.right, r.bottom);
  tooltip.value = { x: anchor === 'left' ? tl.x : anchor === 'right' ? br.x : (tl.x + br.x) / 2, y: anchor === 'below' ? br.y : anchor === 'above' ? tl.y : tl.y, content, anchor };
}

export function hideTooltip(): void {
  tooltip.value = null;
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
