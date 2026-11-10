import type { ActionDef, BlessingDef, EventOutcome, Hex, ItemDef, NodeDef, NodeKind, Rank, Rarity, RelicDef, StatKey, UpgradeDef } from '@/core/types';
import { HERO_PRICE_BY_RANK, ITEM_PRICE_BY_RARITY, RELIC_PRICE_BY_RARITY } from '@/core/types';
import { Rng } from '@/core/rng';
import { buildEnemyUnit, buildHeroUnit, heroClasses, heroDaoPath, heroItemSlots, type HeroState, type TeamContext } from '@/core/builder';
import { generateEncounter, type Encounter } from '@/core/encounters';
import type { BattleConfig, BattleResult } from '@/battle/sim/battle';
import { HEROES, HERO_BY_ID } from '@/content/heroes';
import { ITEM_BY_ID, SHOP_ITEMS } from '@/content/items';
import { RELIC_BY_ID, SHOP_RELICS, TEAM_SIZE_RELICS } from '@/content/relics';
import { ENEMY_BY_ID } from '@/content/enemies';
import { EVENT_BY_ID, RANDOM_EVENTS } from '@/content/events';
import { BLESSINGS, DIFFICULTIES } from '@/content/difficulties';
import { classInsights } from '@/content/classes';
import { ALLY_MAX_COL, BOARD_ROWS, hexKey, offsetToAxial } from '@/battle/sim/hex';

export type Phase =
  | 'chooseHero'
  | 'event'
  | 'board'
  | 'battle'
  | 'result'
  | 'defeat'
  | 'shop'
  | 'rankUp'
  | 'reward'
  | 'challenge'
  | 'realmCleared'
  | 'runEnd';

export interface ShopHero {
  key: string;
  defId: string;
  rank: Rank;
  price: number;
  sale: boolean;
}
export interface ShopItem {
  key: string;
  itemId: string;
  price: number;
  sale: boolean;
}
export interface ShopRelic {
  key: string;
  relicId: string;
  price: number;
  sale: boolean;
}
export interface ShopOffer {
  heroes: (ShopHero | null)[];
  items: (ShopItem | null)[];
  relics: (ShopRelic | null)[];
  teamSize: (ShopRelic | null)[];
}

export interface RelicState {
  id: string;
  questProgress: number;
  questDone: boolean;
}

export interface Draft {
  heroes: string[];
  blessings: string[];
  rerolls: number;
}

export interface StonesBreakdown {
  base: number;
  survivors: number;
  survivorCount: number;
  relicBonus: number;
  battleBonus: number;
  bounty: number;
  quests: { name: string; amount: number }[];
  challenge: number;
  total: number;
}

export interface ChallengeOffer {
  id: string;
  name: string;
  desc: string;
  rewardDesc: string;
}

export interface RunStats {
  fights: number;
  wins: number;
  damage: number;
  stonesEarned: number;
  startedAt: number;
  rewinds: number;
  bestHit: number;
  elapsedMs: number;
}

export interface PendingPick {
  kind: 'item' | 'relic';
  items?: ItemDef[];
  relics?: RelicDef[];
  count: number;
  title: string;
}

/** One fight of the run, for the run-end timeline. */
export interface FightRecord {
  realm: number;
  floor: number;
  node: number;
  kind: string;
  won: boolean;
  dealt: number;
  stones: number;
  /** The toughest foe of the fight (boss, elite, else the first enemy). */
  foe?: string;
}

export interface HeroTotals {
  dealt: number;
  taken: number;
  healed: number;
  kills: number;
  crits: number;
  bestHit: number;
  fights: number;
}

export interface RunState {
  version: 1;
  seed: number;
  rngState: number;
  tier: number;
  blessing: BlessingDef['apply'] | null;
  realm: 1 | 2 | 3;
  floor: number;
  nodeIndex: number;
  timeline: NodeDef[];
  stones: number;
  roster: HeroState[];
  party: (string | null)[];
  reserve: (string | null)[];
  positions: Record<string, Hex>;
  inventory: string[];
  inventorySize: number;
  relics: RelicState[];
  shop: ShopOffer | null;
  shopFrozen: boolean;
  rerollsThisShop: number;
  partySize: number;
  reserveSize: number;
  stats: RunStats;
  pendingRankUps: string[];
  /** Where to continue once all pending rank-up choices are made. */
  rankUpResume: 'event' | 'shop' | 'advance' | 'afterResult' | 'finishEvent' | 'board';
  rankUpChoices: { uid: string; options: UpgradeDef[] } | null;
  pendingReward: RelicDef[] | null;
  pendingPick: PendingPick | null;
  draft: Draft | null;
  currentEvent: { eventId: string; outcome: EventOutcome | null; chosen: string | null } | null;
  currentEncounter: Encounter | null;
  fightReward: { actions?: ActionDef[]; desc?: string; single?: boolean } | null;
  challengeOffers: ChallengeOffer[] | null;
  activeChallenge: ChallengeOffer | null;
  singleChampion: string | null;
  lastResult: BattleResult | null;
  lastBreakdown: StonesBreakdown | null;
  phase: Phase;
  rewindCost: number;
  /** Set by a Time Reversal: leaving the shop returns to the lost fight instead of moving on to the next node. */
  retryNode?: boolean;
  heroCounter: number;
  victory: boolean;
  endlessScore: number;
  log: string[];
  heroTotals: Record<string, HeroTotals>;
  /** Every fight of the run in order (older saves have none). */
  history?: FightRecord[];
  resultWasSingle?: boolean;
}

const CHALLENGES: ChallengeOffer[] = [
  { id: 'decay', name: 'Decay', desc: 'Disciples have 20% decreased basic stats.', rewardDesc: 'Choose 1 of 3 epic Dao Insights.' },
  { id: 'improvidence', name: 'Improvidence', desc: 'Each second, enemies heal 4% Max HP.', rewardDesc: 'Choose 1 of 3 epic Treasures.' },
  { id: 'haste', name: 'Haste', desc: 'Enemies have +40 Attack Speed.', rewardDesc: 'Gain 30 Spirit Stones.' },
  { id: 'storm', name: 'Early Tribulation', desc: 'Tribulation lightning begins at 25 s.', rewardDesc: 'Choose 1 of 3 rare Dao Insights and 10 Stones.' },
];

// ───────────────────────── helpers ─────────────────────────

export function rngOf(s: RunState): Rng {
  const r = new Rng(s.seed);
  r.setState(s.rngState);
  return r;
}
function commit(s: RunState, r: Rng): void {
  s.rngState = r.getState();
}

