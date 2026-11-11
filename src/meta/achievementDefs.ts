import type { MetaSave } from '@/app/store';
import type { RunState } from '@/core/run';
import type { RunEvent } from '@/core/runEvents';
import type { ClassId } from '@/core/types';
import { heroClasses } from '@/core/builder';
import { BASE_HEROES } from '@/content/heroes';
import { ITEMS } from '@/content/items';
import { RELICS } from '@/content/relics';
import { ENEMIES } from '@/content/enemies';
import { CLASSES } from '@/content/classes';
import { DIFFICULTIES } from '@/content/difficulties';
import type { CosmeticKind } from '@/meta/cosmetics';

/**
 * Achievements (docs/META_PROGRESSION.md, section 8): the ones that can be tracked in phase 1. Each pays Renown XP;
 * some also unlock a cosmetic. `earnedBy` is pure, so the triggers are unit tested.
 */
export type AchievementCategory = 'progress' | 'contracts' | 'mastery' | 'builds' | 'feats' | 'discovery' | 'secrets';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  xp: number;
  /** Shown as "? ? ?" until earned. */
  hidden?: boolean;
  /** Medal: an Icon name, or a brush hanzi. */
  icon?: string;
  hanzi?: string;
  rewards?: { kind: CosmeticKind; id: string }[];
}

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  progress: 'Progress',
  contracts: 'Contracts',
  mastery: 'Mastery',
  builds: 'Builds',
  feats: 'Feats',
  discovery: 'Discovery',
  secrets: 'Secrets',
};

/** A single hit this strong (the bot's best hits run 300 at the median to about 2,150 at most). */
export const MOUNTAIN_SPLITTER_HIT = 2000;
export const TREASURY_STONES = 150;
export const FICKLE_REROLLS = 10;
const CHALLENGE_IDS = ['decay', 'improvidence', 'haste', 'storm'];
const CONTRACT_XP = [50, 75, 100, 125, 150, 200, 250, 300];
const CONTRACT_NAMES = ['Mortal Path', 'Qi Condensed', 'Foundation Laid', 'Golden Core Formed', 'Nascent Soul Born', 'Soul Formed', 'Void Refined', 'Tribulation Survivor'];
const CLASS_ACH_NAME: Record<string, string> = {
  sword: 'Way of the Sword',
  body: 'Way of the Iron Body',
  talisman: 'Way of the Talisman',
  alchemist: 'Way of the Cauldron',
  shadow: 'Way of Shadows',
  martial: 'Way of the Fist',
  array: 'Way of the Array',
};

