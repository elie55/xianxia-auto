import { HEROES } from '@/content/heroes';
import { MASTER_TITLES, masterTitleId } from '@/meta/mastery';

/**
 * Phase-1 cosmetics (docs/META_PROGRESSION.md, sections 5.3 and 13): avatars, titles, card frames and profile banners,
 * unlocked by the Renown track, achievements, and winning a run with a disciple. Pure data.
 */
export type CosmeticKind = 'avatar' | 'title' | 'frame' | 'banner';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Avatars drawn as a brush seal. */
  hanzi?: string;
  /** Seal ink, frame or banner colour. */
  color?: string;
  /** Avatars drawn from a disciple's portrait. */
  hero?: string;
  /** Avatars drawn from a foe's sprite. */
  sprite?: string;
  /** How it is unlocked, for locked entries. */
  how?: string;
}

const seal = (id: string, hanzi: string, name: string, color: string): Cosmetic => ({ id: `seal_${id}`, kind: 'avatar', name, hanzi, color });

export const SEAL_AVATARS: Cosmetic[] = [
  seal('sect', '宗', 'Seal of the Sect', '#6fe3c4'),
  seal('sword', '剑', 'Seal of the Sword', '#f3cf78'),
  seal('pill', '丹', 'Seal of the Elixir', '#ff8a5c'),
  seal('thunder', '雷', 'Seal of Thunder', '#c9a7ff'),
  seal('cloud', '云', 'Seal of Clouds', '#e8f1f2'),
  seal('dragon', '龙', 'Seal of the Dragon', '#7fe0c8'),
  seal('moon', '月', 'Seal of the Moon', '#b9d4ff'),
  seal('mountain', '山', 'Seal of the Mountain', '#c9b38a'),
  seal('fire', '火', 'Seal of Fire', '#ff7a3c'),
  seal('phoenix', '凤', 'Seal of the Phoenix', '#ff5d6c'),
  seal('ice', '冰', 'Seal of Ice', '#8fe3ff'),
  seal('shadow', '影', 'Seal of Shadow', '#a27cff'),
  seal('wind', '风', 'Seal of Wind', '#9ff2c8'),
  seal('water', '水', 'Seal of Water', '#6fb8ff'),
  seal('lotus', '莲', 'Seal of the Lotus', '#ffb3d1'),
  seal('star', '星', 'Seal of the Stars', '#fff1a8'),
  seal('spirit', '灵', 'Seal of Spirit', '#9ae6ff'),
  seal('tiger', '虎', 'Seal of the Tiger', '#ffc35c'),
  seal('crane', '鹤', 'Seal of the Crane', '#f2efe6'),
  seal('heaven', '天', 'Seal of Heaven', '#7fc8ff'),
  seal('gold', '金', 'Seal of Gold', '#ffd76a'),
  seal('heart', '心', 'Seal of the Heart', '#ff8fa8'),
  seal('dao', '道', 'Seal of the Dao', '#f3cf78'),
  seal('immortal', '仙', 'Seal of the Immortal', '#e9fbff'),
];

export const HERO_AVATARS: Cosmetic[] = HEROES.map((h) => ({ id: `hero_${h.id}`, kind: 'avatar', name: h.name, hero: h.id, how: `Clear both realms with ${h.name} in your party.` }));

export const FOE_AVATARS: Cosmetic[] = [
  { id: 'foe_flood_dragon', kind: 'avatar', name: 'Flood Dragon', sprite: 'flood_dragon', how: 'Achievement: The Jade River Calmed.' },
  { id: 'foe_blood_moon_sovereign', kind: 'avatar', name: 'Blood Moon Sovereign', sprite: 'blood_moon_sovereign', how: 'Achievement: Ascension.' },
];

const title = (id: string, name: string): Cosmetic => ({ id, kind: 'title', name });
export const TITLES: Cosmetic[] = [
  title('wanderer', 'Wandering Cultivator'),
  title('outer', 'Outer Disciple'),
  title('inner', 'Inner Disciple'),
  title('core', 'Core Disciple'),
  title('true', 'True Disciple'),
  title('aide', "Elder's Aide"),
  title('elder', 'Sect Elder'),
  title('grand_elder', 'Grand Elder'),
  title('vice_master', 'Vice Sect Master'),
  title('master', 'Sect Master'),
  title('patriarch', 'Patriarch'),
  title('sage', 'Sage of the Nine Heavens'),
  title('saint', 'Dao Saint'),
  title('ancestor', 'Immortal Ancestor'),
  // achievement titles
  title('dragon_queller', 'Dragon Queller'),
  title('touching_heaven', 'Touching Heaven'),
  title('tribulation', 'Tribulation Survivor'),
  title('empty_hands', 'Empty-Handed Master'),
  title('archivist', 'Archivist'),
  title('hundred_schools', 'Master of a Hundred Schools'),
  // disciple mastery IV (src/meta/mastery.ts)
  ...Object.entries(MASTER_TITLES).map(([hero, name]) => title(masterTitleId(hero), name)),
];