export function difficultyMods(s: RunState) {
  const mods = { startCombatHpLossPct: 0, enemyHpPct: 0, stonesPerSurvivorDelta: 0, itemSlotsPerRank: false, enemyDamagePct: 0, shopPricePct: 0, tribulationAt: 50, bossExtraAbility: false };
  for (const d of DIFFICULTIES) {
    if (d.tier > s.tier || d.tier === 0) continue;
    const m = d.mod;
    if (m.startCombatHpLossPct) mods.startCombatHpLossPct += m.startCombatHpLossPct;
    if (m.enemyHpPct) mods.enemyHpPct += m.enemyHpPct;
    if (m.stonesPerSurvivorDelta) mods.stonesPerSurvivorDelta += m.stonesPerSurvivorDelta;
    if (m.itemSlotsPerRank) mods.itemSlotsPerRank = true;
    if (m.enemyDamagePct) mods.enemyDamagePct += m.enemyDamagePct;
    if (m.shopPricePct) mods.shopPricePct += m.shopPricePct;
    if (m.tribulationAt) mods.tribulationAt = Math.min(mods.tribulationAt, m.tribulationAt);
    if (m.bossExtraAbility) mods.bossExtraAbility = true;
  }
  return mods;
}

export function relicDefs(s: RunState): RelicDef[] {
  return s.relics.map((r) => RELIC_BY_ID[r.id]).filter(Boolean);
}

export function teamContext(s: RunState): TeamContext {
  const mods = difficultyMods(s);
  let itemSlotBonus = 0;
  for (const r of relicDefs(s)) if (r.run?.itemSlots) itemSlotBonus += r.run.itemSlots;
  return {
    relics: relicDefs(s),
    itemSlotBonus,
    itemSlotsPerRank: mods.itemSlotsPerRank,
    warriorBlessing: s.blessing === 'warrior',
    qualityBlessing: s.blessing === 'quality',
  };
}

export function heroByUid(s: RunState, uid: string): HeroState | undefined {
  return s.roster.find((h) => h.uid === uid);
}

export function currentNode(s: RunState): NodeDef {
  return s.timeline[s.nodeIndex];
}

function price(s: RunState, base: number, sale: boolean): number {
  const mods = difficultyMods(s);
  let p = base * (1 + mods.shopPricePct / 100);
  if (sale) p *= 0.6;
  return Math.max(1, Math.round(p));
}

function log(s: RunState, msg: string): void {
  s.log.push(msg);
  if (s.log.length > 200) s.log.shift();
}

export function makeTimeline(realm: number): NodeDef[] {
  const kinds: NodeKind[] = realm === 3
    ? ['fight', 'fight', 'event', 'fight', 'elite', 'fight', 'event', 'fight', 'fight', 'rest', 'fight', 'boss']
    : ['fight', 'event', 'fight', 'challenge', 'event', 'fight', 'trial', 'elite', 'fight', 'rest', 'fight', 'boss'];
  return kinds.map((kind, index) => ({ kind, index }));
}

// ───────────────────────── run creation & draft ─────────────────────────

export function newRun(tier: number, seed: number): RunState {
  const rng = new Rng(seed);
  const s: RunState = {
    version: 1,
    seed,
    rngState: rng.getState(),
    tier,
    blessing: null,
    realm: 1,
    floor: 0,
    nodeIndex: 0,
    timeline: makeTimeline(1),
    stones: 30,
    roster: [],
    party: [null, null, null, null, null],
    reserve: [null],
    positions: {},
    inventory: [],
    inventorySize: 8,
    relics: [],
    shop: null,
    shopFrozen: false,
    rerollsThisShop: 0,
    partySize: 5,
    reserveSize: 1,
    stats: { fights: 0, wins: 0, damage: 0, stonesEarned: 0, startedAt: Date.now(), rewinds: 0, bestHit: 0, elapsedMs: 0 },
    pendingRankUps: [],
    rankUpResume: 'board',
    rankUpChoices: null,
    pendingReward: null,
    pendingPick: null,
    draft: null,
    currentEvent: null,
    currentEncounter: null,
    fightReward: null,
    challengeOffers: null,
    activeChallenge: null,
    singleChampion: null,
    lastResult: null,
    lastBreakdown: null,
    phase: 'chooseHero',
    rewindCost: 30,
    heroCounter: 0,
    victory: false,
    endlessScore: 0,
    log: [],
    heroTotals: {},
    history: [],
  };
  rollDraft(s, rng);
  commit(s, rng);
  return s;
}

function rollDraft(s: RunState, rng: Rng): void {
  const heroes = rng.pickN(HEROES, 3).map((h) => h.id);
  const blessings = rng.pickN(BLESSINGS, 3).map((b) => b.id);
  s.draft = { heroes, blessings, rerolls: s.draft?.rerolls ?? 0 };
}

export function draftReroll(s: RunState): boolean {
  if (!s.draft || s.stones < 1) return false;
  const rng = rngOf(s);
  s.stones -= 1;
  s.draft.rerolls++;
  const prev = s.draft.blessings;
  rollDraft(s, rng);
  s.draft.blessings = prev;
  commit(s, rng);
  return true;
}

export function draftPick(s: RunState, heroDefId: string, blessingId: string): void {
  if (!s.draft) return;
  const blessing = BLESSINGS.find((b) => b.id === blessingId);
  s.blessing = blessing?.apply ?? null;
  if (s.blessing === 'wealth') s.stones += 20;
  if (s.blessing === 'quality') {
    s.partySize = 4;
    s.party = s.party.slice(0, 4);
  }
  const h = addHero(s, heroDefId, s.blessing === 'scholar' ? 1 : 0);
  s.draft = null;
  if (h.rank >= 1) queueRankUp(s, h.uid);
  // Starter kit event
  s.currentEvent = { eventId: 'starter_kit', outcome: null, chosen: null };
  if (s.pendingRankUps.length) {
    s.rankUpResume = 'event';
    prepareRankUp(s);
    s.phase = 'rankUp';
  } else s.phase = 'event';
  log(s, `${HERO_BY_ID[heroDefId].name} joins the sect.`);
}

// ───────────────────────── roster management ─────────────────────────

export function addHero(s: RunState, defId: string, rank: Rank): HeroState {
  const uid = `h${++s.heroCounter}`;
  const h: HeroState = { uid, defId, rank, insightIds: [], items: [], permanent: [] };
  s.roster.push(h);
  const slot = s.party.indexOf(null);
  if (slot >= 0) {
    s.party[slot] = uid;
    autoPlace(s, uid);
  } else {
    const r = s.reserve.indexOf(null);
    if (r >= 0) s.reserve[r] = uid;
  }
  return h;
}

export function freeRosterSlots(s: RunState): number {
  return s.party.filter((x) => x === null).length + s.reserve.filter((x) => x === null).length;
}

export function isOnBoard(s: RunState, uid: string): boolean {
  return s.party.includes(uid);
}

