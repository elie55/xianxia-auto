import type { Hex } from '@/core/types';

/**
 * Axial hex coordinates (pointy-top). The board is a parallelogram-free rectangle
 * expressed in "odd-r" offset rows internally for bounds, converted to axial for math.
 */
export const BOARD_COLS = 11;
export const BOARD_ROWS = 5;

/** Columns [0, ALLY_MAX_COL] are the ally placement zone; [ENEMY_MIN_COL, BOARD_COLS-1] the enemy zone. */
export const ALLY_MAX_COL = 3;
export const ENEMY_MIN_COL = 7;

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Offset (col,row) → axial. odd-r: odd rows shoved right. */
export function offsetToAxial(col: number, row: number): Hex {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

/** Axial → offset (col,row). */
export function axialToOffset(h: Hex): { col: number; row: number } {
  const col = h.q + (h.r - (h.r & 1)) / 2;
  return { col, row: h.r };
}

export function inBounds(h: Hex): boolean {
  const { col, row } = axialToOffset(h);
  return col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS;
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

const DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(h: Hex): Hex[] {
  const out: Hex[] = [];
  for (const d of DIRS) {
    const n = { q: h.q + d.q, r: h.r + d.r };
    if (inBounds(n)) out.push(n);
  }
  return out;
}

/** All in-bounds hexes within `radius` of center (inclusive), excluding the center when excludeCenter. */
export function hexesInRange(center: Hex, radius: number, excludeCenter = false): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      if (excludeCenter && dq === 0 && dr === 0) continue;
      const h = { q: center.q + dq, r: center.r + dr };
      if (inBounds(h)) out.push(h);
    }
  }
  return out;
}

export function allHexes(): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) out.push(offsetToAxial(col, row));
  }
  return out;
}

export function isAllyZone(h: Hex): boolean {
  const { col } = axialToOffset(h);
  return col <= ALLY_MAX_COL;
}

export function isEnemyZone(h: Hex): boolean {
  const { col } = axialToOffset(h);
  return col >= ENEMY_MIN_COL;
}

/** "Front row" for allies = rightmost columns of their zone; for enemies = leftmost columns of theirs. */
export function isFrontForSide(h: Hex, side: 'ally' | 'enemy'): boolean {
  const { col } = axialToOffset(h);
  return side === 'ally' ? col >= ALLY_MAX_COL - 1 : col <= ENEMY_MIN_COL + 1;
}

/** Cube-linear interpolation line from a to b (inclusive), used for pierce attacks. */
export function hexLine(a: Hex, b: Hex, extend = 0): Hex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const out: Hex[] = [];
  const total = n + extend;
  for (let i = 1; i <= total; i++) {
    const t = i / n;
    const q = a.q + (b.q - a.q) * t;
    const r = a.r + (b.r - a.r) * t;
    const h = hexRound(q, r);
    if (!inBounds(h)) break;
    if (out.length === 0 || !hexEquals(out[out.length - 1], h)) out.push(h);
  }
  return out;
}

export function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/**
 * Pixel layout for rendering. Pointy-top hexes with a vertical squash to fake perspective.
 */
export const HEX_SIZE = 60; // outer radius in design pixels
export const HEX_SQUASH = 0.66;
export const HEX_W = Math.sqrt(3) * HEX_SIZE;
export const HEX_H_STEP = 1.5 * HEX_SIZE * HEX_SQUASH;

export function hexToPixel(h: Hex): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = HEX_SIZE * 1.5 * h.r * HEX_SQUASH;
  return { x, y };
}

export function boardPixelSize(): { w: number; h: number } {
  return {
    w: HEX_W * BOARD_COLS + HEX_W / 2,
    h: HEX_H_STEP * (BOARD_ROWS - 1) + HEX_SIZE * 2 * HEX_SQUASH,
  };
}

/** Inverse of hexToPixel (local board coordinates). */
export function pixelToHex(x: number, y: number): Hex {
  const r = y / (HEX_SIZE * 1.5 * HEX_SQUASH);
  const q = (x / HEX_SIZE - (Math.sqrt(3) / 2) * r) / Math.sqrt(3);
  return hexRound(q, r);
}

/**
 * Breadth-first path from `from` to any hex adjacent-within-range of `goal`,
 * avoiding blocked hexes. Returns the path excluding `from` (empty if already in range or unreachable).
 */
export function findPath(from: Hex, goal: Hex, range: number, blocked: Set<string>): Hex[] {
  if (hexDistance(from, goal) <= range) return [];
  const startKey = hexKey(from);
  const cameFrom = new Map<string, string | null>();
  const queue: Hex[] = [from];
  cameFrom.set(startKey, null);
  let found: Hex | null = null;
  // Greedy-ish BFS ordering: expand neighbors sorted by distance to goal for natural-looking paths.
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (hexDistance(cur, goal) <= range && hexKey(cur) !== startKey) {
      found = cur;
      break;
    }
    const neighbors = hexNeighbors(cur).sort((a, b) => hexDistance(a, goal) - hexDistance(b, goal));
    for (const n of neighbors) {
      const k = hexKey(n);
      if (cameFrom.has(k)) continue;
      if (blocked.has(k) && !hexEquals(n, goal)) continue;
      if (hexEquals(n, goal)) {
        // can't step onto the goal (occupied by the target) but can stand next to it
        continue;
      }
      cameFrom.set(k, hexKey(cur));
      queue.push(n);
    }
  }
  if (!found) {
    // fallback: step to the reachable hex closest to the goal
    let best: Hex | null = null;
    let bestD = Infinity;
    for (const k of cameFrom.keys()) {
      if (k === startKey) continue;
      const [q, r] = k.split(',').map(Number);
      const d = hexDistance({ q, r }, goal);
      if (d < bestD) {
        bestD = d;
        best = { q, r };
      }
    }
    if (!best || bestD >= hexDistance(from, goal)) return [];
    found = best;
  }
  const path: Hex[] = [];
  let k: string | null = hexKey(found);
  while (k && k !== startKey) {
    const [q, r] = k.split(',').map(Number);
    path.push({ q, r });
    k = cameFrom.get(k) ?? null;
  }
  return path.reverse();
}
