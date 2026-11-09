import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Animated sprite packs live in /assets/art/sprites/<id>/pack.json with horizontal strip sheets:
 * {
 *   "frameW": 256, "frameH": 256, "fps": 12, "anchorY": 0.96,
 *   "animations": { "idle": { "sheet": "idle.png", "frames": 12, "loop": true }, "attack": { "sheet": "attack.png", "frames": 10, "hitFrame": 5 }, ... }
 * }
 * Autosprite exports are converted into this format by scripts/convert-autosprite.mjs.
 */
export interface SpritePackDef {
  frameW: number;
  frameH: number;
  fps: number;
  anchorY?: number;
  /** Horizontal offset of the feet from the frame center, in frame pixels. */
  anchorX?: number;
  /** Visual height in design pixels at scale 1 (defaults to 150). */
  height?: number;
  animations: Record<string, { sheet: string; frames: number; loop?: boolean; hitFrame?: number; fps?: number; rows?: number; cols?: number }>;
}

export interface SpritePack {
  def: SpritePackDef;
  anims: Record<string, Texture[]>;
}

const cache = new Map<string, Promise<SpritePack | null>>();

export function loadSpritePack(id: string): Promise<SpritePack | null> {
  let p = cache.get(id);
  if (!p) {
    p = load(id).catch(() => null);
    cache.set(id, p);
  }
  return p;
}

async function load(id: string): Promise<SpritePack | null> {
  const base = `./assets/art/sprites/${id}/`;
  const res = await fetch(`${base}pack.json`, { cache: 'force-cache' });
  if (!res.ok) return null;
  const def = (await res.json()) as SpritePackDef;
  const anims: Record<string, Texture[]> = {};
  for (const [name, a] of Object.entries(def.animations)) {
    const sheet = await Assets.load<Texture>(`${base}${a.sheet}`);
    const cols = a.cols ?? Math.max(1, Math.floor(sheet.width / def.frameW));
    const frames: Texture[] = [];
    for (let i = 0; i < a.frames; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const frame = new Rectangle(col * def.frameW, row * def.frameH, def.frameW, def.frameH);
      frames.push(new Texture({ source: sheet.source, frame }));
    }
    anims[name] = frames;
  }
  return { def, anims };
}