const A = (d: AchievementDef) => d;

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── progress
  A({ id: 'ACH_FIRST_STEP', name: 'First Step on the Path', desc: 'Win your first fight.', category: 'progress', xp: 25, icon: 'node_fight' }),
  A({ id: 'ACH_RIFT_SEALED_1', name: 'The Jade River Calmed', desc: 'Defeat the guardian of Realm I.', category: 'progress', xp: 75, icon: 'node_boss', rewards: [{ kind: 'avatar', id: 'foe_flood_dragon' }, { kind: 'title', id: 'dragon_queller' }] }),
  A({ id: 'ACH_ASCENDED', name: 'Ascension', desc: 'Clear both realms in one run.', category: 'progress', xp: 150, icon: 'ui_trophy', rewards: [{ kind: 'avatar', id: 'foe_blood_moon_sovereign' }] }),
  A({ id: 'ACH_LADDER_5', name: 'Five Rungs', desc: 'Clear 5 floors of the Heavenly Ladder.', category: 'progress', xp: 100, icon: 'ui_leaderboard' }),
  A({ id: 'ACH_LADDER_10', name: 'Above the Clouds', desc: 'Clear 10 floors of the Heavenly Ladder.', category: 'progress', xp: 150, icon: 'ui_leaderboard' }),
  A({ id: 'ACH_LADDER_20', name: 'Touching Heaven', desc: 'Clear 20 floors of the Heavenly Ladder.', category: 'progress', xp: 250, icon: 'ui_leaderboard', rewards: [{ kind: 'title', id: 'touching_heaven' }] }),
  // ── contracts
  ...DIFFICULTIES.map((d, t) =>
    A({
      id: `ACH_CONTRACT_${t}`,
      name: CONTRACT_NAMES[t] ?? d.name,
      // the last contract's achievement also calls the eighth exclusive disciple (RECRUITS in src/meta/sect.ts)
      desc: `Clear both realms on the ${d.name} contract.${t === DIFFICULTIES.length - 1 ? " Huang Quan, the Corpse Immortal, answers the sect's call." : ''}`,
      category: 'contracts',
      xp: CONTRACT_XP[t] ?? 300,
      hanzi: d.hanzi,
      rewards: t === DIFFICULTIES.length - 1 ? [{ kind: 'title', id: 'tribulation' }] : undefined,
    }),
  ),
  // ── mastery
  ...Object.values(CLASSES).map((c) =>
    A({ id: `ACH_CLASS_${c.id.toUpperCase()}`, name: CLASS_ACH_NAME[c.id] ?? `Way of the ${c.name}`, desc: `Clear both realms with 3 or more ${c.name}s in your party.`, category: 'mastery', xp: 75, icon: `class_${c.id}` }),
  ),
  A({ id: 'ACH_HUNDRED_SCHOOLS', name: 'Hundred Schools', desc: 'Clear both realms with each disciple in your party at least once (over many runs).', category: 'mastery', xp: 300, icon: 'ui_party', rewards: [{ kind: 'title', id: 'hundred_schools' }] }),
  A({ id: 'ACH_NASCENT', name: 'Nascent Soul', desc: 'Raise a disciple to Nascent Soul.', category: 'mastery', xp: 50, icon: 'ui_rank' }),
  A({ id: 'ACH_FULL_HALL', name: 'Full Hall', desc: 'Win a fight with 6 disciples on the board.', category: 'mastery', xp: 50, icon: 'ui_party' }),
  // ── builds
  A({ id: 'ACH_EMPTY_HANDS', name: 'Empty Hands', desc: 'Clear both realms without a single Treasure equipped.', category: 'builds', xp: 150, icon: 'ui_bag', rewards: [{ kind: 'title', id: 'empty_hands' }] }),
  A({ id: 'ACH_NO_REVERSAL', name: 'No Turning Back', desc: 'Clear both realms without using a Time Reversal.', category: 'builds', xp: 100, icon: 'ui_rewind' }),
  A({ id: 'ACH_SEEKER', name: 'Seeker of Hardship', desc: 'Win each of the four Challenges at least once.', category: 'builds', xp: 100, icon: 'node_challenge' }),
  A({ id: 'ACH_DUEL', name: 'Duel of Fates', desc: 'Win the Heavenly Trial with a Qi Condensation disciple.', category: 'builds', xp: 75, icon: 'node_trial' }),
  // ── feats
  A({ id: 'ACH_MOUNTAIN_SPLITTER', name: 'Mountain-Splitting Strike', desc: `Deal ${MOUNTAIN_SPLITTER_HIT.toLocaleString('en-US')} damage with a single hit.`, category: 'feats', xp: 75, icon: 'stat_attack' }),
  A({ id: 'ACH_LAST_STANDING', name: 'Last One Standing', desc: 'Win a fight with a single disciple left.', category: 'feats', xp: 50, icon: 'ui_fight' }),
  A({ id: 'ACH_UNTOUCHED', name: 'Untouched', desc: 'Clear a realm without losing a disciple in any of its fights.', category: 'feats', xp: 150, icon: 'kw_shield' }),
  A({ id: 'ACH_TREASURY', name: 'Merchant of the Sect', desc: `Hold ${TREASURY_STONES} Spirit Stones at once.`, category: 'feats', xp: 50, icon: 'stones' }),
  A({ id: 'ACH_OATH', name: 'Bound by Oath', desc: 'Complete a Treasure or Dao Insight quest.', category: 'feats', xp: 50, icon: 'ui_check' }),
  // ── discovery
  A({ id: 'ACH_CODEX_DISCIPLES', name: 'Roll of Disciples', desc: 'Discover every disciple in the Compendium.', category: 'discovery', xp: 100, icon: 'ui_compendium' }),
  A({ id: 'ACH_CODEX_TREASURES', name: 'Treasure Vault', desc: 'Discover every Treasure in the Compendium.', category: 'discovery', xp: 150, icon: 'ui_compendium' }),
  A({ id: 'ACH_CODEX_INSIGHTS', name: 'Library of the Dao', desc: 'Discover every Dao Insight in the Compendium.', category: 'discovery', xp: 150, icon: 'ui_compendium' }),
  A({ id: 'ACH_CODEX_FOES', name: "Demon Hunter's Almanac", desc: 'Discover every foe in the Compendium.', category: 'discovery', xp: 100, icon: 'ui_compendium' }),
  A({ id: 'ACH_CODEX_ALL', name: 'Archivist', desc: 'Discover everything in the Compendium.', category: 'discovery', xp: 300, icon: 'ui_compendium', rewards: [{ kind: 'title', id: 'archivist' }] }),
  // ── secrets
  A({ id: 'ACH_HUMBLING', name: 'A Humbling Start', desc: 'Lose the very first fight of a run.', category: 'secrets', xp: 25, icon: 'ui_skull', hidden: true }),
  A({ id: 'ACH_FICKLE_FATE', name: 'Fickle Fate', desc: `Reroll ${FICKLE_REROLLS} times in one shop.`, category: 'secrets', xp: 25, icon: 'ui_reroll', hidden: true }),
  A({ id: 'ACH_UNGRATEFUL', name: 'Ungrateful Master', desc: 'Sell a disciple at Nascent Soul.', category: 'secrets', xp: 25, icon: 'ui_sell', hidden: true }),
];

