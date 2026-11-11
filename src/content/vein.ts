/**
 * The Spirit Vein (docs/META_PROGRESSION.md, section 6.5): a small web of sect blessings for every run, bought with
 * points (2 per Spirit Vein level, 10 at level V) and moved freely between runs. The help is economic, never raw stats:
 * the Root (ring 1) is the front-loaded help; the Trunk (ring 2, after 3 points in the Root) and the Crown (ring 3,
 * after 6 points in the rings below) are pairs where only one side can be taken. A Pure run leaves the Vein at home.
 */
export interface VeinNode {
  id: string;
  ring: 1 | 2 | 3;
  name: string;
  /** Painted or line icon. */
  icon: string;
  /** Rich text, per rank. */
  desc: string;
  /** Ranks it can take. */
  max: number;
  /** Points per rank. */
  cost: number;
  /** Nodes sharing a pair exclude each other. */
  pair?: string;
}

export const VEIN_NODES: VeinNode[] = [
  // the Root: the help
  { id: 'stones', ring: 1, name: 'Spirit Spring', icon: 'stones', desc: 'Start every run with [+5 Spirit Stones] per rank.', max: 3, cost: 1 },
  { id: 'reroll', ring: 1, name: 'Patient Eye', icon: 'ui_reroll', desc: "Each shop's [first reroll] is free.", max: 1, cost: 1 },
  { id: 'reversal', ring: 1, name: 'Echo of Time', icon: 'relic_hourglass', desc: 'Time Reversal costs [5 fewer] Spirit Stones.', max: 1, cost: 1 },
  { id: 'parcel', ring: 1, name: "Elder's Gift", icon: 'item_satchel', desc: 'Your first disciple brings a random [common Treasure].', max: 1, cost: 1 },
  // the Trunk: one of each pair
  { id: 'gate', ring: 2, pair: 'draft', name: 'Wide Gate', icon: 'choice_disciple', desc: 'The opening draft has [1 more free reroll].', max: 1, cost: 1 },
  { id: 'blessings', ring: 2, pair: 'draft', name: 'Many Blessings', icon: 'blessing_scholar', desc: 'The opening draft offers [1 more blessing].', max: 1, cost: 1 },
  { id: 'tales', ring: 2, pair: 'coin', name: 'Campfire Tales', icon: 'node_rest', desc: "The Sect Rest's stories pay [10 more] Spirit Stones.", max: 1, cost: 1 },
  { id: 'haggler', ring: 2, pair: 'coin', name: 'Haggler', icon: 'relic_merchant', desc: 'Rare and epic Treasures in the shop cost [1 fewer] Spirit Stone.', max: 1, cost: 1 },
  { id: 'recruiter', ring: 2, pair: 'hands', name: "Recruiter's Eye", icon: 'relic_outer_court', desc: 'Disciples in the shop cost [1 fewer] Spirit Stone.', max: 1, cost: 1 },
  { id: 'spoils', ring: 2, pair: 'hands', name: 'Battle Spoils', icon: 'node_fight', desc: 'Every fight won pays [+1 Spirit Stone].', max: 1, cost: 1 },
  // the Crown: one of the pair
  { id: 'second_chance', ring: 3, pair: 'crown', name: 'Second Chance', icon: 'relic_mirror_karma', desc: 'The first Time Reversal of the run costs [15 fewer] Spirit Stones.', max: 1, cost: 2 },
  { id: 'courtyard', ring: 3, pair: 'crown', name: 'Open Courtyard', icon: 'relic_inner_court', desc: 'The reserve has [1 more slot].', max: 1, cost: 2 },
];
export const VEIN_BY_ID = Object.fromEntries(VEIN_NODES.map((n) => [n.id, n])) as Record<string, VeinNode>;

export const VEIN_RINGS: { ring: 1 | 2 | 3; name: string; hanzi: string; needs: number }[] = [
  { ring: 1, name: 'Root', hanzi: '根', needs: 0 },
  { ring: 2, name: 'Trunk', hanzi: '干', needs: 3 },
  { ring: 3, name: 'Crown', hanzi: '冠', needs: 6 },
];

export type VeinState = Record<string, number>;

/** Points a Spirit Vein level gives: 2 per level. */
export const veinPoints = (level: number) => Math.max(0, level) * 2;

/** Points spent, in every ring or in the rings below `ring`. */
export function veinSpent(v: VeinState, below?: number): number {
  let n = 0;
  for (const [id, rank] of Object.entries(v)) {
    const node = VEIN_BY_ID[id];
    if (node && (below === undefined || node.ring < below)) n += rank * node.cost;
  }
  return n;
}

/** Every rank in range, no pair taken twice, every ring's needs met. */
export function veinValid(v: VeinState): boolean {
  const pairs = new Set<string>();
  for (const [id, rank] of Object.entries(v)) {
    const node = VEIN_BY_ID[id];
    if (!node || rank < 0 || rank > node.max) return false;
    if (rank === 0) continue;
    if (node.pair) {
      if (pairs.has(node.pair)) return false;
      pairs.add(node.pair);
    }
    if (veinSpent(v, node.ring) < VEIN_RINGS[node.ring - 1].needs) return false;
  }
  return true;
}

/** Why a rank cannot be added (null: it can). */
export function veinAddBlocked(v: VeinState, id: string, points: number): string | null {
  const node = VEIN_BY_ID[id];
  if (!node) return 'No such node';
  const rank = v[id] ?? 0;
  if (rank >= node.max) return 'Fully taken';
  if (veinSpent(v) + node.cost > points) return 'No points left: raise the Spirit Vein';
  const ring = VEIN_RINGS[node.ring - 1];
  if (veinSpent(v, node.ring) < ring.needs) return `Needs ${ring.needs} points in the rings below`;
  const other = node.pair && VEIN_NODES.find((n) => n.pair === node.pair && n.id !== id && (v[n.id] ?? 0) > 0);
  if (other) return `Takes the place of ${other.name}: remove it first`;
  return null;
}

/** Why a rank cannot be removed (null: it can). Removing must leave every outer node's needs met. */
export function veinRemoveBlocked(v: VeinState, id: string): string | null {
  if (!(v[id] > 0)) return 'Nothing to remove';
  const next = { ...v, [id]: v[id] - 1 };
  if (!next[id]) delete next[id];
  return veinValid(next) ? null : 'The outer rings rest on it: remove them first';
}