/** Picks a sensible free hex for a hero based on their range. */
export function autoPlace(s: RunState, uid: string): void {
  const h = heroByUid(s, uid);
  if (!h) return;
  const range = HERO_BY_ID[h.defId].baseStats.range ?? 1;
  const taken = new Set(Object.entries(s.positions).filter(([u]) => s.party.includes(u) && u !== uid).map(([, p]) => hexKey(p)));
  const centerRow = Math.floor(BOARD_ROWS / 2);
  // centre row first, then the far rows: a loose formation reads better than a tight stack of tall sprites
  const rows = [...new Set([centerRow, 0, BOARD_ROWS - 1, centerRow - 1, centerRow + 1])].filter((r) => r >= 0 && r < BOARD_ROWS);
  const preferredCols = range >= 3 ? [0, 1, 2, 3] : range === 2 ? [2, 1, 3, 0] : [3, 2, 1, 0];
  for (const col of preferredCols) {
    for (const row of rows) {
      const hex = offsetToAxial(col, row);
      if (!taken.has(hexKey(hex))) {
        s.positions[uid] = hex;
        return;
      }
    }
  }
}

export function setPosition(s: RunState, uid: string, hex: Hex): boolean {
  if (!s.party.includes(uid)) return false;
  const { col } = { col: hex.q + (hex.r - (hex.r & 1)) / 2 };
  if (col > ALLY_MAX_COL || col < 0) return false;
  const occupant = Object.entries(s.positions).find(([u, p]) => u !== uid && s.party.includes(u) && hexKey(p) === hexKey(hex));
  if (occupant) {
    const mine = s.positions[uid];
    if (mine) s.positions[occupant[0]] = mine;
    else autoPlace(s, occupant[0]);
  }
  s.positions[uid] = hex;
  return true;
}

export type SlotRef = { kind: 'party'; index: number } | { kind: 'reserve'; index: number };

export function moveHero(s: RunState, uid: string, target: SlotRef): boolean {
  const from = findSlot(s, uid);
  if (!from) return false;
  const targetArr = target.kind === 'party' ? s.party : s.reserve;
  if (target.index < 0 || target.index >= targetArr.length) return false;
  const fromArr = from.kind === 'party' ? s.party : s.reserve;
  const other = targetArr[target.index];
  fromArr[from.index] = other;
  targetArr[target.index] = uid;
  if (target.kind === 'party' && from.kind === 'reserve') {
    autoPlace(s, uid);
    if (other) delete s.positions[other];
  } else if (target.kind === 'reserve' && from.kind === 'party') {
    delete s.positions[uid];
    if (other) autoPlace(s, other);
  }
  return true;
}

export function findSlot(s: RunState, uid: string): SlotRef | null {
  const p = s.party.indexOf(uid);
  if (p >= 0) return { kind: 'party', index: p };
  const r = s.reserve.indexOf(uid);
  if (r >= 0) return { kind: 'reserve', index: r };
  return null;
}

export function removeHero(s: RunState, uid: string): void {
  const h = heroByUid(s, uid);
  if (!h) return;
  // return items to inventory
  for (const it of h.items) if (s.inventory.length < s.inventorySize) s.inventory.push(it);
  s.roster = s.roster.filter((x) => x.uid !== uid);
  s.party = s.party.map((x) => (x === uid ? null : x));
  s.reserve = s.reserve.map((x) => (x === uid ? null : x));
  delete s.positions[uid];
  s.pendingRankUps = s.pendingRankUps.filter((x) => x !== uid);
}

export function heroSellValue(s: RunState, uid: string): number {
  const h = heroByUid(s, uid);
  if (!h) return 0;
  return Math.round(HERO_PRICE_BY_RANK[h.rank] * 0.5) + h.rank * 5;
}

export function itemSellValue(itemId: string): number {
  const it = ITEM_BY_ID[itemId];
  return it ? Math.max(1, Math.round((it.price ?? ITEM_PRICE_BY_RARITY[it.rarity]) * 0.5)) : 0;
}

export function sellHero(s: RunState, uid: string): boolean {
  if (s.roster.length <= 1) return false;
  const v = heroSellValue(s, uid);
  removeHero(s, uid);
  s.stones += v;
  log(s, `Sold a disciple for ${v} stones.`);
  return true;
}

export function sellItem(s: RunState, itemId: string, fromHero?: string): boolean {
  if (fromHero) {
    const h = heroByUid(s, fromHero);
    if (!h) return false;
    const i = h.items.indexOf(itemId);
    if (i < 0) return false;
    h.items.splice(i, 1);
  } else {
    const i = s.inventory.indexOf(itemId);
    if (i < 0) return false;
    s.inventory.splice(i, 1);
  }
  s.stones += itemSellValue(itemId);
  return true;
}

export function equipItem(s: RunState, itemId: string, uid: string, fromHero?: string): boolean {
  const h = heroByUid(s, uid);
  if (!h) return false;
  const slots = heroItemSlots(h, teamContext(s));
  if (fromHero && fromHero !== uid) {
    const src = heroByUid(s, fromHero);
    if (!src) return false;
    const i = src.items.indexOf(itemId);
    if (i < 0) return false;
    if (h.items.length >= slots) {
      // swap last item
      const swapped = h.items.pop()!;
      src.items.splice(i, 1, swapped);
    } else src.items.splice(i, 1);
    h.items.push(itemId);
    return true;
  }
  const i = s.inventory.indexOf(itemId);
  if (i < 0) return false;
  if (h.items.length >= slots) {
    const swapped = h.items.pop()!;
    s.inventory.splice(i, 1, swapped);
  } else s.inventory.splice(i, 1);
  h.items.push(itemId);
  return true;
}

/**
 * Equips a Treasure into one chosen socket of a disciple. An empty socket fills the next free slot; an occupied one
 * trades places with the dragged Treasure: the one it replaces goes back where the dragged one came from (the
 * inventory, or the other disciple's socket). Within the same disciple, two sockets swap.
 */
export function equipItemAt(s: RunState, itemId: string, uid: string, index: number, fromHero?: string): boolean {
  const h = heroByUid(s, uid);
  if (!h) return false;
  if (index < 0 || index >= h.items.length) return equipItem(s, itemId, uid, fromHero);
  if (fromHero === uid) {
    const from = h.items.indexOf(itemId);
    if (from < 0) return false;
    [h.items[from], h.items[index]] = [h.items[index], h.items[from]];
    return true;
  }
  const replaced = h.items[index];
  if (fromHero) {
    const src = heroByUid(s, fromHero);
    if (!src) return false;
    const i = src.items.indexOf(itemId);
    if (i < 0) return false;
    src.items.splice(i, 1, replaced);
  } else {
    const i = s.inventory.indexOf(itemId);
    if (i < 0) return false;
    s.inventory.splice(i, 1, replaced);
  }
  h.items[index] = itemId;
  return true;
}

export function unequipItem(s: RunState, itemId: string, uid: string): boolean {
  const h = heroByUid(s, uid);
  if (!h) return false;
  const i = h.items.indexOf(itemId);
  if (i < 0) return false;
  if (s.inventory.length >= s.inventorySize) return false;
  h.items.splice(i, 1);
  s.inventory.push(itemId);
  return true;
}

