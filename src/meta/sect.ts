import type { MetaSave } from '@/app/store';
import type { RunSect, RunState } from '@/core/run';
import { RESEARCH_RELICS } from '@/content/relics';
import { HEIRLOOM_MAX_LEVEL, HEIRLOOM_RECIPES } from '@/content/heirlooms';
import { HERO_BY_ID } from '@/content/heroes';
import { DOCTRINES, DOCTRINE_BY_ID } from '@/content/doctrines';
import { VEIN_BY_ID, veinPoints, veinSpent, veinValid, type VeinState } from '@/content/vein';
import { TRAINING_BLESSINGS } from '@/content/difficulties';
import { masteryLevels } from '@/meta/mastery';
import { OMEN_BY_ID, SECT_EVENT_BY_ID, type OmenId, type SectOmen } from '@/content/sectEvents';
import { contractMultiplier, cumulativeXp, levelOf, rankOf } from '@/meta/renown';

/**
 * The Sect (docs/META_PROGRESSION.md, section 6), phase 2: Sect Funds and three materials paid by every run, the Main
 * Hall, the Scripture Pavilion (studies and seals), the Artifact Forge (heirlooms) and the Bounty Board. Pure data and
 * rules, so they are unit tested; src/meta/sectActions.ts applies them to the save.
 */
export type MaterialKey = 'herbs' | 'cores' | 'jade';
export type Purse = { funds: number } & Record<MaterialKey, number>;

export const CURRENCIES: { key: keyof Purse; name: string; icon: string; desc: string }[] = [
  { key: 'funds', name: 'Sect Funds', icon: 'item_pouch', desc: 'A quarter of the Spirit Stones a run earns. Every building, study and craft costs Funds.' },
  { key: 'herbs', name: 'Spirit Herbs', icon: 'item_lotus_ice', desc: 'Gathered at events (2) and at the Sect Rest (3). The Scripture Pavilion studies with them.' },
  { key: 'cores', name: 'Beast Cores', icon: 'item_core', desc: 'Taken from elites (2), challenges and trials (1). The Artifact Forge works them.' },
  { key: 'jade', name: 'Heavenly Jade', icon: 'item_pendant', desc: 'Left by realm guardians (3, 4 from Nascent Soul up) and Ladder floors (2). High building levels need it.' },
];

export const emptyPurse = (): Purse => ({ funds: 0, herbs: 0, cores: 0, jade: 0 });

/** What a finished run pays the sect, all × the contract multiplier and rounded down. */
export function computeRunPurse(s: RunState): Purse {
  const mult = contractMultiplier(s.tier);
  const won = (s.history ?? []).filter((h) => h.won);
  const n = (pred: (h: (typeof won)[number]) => boolean) => won.filter(pred).length;
  const elites = n((h) => h.kind === 'elite');
  const trials = n((h) => h.kind === 'challenge' || h.kind === 'single' || h.kind === 'trial');
  const guardians = n((h) => h.kind === 'boss' && h.realm <= 2);
  const floors = n((h) => h.kind === 'boss' && h.realm === 3);
  const events = s.nodes?.events ?? 0;
  const rests = s.nodes?.rests ?? 0;
  const jadePerGuardian = s.tier >= 4 ? 4 : 3;
  // the Wandering Cultivator's doctrine: +20% Funds
  const fundsBonus = 1 + (s.sect?.doctrine ? (DOCTRINE_BY_ID[s.sect.doctrine]?.run?.payoutPct ?? 0) : 0) / 100;
  return {
    funds: Math.floor(s.stats.stonesEarned * 0.25 * mult * fundsBonus),
    herbs: Math.floor((events * 2 + rests * 3) * mult),
    cores: Math.floor((elites * 2 + trials) * mult),
    jade: Math.floor((guardians * jadePerGuardian + floors * 2) * mult),
  };
}

// ───────────────────────── buildings ─────────────────────────

export type BuildingId = 'hall' | 'pavilion' | 'forge' | 'bounty' | 'recruit' | 'doctrine' | 'vein' | 'training' | 'ancestors';
/** The buildings raised with Funds and materials. */
export type UpgradableId = 'pavilion' | 'forge' | 'recruit' | 'doctrine' | 'vein' | 'training';
export const UPGRADABLE: UpgradableId[] = ['forge', 'pavilion', 'doctrine', 'recruit', 'vein', 'training'];

