import { Assets, Texture } from 'pixi.js';

/** Attempts to load a static sprite texture for a unit; caches misses. */
const texCache = new Map<string, Promise<Texture | null>>();

export function loadUnitTexture(sprite: string): Promise<Texture | null> {
  let p = texCache.get(sprite);
  if (!p) {
    p = Assets.load<Texture>(`./assets/art/sprites/${sprite}.png`).catch(() => null);
    texCache.set(sprite, p);
  }
  return p;
}

/** Preloads the static sprites for a list of unit sprite keys (used before a battle). */
export async function preloadSprites(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => loadUnitTexture(k)));
}
