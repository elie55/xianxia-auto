import type { RunState } from '@/core/run';

/**
 * Sect Renown: the account level (docs/META_PROGRESSION.md, section 5). Every run pays XP, win or lose; levels raise
 * the sect's rank and pay out the reward track (src/meta/cosmetics.ts). Pure: no store access, so it is unit tested.
 */
export const MAX_RENOWN = 50;

/** XP needed to go from `level` to `level + 1` (levels 1–49). */
export function xpToNext(level: number): number {
  if (level >= MAX_RENOWN) return 0;
  if (level < 10) return 120;
  if (level < 30) return 120 + 30 * (level - 10);
  return 720 + 20 * (level - 30);
}

/** Total XP needed to reach `level` from nothing (level 1 = 0, level 10 = 1,080, level 30 = 9,180, level 50 = 27,380). */
export function cumulativeXp(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, MAX_RENOWN); l++) total += xpToNext(l);
  return total;
}

export interface RenownLevel {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level needs (0 at the cap). */
  need: number;
  /** 0–1 progress through the current level (1 at the cap). */
  frac: number;
}

export function levelOf(xp: number): RenownLevel {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (level < MAX_RENOWN && left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  const need = xpToNext(level);
  return { level, into: level >= MAX_RENOWN ? 0 : left, need, frac: need ? left / need : 1 };
}

export const SECT_RANKS: { level: number; name: string; hanzi: string }[] = [
  { level: 1, name: 'Humble Sect', hanzi: '宗' },
  { level: 10, name: 'Rising Sect', hanzi: '兴' },
  { level: 20, name: 'Established Sect', hanzi: '立' },
  { level: 30, name: 'Great Sect', hanzi: '盛' },
  { level: 40, name: 'Holy Land', hanzi: '圣' },
  { level: 50, name: 'Immortal Sect', hanzi: '仙' },
];

export function rankOf(level: number): { level: number; name: string; hanzi: string; index: number } {
  let index = 0;
  for (let i = 0; i < SECT_RANKS.length; i++) if (level >= SECT_RANKS[i].level) index = i;
  return { ...SECT_RANKS[index], index };
}

/** Harder contracts pay more: × (1 + 0.15 × tier). */
export function contractMultiplier(tier: number): number {
  return Math.round((1 + 0.15 * Math.max(0, tier)) * 100) / 100;
}

export const RENOWN_XP = {
  fight: 10,
  challenge: 20,
  elite: 30,
  guardian: 60,
  realm1: 60,
  realm2: 100,
  floor: 40,
  discovery: 5,
} as const;

export interface RenownLine {
  key: string;
  label: string;
  count?: number;
  xp: number;
  /** Medal for the line (an Icon name). */
  icon: string;
}

export interface RunRenown {
  lines: RenownLine[];
  /** XP from fights and realms before the contract multiplier. */
  base: number;
  multiplier: number;
  /** What the contract multiplier added. */
  contractBonus: number;
  discoveries: number;
  achievements: number;
  total: number;
}

/**
 * What a finished run pays in Renown XP, from its fight history: 10 per fight won, 20 per challenge or Heavenly Trial,
 * 30 per elite, 60 per guardian or Ladder warden, 60 for Realm I, 100 for Realm II, 40 per Ladder floor, all × the
 * contract multiplier; then 5 per new Compendium entry and the XP of the achievements earned during the run.
 */
export function computeRunRenown(s: RunState, achievementXp = 0): RunRenown {
  const won = (s.history ?? []).filter((h) => h.won);
  const count = (pred: (k: string, realm: number) => boolean) => won.filter((h) => pred(h.kind, h.realm)).length;
  const fights = count((k) => k === 'fight');
  const challenges = count((k) => k === 'challenge' || k === 'single' || k === 'trial');
  const elites = count((k) => k === 'elite');
  const guardians = count((k) => k === 'boss');
  const realm1 = won.some((h) => h.kind === 'boss' && h.realm === 1);
  const realm2 = won.some((h) => h.kind === 'boss' && h.realm === 2);
  const floors = count((k, realm) => k === 'boss' && realm === 3);
  const lines: RenownLine[] = [];
  const add = (key: string, label: string, n: number, each: number, icon: string) => {
    if (n > 0) lines.push({ key, label, count: n, xp: n * each, icon });
  };
  add('fights', 'Fights won', fights, RENOWN_XP.fight, 'node_fight');
  add('challenges', 'Challenges and trials', challenges, RENOWN_XP.challenge, 'node_challenge');
  add('elites', 'Elites defeated', elites, RENOWN_XP.elite, 'node_elite');
  add('guardians', 'Guardians defeated', guardians, RENOWN_XP.guardian, 'node_boss');
  if (realm1) lines.push({ key: 'realm1', label: 'Realm I sealed', xp: RENOWN_XP.realm1, icon: 'ui_trophy' });
  if (realm2) lines.push({ key: 'realm2', label: 'Realm II sealed', xp: RENOWN_XP.realm2, icon: 'ui_trophy' });
  add('floors', 'Ladder floors cleared', floors, RENOWN_XP.floor, 'ui_leaderboard');
  const base = lines.reduce((a, l) => a + l.xp, 0);
  const multiplier = contractMultiplier(s.tier);
  const contractBonus = Math.round(base * multiplier) - base;
  if (contractBonus > 0) lines.push({ key: 'contract', label: `Contract bonus ×${multiplier.toFixed(2)}`, xp: contractBonus, icon: 'ui_rank' });
  const discoveries = Math.max(0, s.discovered ?? 0);
  add('discoveries', 'New Compendium entries', discoveries, RENOWN_XP.discovery, 'ui_compendium');
  if (achievementXp > 0) lines.push({ key: 'achievements', label: 'Achievements', count: s.achievementsEarned?.length, xp: achievementXp, icon: 'ui_star' });
  const total = base + contractBonus + discoveries * RENOWN_XP.discovery + achievementXp;
  return { lines, base, multiplier, contractBonus, discoveries, achievements: achievementXp, total };
}