export interface BuildingDef {
  id: BuildingId;
  name: string;
  hanzi: string;
  icon: string;
  desc: string;
  /** Renown level that opens it. */
  unlock: number;
  /** Material its upgrades use (bought buildings only). */
  material?: MaterialKey;
  /** Upgradable with Funds and materials (the Main Hall rises with the sect's rank instead). */
  upgradable: boolean;
}

/** The Sect itself (and the Main Hall and Bounty Board) opens at Renown 2. */
export const SECT_OPENS = 2;

export const BUILDINGS: BuildingDef[] = [
  { id: 'hall', name: 'Main Hall', hanzi: '殿', icon: 'relic_inner_court', desc: "The sect's seat. It rises with the sect's rank, and the rank caps every other building's level.", unlock: SECT_OPENS, upgradable: false },
  { id: 'pavilion', name: 'Scripture Pavilion', hanzi: '经', icon: 'relic_library', desc: 'Studies add new Dao Insights to what runs can offer. Seals keep chosen Treasures and Insights out of every shop and reward.', unlock: 3, material: 'herbs', upgradable: true },
  { id: 'forge', name: 'Artifact Forge', hanzi: '炉', icon: 'relic_furnace', desc: 'Crafts heirloom Treasures. One heirloom can be carried into a run, and it grows with each victory.', unlock: 5, material: 'cores', upgradable: true },
  {
    id: 'doctrine',
    name: 'Doctrine Hall',
    hanzi: '法',
    icon: 'relic_creed',
    desc: 'Teaches doctrines: a run can follow one, picked on the New Run screen. Each has an upside and a cost. Every level teaches more.',
    unlock: 7,
    material: 'herbs',
    upgradable: true,
  },
  { id: 'bounty', name: 'Bounty Board', hanzi: '榜', icon: 'relic_ledger', desc: 'Three standing bounties. A run that meets one pays its reward, and a new bounty takes its place.', unlock: SECT_OPENS, upgradable: false },
  {
    id: 'recruit',
    name: 'Recruitment Hall',
    hanzi: '招',
    icon: 'sect_recruitment_hall',
    desc: 'Exclusive disciples answer the call of a rising sect. Recruit them here and they can join your drafts and shops. Level III: one free draft reroll each run. Level V: the draft shows 4 disciples.',
    unlock: 8,
    material: 'cores',
    upgradable: true,
  },
  {
    id: 'vein',
    name: 'Spirit Vein',
    hanzi: '脉',
    icon: 'relic_vein',
    desc: 'A web of small blessings the sect sends with every run: 2 points per level, moved freely between runs. A Pure run goes without.',
    unlock: 11,
    material: 'herbs',
    upgradable: true,
  },
  {
    id: 'training',
    name: 'Training Grounds',
    hanzi: '武',
    icon: 'relic_grounds',
    desc: 'Disciples train new ways to begin a run: every level adds blessings to the opening draft. Level V: the draft shows 4 blessings.',
    unlock: 13,
    material: 'cores',
    upgradable: true,
  },
  {
    id: 'ancestors',
    name: 'Hall of Ancestors',
    hanzi: '祖',
    icon: 'sect_hall_of_ancestors',
    desc: 'The sect remembers: a statue for the champion of every victory, the masters of each disciple, the best Ladder ascents and the Hall of Merit. Free, no levels.',
    unlock: 17,
    upgradable: false,
  },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;
export const MAX_BUILDING_LEVEL = 5;

/** What it costs to raise a building to `level` (2–5). */
export function levelCost(level: number, material: MaterialKey): Partial<Purse> {
  const table: Record<number, [number, number, number]> = { 2: [100, 10, 0], 3: [250, 25, 0], 4: [450, 45, 5], 5: [700, 70, 12] };
  const [funds, mat, jade] = table[level] ?? [0, 0, 0];
  const cost: Partial<Purse> = { funds, [material]: mat };
  if (jade) cost.jade = (cost.jade ?? 0) + jade;
  return cost;
}

/** The highest level the sect's rank allows: 1 as a Humble Sect, up to 5 as a Holy Land. */
export function levelCap(renownXp: number): number {
  return Math.min(MAX_BUILDING_LEVEL, 1 + rankOf(levelOf(renownXp).level).index);
}

export function isOpen(b: BuildingId, renownXp: number): boolean {
  return levelOf(renownXp).level >= BUILDING_BY_ID[b].unlock;
}

// ───────────────────────── Scripture Pavilion ─────────────────────────

export interface StudyDef {
  id: string;
  name: string;
  /** Pavilion level needed. */
  level: number;
  cost: Partial<Purse>;
  blurb: string;
}

export const STUDIES: StudyDef[] = [
  { id: 'five_phases', name: 'Scrolls of the Five Phases', level: 1, cost: { funds: 60, herbs: 8 }, blurb: 'Fire on kills, frost on crits, poison and Qi on a rhythm.' },
  { id: 'iron_body', name: 'Treatises of the Iron Body', level: 2, cost: { funds: 120, herbs: 15 }, blurb: 'Defense for the front row, shields when wounded, more Max HP for all.' },
  { id: 'merchant', name: 'Ledgers of the Wandering Merchant', level: 3, cost: { funds: 200, herbs: 25 }, blurb: 'Spirit Stones after fights and on kills, a richer shop.' },
];
export const studyRelics = (study: string) => RESEARCH_RELICS.filter((r) => r.research === study);

/** Seals the Pavilion allows: one per level. */
export const sealSlots = (pavilionLevel: number) => Math.max(0, pavilionLevel);

// ───────────────────────── Artifact Forge ─────────────────────────

export interface RecipeState {
  id: string;
  level: number;
}

/** Forge level that teaches each recipe, and what crafting it costs. */
export const RECIPE_TERMS: Record<string, { forge: number; cost: Partial<Purse> }> = {
  founder_sword: { forge: 1, cost: { funds: 80, cores: 6 } },
  jade_seal: { forge: 1, cost: { funds: 100, cores: 8 } },
  elder_gourd: { forge: 2, cost: { funds: 160, cores: 14 } },
  storm_banner: { forge: 3, cost: { funds: 220, cores: 20, jade: 2 } },
};
export const RECIPES = HEIRLOOM_RECIPES.map((r) => ({ ...r, ...RECIPE_TERMS[r.id] }));

/** From Forge level 4, new heirlooms start at level 2 and older level-1 heirlooms are raised to it. */
export const heirloomStartLevel = (forgeLevel: number) => (forgeLevel >= 4 ? 2 : 1);
export const nextHeirloomLevel = (level: number) => Math.min(HEIRLOOM_MAX_LEVEL, level + 1);

// ───────────────────────── Doctrine Hall ─────────────────────────

/** The Doctrine Hall level that teaches each doctrine, and the price of learning it (Funds and Heavenly Jade). */
export const DOCTRINE_TERMS: Record<string, { hall: number; price: Partial<Purse> }> = {
  wandering: { hall: 1, price: { funds: 60, jade: 2 } },
  herbs: { hall: 1, price: { funds: 60, jade: 2 } },
  iron: { hall: 2, price: { funds: 100, jade: 4 } },
  merchant: { hall: 2, price: { funds: 100, jade: 4 } },
  fists: { hall: 3, price: { funds: 150, jade: 6 } },
  talisman: { hall: 3, price: { funds: 150, jade: 6 } },
  shadow: { hall: 4, price: { funds: 220, jade: 9 } },
  frost: { hall: 4, price: { funds: 220, jade: 9 } },
  sword: { hall: 5, price: { funds: 300, jade: 12 } },
};
export const DOCTRINE_LIST = DOCTRINES.map((d) => ({ ...d, ...DOCTRINE_TERMS[d.id] }));

// ───────────────────────── Training Grounds ─────────────────────────

/** Blessings a Training Grounds level adds to the draft's pool, and how many the draft shows. */
export const trainedBlessings = (level: number) => TRAINING_BLESSINGS.filter((b) => (b.training ?? 99) <= level).map((b) => b.id);
export const blessingCountFor = (level: number) => (level >= 5 ? 4 : 3);

// ───────────────────────── Recruitment Hall ─────────────────────────

/** An exclusive disciple: the Renown at which they answer the sect's call and what recruiting them costs. */
export interface RecruitDef {
  hero: string;
  renown: number;
  cost: Partial<Purse>;
  /** One line for the Recruitment Hall. */
  blurb: string;
}

export const RECRUITS: RecruitDef[] = [
  { hero: 'ling_shuang', renown: 10, cost: { funds: 150, jade: 4 }, blurb: 'A Sword Cultivator and Array Master in one: her frost swords fall in waves and freeze what they strike.' },
  { hero: 'zhong_ming', renown: 20, cost: { funds: 250, jade: 6 }, blurb: 'A Body Refiner and Martial Artist whose Golden Bell drinks in every blow she takes and rings it back out as a shockwave.' },
  { hero: 'wen_yan', renown: 25, cost: { funds: 350, jade: 8 }, blurb: 'A Talisman Master and Array Master whose paper seals wait two breaths, then explode on the enemies they mark.' },
  { hero: 'jin_ding', renown: 35, cost: { funds: 450, jade: 10 }, blurb: "An Alchemist and Body Refiner whose golden cauldron turns the sect's Spirit Stones into healing for the whole party." },
];
export const RECRUIT_BY_HERO = Object.fromEntries(RECRUITS.map((r) => [r.hero, r])) as Record<string, RecruitDef>;

/** Disciples the opening draft shows, and free draft rerolls, for a Recruitment Hall level. */
export const draftSizeFor = (hallLevel: number) => (hallLevel >= 5 ? 4 : 3);
export const freeRerollsFor = (hallLevel: number) => (hallLevel >= 3 ? 1 : 0);

// ───────────────────────── Bounty Board ─────────────────────────

export interface BountyDef {
  id: string;
  name: string;
  desc: string;
  reward: Partial<Purse>;
  /** Met by a finished run? */
  met: (s: RunState) => boolean;
}

const wins = (s: RunState, kind: string, realm?: number) => (s.history ?? []).filter((h) => h.won && h.kind === kind && (realm === undefined || h.realm === realm)).length;

export const BOUNTIES: BountyDef[] = [
  { id: 'win_six', name: 'Proving Ground', desc: 'Win 6 fights in one run.', reward: { funds: 40, herbs: 4 }, met: (s) => s.stats.wins >= 6 },
  { id: 'two_elites', name: 'Elite Hunt', desc: 'Defeat 2 elites in one run.', reward: { funds: 50, cores: 4 }, met: (s) => wins(s, 'elite') >= 2 },
  { id: 'realm_one', name: 'Calm the Jade River', desc: 'Defeat the guardian of Realm I.', reward: { funds: 60, jade: 2 }, met: (s) => wins(s, 'boss', 1) >= 1 },
  { id: 'challenge', name: 'Tempered by Hardship', desc: 'Win a Challenge fight.', reward: { funds: 40, cores: 3 }, met: (s) => wins(s, 'challenge') >= 1 },
  { id: 'trial', name: 'Duel on the Peak', desc: 'Win the Heavenly Trial.', reward: { funds: 40, cores: 3 }, met: (s) => wins(s, 'single') + wins(s, 'trial') >= 1 },
  { id: 'coffers', name: 'Full Coffers', desc: 'Earn 300 Spirit Stones in one run.', reward: { funds: 60, herbs: 5 }, met: (s) => s.stats.stonesEarned >= 300 },
  { id: 'seeker', name: 'Seeker of Knowledge', desc: 'Meet 4 new Compendium entries in one run.', reward: { funds: 40, herbs: 6 }, met: (s) => (s.discovered ?? 0) >= 4 },
  { id: 'golden_core', name: 'A Golden Core', desc: 'Raise a disciple to Golden Core.', reward: { funds: 50, herbs: 4 }, met: (s) => s.roster.some((h) => h.rank >= 2) },
  { id: 'no_reversal', name: 'No Second Chances', desc: 'Defeat the guardian of Realm I without a Time Reversal.', reward: { funds: 70, jade: 2 }, met: (s) => wins(s, 'boss', 1) >= 1 && !s.stats.rewinds },
  { id: 'cuts', name: 'Ten Thousand Cuts', desc: 'Deal 60,000 damage in one run.', reward: { funds: 50, cores: 4 }, met: (s) => s.stats.damage >= 60000 },
  { id: 'library', name: 'Patron of the Library', desc: 'End a run holding 4 Dao Insights.', reward: { funds: 50, herbs: 5 }, met: (s) => s.relics.length >= 4 },
  { id: 'above_mortals', name: 'Above Mortal Ground', desc: 'Reach Realm II on Qi Condensation or a harder contract.', reward: { funds: 80, jade: 3 }, met: (s) => s.realm >= 2 && s.tier >= 1 },
];
export const BOUNTY_BY_ID = Object.fromEntries(BOUNTIES.map((b) => [b.id, b])) as Record<string, BountyDef>;
export const BOUNTY_SLOTS = 3;

/** Fills the board to three: the next bounties not on it and not done yet; once every bounty is done, the cycle restarts. */
export function refillBounties(active: string[], done: string[]): { active: string[]; done: string[] } {
  const a = active.filter((id) => BOUNTY_BY_ID[id]);
  let d = done.filter((id) => BOUNTY_BY_ID[id]);
  while (a.length < BOUNTY_SLOTS) {
    let next = BOUNTIES.find((b) => !a.includes(b.id) && !d.includes(b.id));
    if (!next) {
      d = [];
      next = BOUNTIES.find((b) => !a.includes(b.id));
      if (!next) break;
    }
    a.push(next.id);
  }
  return { active: a, done: d };
}

// ───────────────────────── the save ─────────────────────────

export interface SectState {
  purse: Purse;
  buildings: Record<UpgradableId, number>;
  research: string[];
  seals: string[];
  heirlooms: RecipeState[];
  bounties: { active: string[]; done: string[] };
  /** The heirloom picked on the New Run screen last time ('' for none). */
  carry: string;
  /** Exclusive disciples recruited in the Recruitment Hall. */
  disciples: string[];
  /** Doctrines learned in the Doctrine Hall. */
  doctrines: string[];
  /** The doctrine picked on the New Run screen last time ('' for none). */
  doctrine: string;
  /** The New Run screen's Pure run switch, as last set. */
  pure: boolean;
  /** Spirit Vein node ranks (src/content/vein.ts). */
  vein: VeinState;
  /** The sect event waiting for a decision (src/meta/sectEvents.ts), if any. */
  event: PendingSectEvent | null;
  /** Omens waiting for the next run (src/content/sectEvents.ts). */
  omens: SectOmen[];
  /** Returns since the last sect event, and which event it was. */
  pace: EventPace;
}

/** A sect event come home with a run, waiting for the player's choice. */
export interface PendingSectEvent {
  id: string;
  /** The disciple it is about (seclusion). */
  hero?: string;
}
export interface EventPace {
  since: number;
  last?: string;
}

export const emptySect = (): SectState => ({
  purse: emptyPurse(),
  buildings: { pavilion: 1, forge: 1, recruit: 1, doctrine: 1, vein: 1, training: 1 },
  research: [],
  seals: [],
  heirlooms: [],
  bounties: { active: [], done: [] },
  carry: '',
  disciples: [],
  doctrines: [],
  doctrine: '',
  pure: false,
  vein: {},
  event: null,
  omens: [],
  pace: { since: 0 },
});

/** The sect part of a save, with defaults for older saves. */
export function sectOf(m: MetaSave): SectState {
  const base = emptySect();
  const s = m.sect;
  if (!s) return base;
  return {
    purse: { ...base.purse, ...(s.purse ?? {}) },
    buildings: { ...base.buildings, ...(s.buildings ?? {}) },
    research: s.research ?? [],
    seals: s.seals ?? [],
    heirlooms: s.heirlooms ?? [],
    bounties: { active: s.bounties?.active ?? [], done: s.bounties?.done ?? [] },
    carry: s.carry ?? '',
    disciples: (s.disciples ?? []).filter((id) => RECRUIT_BY_HERO[id]),
    doctrines: (s.doctrines ?? []).filter((id) => DOCTRINE_BY_ID[id]),
    doctrine: s.doctrine && DOCTRINE_BY_ID[s.doctrine] ? s.doctrine : '',
    pure: !!s.pure,
    vein: cleanVein(s.vein),
    event: s.event && SECT_EVENT_BY_ID[s.event.id] ? { id: s.event.id, ...(s.event.hero && HERO_BY_ID[s.event.hero] ? { hero: s.event.hero } : {}) } : null,
    omens: (s.omens ?? []).filter((o) => OMEN_BY_ID[o.id as OmenId] && (o.id !== 'seclusion' || (o.hero && HERO_BY_ID[o.hero]))) as SectOmen[],
    pace: { since: Math.max(0, s.pace?.since ?? 0), ...(s.pace?.last ? { last: s.pace.last } : {}) },
  };
}

/** Known nodes only, and a web that breaks no rule (else it is refunded whole). */
function cleanVein(v: VeinState | undefined): VeinState {
  const out: VeinState = {};
  for (const [id, rank] of Object.entries(v ?? {})) if (VEIN_BY_ID[id] && rank > 0) out[id] = Math.min(rank, VEIN_BY_ID[id].max);
  return veinValid(out) ? out : {};
}

export const canAfford = (purse: Purse, cost: Partial<Purse>) => (Object.keys(cost) as (keyof Purse)[]).every((k) => purse[k] >= (cost[k] ?? 0));
export function spend(purse: Purse, cost: Partial<Purse>): Purse {
  const out = { ...purse };
  for (const k of Object.keys(cost) as (keyof Purse)[]) out[k] -= cost[k] ?? 0;
  return out;
}
export function addPurse(a: Purse, b: Partial<Purse>): Purse {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof Purse)[]) out[k] += b[k] ?? 0;
  return out;
}