export function addItemToInventory(s: RunState, itemId: string): boolean {
  if (s.inventory.length >= s.inventorySize) return false;
  s.inventory.push(itemId);
  return true;
}

export function addRelic(s: RunState, relicId: string): void {
  if (s.relics.some((r) => r.id === relicId)) return;
  s.relics.push({ id: relicId, questProgress: 0, questDone: false });
  const def = RELIC_BY_ID[relicId];
  if (def?.run?.partySize) {
    s.partySize = Math.min(6, s.partySize + def.run.partySize);
    while (s.party.length < s.partySize) s.party.push(null);
  }
  if (def?.run?.reserveSize) {
    s.reserveSize = Math.min(3, s.reserveSize + def.run.reserveSize);
    while (s.reserve.length < s.reserveSize) s.reserve.push(null);
  }
  log(s, `Gained Dao Insight: ${def?.name ?? relicId}.`);
}

// ───────────────────────── rank ups ─────────────────────────

export function queueRankUp(s: RunState, uid: string): void {
  if (!s.pendingRankUps.includes(uid)) s.pendingRankUps.push(uid);
}

export function rankUpHero(s: RunState, uid: string): boolean {
  const h = heroByUid(s, uid);
  if (!h || h.rank >= 3) return false;
  h.rank = (h.rank + 1) as Rank;
  queueRankUp(s, uid);
  log(s, `${HERO_BY_ID[h.defId].name} broke through to a new realm.`);
  return true;
}

export function beginRankUps(s: RunState, resume: RunState['rankUpResume']): void {
  s.rankUpResume = resume;
  prepareRankUp(s);
  s.phase = 'rankUp';
}

export function prepareRankUp(s: RunState): void {
  const uid = s.pendingRankUps[0];
  if (!uid) {
    s.rankUpChoices = null;
    return;
  }
  const h = heroByUid(s, uid);
  if (!h) {
    s.pendingRankUps.shift();
    prepareRankUp(s);
    return;
  }
  const def = HERO_BY_ID[h.defId];
  if (h.rank >= 1 && !h.daoPathId) {
    s.rankUpChoices = { uid, options: def.daoPaths };
    return;
  }
  const rng = rngOf(s);
  const pool = classInsights(heroClasses(h)).filter((i) => !h.insightIds.includes(i.id));
  const options = rng.pickN(pool, 3);
  commit(s, rng);
  s.rankUpChoices = { uid, options };
}

export function chooseUpgrade(s: RunState, upgradeId: string): void {
  const c = s.rankUpChoices;
  if (!c) return;
  const h = heroByUid(s, c.uid);
  const up = c.options.find((o) => o.id === upgradeId);
  if (h && up) {
    if (h.rank >= 1 && !h.daoPathId && HERO_BY_ID[h.defId].daoPaths.some((p) => p.id === up.id)) h.daoPathId = up.id;
    else h.insightIds.push(up.id);
  }
  s.pendingRankUps.shift();
  // a hero may need multiple choices (e.g. jumped from C to A): keep queue if more picks needed
  if (h) {
    const needed = picksNeeded(h);
    if (needed > 0) s.pendingRankUps.unshift(h.uid);
  }
  if (s.pendingRankUps.length) prepareRankUp(s);
  else {
    s.rankUpChoices = null;
    resumeAfterRankUp(s);
  }
}

function resumeAfterRankUp(s: RunState): void {
  const r = s.rankUpResume;
  s.rankUpResume = 'board';
  switch (r) {
    case 'event':
      s.phase = s.currentEvent ? 'event' : 'board';
      if (s.phase === 'board' && !s.currentEncounter) advanceNode(s);
      return;
    case 'shop':
      s.phase = s.shop ? 'shop' : 'board';
      return;
    case 'advance':
      advanceNode(s);
      return;
    case 'afterResult':
      afterResultContinue(s);
      return;
    case 'finishEvent':
      finishEvent(s);
      return;
    default:
      if (s.currentEvent) s.phase = 'event';
      else if (s.shop) s.phase = 'shop';
      else if (s.currentEncounter) s.phase = 'board';
      else advanceNode(s);
  }
}

/** How many rank-up choices this hero still owes (dao path + insights). */
export function picksNeeded(h: HeroState): number {
  const made = (h.daoPathId ? 1 : 0) + h.insightIds.length;
  return Math.max(0, h.rank - made);
}

// ───────────────────────── shop ─────────────────────────

function rankWeights(s: RunState): number[] {
  if (s.realm === 1) return s.nodeIndex < 5 ? [85, 15, 0, 0] : [70, 25, 5, 0];
  if (s.realm === 2) return s.nodeIndex < 5 ? [55, 35, 10, 0] : [40, 40, 17, 3];
  return [25, 40, 28, 7];
}
function rarityWeights(s: RunState): Record<Rarity, number> {
  if (s.realm === 1) return { common: 62, rare: 30, epic: 8, unique: 0 };
  if (s.realm === 2) return { common: 42, rare: 40, epic: 18, unique: 0 };
  return { common: 30, rare: 42, epic: 28, unique: 0 };
}