export const ACH_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Events the evaluator understands: run facts, any change of the run, and the meta save itself. */
export type MetaEvent = RunEvent | { type: 'state'; s: RunState } | { type: 'meta'; m: MetaSave };

const partyHeroes = (s: RunState) => s.party.filter((u): u is string => !!u).map((uid) => s.roster.find((h) => h.uid === uid)).filter((h) => !!h);
const allIn = (list: string[] | undefined, ids: string[]) => {
  const set = new Set(list ?? []);
  return ids.length > 0 && ids.every((id) => set.has(id));
};

/**
 * The achievements an event satisfies (already-earned ones included; the caller skips those). Realm clears name the
 * realm just cleared: s.realm and s.floor are still the cleared realm's when the event fires.
 */
export function earnedBy(e: MetaEvent, m: MetaSave): string[] {
  const out: string[] = [];
  switch (e.type) {
    case 'fightEnd': {
      const { s, result, record } = e;
      const allies = result.units.filter((u) => u.side === 'ally' && u.heroUid && u.onBoard);
      if (record.won) {
        out.push('ACH_FIRST_STEP');
        if (allies.length >= 6) out.push('ACH_FULL_HALL');
        if (result.survivors === 1) out.push('ACH_LAST_STANDING');
        if (record.kind === 'single') {
          const champ = s.roster.find((h) => h.uid === s.singleChampion);
          if (champ && champ.rank === 0) out.push('ACH_DUEL');
        }
      } else if (s.stats.fights === 1) out.push('ACH_HUMBLING');
      if (result.units.some((u) => u.side === 'ally' && u.tracker.bestHit >= MOUNTAIN_SPLITTER_HIT)) out.push('ACH_MOUNTAIN_SPLITTER');
      break;
    }
    case 'realmCleared': {
      const { s } = e;
      if (s.realm <= 2 && !(s.realmDeaths ?? 0)) out.push('ACH_UNTOUCHED');
      if (s.realm === 1) out.push('ACH_RIFT_SEALED_1');
      if (s.realm === 2) {
        out.push('ACH_ASCENDED', `ACH_CONTRACT_${s.tier}`);
        const party = partyHeroes(s);
        const counts = new Map<ClassId, number>();
        for (const h of party) for (const c of heroClasses(h)) counts.set(c, (counts.get(c) ?? 0) + 1);
        for (const [c, n] of counts) if (n >= 3) out.push(`ACH_CLASS_${c.toUpperCase()}`);
        if (s.roster.every((h) => h.items.length === 0)) out.push('ACH_EMPTY_HANDS');
        if (!s.stats.rewinds) out.push('ACH_NO_REVERSAL');
      }
      if (s.realm === 3) {
        if (s.floor >= 5) out.push('ACH_LADDER_5');
        if (s.floor >= 10) out.push('ACH_LADDER_10');
        if (s.floor >= 20) out.push('ACH_LADDER_20');
      }
      break;
    }
    case 'rankUp':
      if (e.rank >= 3) out.push('ACH_NASCENT');
      break;
    case 'reroll':
      if (e.s.rerollsThisShop >= FICKLE_REROLLS) out.push('ACH_FICKLE_FATE');
      break;
    case 'sellHero':
      if (e.rank >= 3) out.push('ACH_UNGRATEFUL');
      break;
    case 'questDone':
      out.push('ACH_OATH');
      break;
    case 'state':
      if (e.s.stones >= TREASURY_STONES) out.push('ACH_TREASURY');
      if (e.s.roster.some((h) => h.rank >= 3)) out.push('ACH_NASCENT');
      break;
    case 'meta': {
      const mm = e.m;
      const seen = mm.seen;
      const codex = [
        allIn(seen?.heroes, BASE_HEROES.map((h) => h.id)),
        allIn(seen?.items, ITEMS.map((i) => i.id)),
        allIn(seen?.relics, RELICS.map((r) => r.id)),
        allIn(seen?.enemies, ENEMIES.map((x) => x.id)),
      ];
      if (codex[0]) out.push('ACH_CODEX_DISCIPLES');
      if (codex[1]) out.push('ACH_CODEX_TREASURES');
      if (codex[2]) out.push('ACH_CODEX_INSIGHTS');
      if (codex[3]) out.push('ACH_CODEX_FOES');
      if (codex.every(Boolean)) out.push('ACH_CODEX_ALL');
      // facts the save already holds (also how older saves earn them retroactively)
      for (let t = 0; t <= Math.min(mm.bestTierCleared, DIFFICULTIES.length - 1); t++) out.push(`ACH_CONTRACT_${t}`);
      if (mm.runsWon > 0) out.push('ACH_FIRST_STEP', 'ACH_RIFT_SEALED_1', 'ACH_ASCENDED');
      const cleared = Math.max(0, (mm.lifetime?.bestFloor ?? 0) - 1);
      if (cleared >= 5) out.push('ACH_LADDER_5');
      if (cleared >= 10) out.push('ACH_LADDER_10');
      if (cleared >= 20) out.push('ACH_LADDER_20');
      if (allIn(mm.lifetime?.challengesWon, CHALLENGE_IDS)) out.push('ACH_SEEKER');
      if (allIn(mm.lifetime?.winnersWith, BASE_HEROES.map((h) => h.id))) out.push('ACH_HUNDRED_SCHOOLS');
      break;
    }
  }
  return out.filter((id) => ACH_BY_ID[id]);
}

/** Total Renown XP of a list of achievement ids. */
export function achievementXp(ids: string[]): number {
  return ids.reduce((a, id) => a + (ACH_BY_ID[id]?.xp ?? 0), 0);
}
