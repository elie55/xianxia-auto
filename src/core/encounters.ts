import type { EnemyDef, Hex, NodeKind } from '@/core/types';
import type { Rng } from '@/core/rng';
import { ENEMIES, ENEMY_BY_ID } from '@/content/enemies';
import { BOARD_ROWS, ENEMY_MIN_COL, BOARD_COLS, offsetToAxial, axialToOffset, hexToPixel } from '@/battle/sim/hex';

export interface EncounterUnit {
  defId: string;
  pos: Hex;
}

export interface Encounter {
  id: string;
  label: string;
  enemies: EncounterUnit[];
  level: number;
  kind: NodeKind | 'single';
}

/** Tribulation Level: drives enemy scaling. */
export function tribulationLevel(realm: number, nodeIndex: number, tier: number, floor = 0): number {
  const realmOffset = realm === 1 ? 0 : realm === 2 ? 10 : 21 + floor * 2;
  return realmOffset + nodeIndex + Math.floor(tier / 2);
}

function budgetFor(realm: number, nodeIndex: number, kind: NodeKind | 'single'): number {
  const base = realm === 1 ? 2.2 : realm === 2 ? 4.2 : 7;
  const growth = realm === 1 ? 0.75 : realm === 2 ? 0.9 : 1.3;
  let b = base + nodeIndex * growth;
  if (kind === 'elite') b *= 1.1;
  if (kind === 'challenge') b *= 1.15;
  return b;
}

function poolFor(realm: number): EnemyDef[] {
  return ENEMIES.filter((e) => !e.boss && !e.elite && (e.realm === realm || e.realm === 'any' || (realm >= 3 && e.realm !== 1)));
}

/**
 * Places enemies in the enemy zone: melee toward the front (left side of their zone), ranged behind, bosses in the middle.
 * Within its allowed columns each unit takes the hex farthest from the units already placed (vertical gaps count
 * extra because the sprites are tall), so a wave spreads into a loose formation instead of a cramped clump.
 * The whole formation is then centred inside the zone.
 */
export function placeEnemies(defIds: string[], rng: Rng): EncounterUnit[] {
  const out: EncounterUnit[] = [];
  const used = new Set<string>();
  const centerRow = Math.floor(BOARD_ROWS / 2);
  const rowOrder = [...new Set([centerRow, 0, BOARD_ROWS - 1, centerRow - 1, centerRow + 1])].filter((r) => r >= 0 && r < BOARD_ROWS);
  const frontCols = [ENEMY_MIN_COL, ENEMY_MIN_COL + 1];
  const backCols = [ENEMY_MIN_COL + 2, Math.min(BOARD_COLS - 1, ENEMY_MIN_COL + 3)];
  const allCols = Array.from({ length: BOARD_COLS - ENEMY_MIN_COL }, (_, i) => ENEMY_MIN_COL + i);
  const placed: { x: number; y: number }[] = [];
  const sorted = defIds
    .map((id) => ENEMY_BY_ID[id])
    .sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || (a.baseStats.range ?? 1) - (b.baseStats.range ?? 1));
  const pick = (cols: number[]): { col: number; row: number } | null => {
    let best: { col: number; row: number; score: number } | null = null;
    cols.forEach((col, ci) => {
      rowOrder.forEach((row, ri) => {
        if (used.has(`${col},${row}`)) return;
        const p = hexToPixel(offsetToAxial(col, row));
        const gap = placed.length ? Math.min(...placed.map((q) => Math.hypot(p.x - q.x, (p.y - q.y) * 1.3))) : 0;
        const score = gap - ri * 10 - ci * 6;
        if (!best || score > best.score) best = { col, row, score };
      });
    });
    return best;
  };
  for (const def of sorted) {
    const ranged = (def.baseStats.range ?? 1) >= 3;
    const cols = def.boss ? [ENEMY_MIN_COL + 1, ENEMY_MIN_COL + 2] : ranged ? backCols : frontCols;
    const spot = pick(cols) ?? pick(allCols);
    if (!spot) continue;
    used.add(`${spot.col},${spot.row}`);
    const pos = offsetToAxial(spot.col, spot.row);
    placed.push(hexToPixel(pos));
    out.push({ defId: def.id, pos });
  }
  // Centre the formation inside the enemy zone: a small wave otherwise huddles at the zone's front edge
  // and the arena looks lopsided next to a full ally formation.
  if (out.length) {
    const cols = out.map((u) => axialToOffset(u.pos).col);
    const slack = BOARD_COLS - 1 - Math.max(...cols) - (Math.min(...cols) - ENEMY_MIN_COL);
    const shift = Math.floor(slack / 2);
    if (shift > 0) {
      for (const u of out) {
        const o = axialToOffset(u.pos);
        u.pos = offsetToAxial(o.col + shift, o.row);
      }
    }
  }
  // tiny shuffle of rows for variety is implicit via rng consumption to keep seeds meaningful
  rng.next();
  return out;
}

export function generateEncounter(realm: number, nodeIndex: number, kind: NodeKind | 'single', tier: number, rng: Rng, floor = 0): Encounter {
  const level = tribulationLevel(realm, nodeIndex, tier, floor);
  const defIds: string[] = [];
  let label = 'Regular Encounter';

  if (kind === 'boss') {
    const boss = realm === 1 ? 'flood_dragon' : realm === 2 ? 'blood_moon_sovereign' : rng.pick(['flood_dragon', 'blood_moon_sovereign']);
    defIds.push(boss);
    const adds = realm === 1 ? ['spirit_wolf', 'spirit_wolf'] : ['blood_bat', 'blood_bat'];
    defIds.push(...adds);
    label = ENEMY_BY_ID[boss].name;
  } else if (kind === 'single') {
    const pool = poolFor(realm).filter((e) => e.cost >= 1.8);
    const pick = rng.pick(pool.length ? pool : poolFor(realm));
    defIds.push(pick.id);
    label = `Heavenly Trial: ${pick.name}`;
  } else {
    let budget = budgetFor(realm, nodeIndex, kind);
    if (kind === 'elite') {
      const elite = realm === 1 ? 'moss_golem' : realm === 2 ? 'demon_general' : rng.pick(['moss_golem', 'demon_general', 'thunder_ape']);
      defIds.push(elite);
      budget = Math.max(1.5, budget * 0.5);
      label = `Elite: ${ENEMY_BY_ID[elite].name}`;
    }
    const pool = poolFor(realm);
    const maxUnits = kind === 'elite' ? 5 : 7;
    let guard = 0;
    while (budget > 0.6 && defIds.length < maxUnits && guard++ < 40) {
      const affordable = pool.filter((e) => e.cost <= budget + 0.4);
      if (affordable.length === 0) break;
      const pick = rng.weighted(affordable, affordable.map((e) => 1 / Math.sqrt(e.cost)));
      defIds.push(pick.id);
      budget -= pick.cost;
    }
    if (defIds.length === 0) defIds.push(pool[0].id);
    if (kind === 'challenge') label = 'Challenge Encounter';
  }

  return {
    id: `${realm}-${nodeIndex}-${kind}`,
    label,
    enemies: placeEnemies(defIds, rng),
    level,
    kind,
  };
}
