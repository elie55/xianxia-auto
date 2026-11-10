import { ENEMIES } from './enemies';

/**
 * Contract battlefields: every contract (difficulty tier) has its own battlefield and foes for each realm. Mortal keeps
 * the Azure Bamboo Province and the Blood Moon Abyss; a contract whose theme is not built yet falls back to them.
 * The Heavenly Ladder (realm 3) has one arena for every contract.
 */
export type AmbientKind =
  | 'petals'
  | 'embers'
  | 'clouds'
  | 'mist'
  | 'wisps'
  | 'dust'
  | 'bubbles'
  | 'ash'
  | 'snow'
  | 'spores'
  | 'storm'
  | 'wind'
  | 'sand'
  | 'void'
  | 'tribulation'
  | 'celestial';

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
  {
    id: 'bone_marsh',
    tier: 1,
    realm: 2,
    name: 'Wailing Bone Marsh',
    hanzi: '尸',
    art: 'theme_bone_marsh',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'wisps',
    palette: [0x141f1b, 0x22352c, 0x0a110e, 0x2a3b31],
    regulars: ['jiangshi', 'bone_crow', 'carrion_bat', 'marsh_shaman', 'bog_golem', 'thunder_ape'],
    elites: ['corpse_puppeteer'],
    guardians: ['jiangshi_patriarch'],
    escort: ['carrion_bat', 'carrion_bat'],
    teaser: 'A marsh of coffins and wisps, where the Jiangshi Patriarch holds court.',
    ready: true,
  },
  {
    id: 'jade_quarry',
    tier: 2,
    realm: 1,
    name: 'Jade Quarry Peaks',
    hanzi: '玉',
    art: 'theme_jade_quarry',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'dust',
    palette: [0x1b2c27, 0x2f4d40, 0x101b17, 0x3d5c4c],
    regulars: ['jade_scorpion', 'quarry_imp', 'rock_demon', 'jade_wolf', 'renegade_miner', 'thunder_ape'],
    elites: ['stone_lion'],
    guardians: ['jade_colossus'],
    escort: ['jade_wolf', 'jade_wolf'],
    teaser: 'Cliffs veined with jade, where a colossus half-carved from the mountain wakes.',
    ready: true,
  },
  {
    id: 'drowned_ruins',
    tier: 2,
    realm: 2,
    name: 'Drowned Sect Ruins',
    hanzi: '溺',
    art: 'theme_drowned_ruins',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'bubbles',
    palette: [0x0b2a33, 0x124552, 0x061a20, 0x1a5060],
    regulars: ['drowned_disciple', 'spirit_eel', 'drowned_soldier', 'abyss_stalker', 'gloom_bat', 'thunder_ape'],
    elites: ['coral_elder'],
    guardians: ['kraken_elder'],
    escort: ['gloom_bat', 'gloom_bat'],
    teaser: 'A sect lost beneath the lake, ruled by the Abyssal Kraken Elder.',
    ready: true,
  },
  {
    id: 'furnace_volcano',
    tier: 3,
    realm: 1,
    name: 'Vermilion Furnace Volcano',
    hanzi: '炉',
    art: 'theme_furnace_volcano',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'embers',
    palette: [0x2a0f08, 0x4a1e0e, 0x160704, 0x5a2a14],
    regulars: ['fire_salamander', 'lava_imp', 'ember_wolf', 'magma_serpent', 'fire_lantern', 'thunder_ape'],
    elites: ['molten_golem'],
    guardians: ['furnace_tyrant'],
    escort: ['ember_wolf', 'ember_wolf'],
    teaser: "An alchemists' fortress on a living volcano, where the Furnace Tyrant burns.",
    ready: true,
  },
  {
    id: 'ash_wastes',
    tier: 3,
    realm: 2,
    name: 'Ashen Pill Wastes',
    hanzi: '灰',
    art: 'theme_ash_wastes',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'ash',
    palette: [0x24231f, 0x3a3830, 0x141310, 0x4a463a],
    regulars: ['pill_abomination', 'ash_ghoul', 'ash_golem', 'ash_necromancer', 'ash_soldier', 'thunder_ape'],
    elites: ['pill_brute'],
    guardians: ['mad_alchemist'],
    escort: ['ash_ghoul', 'ash_ghoul'],
    teaser: 'The ashes of a great pill gone wrong, and the Mad Alchemist who brewed it.',
    ready: true,
  },
  {
    id: 'frozen_north',
    tier: 4,
    realm: 1,
    name: 'Frozen Northern Wastes',
    hanzi: '冰',
    art: 'theme_frozen_north',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'snow',
    palette: [0x16263a, 0x2a4560, 0x0c1622, 0x3a5a78],
    regulars: ['ice_wraith', 'snow_yeti', 'frost_wolf', 'frozen_treant', 'frostbitten_cultist', 'thunder_ape'],
    elites: ['frost_maiden'],
    guardians: ['glacier_qilin'],
    escort: ['frost_wolf', 'frost_wolf'],
    teaser: 'A frozen outpost under the aurora, watched by the Glacier Qilin.',
    ready: true,
  },
  {
    id: 'soul_forest',
    tier: 4,
    realm: 2,
    name: 'Soul-Devouring Forest',
    hanzi: '噬',
    art: 'theme_soul_forest',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'spores',
    palette: [0x1a1028, 0x2c1a40, 0x0d0816, 0x2e2240],
    regulars: ['soul_moth', 'vine_beast', 'forest_stalker', 'soul_bat', 'hollow_shaman', 'thunder_ape'],
    elites: ['hollow_hunter'],
    guardians: ['heart_demon_tree'],
    escort: ['soul_bat', 'soul_bat'],
    teaser: 'A forest that feeds on souls, rooted in the Heart Demon Tree.',
    ready: true,
  },
  {
    id: 'thunder_plateau',
    tier: 5,
    realm: 1,
    name: 'Thunder Plateau',
    hanzi: '雷',
    art: 'theme_thunder_plateau',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'storm',
    palette: [0x121a2a, 0x223048, 0x0a0f1a, 0x2c3a52],
    regulars: ['lightning_hawk', 'storm_ram', 'storm_wolf', 'storm_lantern', 'thunder_serpent', 'thunder_ape'],
    elites: ['thunder_shaman'],
    guardians: ['thunder_roc'],
    escort: ['storm_wolf', 'storm_wolf'],
    teaser: 'A plateau of endless storms, where the Thunder Roc nests.',
    ready: true,
  },
  {
    id: 'sky_isles',
    tier: 5,
    realm: 2,
    name: 'Shattered Sky Isles',
    hanzi: '空',
    art: 'theme_sky_isles',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'wind',
    palette: [0x2a4a6a, 0x5a7ea0, 0x1a2e44, 0x6a8aa8],
    regulars: ['wind_demon', 'cloud_serpent', 'gale_bat', 'sky_soldier', 'cloud_stalker', 'thunder_ape'],
    elites: ['sky_pirate'],
    guardians: ['tempest_lord'],
    escort: ['gale_bat', 'gale_bat'],
    teaser: 'Islands broken loose above the clouds, where the Tempest Demon Lord reigns.',
    ready: true,
  },
  {
    id: 'starfall_desert',
    tier: 6,
    realm: 1,
    name: 'Starfall Desert',
    hanzi: '星',
    art: 'theme_starfall_desert',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'sand',
    palette: [0x10142e, 0x2a2a52, 0x0a0c1c, 0x6a5232],
    regulars: ['star_scarab', 'meteor_golem', 'dune_jackal', 'sand_viper', 'sand_demon', 'thunder_ape'],
    elites: ['star_witch'],
    guardians: ['sandworm'],
    escort: ['dune_jackal', 'dune_jackal'],
    teaser: 'Dunes strewn with fallen stars, and the Sandworm that swallows them.',
    ready: true,
  },
  {
    id: 'void_rift',
    tier: 6,
    realm: 2,
    name: 'Void Rift',
    hanzi: '虚',
    art: 'theme_void_rift',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'void',
    palette: [0x120a20, 0x2a1240, 0x08040e, 0x2a1a3a],
    regulars: ['void_horror', 'mirror_shade', 'void_stalker', 'void_mage', 'void_flesh_golem', 'thunder_ape'],
    elites: ['rift_warden'],
    guardians: ['void_devourer'],
    escort: ['void_horror', 'void_horror'],
    teaser: 'A realm torn open to the void, where the Void Devourer waits.',
    ready: true,
  },
  {
    id: 'tribulation_peak',
    tier: 7,
    realm: 1,
    name: 'Tribulation Peak',
    hanzi: '劫',
    art: 'theme_tribulation_peak',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'tribulation',
    palette: [0x160c22, 0x2c1640, 0x0a0612, 0x3a2a3a],
    regulars: ['heavenly_soldier', 'thunder_spirit', 'failed_ascendant', 'tribulation_lantern', 'tribulation_wolf', 'thunder_ape'],
    elites: ['trib_enforcer'],
    guardians: ['trib_avatar'],
    escort: ['tribulation_wolf', 'tribulation_wolf'],
    teaser: 'The summit of the heavenly tribulation, where the lightning itself takes form.',
    ready: true,
  },
  {
    id: 'heaven_gate',
    tier: 7,
    realm: 2,
    name: 'Ninth Heaven Gate',
    hanzi: '天',
    art: 'theme_heaven_gate',
    layout: { centerY: 740, squash: 0.62 },
    ambient: 'celestial',
    palette: [0x3a3020, 0x6a5a3a, 0x201a10, 0x8a7a5a],
    regulars: ['celestial_guard', 'heavenly_crane', 'gate_sentinel', 'heavenly_scribe', 'golden_crow', 'thunder_ape'],
    elites: ['celestial_general'],
    guardians: ['dao_enforcer'],
    escort: ['golden_crow', 'golden_crow'],
    teaser: 'The last gate of heaven, held by the Heavenly Dao Enforcer.',
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

/**
 * The colour matrix of a recolour, exactly as CSS applies `hue-rotate() saturate() brightness()` (Filter Effects spec),
 * as the 20 values of a Pixi ColorMatrixFilter. Using the spec's matrices keeps a variant the same colour in battle as
 * in the Compendium and the encounter banner (Pixi's own hue() rotates differently).
 */
export function lookMatrix(look: { hue?: number; saturate?: number; brightness?: number }): number[] {
  const r = ((look.hue ?? 0) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const H = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
  const t = look.saturate ?? 1;
  const S = [
    [0.213 + 0.787 * t, 0.715 - 0.715 * t, 0.072 - 0.072 * t],
    [0.213 - 0.213 * t, 0.715 + 0.285 * t, 0.072 - 0.072 * t],
    [0.213 - 0.213 * t, 0.715 - 0.715 * t, 0.072 + 0.928 * t],
  ];
  const b = look.brightness ?? 1;
  const M = S.map((row) => [0, 1, 2].map((j) => (row[0] * H[0][j] + row[1] * H[1][j] + row[2] * H[2][j]) * b));
  return [...M[0], 0, 0, ...M[1], 0, 0, ...M[2], 0, 0, 0, 0, 0, 1, 0];
}

/** CSS filter for a recoloured variant (Compendium, encounter banner); battle uses lookMatrix with the same values. */
export function lookFilter(look?: { hue?: number; saturate?: number; brightness?: number }): string | undefined {
  if (!look) return undefined;
  const parts = [look.hue ? `hue-rotate(${look.hue}deg)` : '', look.saturate !== undefined ? `saturate(${look.saturate})` : '', look.brightness !== undefined ? `brightness(${look.brightness})` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}
