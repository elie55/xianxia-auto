import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Animated sprite packs live in /assets/art/sprites/<id>/pack.json with grid sheets per animation:
 * {
 *   "animations": {
 *     "idle":   { "sheet": "idle.png", "frames": 25, "cols": 5, "frameW": 256, "frameH": 256, "fps": 10.7, "pivotX": 0.5, "pivotY": 0.93, "charH": 213, "loop": true },
 *     "attack": { "sheet": "attack.png", "frames": 22, "cols": 5, "frameW": 512, "frameH": 512, "fps": 24, "pivotX": 0.38, "pivotY": 0.97, "charH": 290, "hitFrame": 10 }
 *   }
 * }
 * `charH` is the character's pixel height inside a frame (from AutoSprite trim boxes) so every
 * animation renders the character at the same on-screen size. AutoSprite exports are converted by
 * scripts/convert-autosprite.mjs.
 */
export interface SpriteAnimDef {
  sheet: string;
  frames: number;
  cols: number;
  frameW: number;
  frameH: number;
  fps: number;
  pivotX: number;
  pivotY: number;
  charH: number;
  /** Idle-pose width in frame pixels (drives the ground shadow). */
  charW?: number;
  loop?: boolean;
  hitFrame?: number;
}

export interface SpritePackDef {
  animations: Record<string, SpriteAnimDef>;
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
  const res = await fetch(`${base}pack.json`, { cache: 'no-cache' });
  if (!res.ok) return null;
  const def = (await res.json()) as SpritePackDef;
  if (!def.animations || !def.animations.idle) return null;
  const anims: Record<string, Texture[]> = {};
  for (const [name, a] of Object.entries(def.animations)) {
    const sheet = await Assets.load<Texture>(`${base}${a.sheet}`);
    const cols = a.cols || Math.max(1, Math.floor(sheet.width / a.frameW));
    const frames: Texture[] = [];
    for (let i = 0; i < a.frames; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const frame = new Rectangle(col * a.frameW, row * a.frameH, a.frameW, a.frameH);
      frames.push(new Texture({ source: sheet.source, frame }));
    }
    anims[name] = frames;
  }
  return { def, anims };
}
