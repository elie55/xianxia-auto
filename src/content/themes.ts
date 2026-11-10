import { ENEMIES } from './enemies';

/**
 * Contract battlefields: every contract (difficulty tier) has its own battlefield and foes for each realm. Mortal keeps
 * the Azure Bamboo Province and the Blood Moon Abyss; a contract whose theme is not built yet falls back to them.
 * The Heavenly Ladder (realm 3) has one arena for every contract.
 */
export type AmbientKind = 'petals' | 'embers' | 'clouds' | 'mist';

export interface Arena {
  /** Painting under public/assets/art/bg, without the extension. */
  art: string;
  /** Board placement on the painting at 1920×1080: centre of the five rows, and the row squash. */
  layout: { centerY: number; squash: number };
  ambient: AmbientKind;
  /** Fallback stage when the painting is missing: gradient top, middle and bottom, then the floor. */
  palette: [number, number, number, number];
}

export interface ArenaTheme extends Arena {
  id: string;
  /** Contract tier (0 = Mortal). */
  tier: number;
  realm: 1 | 2;
  name: string;
  hanzi: string;
  /** Foes drawn for regular, challenge and trial fights. */
  regulars: string[];
  elites: string[];
  guardians: string[];
  /** Who stands beside the guardian. */
  escort: string[];
  /** One line about this realm, shown when the realm before it is sealed. */
  teaser: string;
  /** False while its art or sprites are still being made: the contract keeps the Mortal battlefield. */
  ready: boolean;
}

const mortalRegulars = (realm: 1 | 2) => ENEMIES.filter((e) => !e.theme && !e.boss && !e.elite && (e.realm === realm || e.realm === 'any')).map((e) => e.id);

export const THEMES: ArenaTheme[] = [
  {
    id: 'azure_bamboo',
    tier: 0,
    realm: 1,
    name: 'Azure Bamboo Province',
    hanzi: '竹',
    art: 'realm1_bamboo',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'petals',
    palette: [0x0f2a2a, 0x163d35, 0x0a1a19, 0x1d4a3d],
    regulars: mortalRegulars(1),
    elites: ['moss_golem'],
    guardians: ['flood_dragon'],
    escort: ['spirit_wolf', 'spirit_wolf'],
    teaser: 'Bamboo groves and a jade river, where the Flood Dragon coils.',
    ready: true,
  },
  {
    id: 'blood_moon_abyss',
    tier: 0,
    realm: 2,
    name: 'Blood Moon Abyss',
    hanzi: '渊',
    art: 'realm2_abyss',
    layout: { centerY: 790, squash: 0.52 },
    ambient: 'embers',
    palette: [0x2a0d14, 0x4a1420, 0x160609, 0x4a1d24],
    regulars: mortalRegulars(2),
    elites: ['demon_general'],
    guardians: ['blood_moon_sovereign'],
    escort: ['blood_bat', 'blood_bat'],
    teaser: 'Below the bamboo, the Blood Moon Sovereign stirs.',
    ready: true,
  },
  {
    id: 'misty_herb_valley',
    tier: 1,
    realm: 1,
    name: 'Misty Herb Valley',
    hanzi: '药',
    art: 'theme_misty_herb_valley',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'mist',
    palette: [0x14302a, 0x2a4a3a, 0x0c1a16, 0x2f5a44],
    // the Thunder Ape roams every battlefield (realm 'any'), as in the Mortal realms
    regulars: ['herb_spirit', 'venom_toad', 'mist_wolf', 'thornvine_serpent', 'mist_lantern', 'thunder_ape'],
    elites: ['mist_fox'],
    guardians: ['ginseng_king'],
    escort: ['mist_wolf', 'mist_wolf'],
    teaser: 'Terraced herb fields lost in mist, guarded by a thousand-year root.',
    ready: true,
  },
];

export const THEME_BY_ID: Record<string, ArenaTheme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/** The Heavenly Ladder's arena, the same on every contract. */
export const LADDER_ARENA: Arena = {
  art: 'realm3_ladder',
  layout: { centerY: 775, squash: 0.56 },
  ambient: 'clouds',
  palette: [0x101a33, 0x27345e, 0x0a0f1f, 0x1f2c55],
};

/** The battlefield of a realm on a contract: its own theme once built, else the Mortal one. */
export function themeFor(tier: number, realm: 1 | 2): ArenaTheme {
  return THEMES.find((t) => t.tier === tier && t.realm === realm && t.ready) ?? THEMES.find((t) => t.tier === 0 && t.realm === realm)!;
}

/** What the battle view paints for a realm (1, 2, or 3 for the Ladder) on a contract. */
export function arenaFor(realm: number, tier: number): Arena {
  return realm === 1 || realm === 2 ? themeFor(tier, realm) : LADDER_ARENA;
}

/** CSS filter for a recoloured variant (Compendium, encounter banner); Pixi uses a ColorMatrixFilter with the same values. */
export function lookFilter(look?: { hue?: number; saturate?: number; brightness?: number }): string | undefined {
  if (!look) return undefined;
  const parts = [look.hue ? `hue-rotate(${look.hue}deg)` : '', look.saturate !== undefined ? `saturate(${look.saturate})` : '', look.brightness !== undefined ? `brightness(${look.brightness})` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}