export function rollShop(s: RunState, keepFrozen = false): void {
  const rng = rngOf(s);
  const relics = relicDefs(s);
  let itemCount = 2;
  let relicCount = 1;
  for (const r of relics) {
    if (r.run?.shopItems) itemCount += r.run.shopItems;
    if (r.run?.shopRelics) relicCount += r.run.shopRelics;
  }
  if (s.blessing === 'bazaar') relicCount += 1;
  const prev = keepFrozen && s.shop ? s.shop : null;

  const heroes: (ShopHero | null)[] = [];
  const offered = new Set<string>((prev?.heroes ?? []).filter(Boolean).map((h) => h!.defId));
  for (let i = 0; i < 3; i++) {
    if (prev?.heroes[i]) {
      heroes.push(prev.heroes[i]);
      continue;
    }
    let def = rng.pick(HEROES);
    for (let tries = 0; offered.has(def.id) && tries < 8; tries++) def = rng.pick(HEROES);
    offered.add(def.id);
    const rank = rng.weighted([0, 1, 2, 3] as Rank[], rankWeights(s));
    const sale = rng.chance(12);
    heroes.push({ key: `sh${s.stats.fights}-${i}-${rng.int(0, 9999)}`, defId: def.id, rank, price: price(s, HERO_PRICE_BY_RANK[rank], sale), sale });
  }
  const items: (ShopItem | null)[] = [];
  const rw = rarityWeights(s);
  for (let i = 0; i < itemCount; i++) {
    if (prev?.items[i]) {
      items.push(prev.items[i]);
      continue;
    }
    const rarity = rng.weighted(['common', 'rare', 'epic'] as Rarity[], [rw.common, rw.rare, rw.epic]);
    const pool = SHOP_ITEMS.filter((it) => it.rarity === rarity);
    const it = rng.pick(pool);
    const sale = rng.chance(15);
    items.push({ key: `si${s.stats.fights}-${i}-${rng.int(0, 9999)}`, itemId: it.id, price: price(s, it.price ?? ITEM_PRICE_BY_RARITY[it.rarity], sale), sale });
  }
  const relicOffers: (ShopRelic | null)[] = [];
  const owned = new Set(s.relics.map((r) => r.id));
  for (let i = 0; i < relicCount; i++) {
    if (prev?.relics[i]) {
      relicOffers.push(prev.relics[i]);
      continue;
    }
    const rarity = rng.weighted(['common', 'rare', 'epic'] as Rarity[], [rw.common, rw.rare, rw.epic * 0.8]);
    let pool = SHOP_RELICS.filter((r) => r.rarity === rarity && !owned.has(r.id));
    if (pool.length === 0) pool = SHOP_RELICS.filter((r) => !owned.has(r.id));
    if (pool.length === 0) {
      relicOffers.push(null);
      continue;
    }
    const r = rng.pick(pool);
    const sale = rng.chance(15);
    relicOffers.push({ key: `sr${s.stats.fights}-${i}-${rng.int(0, 9999)}`, relicId: r.id, price: price(s, r.price ?? RELIC_PRICE_BY_RARITY[r.rarity], sale), sale });
  }
  const teamSize: (ShopRelic | null)[] = TEAM_SIZE_RELICS.map((r, i) => {
    const maxed = (r.run?.partySize && s.partySize >= 6) || (r.run?.reserveSize && s.reserveSize >= 3);
    if (maxed) return null;
    return { key: `ts-${i}`, relicId: r.id, price: price(s, r.price ?? 40, false), sale: false };
  });

  s.shop = { heroes, items, relics: relicOffers, teamSize };
  s.rerollsThisShop = 0;
  s.shopFrozen = false;
  commit(s, rng);
}

export function rerollCost(s: RunState): number {
  let discount = 0;
  for (const r of relicDefs(s)) if (r.run?.rerollDiscount) discount += r.run.rerollDiscount;
  const base = (s.realm === 1 ? 1 : 2) + s.rerollsThisShop;
  return Math.max(1, base - discount);
}

export function shopReroll(s: RunState): boolean {
  const cost = rerollCost(s);
  if (s.stones < cost || !s.shop) return false;
  s.stones -= cost;
  const n = s.rerollsThisShop + 1;
  rollShop(s, false);
  s.rerollsThisShop = n;
  return true;
}

export function toggleFreeze(s: RunState): void {
  s.shopFrozen = !s.shopFrozen;
}

export function buyHero(s: RunState, key: string): { ok: boolean; reason?: string; rankedUp?: string } {
  if (!s.shop) return { ok: false };
  const idx = s.shop.heroes.findIndex((h) => h?.key === key);
  const offer = idx >= 0 ? s.shop.heroes[idx] : null;
  if (!offer) return { ok: false };
  if (s.stones < offer.price) return { ok: false, reason: 'Not enough Spirit Stones' };
  const owned = s.roster.find((h) => h.defId === offer.defId);
  if (owned) {
    if (owned.rank >= 3) return { ok: false, reason: 'Already at Nascent Soul' };
    s.stones -= offer.price;
    const newRank = Math.max(owned.rank + 1, offer.rank) as Rank;
    owned.rank = Math.min(3, newRank) as Rank;
    queueRankUp(s, owned.uid);
    s.shop.heroes[idx] = null;
    log(s, `${HERO_BY_ID[offer.defId].name} ranked up.`);
    return { ok: true, rankedUp: owned.uid };
  }
  if (freeRosterSlots(s) === 0) return { ok: false, reason: 'No free slot in party or reserve' };
  s.stones -= offer.price;
  const h = addHero(s, offer.defId, offer.rank);
  if (h.rank >= 1) queueRankUp(s, h.uid);
  s.shop.heroes[idx] = null;
  log(s, `${HERO_BY_ID[offer.defId].name} joins the sect.`);
  return { ok: true, rankedUp: h.rank >= 1 ? h.uid : undefined };
}

export function buyItem(s: RunState, key: string): { ok: boolean; reason?: string } {
  if (!s.shop) return { ok: false };
  const idx = s.shop.items.findIndex((i) => i?.key === key);
  const offer = idx >= 0 ? s.shop.items[idx] : null;
  if (!offer) return { ok: false };
  if (s.stones < offer.price) return { ok: false, reason: 'Not enough Spirit Stones' };
  if (s.inventory.length >= s.inventorySize) return { ok: false, reason: 'Inventory is full' };
  s.stones -= offer.price;
  s.inventory.push(offer.itemId);
  s.shop.items[idx] = null;
  return { ok: true };
}

export function buyRelic(s: RunState, key: string): { ok: boolean; reason?: string } {
  if (!s.shop) return { ok: false };
  let idx = s.shop.relics.findIndex((r) => r?.key === key);
  let list = s.shop.relics;
  if (idx < 0) {
    idx = s.shop.teamSize.findIndex((r) => r?.key === key);
    list = s.shop.teamSize;
  }
  const offer = idx >= 0 ? list[idx] : null;
  if (!offer) return { ok: false };
  if (s.stones < offer.price) return { ok: false, reason: 'Not enough Spirit Stones' };
  s.stones -= offer.price;
  addRelic(s, offer.relicId);
  list[idx] = null;
  return { ok: true };
}

/** Leaves the shop: advances to the next node. */
export function proceedFromShop(s: RunState): void {
  if (!s.shopFrozen) s.shop = null;
  if (s.pendingRankUps.length) {
    s.rankUpResume = 'advance';
    prepareRankUp(s);
    s.phase = 'rankUp';
    return;
  }
  advanceNode(s);
}

// ───────────────────────── node flow ─────────────────────────

export function advanceNode(s: RunState): void {
  // After a Time Reversal the lost fight is fought again: back to the same node's board with the same enemies (and
  // the same challenge or trial). Moving on here used to count the lost fight as won, and a lost boss cleared the realm.
  if (s.retryNode) {
    s.retryNode = false;
    if (s.currentEncounter) s.phase = 'board';
    else enterNode(s);
    return;
  }
  const node = currentNode(s);
  if (node.kind === 'boss' && s.lastResult?.winner === 'ally' && s.currentEncounter?.kind === 'boss') {
    // boss was just beaten → realm cleared
    s.phase = 'realmCleared';
    return;
  }
  s.nodeIndex++;
  if (s.nodeIndex >= s.timeline.length) {
    s.phase = 'realmCleared';
    return;
  }
  enterNode(s);
}

