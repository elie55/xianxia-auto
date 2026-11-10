import { useEffect, useState } from 'preact/hooks';
import type { SpritePackDef } from '@/battle/view/SpritePack';
import { reducedMotion } from '@/app/motion';

const defs = new Map<string, Promise<SpritePackDef | null>>();
/** Packs already loaded, so a remount draws its first frame at once. */
const loaded = new Map<string, SpritePackDef | null>();

function loadDef(id: string): Promise<SpritePackDef | null> {
  let p = defs.get(id);
  if (!p) {
    p = fetch(`./assets/art/sprites/${id}/pack.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SpritePackDef>) : null))
      .catch(() => null)
      .then((d) => {
        loaded.set(id, d);
        return d;
      });
    defs.set(id, p);
  }
  return p;
}

/** The pack definition of a sprite (undefined while loading, null when it has none). */
export function useSpritePack(id: string): SpritePackDef | null | undefined {
  const [state, setState] = useState<{ id: string; def: SpritePackDef | null | undefined }>(() => ({ id, def: loaded.get(id) }));
  useEffect(() => {
    if (loaded.has(id)) {
      setState({ id, def: loaded.get(id) });
      return;
    }
    let live = true;
    void loadDef(id).then((d) => live && setState({ id, def: d }));
    return () => {
      live = false;
    };
  }, [id]);
  return state.id === id ? state.def : loaded.get(id);
}

/**
 * One clip of a sprite pack drawn with CSS, outside the battle renderer (the Compendium's detail page).
 * The element is the ground point: the character's feet stand on it and it is `height` px tall in every clip.
 * A clip that does not loop calls onDone at its last frame; a new `nonce` replays it.
 */
export function SpriteClip({ id, anim = 'idle', height, nonce = 0, onDone }: { id: string; anim?: string; height: number; nonce?: number; onDone?: () => void }) {
  const def = useSpritePack(id);
  const [frame, setFrame] = useState(0);
  const a = def?.animations[anim] ?? def?.animations.idle;
  useEffect(() => {
    if (!a) return;
    setFrame(0);
    const once = a.loop === false;
    // reduced motion: the idle holds its first frame; a requested clip still plays once
    if (!once && reducedMotion()) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const f = Math.floor(((now - t0) / 1000) * a.fps);
      if (once && f >= a.frames) {
        onDone?.();
        return;
      }
      setFrame(f % a.frames);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [a, nonce]);
  if (def === null) {
    // no pack: the still sprite, feet on the ground point
    return (
      <div class="sprite-clip">
        <img class="sprite-clip-still" src={`./assets/art/sprites/${id}.png`} alt="" draggable={false} style={{ height: height * 1.12 }} />
      </div>
    );
  }
  if (!a) return <div class="sprite-clip" />;
  const s = height / a.charH;
  const w = a.frameW * s;
  const h = a.frameH * s;
  const rows = Math.ceil(a.frames / a.cols);
  const col = frame % a.cols;
  const row = Math.floor(frame / a.cols);
  return (
    <div class="sprite-clip">
      <div
        class="sprite-clip-frame"
        style={{
          left: -a.pivotX * w,
          top: -a.pivotY * h,
          width: w,
          height: h,
          backgroundImage: `url(./assets/art/sprites/${id}/${a.sheet})`,
          backgroundSize: `${a.cols * w}px ${rows * h}px`,
          backgroundPosition: `${-col * w}px ${-row * h}px`,
        }}
      />
    </div>
  );
}
