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
  { id: 'founder_sword', name: "Sect Founder's Sword", icon: 'sword_star', blurb: 'Attack and Crit; at level III its first Crit each fight restores Qi.' },
  { id: 'jade_seal', name: 'Ancestral Jade Seal', icon: 'amulet', blurb: 'Max HP and a Qi Shield at the start of every fight.' },
  { id: 'elder_gourd', name: "Wandering Elder's Gourd", icon: 'gourd', blurb: 'Omnivamp, and a burst of healing when its bearer falls low.' },
  { id: 'storm_banner', name: 'Storm-Calling Banner', icon: 'flag', blurb: 'Spirit, and a bolt of lightning on the nearest foe every few seconds.' },
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

const swordQi = (qi: number) => [{ id: 'founder_sword_qi', desc: 'First Crit restores Qi.', trigger: { on: 'crit' as const }, once: true, actions: [{ do: 'qi' as const, target: 'self' as const, amount: qi }] }];
const sealShield = (pct: number) => [{ id: 'jade_seal_shield', desc: 'Start shielded.', trigger: { on: 'combatStart' as const }, actions: [{ do: 'shield' as const, target: 'self' as const, scale: { maxHp: pct }, duration: 10 }] }];
const gourdHeal = (pct: number, cleanse = false) => [{ id: 'elder_gourd_heal', desc: 'Heal when low.', trigger: { on: 'hpBelow' as const, pct: 40 }, once: true, actions: [{ do: 'heal' as const, target: 'self' as const, scale: { maxHp: pct }, cleanse }] }];
const bannerBolt = (every: number, spirit: number) => [{ id: 'storm_banner_bolt', desc: 'Lightning every few seconds.', trigger: { on: 'interval' as const, every, after: 2 }, actions: [{ do: 'damage' as const, target: 'nearestEnemy' as const, scale: { spirit }, vfx: 'lightning' }] }];

export const HEIRLOOM_ITEMS: ItemDef[] = [
  H('founder_sword', 1, { stats: { attack: 12, crit: 5 }, keywords: ['Crit'] }),
  H('founder_sword', 2, { stats: { attack: 18, crit: 10 }, keywords: ['Crit'] }),
  H('founder_sword', 3, { stats: { attack: 26, crit: 15 }, desc: 'The first [Crit] each fight restores [20 Qi].', effects: swordQi(20), keywords: ['Crit', 'Qi'] }),
  H('jade_seal', 1, { stats: { hp: 150 }, desc: 'Start each fight with a [Qi Shield] of [6% Max HP].', effects: sealShield(0.06), keywords: ['Shield'] }),
  H('jade_seal', 2, { stats: { hp: 220 }, desc: 'Start each fight with a [Qi Shield] of [9% Max HP].', effects: sealShield(0.09), keywords: ['Shield'] }),
  H('jade_seal', 3, { stats: { hp: 300 }, desc: 'Start each fight with a [Qi Shield] of [12% Max HP].', effects: sealShield(0.12), keywords: ['Shield'] }),
  H('elder_gourd', 1, { stats: { omnivamp: 6 }, desc: 'Once per fight, below [40% HP], heal [15% Max HP].', effects: gourdHeal(0.15), keywords: ['Omnivamp', 'Heal'] }),
  H('elder_gourd', 2, { stats: { omnivamp: 9 }, desc: 'Once per fight, below [40% HP], heal [20% Max HP].', effects: gourdHeal(0.2), keywords: ['Omnivamp', 'Heal'] }),
  H('elder_gourd', 3, { stats: { omnivamp: 12 }, desc: 'Once per fight, below [40% HP], heal [25% Max HP] and cleanse.', effects: gourdHeal(0.25, true), keywords: ['Omnivamp', 'Heal'] }),
  H('storm_banner', 1, { stats: { spirit: 12 }, desc: 'Every 6 s, lightning strikes the nearest enemy for [60% Spirit].', effects: bannerBolt(6, 0.6), keywords: ['Lightning'] }),
  H('storm_banner', 2, { stats: { spirit: 18 }, desc: 'Every 5 s, lightning strikes the nearest enemy for [70% Spirit].', effects: bannerBolt(5, 0.7), keywords: ['Lightning'] }),
  H('storm_banner', 3, { stats: { spirit: 26 }, desc: 'Every 4 s, lightning strikes the nearest enemy for [80% Spirit].', effects: bannerBolt(4, 0.8), keywords: ['Lightning'] }),
];
