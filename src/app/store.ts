import { computed, signal } from '@preact/signals';
import type { RunState } from '@/core/run';

export type Screen = 'menu' | 'newRun' | 'run' | 'settings' | 'compendium' | 'credits' | 'renown' | 'sect';

/** The player's sect as shown on the menu and the Renown screen (docs/META_PROGRESSION.md). */
export interface MetaProfile {
  sectName: string;
  /** Cosmetic ids (src/meta/cosmetics.ts). */
  avatar: string;
  title: string;
  frame: string;
  banner: string;
}

/** Totals over every run, for the Records tab and for achievements that span runs. */
export interface LifetimeStats {
  runs: number;
  wins: number;
  fights: number;
  fightsWon: number;
  kills: number;
  crits: number;
  damage: number;
  bestHit: number;
  stonesEarned: number;
  /** Highest Heavenly Ladder floor reached (0: never climbed). */
  bestFloor: number;
  playMs: number;
  /** Challenge ids won at least once. */
  challengesWon: string[];
  /** Disciple ids that were in the party when both realms were cleared. */
  winnersWith: string[];
}

export interface MetaSave {
  unlockedTier: number;
  runsPlayed: number;
  runsWon: number;
  bestEndless: number;
  bestTierCleared: number;
  /** score counts Ladder nodes, (floor − 1) × 12 + node; floor is stored from save version 2 on. */
  leaderboard: { name: string; score: number; tier: number; date: number; floor?: number }[];
  settings: {
    music: number;
    sfx: number;
    autoBattle: boolean;
    battleSpeed: 1 | 2 | 3;
    screenShake: boolean;
    showDamage: boolean;
    fullscreen?: boolean;
    textScale?: number;
    /** Master volume (0–1), applied on top of music and effects. */
    master?: number;
    /** Silence the game while its window is in the background. */
    muteUnfocused?: boolean;
    /** Hover delay before a tooltip opens, in ms. */
    tooltipDelay?: number;
    /** Ask before selling a disciple or a Treasure. */
    confirmSell?: boolean;
    /** Colour-vision palette for teams, rarities and damage types. */
    palette?: 'default' | 'deutan' | 'tritan';
    /** Fewer flashes, shakes and moving effects. Unset: follow the operating system's setting. */
    reduceMotion?: boolean;
    /** The battle camera follows the fight and leans in on techniques and kills (default on). */
    battleCamera?: boolean;
    /** Frame-rate cap for the battle renderer (0 = uncapped). */
    frameCap?: 0 | 30 | 60;
  };
  seenTutorial: boolean;
  /** Tutorial chapters already shown (by id). */
  tutorialSeen: string[];
  /** Player skipped the tutorial: never show chapters again. */
  tutorialDisabled: boolean;
  /** Compendium discovery: ids of the disciples, Treasures, Dao Insights and foes met in any run. */
  seen?: { heroes: string[]; items: string[]; relics: string[]; enemies: string[] };
  /** Save version: 2 adds Sect Renown, achievements, the profile and lifetime stats (src/meta/migrate.ts). */
  version?: number;
  profile?: MetaProfile;
  /** Sect Renown: total XP earned; the level is derived from it (src/meta/renown.ts). */
  renown?: { xp: number };
  /** Achievement id → unlock time (ms). */
  achievements?: Record<string, number>;
  lifetime?: LifetimeStats;
  /** The Sect (src/meta/sect.ts, read through sectOf): Funds and materials, building levels, studies, seals, heirlooms, bounties. */
  sect?: {
    purse?: { funds: number; herbs: number; cores: number; jade: number };
    buildings?: { pavilion: number; forge: number; recruit?: number };
    research?: string[];
    seals?: string[];
    heirlooms?: { id: string; level: number }[];
    bounties?: { active?: string[]; done?: string[] };
    carry?: string;
    /** Exclusive disciples recruited in the Recruitment Hall. */
    disciples?: string[];
  };
}

const META_KEY = 'nine-heavens:meta';
const RUN_KEY = 'nine-heavens:run';

export const defaultMeta = (): MetaSave => ({
  unlockedTier: 0,
  runsPlayed: 0,
  runsWon: 0,
  bestEndless: 0,
  bestTierCleared: -1,
  leaderboard: [],
  settings: { music: 0.6, sfx: 0.8, autoBattle: false, battleSpeed: 1, screenShake: true, showDamage: true },
  seenTutorial: false,
  tutorialSeen: [],
  tutorialDisabled: false,
});

function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { ...defaultMeta(), ...JSON.parse(raw), settings: { ...defaultMeta().settings, ...(JSON.parse(raw).settings ?? {}) } };
  } catch {
    /* ignore */
  }
  return defaultMeta();
}

export const meta = signal<MetaSave>(loadMeta());
export const screen = signal<Screen>('menu');
/** Where the Compendium's Back button leads (the pause menu opens it from a run). */
export const compendiumReturn = signal<Screen>('menu');
export const run = signal<RunState | null>(null);
export const toast = signal<{ id: number; text: string; kind: 'info' | 'error' | 'gold' } | null>(null);
export const hasSavedRun = signal<boolean>(!!localStorage.getItem(RUN_KEY));

export const phase = computed(() => run.value?.phase ?? null);

let toastId = 0;
export function showToast(text: string, kind: 'info' | 'error' | 'gold' = 'info'): void {
  toast.value = { id: ++toastId, text, kind };
  const id = toastId;
  setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2200);
}

export function saveMeta(): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta.value));
}

export function updateMeta(fn: (m: MetaSave) => void): void {
  const m = structuredClone(meta.value);
  fn(m);
  meta.value = m;
  saveMeta();
}

export function saveRun(): void {
  const s = run.value;
  if (!s) {
    localStorage.removeItem(RUN_KEY);
    hasSavedRun.value = false;
    return;
  }
  if (s.phase === 'runEnd') {
    localStorage.removeItem(RUN_KEY);
    hasSavedRun.value = false;
    return;
  }
  // battle phase saves as 'board' so a reload re-enters placement; the last battle's record is kept so the
  // result screen still has its stats after a reload
  const copy: RunState = { ...s, phase: s.phase === 'battle' ? 'board' : s.phase };
  localStorage.setItem(RUN_KEY, JSON.stringify(copy));
  hasSavedRun.value = true;
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RunState;
    if (s.version !== 1) return null;
    // forward-compatible defaults for fields added after a save was written
    s.heroTotals ??= {};
    s.log ??= [];
    s.inventory ??= [];
    s.relics ??= [];
    s.pendingRankUps ??= [];
    s.rankUpResume ??= 'board';
    s.lastResult ??= null;
    return s;
  } catch {
    return null;
  }
}

export function clearSavedRun(): void {
  localStorage.removeItem(RUN_KEY);
  hasSavedRun.value = false;
}

/** Mutates the current run through a run.ts function and notifies subscribers. */
export function act(fn: (s: RunState) => void): void {
  const s = run.value;
  if (!s) return;
  fn(s);
  run.value = { ...s };
  saveRun();
}

export function setRun(s: RunState | null): void {
  run.value = s;
  saveRun();
}
