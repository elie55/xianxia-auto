import type { ClassId, EffectDef, Rank, RelicDef } from '@/core/types';

/**
 * Doctrines (docs/META_PROGRESSION.md, section 6.3): one optional start-of-run choice, learned in the Doctrine Hall.
 * Each has an upside and a cost. Team stats and battle effects ride on "virtual" Dao Insights that only the team
 * context reads (never shown or counted as Insights); the run-level parts are read by src/core/run.ts and the payout.
 */
export interface DoctrineDef {
  id: string;
  name: string;
  hanzi: string;
  /** Painted icon. */
  icon: string;
  /** The class it favours, if any. */
  class?: ClassId;
  /** Rich text: what it gives. */
  upside: string;
  /** Rich text: what it costs. */
  cost: string;
  /** Team stats and battle effects, applied like Dao Insights. */
  relics?: RelicDef[];
  run?: {
    /** Added to the starting Spirit Stones (negative: fewer). */
    startStones?: number;
    /** Added to the reserve's slots (negative: fewer). */
    reserve?: number;
    /** Added to every Treasure's shop price. */
    itemPrice?: number;
    /** Extra foe HP, like a contract modifier. */
    enemyHpPct?: number;
    /** Extra Sect Renown and Sect Funds the run pays, in %. */
    payoutPct?: number;
    /** Treasures and Dao Insights the shop shows, added to the usual counts. */
    shopItems?: number;
    shopRelics?: number;
    /** Added to each shop reroll's price. */
    rerollCost?: number;
    /** Added to the Spirit Stones each won fight pays. */
    stonesPerFight?: number;
    /** Disciples of this class join at this rank at least. */
    joinRank?: { class: ClassId; rank: Rank };
  };
}

const effect = (id: string, rest: Omit<EffectDef, 'id' | 'desc'>): EffectDef => ({ id: `doctrine_${id}`, desc: '', ...rest });
const virtual = (id: string, name: string, rest: Partial<RelicDef>): RelicDef => ({ id: `doctrine_${id}`, name, rarity: 'unique', icon: 'creed', desc: '', ...rest });

export const DOCTRINES: DoctrineDef[] = [
  {
    id: 'wandering',
    name: 'Wandering Cultivator',
    hanzi: '游',
    icon: 'relic_wind',
    upside: 'The run pays [+20%] Sect Renown and Sect Funds.',
    cost: 'No help in battle.',
    run: { payoutPct: 20 },
  },
  {
    id: 'herbs',
    name: 'Hundred Herbs Valley',
    hanzi: '药',
    icon: 'class_alchemist',
    upside: "Every disciple's healing is [+15%] stronger.",
    cost: 'Start with [10 fewer] Spirit Stones.',
    relics: [virtual('herbs', 'Hundred Herbs Valley', { effects: [effect('herbs_heal', { trigger: { on: 'passive' }, actions: [{ do: 'counter', key: 'healPct', add: 15 }] })] })],
    run: { startStones: -10 },
  },
  {
    id: 'iron',
    name: 'Iron Mountain',
    hanzi: '山',
    icon: 'class_body',
    class: 'body',
    upside: 'Body Refiners gain [+15% Max HP].',
    cost: 'Every disciple has [-10 Attack Speed].',
    relics: [
      virtual('iron_hp', 'Iron Mountain', { teamStats: { class: 'body', statsPct: { hp: 15 } } }),
      virtual('iron_as', 'Iron Mountain', { teamStats: { stats: { attackSpeed: -10 } } }),
    ],
  },
  {
    id: 'merchant',
    name: "Merchant's Way",
    hanzi: '商',
    icon: 'relic_merchant',
    upside: 'Shops show [1 more] Treasure.',
    cost: 'Each fight won pays [1 fewer] Spirit Stone.',
    run: { shopItems: 1, stonesPerFight: -1 },
  },
  {
    id: 'fists',
    name: 'Thousand Fists',
    hanzi: '拳',
    icon: 'class_martial',
    class: 'martial',
    upside: 'Martial Artists gain [+15 Attack Speed].',
    cost: 'Shop rerolls cost [1 more] Spirit Stone.',
    relics: [virtual('fists', 'Thousand Fists', { teamStats: { class: 'martial', stats: { attackSpeed: 15 } } })],
    run: { rerollCost: 1 },
  },
  {
    id: 'talisman',
    name: 'Talisman Court',
    hanzi: '符',
    icon: 'class_talisman',
    class: 'talisman',
    upside: 'Talisman Masters start every fight with [15 Qi].',
    cost: 'Treasures cost [2 more] Spirit Stones.',
    relics: [virtual('talisman', 'Talisman Court', { effects: [effect('talisman_qi', { trigger: { on: 'combatStart' }, actions: [{ do: 'qi', target: 'self', amount: 15 }], scope: 'class', class: 'talisman' })] })],
    run: { itemPrice: 2 },
  },
  {
    id: 'shadow',
    name: 'Shadow Pavilion',
    hanzi: '影',
    icon: 'class_shadow',
    class: 'shadow',
    upside: "A Shadow Walker's first attack in every fight is a [Crit].",
    cost: 'Foes have [+5% HP].',
    relics: [virtual('shadow', 'Shadow Pavilion', { effects: [effect('shadow_first', { trigger: { on: 'passive' }, actions: [{ do: 'counter', key: 'firstHitCrit', add: 1 }], scope: 'class', class: 'shadow' })] })],
    run: { enemyHpPct: 5 },
  },
  {
    id: 'frost',
    name: 'Frost Lattice',
    hanzi: '霜',
    icon: 'class_array',
    class: 'array',
    upside: "Array Masters' hits apply [3 Frost].",
    cost: '[1 fewer] reserve slot.',
    relics: [
      virtual('frost', 'Frost Lattice', {
        effects: [effect('frost_hit', { trigger: { on: 'hit' }, actions: [{ do: 'status', target: 'triggerTarget', status: 'frost', stacks: 3, duration: 5 }], scope: 'class', class: 'array' })],
      }),
    ],
    run: { reserve: -1 },
  },
  {
    id: 'sword',
    name: 'Sword Peak',
    hanzi: '剑',
    icon: 'class_sword',
    class: 'sword',
    upside: 'Sword Cultivators join at [Foundation] rank.',
    cost: 'Shops show [1 fewer] Dao Insight.',
    run: { joinRank: { class: 'sword', rank: 1 }, shopRelics: -1 },
  },
];

export const DOCTRINE_BY_ID = Object.fromEntries(DOCTRINES.map((d) => [d.id, d])) as Record<string, DoctrineDef>;
