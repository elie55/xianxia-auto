import type { ItemDef } from '@/core/types';

/**
 * Heirloom Treasures (传家宝): crafted in the sect's Artifact Forge, one carried into a run from the New Run screen,
 * and stronger each time a run is won with it (levels 1–3). They are never sold in the shop or offered by events, and
 * they are kept out of ITEMS (the Compendium and its discovery count), but ITEM_BY_ID knows them.
 * See docs/META_PROGRESSION.md, section 6.4.
 */
export interface HeirloomRecipe {
  id: string;
  name: string;
  /** Painted item icon (item_<icon>). */
  icon: string;
  /** One line for the Forge. */
  blurb: string;
}

export const HEIRLOOM_RECIPES: HeirloomRecipe[] = [
  { id: 'founder_sword', name: "Sect Founder's Sword", icon: 'founder_sword', blurb: 'When an ally falls, its bearer takes up their fight: more Attack and Attack Speed for the rest of the battle.' },
  { id: 'jade_seal', name: 'Ancestral Jade Seal', icon: 'jade_seal', blurb: "Every ally starts each fight behind a jade shield drawn from the bearer's own life." },
  { id: 'elder_gourd', name: "Wandering Elder's Gourd", icon: 'elder_gourd', blurb: 'Every few seconds the most wounded ally drinks from it: healing and Qi.' },
  { id: 'storm_banner', name: 'Storm-Calling Banner', icon: 'storm_banner', blurb: "Each technique its bearer casts rallies the whole sect and calls lightning on the bearer's target." },
];

export const HEIRLOOM_MAX_LEVEL = 3;
const ROMAN = ['', 'I', 'II', 'III'];

export function heirloomItemId(recipe: string, level: number): string {
  return `heirloom_${recipe}_${Math.max(1, Math.min(HEIRLOOM_MAX_LEVEL, level))}`;
}

const H = (recipe: string, level: number, def: Omit<ItemDef, 'id' | 'name' | 'rarity' | 'icon' | 'heirloom'>): ItemDef => {
  const r = HEIRLOOM_RECIPES.find((x) => x.id === recipe)!;
  return { id: heirloomItemId(recipe, level), name: `${r.name} ${ROMAN[level]}`, rarity: 'unique', icon: r.icon, heirloom: recipe, ...def };
};

// Unique sect effects: no shop Treasure reacts to a fallen ally, shields the whole team, tends the wounded or rallies
// allies when its bearer casts.
const resolve = (pct: number, as: number, qi = 0): ItemDef['effects'] => [
  {
    id: 'founder_resolve',
    desc: 'Grows stronger as allies fall.',
    trigger: { on: 'allyDied' },
    // two buffs per fall share one stack count: 6 = three falls
    actions: [
      { do: 'buff', target: 'self', stat: 'attack', pct, maxStacks: 6 },
      { do: 'buff', target: 'self', stat: 'attackSpeed', flat: as, maxStacks: 6 },
      ...(qi ? [{ do: 'qi' as const, target: 'self' as const, amount: qi }] : []),
    ],
  },
];
const ward = (pct: number): ItemDef['effects'] => [
  { id: 'jade_seal_ward', desc: 'Shields every ally at the start.', trigger: { on: 'combatStart' }, actions: [{ do: 'shield', target: 'allAllies', scale: { maxHp: pct }, duration: 10, vfx: 'shield' }] },
];
const wine = (every: number, maxHp: number, spirit: number, qi: number, cleanse = false): ItemDef['effects'] => [
  {
    id: 'elder_gourd_wine',
    desc: 'Tends the most wounded ally.',
    trigger: { on: 'interval', every, after: 3 },
    // Qi first, so both land on the same ally (the heal changes who is lowest)
    actions: [
      { do: 'qi', target: { kind: 'lowestHpAlly', includeSelf: true }, amount: qi },
      { do: 'heal', target: { kind: 'lowestHpAlly', includeSelf: true }, scale: { maxHp, spirit }, cleanse, vfx: 'heal_bloom' },
    ],
  },
];
const rally = (as: number, duration: number, spirit: number): ItemDef['effects'] => [
  {
    id: 'storm_banner_rally',
    desc: 'Casting rallies the sect.',
    trigger: { on: 'cast' },
    actions: [
      { do: 'buff', target: 'allAllies', stat: 'attackSpeed', flat: as, duration, unique: 'rally' },
      { do: 'damage', target: 'target', scale: { spirit }, vfx: 'lightning' },
    ],
  },
];