export function enterNode(s: RunState): void {
  const node = currentNode(s);
  s.currentEncounter = null;
  s.fightReward = null;
  s.activeChallenge = null;
  s.challengeOffers = null;
  s.singleChampion = null;
  const rng = rngOf(s);
  switch (node.kind) {
    case 'fight':
    case 'elite':
    case 'boss': {
      s.currentEncounter = generateEncounter(s.realm, node.index, node.kind, s.tier, rng, s.floor);
      s.phase = 'board';
      break;
    }
    case 'challenge': {
      s.currentEncounter = generateEncounter(s.realm, node.index, 'challenge', s.tier, rng, s.floor);
      s.challengeOffers = rng.pickN(CHALLENGES, 2);
      s.phase = 'challenge';
      break;
    }
    case 'trial': {
      s.currentEvent = { eventId: 'heavenly_trial', outcome: null, chosen: null };
      s.phase = 'event';
      break;
    }
    case 'rest': {
      s.currentEvent = { eventId: 'sect_rest', outcome: null, chosen: null };
      s.phase = 'event';
      break;
    }
    case 'event': {
      const pool = RANDOM_EVENTS.filter((e) => !e.realm || e.realm === 'any' || e.realm === s.realm);
      const ev = rng.weighted(pool, pool.map((e) => e.weight ?? 1));
      s.currentEvent = { eventId: ev.id, outcome: null, chosen: null };
      s.phase = 'event';
      break;
    }
  }
  commit(s, rng);
}

export function acceptChallenge(s: RunState, id: string | null): void {
  s.activeChallenge = id ? (s.challengeOffers?.find((c) => c.id === id) ?? null) : null;
  s.challengeOffers = null;
  s.phase = 'board';
}

// ───────────────────────── events ─────────────────────────

export function eventContext(s: RunState) {
  const rng = rngOf(s);
  const ctx = {
    stones: s.stones,
    partyCount: s.party.filter(Boolean).length,
    rosterCount: s.roster.length,
    realm: s.realm,
    rng,
    addStones: (n: number) => {
      s.stones = Math.max(0, s.stones + n);
      if (n > 0) s.stats.stonesEarned += n;
    },
    addItemToInventory: (item: ItemDef) => void addItemToInventory(s, item.id),
    addRelic: (relic: RelicDef) => addRelic(s, relic.id),
    permanentHeroBuff: (uid: string, stat: StatKey, flat = 0, pct = 0) => {
      const h = heroByUid(s, uid);
      if (h) h.permanent.push({ stat, flat, pct });
    },
    rankUpHero: (uid: string) => void rankUpHero(s, uid),
    heroes: s.roster.map((h) => ({ uid: h.uid, name: HERO_BY_ID[h.defId].name, rank: h.rank, classes: heroClasses(h) })),
    rollItems: (count: number, rarity?: Rarity) => {
      const pool = SHOP_ITEMS.filter((i) => !rarity || i.rarity === rarity);
      return rng.pickN(pool.length ? pool : SHOP_ITEMS, count);
    },
    rollRelics: (count: number, rarity?: Rarity) => {
      const owned = new Set(s.relics.map((r) => r.id));
      let pool = SHOP_RELICS.filter((r) => !owned.has(r.id) && (!rarity || r.rarity === rarity));
      if (pool.length < count) pool = SHOP_RELICS.filter((r) => !owned.has(r.id));
      return rng.pickN(pool, count);
    },
  };
  return { ctx, rng };
}

export function resolveEventChoice(s: RunState, choiceId: string, heroUid?: string): EventOutcome | null {
  if (!s.currentEvent) return null;
  const ev = EVENT_BY_ID[s.currentEvent.eventId];
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !choice) return null;
  const { ctx, rng } = eventContext(s);
  if (choice.available && !choice.available(ctx)) return null;
  const outcome = choice.resolve(ctx, heroUid);
  commit(s, rng);
  s.currentEvent.outcome = outcome;
  s.currentEvent.chosen = choiceId;
  if (outcome.pickItem?.length) {
    const count = choiceId === 'items' && ev.id === 'starter_kit' ? 2 : 1;
    s.pendingPick = { kind: 'item', items: outcome.pickItem, count, title: 'Choose a Treasure' };
  } else if (outcome.pickRelic?.length) {
    if (outcome.pickRelic.length === 1) addRelic(s, outcome.pickRelic[0].id);
    else s.pendingPick = { kind: 'relic', relics: outcome.pickRelic, count: 1, title: 'Choose a Dao Insight' };
  }
  if (outcome.fight) {
    const encRng = rngOf(s);
    s.currentEncounter = generateEncounter(s.realm, currentNode(s).index, 'single', s.tier, encRng, s.floor);
    commit(s, encRng);
    s.fightReward = { actions: outcome.fight.reward, desc: outcome.fight.rewardDesc, single: outcome.fight.single };
  }
  return outcome;
}

export function pickFromPending(s: RunState, id: string): void {
  const p = s.pendingPick;
  if (!p) return;
  if (p.kind === 'item') {
    const it = p.items?.find((i) => i.id === id);
    if (it) {
      addItemToInventory(s, it.id);
      p.items = p.items!.filter((i) => i.id !== id);
    }
  } else {
    const r = p.relics?.find((i) => i.id === id);
    if (r) addRelic(s, r.id);
  }
  p.count--;
  if (p.count <= 0 || (p.kind === 'item' && !p.items?.length)) s.pendingPick = null;
}

export function finishEvent(s: RunState): void {
  s.currentEvent = null;
  s.pendingPick = null;
  if (s.pendingRankUps.length) {
    s.rankUpResume = 'finishEvent';
    prepareRankUp(s);
    s.phase = 'rankUp';
    return;
  }
  if (s.currentEncounter && s.fightReward?.single) {
    s.phase = 'board';
    return;
  }
  // Starter kit happens before node 0, so do not advance; otherwise go to the next node.
  if (s.nodeIndex === 0 && s.stats.fights === 0 && !s.currentEncounter) {
    enterNode(s);
    return;
  }
  advanceNode(s);
}

// ───────────────────────── battle ─────────────────────────