/**
 * What the sect sends into a new run: its seals, its studies, the chosen heirloom (none while the Forge is closed),
 * the chosen doctrine (one it has learned), its recruited disciples and what the Recruitment Hall's level does to the
 * draft. A Pure run leaves the heirloom and the doctrine at home: pool content (studies, seals, disciples) stays,
 * because it adds options, not power.
 */
export function runSectFor(m: MetaSave, heirloom: string, opts: { doctrine?: string; pure?: boolean } = {}): RunSect {
  const s = sectOf(m);
  const xp = m.renown?.xp ?? 0;
  const pure = !!opts.pure;
  const h = !pure && isOpen('forge', xp) ? s.heirlooms.find((x) => x.id === heirloom) : undefined;
  const doctrine = !pure && opts.doctrine && isOpen('doctrine', xp) && s.doctrines.includes(opts.doctrine) ? opts.doctrine : undefined;
  const hall = isOpen('recruit', xp) ? s.buildings.recruit : 0;
  // the Spirit Vein, within its points (a Pure run goes without)
  const vein = !pure && isOpen('vein', xp) && veinSpent(s.vein) <= veinPoints(s.buildings.vein) && Object.keys(s.vein).length ? { ...s.vein } : undefined;
  return {
    seals: isOpen('pavilion', xp) ? s.seals.slice() : [],
    research: s.research.slice(),
    heirloom: h ? { id: h.id, level: h.level } : undefined,
    disciples: s.disciples.slice(),
    draftSize: draftSizeFor(hall),
    freeRerolls: freeRerollsFor(hall) + (vein?.gate ?? 0),
    doctrine,
    vein,
    // the Training Grounds add options, not power: a Pure run keeps them
    blessings: isOpen('training', xp) ? trainedBlessings(s.buildings.training) : [],
    blessingCount: blessingCountFor(isOpen('training', xp) ? s.buildings.training : 0),
    // disciple mastery: options and looks, so a Pure run keeps it too
    mastery: masteryLevels(m),
    pure: pure || undefined,
    // sect events' omens: a Pure run leaves the boons waiting for the next one
    omens: omensFor(s.omens, pure).length ? omensFor(s.omens, pure) : undefined,
  };
}

