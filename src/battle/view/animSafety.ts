import gsap from 'gsap';
import { Container, Graphics, Sprite } from 'pixi.js';

/**
 * Animation safety net.
 *
 * Pixi nulls a container's position and scale (and a Graphics' drawing context) when it is destroyed, so a GSAP tween
 * still moving or redrawing a destroyed object throws on its next frame. GSAP keeps ticking, but it renders its tweens
 * in order and stops at the one that throws, every frame, forever: every effect created after it (rings, shield
 * domes, floating numbers, dust, lightning) froze in place for the rest of the session.
 *
 *  1. Reading or writing the transform of a destroyed container, and drawing on a destroyed Graphics, become no-ops.
 *  2. An uncaught error, and a periodic sweep, kill any tween whose target has been destroyed.
 */
let installed = false;

export function installAnimationSafety(): void {
  if (installed) return;
  installed = true;
  guardAccessors(Container.prototype, ['x', 'y', 'position', 'scale', 'width', 'height', 'rotation']);
  guardAccessors(Sprite.prototype, ['width', 'height']);
  const proto = Graphics.prototype as unknown as { _callContextMethod(method: string, args: unknown[]): unknown; _context: unknown };
  const callContext = proto._callContextMethod;
  proto._callContextMethod = function (this: typeof proto, method: string, args: unknown[]) {
    if (!this._context) return this;
    return callContext.call(this, method, args);
  };
  window.addEventListener('error', () => sweepDeadTweens());
}

/** Wraps getters and setters so a destroyed container answers 0 and ignores writes instead of throwing. */
function guardAccessors(proto: object, props: string[]): void {
  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || (!desc.get && !desc.set)) continue;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get
        ? function (this: { destroyed?: boolean }) {
            return this.destroyed ? 0 : desc.get!.call(this);
          }
        : undefined,
      set: desc.set
        ? function (this: { destroyed?: boolean }, v: unknown) {
            if (!this.destroyed) desc.set!.call(this, v);
          }
        : undefined,
    });
  }
}

const isDead = (o: unknown): boolean => {
  if (!o || typeof o !== 'object') return false;
  const x = o as { destroyed?: boolean; _observer?: { destroyed?: boolean } };
  return x.destroyed === true || x._observer?.destroyed === true;
};

/** Kills every active tween that animates a destroyed display object (or a point owned by one). */
export function sweepDeadTweens(): number {
  let killed = 0;
  for (const anim of gsap.globalTimeline.getChildren(true, true, false)) {
    const targets = (anim as gsap.core.Tween).targets?.() ?? [];
    if (targets.length && targets.some(isDead)) {
      anim.kill();
      killed++;
    }
  }
  return killed;
}