export function battleConfig(s: RunState): BattleConfig | null {
  const enc = s.currentEncounter;
  if (!enc) return null;
  const ctx = teamContext(s);
  const mods = difficultyMods(s);
  let id = 1;
  const allies = [];
  const bench = [];
  const single = s.fightReward?.single ? s.singleChampion : null;
  if (single) {
    const h = heroByUid(s, single);
    if (!h) return null;
    const pos = offsetToAxial(ALLY_MAX_COL, Math.floor(BOARD_ROWS / 2));
    allies.push(buildHeroUnit(h, ctx, id++, pos, true));
  } else {
    for (const uid of s.party) {
      if (!uid) continue;
      const h = heroByUid(s, uid);
      if (!h) continue;
      if (!s.positions[uid]) autoPlace(s, uid);
      allies.push(buildHeroUnit(h, ctx, id++, s.positions[uid], true));
    }
    for (const uid of s.reserve) {
      if (!uid) continue;
      const h = heroByUid(s, uid);
      if (h) bench.push(buildHeroUnit(h, ctx, id++, null, false));
    }
  }
  if (s.activeChallenge?.id === 'decay') {
    for (const a of allies) {
      a.stats.hp = Math.round(a.stats.hp * 0.8);
      a.stats.attack *= 0.8;
      a.stats.spirit *= 0.8;
      a.stats.defense *= 0.8;
    }
  }
  const enemies = enc.enemies.map((e) => {
    const def = ENEMY_BY_ID[e.defId];
    const u = buildEnemyUnit(def, enc.level, id++, e.pos, mods.enemyHpPct + (def.boss && mods.bossExtraAbility ? 15 : 0));
    if (s.activeChallenge?.id === 'haste') u.stats.attackSpeed += 40;
    if (s.activeChallenge?.id === 'improvidence')
      u.effects = [...(u.effects ?? []), { id: 'improvidence', desc: 'Heals 4% per second.', trigger: { on: 'interval', every: 1 }, actions: [{ do: 'heal', target: 'self', scale: { maxHp: 0.04 } }] }];
    return u;
  });
  const level = enc.level;
  const hpPct = mods.enemyHpPct;
  return {
    seed: (s.seed ^ (s.stats.fights * 7919) ^ (s.nodeIndex * 104729) ^ (s.stats.rewinds * 31)) >>> 0,
    allies,
    bench,
    enemies,
    tribulationAt: s.activeChallenge?.id === 'storm' ? 25 : mods.tribulationAt,
    enemyDamagePct: mods.enemyDamagePct,
    startCombatHpLossPct: mods.startCombatHpLossPct,
    spawnEnemy: (enemyId, uid) => {
      const def = ENEMY_BY_ID[enemyId];
      return def ? buildEnemyUnit(def, level, uid, null, hpPct) : null;
    },
  };
}

export function startBattle(s: RunState): void {
  s.phase = 'battle';
}

export function baseWinStones(s: RunState): number {
  return s.realm === 1 ? 20 : s.realm === 2 ? 25 : 30;
}

export function finishBattle(s: RunState, result: BattleResult): void {
  s.lastResult = result;
  s.stats.fights++;
  for (const u of result.units) {
    if (u.side !== 'ally' || !u.heroUid) continue;
    s.heroTotals ??= {};
    const t = (s.heroTotals[u.heroUid] ??= { dealt: 0, taken: 0, healed: 0, kills: 0, crits: 0, bestHit: 0, fights: 0 });
    t.dealt += u.tracker.damageDealt;
    t.taken += u.tracker.damageTaken;
    t.healed += u.tracker.healing + u.tracker.shielding;
    t.kills += u.tracker.kills;
    t.crits += u.tracker.crits;
    t.bestHit = Math.max(t.bestHit, u.tracker.bestHit);
    t.fights++;
  }
  s.stats.damage += result.quest.damage;
  for (const u of result.units) if (u.side === 'ally' && u.tracker.bestHit > s.stats.bestHit) s.stats.bestHit = u.tracker.bestHit;

  const enc0 = s.currentEncounter;
  const foe = enc0?.enemies.map((e) => e.defId).sort((a, b) => foeRank(b) - foeRank(a))[0];
  const record: FightRecord = { realm: s.realm, floor: s.floor, node: s.nodeIndex, kind: enc0?.kind ?? 'fight', won: result.winner === 'ally', dealt: result.quest.damage, stones: 0, foe };
  (s.history ??= []).push(record);
  if (s.history.length > 120) s.history.shift();

  if (result.winner !== 'ally') {
    s.phase = 'defeat';
    return;
  }
  s.stats.wins++;
  // permanent buffs from combat (Apex Predator etc.)
  for (const pb of result.permanentBuffs) {
    const h = heroByUid(s, pb.heroUid);
    if (h) h.permanent.push({ stat: pb.stat, flat: pb.flat, pct: pb.pct });
  }
  const mods = difficultyMods(s);
  const enc = s.currentEncounter;
  const breakdown: StonesBreakdown = {
    base: s.fightReward?.single ? 0 : baseWinStones(s),
    survivorCount: result.survivors,
    survivors: s.fightReward?.single ? 0 : Math.max(0, result.survivors * (1 + mods.stonesPerSurvivorDelta)),
    relicBonus: 0,
    battleBonus: result.stonesBonus,
    bounty: 0,
    quests: [],
    challenge: s.activeChallenge?.id === 'haste' ? 30 : s.activeChallenge?.id === 'storm' ? 10 : 0,
    total: 0,
  };
  for (const r of relicDefs(s)) if (r.run?.stonesPerFight) breakdown.relicBonus += r.run.stonesPerFight;
  if (enc) for (const e of enc.enemies) breakdown.bounty += ENEMY_BY_ID[e.defId]?.bounty ?? 0;
  // fight reward (trial)
  if (s.fightReward?.actions) {
    for (const a of s.fightReward.actions) if (a.do === 'stones') breakdown.battleBonus += a.amount;
  }
  // quests
  for (const rs of s.relics) {
    const def = RELIC_BY_ID[rs.id];
    if (!def?.quest || rs.questDone) continue;
    rs.questProgress += questDelta(def.quest.type, result);
    if (rs.questProgress >= def.quest.goal) {
      rs.questDone = true;
      const gained = applyRunActions(s, def.quest.reward);
      breakdown.quests.push({ name: def.name, amount: gained });
    }
  }
  for (const h of s.roster) {
    for (const itemId of h.items) {
      const it = ITEM_BY_ID[itemId];
      if (!it?.quest) continue;
      const key = `${h.uid}:${itemId}`;
      const prog = (itemQuestProgress.get(key) ?? 0) + questDelta(it.quest.type, result);
      itemQuestProgress.set(key, prog);
      if (prog >= it.quest.goal && !itemQuestDone.has(key)) {
        itemQuestDone.add(key);
        const gained = applyRunActions(s, it.quest.reward);
        breakdown.quests.push({ name: it.name, amount: gained });
      }
    }
  }
  breakdown.total = breakdown.base + breakdown.survivors + breakdown.relicBonus + breakdown.battleBonus + breakdown.bounty + breakdown.challenge + breakdown.quests.reduce((a, q) => a + q.amount, 0);
  // quests already added their stones in applyRunActions; add the rest
  s.stones += breakdown.base + breakdown.survivors + breakdown.relicBonus + breakdown.battleBonus + breakdown.bounty + breakdown.challenge;
  s.stats.stonesEarned += breakdown.total;
  s.lastBreakdown = breakdown;
  record.stones = breakdown.total;
  s.phase = 'result';
}

/** How notable an enemy is, to name a fight by its toughest foe. */
function foeRank(defId: string): number {
  const d = ENEMY_BY_ID[defId];
  return d?.boss ? 3 : d?.elite ? 2 : 1;
}