/** The omens a new run takes: all that wait, but a Pure run leaves the boons (more power) for a later run. */
export function omensFor(omens: SectOmen[], pure: boolean): SectOmen[] {
  return omens.filter((o) => !(pure && OMEN_BY_ID[o.id]?.boon));
}

/** Where an exclusive disciple stands: not yet at the gate (Renown or Hall missing), waiting to be recruited, or recruited. */
export function recruitState(m: MetaSave, hero: string): 'locked' | 'waiting' | 'recruited' {
  const r = RECRUIT_BY_HERO[hero];
  const xp = m.renown?.xp ?? 0;
  if (sectOf(m).disciples.includes(hero)) return 'recruited';
  return r && isOpen('recruit', xp) && levelOf(xp).level >= r.renown ? 'waiting' : 'locked';
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** What the player can do in the sect right now and afford, the most tempting first: recruit, craft, study, then raise a hall. */
export function sectToDo(m: MetaSave): string[] {
  const xp = m.renown?.xp ?? 0;
  if (!isOpen('hall', xp)) return [];
  const s = sectOf(m);
  const out: string[] = [];
  // a sect event waiting for a decision comes first
  if (s.event) out.push(`${SECT_EVENT_BY_ID[s.event.id].title}: a decision waits at the sect.`);
  for (const r of RECRUITS) if (recruitState(m, r.hero) === 'waiting' && canAfford(s.purse, r.cost)) out.push(`The Recruitment Hall can recruit ${HERO_BY_ID[r.hero].name}.`);
  if (isOpen('forge', xp))
    for (const r of RECIPES) if (!s.heirlooms.some((h) => h.id === r.id) && r.forge <= s.buildings.forge && canAfford(s.purse, r.cost)) out.push(`The Artifact Forge can craft the ${r.name}.`);
  if (isOpen('pavilion', xp))
    for (const st of STUDIES) if (!s.research.includes(st.id) && st.level <= s.buildings.pavilion && canAfford(s.purse, st.cost)) out.push(`The Scripture Pavilion can study the ${st.name}.`);
  if (isOpen('doctrine', xp))
    for (const d of DOCTRINE_LIST) if (!s.doctrines.includes(d.id) && d.hall <= s.buildings.doctrine && canAfford(s.purse, d.price)) out.push(`The Doctrine Hall can teach the ${d.name}.`);
  if (isOpen('vein', xp)) {
    const left = veinPoints(s.buildings.vein) - veinSpent(s.vein);
    if (left > 0) out.push(`The Spirit Vein has ${left} ${left === 1 ? 'point' : 'points'} to place.`);
  }
  const cap = levelCap(xp);
  for (const id of UPGRADABLE) {
    const lvl = s.buildings[id];
    if (isOpen(id, xp) && lvl < cap && canAfford(s.purse, levelCost(lvl + 1, BUILDING_BY_ID[id].material!))) out.push(`The ${BUILDING_BY_ID[id].name} can rise to level ${ROMAN[lvl + 1]}.`);
  }
  return out;
}

/** Anything the player can do in the sect right now (the glow on the main menu's sect banner). */
export function sectHasNews(m: MetaSave): boolean {
  return sectToDo(m).length > 0;
}

export interface SectInvite {
  /** The sect is founded (Renown 2): the banner opens the Sect screen. */
  open: boolean;
  /** Something can be crafted, studied or raised right now. */
  ready: boolean;
  /** One line: the first thing to do, else the next building to open, else the bounties. */
  headline: string;
  /** Renown progress (0–1) towards what the headline waits for: founding the sect or the next building. */
  progress?: number;
}

/** The main menu's sect banner. */
export function sectInvite(m: MetaSave): SectInvite {
  const xp = m.renown?.xp ?? 0;
  if (!isOpen('hall', xp))
    return { open: false, ready: false, headline: `Every run earns Sect Renown. At Renown ${SECT_OPENS} your sect is founded.`, progress: Math.min(1, xp / cumulativeXp(SECT_OPENS)) };
  const todo = sectToDo(m);
  if (todo.length) return { open: true, ready: true, headline: todo[0] };
  const waiting = RECRUITS.find((r) => recruitState(m, r.hero) === 'waiting');
  if (waiting) return { open: true, ready: false, headline: `${HERO_BY_ID[waiting.hero].name} waits at the gate of the Recruitment Hall.` };
  // the nearest milestone: the next building to open or the next disciple to answer the call
  const next = BUILDINGS.filter((b) => !isOpen(b.id, xp)).sort((a, b) => a.unlock - b.unlock)[0];
  const coming = RECRUITS.filter((r) => levelOf(xp).level < r.renown).sort((a, b) => a.renown - b.renown)[0];
  if (next && (!coming || next.unlock <= coming.renown)) return { open: true, ready: false, headline: `Renown ${next.unlock} opens the ${next.name}.`, progress: Math.min(1, xp / cumulativeXp(next.unlock)) };
  if (coming) return { open: true, ready: false, headline: `At Renown ${coming.renown}, ${HERO_BY_ID[coming.hero].name} answers the sect's call.`, progress: Math.min(1, xp / cumulativeXp(coming.renown)) };
  const n = sectOf(m).bounties.active.length;
  return { open: true, ready: false, headline: n ? `${n} ${n === 1 ? 'bounty waits' : 'bounties wait'} on the Bounty Board.` : 'Bring Sect Funds home from your runs to raise its halls.' };
}
