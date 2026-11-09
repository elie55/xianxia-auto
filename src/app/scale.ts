import { signal } from '@preact/signals';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export const viewport = signal<Viewport>(compute());

function compute(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
  return {
    scale,
    offsetX: (w - DESIGN_W * scale) / 2,
    offsetY: (h - DESIGN_H * scale) / 2,
    width: w,
    height: h,
  };
}

export function installScaling(uiRoot: HTMLElement): void {
  const apply = () => {
    const v = compute();
    viewport.value = v;
    uiRoot.style.transform = `translate(${v.offsetX}px, ${v.offsetY}px) scale(${v.scale})`;
    // the bands a wide or tall window leaves outside the 16:9 frame, in design pixels: painted screens and
    // full-screen dimmers extend into them (polish.css, WINDOW BLEED)
    const bleedX = v.offsetX / v.scale;
    const bleedY = v.offsetY / v.scale;
    uiRoot.style.setProperty('--bleed-x', `${bleedX.toFixed(2)}px`);
    uiRoot.style.setProperty('--bleed-y', `${bleedY.toFixed(2)}px`);
    uiRoot.classList.toggle('bleed-x', bleedX > 1);
    uiRoot.classList.toggle('bleed-y', bleedY > 1);
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}

/** Converts a window-space point to design space. */
export function toDesign(x: number, y: number): { x: number; y: number } {
  const v = viewport.value;
  return { x: (x - v.offsetX) / v.scale, y: (y - v.offsetY) / v.scale };
}