/** Card frames: the gradient of every disciple card's pennant border. */
export const FRAMES: Cosmetic[] = [
  { id: 'gold', kind: 'frame', name: 'Gold Leaf', color: '#d4a84b' },
  { id: 'jade', kind: 'frame', name: 'Jade', color: '#6fe3c4' },
  { id: 'crimson', kind: 'frame', name: 'Crimson Lacquer', color: '#ff5d5d' },
  { id: 'ink', kind: 'frame', name: 'Ink and Silver', color: '#cfd8dc' },
  { id: 'moon', kind: 'frame', name: 'Moonlight', color: '#b9d4ff' },
  { id: 'violet', kind: 'frame', name: 'Violet Thunder', color: '#b89cff' },
  { id: 'celestial', kind: 'frame', name: 'Celestial', color: '#fff1c2' },
];

/** Profile banners: the colour of the sect plate on the menu. */
export const BANNERS: Cosmetic[] = [
  { id: 'jade', kind: 'banner', name: 'Jade Banner', color: '#3fbf9f' },
  { id: 'azure', kind: 'banner', name: 'Azure Banner', color: '#4c8dff' },
  { id: 'crimson', kind: 'banner', name: 'Crimson Banner', color: '#d2382c' },
  { id: 'gold', kind: 'banner', name: 'Gold Banner', color: '#d4a84b' },
  { id: 'violet', kind: 'banner', name: 'Violet Banner', color: '#8e6cf5' },
  { id: 'ink', kind: 'banner', name: 'Ink Banner', color: '#5b6b6e' },
  { id: 'dawn', kind: 'banner', name: 'Dawn Banner', color: '#ff9a6b' },
  { id: 'celestial', kind: 'banner', name: 'Celestial Banner', color: '#9fe6ff' },
];

export const ALL_COSMETICS: Cosmetic[] = [...SEAL_AVATARS, ...HERO_AVATARS, ...FOE_AVATARS, ...TITLES, ...FRAMES, ...BANNERS];
const BY_KEY = new Map(ALL_COSMETICS.map((c) => [`${c.kind}:${c.id}`, c]));
export function cosmetic(kind: CosmeticKind, id: string): Cosmetic | undefined {
  return BY_KEY.get(`${kind}:${id}`);
}

/** What every sect starts with. */
export const DEFAULT_COSMETICS: Record<CosmeticKind, string> = { avatar: 'seal_sect', title: 'wanderer', frame: 'gold', banner: 'jade' };

export interface TrackReward {
  level: number;
  kind: CosmeticKind;
  id: string;
}

const R = (level: number, kind: CosmeticKind, id: string): TrackReward => ({ level, kind, id });

/** One reward per Renown level, 2–50. Phase 2 inserts the sect's buildings into this track. */
export const RENOWN_TRACK: TrackReward[] = [
  R(2, 'avatar', 'seal_sword'),
  R(3, 'banner', 'azure'),
  R(4, 'title', 'outer'),
  R(5, 'avatar', 'seal_pill'),
  R(6, 'frame', 'jade'),
  R(7, 'avatar', 'seal_thunder'),
  R(8, 'title', 'inner'),
  R(9, 'avatar', 'seal_cloud'),
  R(10, 'avatar', 'seal_dragon'),
  R(11, 'banner', 'crimson'),
  R(12, 'title', 'core'),
  R(13, 'avatar', 'seal_moon'),
  R(14, 'frame', 'crimson'),
  R(15, 'avatar', 'seal_mountain'),
  R(16, 'title', 'true'),
  R(17, 'avatar', 'seal_fire'),
  R(18, 'banner', 'gold'),
  R(19, 'title', 'aide'),
  R(20, 'avatar', 'seal_phoenix'),
  R(21, 'avatar', 'seal_ice'),
  R(22, 'frame', 'ink'),
  R(23, 'title', 'elder'),
  R(24, 'avatar', 'seal_shadow'),
  R(25, 'avatar', 'seal_wind'),
  R(26, 'banner', 'violet'),
  R(27, 'title', 'grand_elder'),
  R(28, 'avatar', 'seal_water'),
  R(29, 'avatar', 'seal_lotus'),
  R(30, 'frame', 'moon'),
  R(31, 'title', 'vice_master'),
  R(32, 'avatar', 'seal_star'),
  R(33, 'avatar', 'seal_spirit'),
  R(34, 'banner', 'ink'),
  R(35, 'title', 'master'),
  R(36, 'avatar', 'seal_tiger'),
  R(37, 'avatar', 'seal_crane'),
  R(38, 'frame', 'violet'),
  R(39, 'title', 'patriarch'),
  R(40, 'avatar', 'seal_heaven'),
  R(41, 'avatar', 'seal_gold'),
  R(42, 'banner', 'dawn'),
  R(43, 'title', 'sage'),
  R(44, 'avatar', 'seal_heart'),
  R(45, 'avatar', 'seal_dao'),
  R(46, 'frame', 'celestial'),
  R(47, 'title', 'saint'),
  R(48, 'avatar', 'seal_immortal'),
  R(49, 'banner', 'celestial'),
  R(50, 'title', 'ancestor'),
];

export const KIND_LABEL: Record<CosmeticKind, string> = { avatar: 'Avatar', title: 'Title', frame: 'Card frame', banner: 'Banner' };