// module-level quest progress for item quests (per run; reset on new run via resetItemQuests)
const itemQuestProgress = new Map<string, number>();
const itemQuestDone = new Set<string>();
export function resetItemQuests(): void {
  itemQuestProgress.clear();
  itemQuestDone.clear();
}
export function itemQuestState(heroUid: string, itemId: string): { progress: number; done: boolean } {
  const key = `${heroUid}:${itemId}`;
  return { progress: itemQuestProgress.get(key) ?? 0, done: itemQuestDone.has(key) };
}

function questDelta(type: string, r: BattleResult): number {
  switch (type) {
    case 'crits':
      return r.quest.crits;
    case 'wins':
      return r.quest.wins;
    case 'kills':
      return r.quest.kills;
    case 'casts':
      return r.quest.casts;
    case 'frost':
      return r.quest.frost;
    case 'burn':
      return r.quest.burn;
    case 'poison':
      return r.quest.poison;
    case 'shield':
      return r.quest.shield;
    case 'heal':
      return r.quest.heal;
    case 'surge':
      return r.quest.surge;
    case 'enlightenment':
      return r.quest.enlightenment;
    case 'stones':
      return r.quest.stones;
    case 'damage':
      return r.quest.damage;
  }
  return 0;
}

/** Applies run-level actions (quest rewards). Returns stones gained. */
export function applyRunActions(s: RunState, actions: ActionDef[]): number {
  let stones = 0;
  for (const a of actions) {
    if (a.do === 'stones') {
      s.stones += a.amount;
      stones += a.amount;
    } else if (a.do === 'permanentBuff') {
      for (const h of s.roster) h.permanent.push({ stat: a.stat, flat: a.flat ?? 0, pct: a.pct ?? 0 });
    }
  }
  return stones;
}

/** After the result screen. */
export function proceedFromResult(s: RunState): void {
  const node = currentNode(s);
  const wasSingle = !!s.fightReward?.single;
  // trial item reward
  if (wasSingle && s.fightReward && !s.fightReward.actions) {
    const rng = rngOf(s);
    const pool = SHOP_ITEMS.filter((i) => i.rarity === 'rare');
    s.pendingPick = { kind: 'item', items: rng.pickN(pool, 3), count: 1, title: 'Trial Reward: choose a Treasure' };
    commit(s, rng);
  }
  s.fightReward = null;
  s.singleChampion = null;
  s.resultWasSingle = wasSingle;
  if (s.pendingRankUps.length) {
    s.rankUpResume = 'afterResult';
    prepareRankUp(s);
    s.phase = 'rankUp';
    return;
  }
  afterResultContinue(s);
}

export function afterResultContinue(s: RunState): void {
  const node = currentNode(s);
  const wasSingle = !!s.resultWasSingle;
  s.resultWasSingle = false;
  // elite / challenge rewards
  if (node.kind === 'elite' || (s.activeChallenge && s.activeChallenge.id !== 'haste')) {
    const rng = rngOf(s);
    const owned = new Set(s.relics.map((r) => r.id));
    if (s.activeChallenge?.id === 'improvidence') {
      const pool = SHOP_ITEMS.filter((i) => i.rarity === 'epic');
      s.pendingPick = { kind: 'item', items: rng.pickN(pool, 3), count: 1, title: 'Challenge Reward: choose a Treasure' };
    } else {
      const rarity: Rarity = s.activeChallenge?.id === 'storm' ? 'rare' : 'epic';
      let pool = SHOP_RELICS.filter((r) => r.rarity === rarity && !owned.has(r.id));
      if (pool.length < 3) pool = SHOP_RELICS.filter((r) => !owned.has(r.id));
      s.pendingReward = rng.pickN(pool, 3);
    }
    commit(s, rng);
    s.activeChallenge = null;
    s.phase = 'reward';
    return;
  }
  s.activeChallenge = null;
  if (wasSingle && s.pendingPick) {
    s.phase = 'reward';
    return;
  }
  openShop(s);
}

export function chooseReward(s: RunState, relicId: string): void {
  if (s.pendingReward?.some((r) => r.id === relicId)) addRelic(s, relicId);
  s.pendingReward = null;
  if (!s.pendingPick) openShop(s);
}

/** Spirit Stones granted for passing on a reward. */
export const SKIP_REWARD_STONES = 10;

/** Passes on the reward on offer (a Dao Insight choice, or a Treasure / Insight pick) for a few Spirit Stones. */
export function skipReward(s: RunState): void {
  s.stones += SKIP_REWARD_STONES;
  s.stats.stonesEarned += SKIP_REWARD_STONES;
  if (s.pendingReward) {
    s.pendingReward = null;
    if (!s.pendingPick) openShop(s);
    return;
  }
  finishRewardPick(s);
}

export function finishRewardPick(s: RunState): void {
  s.pendingPick = null;
  if (!s.pendingReward) openShop(s);
}

export function openShop(s: RunState): void {
  if (s.shopFrozen && s.shop) rollShop(s, true);
  else rollShop(s, false);
  s.phase = 'shop';
}

export function rewindAvailable(s: RunState): boolean {
  return s.stones >= currentRewindCost(s);
}
export function currentRewindCost(s: RunState): number {
  return Math.max(5, s.rewindCost - (s.blessing === 'stability' ? 25 : 0));
}

export function rewind(s: RunState): boolean {
  const cost = currentRewindCost(s);
  if (s.stones < cost) return false;
  s.stones -= cost;
  s.rewindCost += 20;
  s.stats.rewinds++;
  s.lastResult = null;
  s.retryNode = true;
  log(s, 'Time reversed with a talisman.');
  openShop(s);
  return true;
}

export function endRun(s: RunState, victory: boolean): void {
  s.victory = victory;
  s.stats.elapsedMs = Date.now() - s.stats.startedAt;
  s.phase = 'runEnd';
}

/** From realmCleared: go to next realm or endless. */
export function nextRealm(s: RunState): void {
  if (s.realm === 1) {
    s.realm = 2;
    s.nodeIndex = 0;
    s.timeline = makeTimeline(2);
  } else if (s.realm === 2) {
    s.realm = 3;
    s.floor = 1;
    s.nodeIndex = 0;
    s.timeline = makeTimeline(3);
    s.victory = true;
  } else {
    s.floor++;
    s.nodeIndex = 0;
    s.timeline = makeTimeline(3);
  }
  s.endlessScore = s.realm === 3 ? (s.floor - 1) * 12 + s.nodeIndex : 0;
  enterNode(s);
}

export function endlessScore(s: RunState): number {
  if (s.realm !== 3) return 0;
  return (s.floor - 1) * 12 + s.nodeIndex;
}

/** Hero summary helper for UI. */
export function heroSummary(s: RunState, uid: string) {
  const h = heroByUid(s, uid);
  if (!h) return null;
  return { hero: h, def: HERO_BY_ID[h.defId], classes: heroClasses(h), daoPath: heroDaoPath(h), slots: heroItemSlots(h, teamContext(s)) };
}

export { HERO_BY_ID };
