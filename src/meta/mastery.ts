import type { MetaSave } from '@/app/store';
import { HEROES, HERO_BY_ID } from '@/content/heroes';
import { MASTERY_PATHS } from '@/content/mastery';

/**
 * Disciple mastery (docs/META_PROGRESSION.md, section 6.6): every fight won with a disciple on the board counts towards
 * that disciple's mastery, across all runs. Pure rules, so they are unit tested.
 */

/** Fights won with the disciple on the board that reach mastery I to V. */
export const MASTERY_THRESHOLDS = [3, 10, 20, 35, 50];
export const MAX_MASTERY = MASTERY_THRESHOLDS.length;

export function masteryLevel(wins: number): number {
  return MASTERY_THRESHOLDS.filter((t) => wins >= t).length;
}

export const masteryWins = (m: MetaSave, hero: string) => m.mastery?.[hero] ?? 0;
export const masteryOf = (m: MetaSave, hero: string) => masteryLevel(masteryWins(m, hero));

/** What each mastery level brings (the third depends on whether the disciple has an exclusive path yet). */
export function masteryRewards(hero: string): string[] {
  return [
    'A second page of lore in the Compendium',
    'A golden aura in the arena',
    MASTERY_PATHS[hero] ? `An exclusive fourth Dao Path: ${MASTERY_PATHS[hero].name}` : 'An exclusive fourth Dao Path (to come)',
    `The title "${MASTER_TITLES[hero] ?? 'Master'}"`,
    'A gilded card frame',
  ];
}

/** The title mastery IV grants, named after the disciple's technique. */
export const MASTER_TITLES: Record<string, string> = {
  li_jian: 'Master of the Flying Sword',
  shan_tie: 'Master of the Unmoving Mountain',
  hong_lian: 'Master of the Crimson Lotus',
  mei_yao: 'Master of the Nine-Turn Pill',
  ying_wu: 'Master of the Shadow Step',
  tie_quan: 'Master of the Hundred Fists',
  xuan_bing: 'Master of the Frost Array',
  lei_zhen: 'Master of Heavenly Thunder',
  long_mu: 'Master of the Sun-Shooting Arrow',
  bai_hu: "Master of the Tiger's Roar",
  qing_feng: 'Master of the Gale Thrust',
  yue_ling: 'Master of Moonlit Qi',
  hei_yan: 'Master of the Obsidian Shell',
  zhu_sha: 'Master of Cinnabar Smoke',
  gu_lao: 'Master of the Sutra Chant',
  feng_huang: 'Master of the Nirvana Flame',
  ling_shuang: 'Master of the Nine Frost Swords',
};
/** The cosmetic id of a disciple's mastery title. */
export const masterTitleId = (hero: string) => `master_${hero}`;
/** The disciple whose mastery title this is, if it is one. */
export const heroOfMasterTitle = (id: string) => (id.startsWith('master_') && HERO_BY_ID[id.slice(7)] ? id.slice(7) : undefined);

/** Every disciple's mastery level above 0, for the run (exclusive paths, golden auras). */
export function masteryLevels(m: MetaSave): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of HEROES) {
    const lvl = masteryOf(m, h.id);
    if (lvl > 0) out[h.id] = lvl;
  }
  return out;
}

/** Adds a run's wins to the save's mastery and lists the levels reached. */
export function addMastery(mastery: Record<string, number> | undefined, wins: Record<string, number> | undefined): { mastery: Record<string, number>; ups: { hero: string; level: number }[] } {
  const out = { ...(mastery ?? {}) };
  const ups: { hero: string; level: number }[] = [];
  for (const [hero, n] of Object.entries(wins ?? {})) {
    if (!HERO_BY_ID[hero] || n <= 0) continue;
    const before = masteryLevel(out[hero] ?? 0);
    out[hero] = (out[hero] ?? 0) + n;
    const after = masteryLevel(out[hero]);
    for (let l = before + 1; l <= after; l++) ups.push({ hero, level: l });
  }
  return { mastery: out, ups };
}