export const HEIRLOOM_ITEMS: ItemDef[] = [
  H('founder_sword', 1, { stats: { attack: 10, crit: 5 }, desc: 'When an ally falls, the bearer gains [+10% Attack] and [+10 Attack Speed] for the rest of the fight (up to 3 times).', effects: resolve(10, 10), keywords: ['Crit'] }),
  H('founder_sword', 2, { stats: { attack: 15, crit: 8 }, desc: 'When an ally falls, the bearer gains [+12% Attack] and [+12 Attack Speed] for the rest of the fight (up to 3 times).', effects: resolve(12, 12), keywords: ['Crit'] }),
  H('founder_sword', 3, { stats: { attack: 22, crit: 12 }, desc: 'When an ally falls, the bearer gains [25 Qi], and [+15% Attack] and [+15 Attack Speed] for the rest of the fight (up to 3 times).', effects: resolve(15, 15, 25), keywords: ['Crit', 'Qi'] }),
  H('jade_seal', 1, { stats: { hp: 150 }, desc: "At the start of each fight, every ally gains a [Qi Shield] worth [5% of the bearer's Max HP] for 10 s.", effects: ward(0.05), keywords: ['Shield'] }),
  H('jade_seal', 2, { stats: { hp: 220 }, desc: "At the start of each fight, every ally gains a [Qi Shield] worth [7% of the bearer's Max HP] for 10 s.", effects: ward(0.07), keywords: ['Shield'] }),
  H('jade_seal', 3, { stats: { hp: 300 }, desc: "At the start of each fight, every ally gains a [Qi Shield] worth [9% of the bearer's Max HP] for 10 s.", effects: ward(0.09), keywords: ['Shield'] }),
  H('elder_gourd', 1, { stats: { hp: 80, spirit: 10 }, desc: "Every 8 s, the most wounded ally drinks: heals [4% of the bearer's Max HP + 40% Spirit] and gains [6 Qi].", effects: wine(8, 0.04, 0.4, 6), keywords: ['Heal', 'Qi'] }),
  H('elder_gourd', 2, { stats: { hp: 120, spirit: 15 }, desc: "Every 7 s, the most wounded ally drinks: heals [5% of the bearer's Max HP + 50% Spirit] and gains [8 Qi].", effects: wine(7, 0.05, 0.5, 8), keywords: ['Heal', 'Qi'] }),
  H('elder_gourd', 3, { stats: { hp: 160, spirit: 20 }, desc: "Every 6 s, the most wounded ally drinks: heals [6% of the bearer's Max HP + 60% Spirit], gains [10 Qi] and is cleansed.", effects: wine(6, 0.06, 0.6, 10, true), keywords: ['Heal', 'Qi'] }),
  H('storm_banner', 1, { stats: { spirit: 10 }, desc: "When the bearer casts their technique, every ally gains [+12 Attack Speed] for 4 s and lightning strikes the bearer's target for [50% Spirit].", effects: rally(12, 4, 0.5), keywords: ['Lightning'] }),
  H('storm_banner', 2, { stats: { spirit: 15 }, desc: "When the bearer casts their technique, every ally gains [+16 Attack Speed] for 4 s and lightning strikes the bearer's target for [65% Spirit].", effects: rally(16, 4, 0.65), keywords: ['Lightning'] }),
  H('storm_banner', 3, { stats: { spirit: 22, attackSpeed: 10 }, desc: "When the bearer casts their technique, every ally gains [+20 Attack Speed] for 5 s and lightning strikes the bearer's target for [80% Spirit].", effects: rally(20, 5, 0.8), keywords: ['Lightning'] }),
];
