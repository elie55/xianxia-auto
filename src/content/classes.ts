import type { ClassId, Scale, Stats, UpgradeDef } from '@/core/types';

export interface ClassDef {
  id: ClassId;
  name: string;
  hanzi: string;
  role: string;
  desc: string;
  mechanics: string;
  color: string;
  /** Per-rank growth: pct multipliers and flat adds. */
  growthPct: Partial<Stats>;
  growthFlat: Partial<Stats>;
  attackScale: Scale;
  insights: UpgradeDef[];
}

const ins = (classPool: ClassId, id: string, name: string, desc: string, rest: Partial<UpgradeDef> = {}): UpgradeDef => ({
  id: `${classPool}_${id}`,
  name,
  desc,
  classPool,
  ...rest,
});

export const CLASSES: Record<ClassId, ClassDef> = {
  sword: {
    id: 'sword',
    name: 'Sword Cultivator',
    hanzi: '剑',
    role: 'Damage',
    desc: 'Sword Cultivators turn Attack and Crit into devastating flying-sword strikes.',
    mechanics: 'Crit, Surge, Flying Swords',
    color: '#e8c25a',
    growthPct: { attack: 15 },
    growthFlat: { crit: 5 },
    attackScale: { attack: 1.2 },
    insights: [
      ins('sword', 'keen_edge', 'Keen Edge', 'Gain [20 Crit].', { stats: { crit: 20 } }),
      ins('sword', 'sword_rain', 'Sword Rain', 'On [Crit], a sword shard hits another enemy near the target for [50% Attack].', {
        effects: [
          {
            id: 'sword_rain',
            desc: 'On Crit, hit another nearby enemy for 50% Attack.',
            trigger: { on: 'crit' },
            actions: [{ do: 'damage', target: { kind: 'enemiesAroundTarget', count: 1 }, scale: { attack: 0.5 }, kind: 'physical', canCrit: false, vfx: 'sword_shard' }],
          },
        ],
      }),
      ins('sword', 'heart_of_the_blade', 'Heart of the Blade', 'Gain [25% Attack].', { statsPct: { attack: 25 } }),
      ins('sword', 'first_strike', 'First Strike', '[Surge (6)]: gain [40 Crit] and [30 Attack Speed].', {
        effects: [
          {
            id: 'first_strike',
            name: 'First Strike',
            desc: 'Surge (6): +40 Crit, +30 Attack Speed.',
            trigger: { on: 'surge', duration: 6 },
            actions: [
              { do: 'buff', stat: 'crit', flat: 40 },
              { do: 'buff', stat: 'attackSpeed', flat: 30 },
            ],
            keywords: ['Surge'],
          },
        ],
      }),
      ins('sword', 'sword_intent', 'Sword Intent', 'Every [Crit] permanently grants [2 Attack] this combat.', {
        effects: [
          { id: 'sword_intent', desc: 'On Crit, +2 Attack for the fight.', trigger: { on: 'crit' }, actions: [{ do: 'buff', stat: 'attack', flat: 2 }] },
        ],
      }),
      ins('sword', 'qi_blade', 'Qi Blade', 'Auto-attacks grant [5] extra Qi.', {
        effects: [{ id: 'qi_blade', desc: 'Auto-attacks grant 5 extra Qi.', trigger: { on: 'autoAttack' }, actions: [{ do: 'qi', target: 'self', amount: 5 }] }],
      }),
      ins('sword', 'executioner', "Executioner's Edge", 'Deal [+35%] damage to enemies below [40%] HP.', {
        effects: [
          {
            id: 'executioner',
            desc: 'Bonus damage to low enemies.',
            trigger: { on: 'hit' },
            conditions: [{ if: 'targetHpBelow', pct: 40 }],
            actions: [{ do: 'damage', target: 'triggerTarget', scale: { triggerAmount: 0.35 }, kind: 'true', canCrit: false }],
          },
        ],
      }),
      ins('sword', 'steel_body', 'Tempered Steel', 'Gain [250 HP] and [15 Defense].', { stats: { hp: 250, defense: 15 } }),
    ],
  },
  body: {
    id: 'body',
    name: 'Body Refiner',
    hanzi: '体',
    role: 'Tank',
    desc: 'Body Refiners use Max HP to absorb and dish out damage.',
    mechanics: 'Qi Shield, Taunt, Max HP',
    color: '#5fb8d6',
    growthPct: { hp: 20 },
    growthFlat: { defense: 10 },
    attackScale: { attack: 0.8 },
    insights: [
      ins('body', 'mountain_heart', 'Mountain Heart', 'Gain [400 HP].', { stats: { hp: 400 } }),
      ins('body', 'iron_will', 'Iron Will', 'Gain [30 Defense].', { stats: { defense: 30 } }),
      ins('body', 'riposte', 'Riposte', 'While [Shielded], reflect [25%] of damage taken to the attacker.', {
        effects: [
          {
            id: 'riposte',
            desc: 'Reflect 25% damage while shielded.',
            trigger: { on: 'damaged' },
            conditions: [{ if: 'shielded' }],
            actions: [{ do: 'damage', target: 'triggerTarget', scale: { triggerAmount: 0.25 }, kind: 'true', canCrit: false }],
          },
        ],
      }),
      ins('body', 'bulwark_stance', 'Bulwark Stance', 'At combat start gain a [Qi Shield] equal to [20% Max HP].', {
        effects: [
          { id: 'bulwark_stance', desc: 'Start with a 20% Max HP shield.', trigger: { on: 'combatStart' }, actions: [{ do: 'shield', target: 'self', scale: { maxHp: 0.2 }, duration: 12 }] },
        ],
      }),
      ins('body', 'provoke', 'Provoke', '[Enlightenment (5)]: [Taunt] all enemies within 2 hexes for 4 s.', {
        effects: [
          {
            id: 'provoke',
            name: 'Provoke',
            desc: 'Enlightenment (5): taunt nearby enemies.',
            trigger: { on: 'enlightenment', at: 5 },
            actions: [{ do: 'status', target: { kind: 'enemiesAdjacent', radius: 2 }, status: 'taunt', duration: 4 }],
            keywords: ['Enlightenment', 'Taunt'],
          },
        ],
      }),
      ins('body', 'regeneration', 'Vital Regeneration', 'Heal [2% Max HP] every second.', {
        effects: [{ id: 'regeneration', desc: 'Heal 2% Max HP per second.', trigger: { on: 'interval', every: 1 }, actions: [{ do: 'heal', target: 'self', scale: { maxHp: 0.02 } }] }],
      }),
      ins('body', 'heavy_hands', 'Heavy Hands', 'Auto-attacks deal bonus damage equal to [3% Max HP].', {
        effects: [{ id: 'heavy_hands', desc: 'Auto-attacks +3% Max HP damage.', trigger: { on: 'autoAttack' }, actions: [{ do: 'damage', target: 'triggerTarget', scale: { maxHp: 0.03 }, kind: 'physical', canCrit: false }] }],
      }),
      ins('body', 'unbreakable', 'Unbreakable', 'When [Shielded], gain [25 Defense].', {
        effects: [
          {
            id: 'unbreakable',
            desc: 'On gaining a shield, +25 Defense for 6 s.',
            trigger: { on: 'shieldGained' },
            actions: [{ do: 'buff', stat: 'defense', flat: 25, duration: 6, unique: 'unbreakable' }],
          },
        ],
      }),
    ],
  },
  talisman: {
    id: 'talisman',
    name: 'Talisman Master',
    hanzi: '符',
    role: 'Mage',
    desc: 'Talisman Masters channel Spirit into burning and thundering talismans.',
    mechanics: 'Burn, Lightning, Spirit',
    color: '#ff7a45',
    growthPct: { spirit: 20 },
    growthFlat: { qiRegen: 2 },
    attackScale: { attack: 0.6, spirit: 0.4 },
    insights: [
      ins('talisman', 'spirit_well', 'Spirit Well', 'Gain [40 Spirit].', { stats: { spirit: 40 } }),
      ins('talisman', 'overflow', 'Qi Overflow', 'After casting, refund [20 Qi].', {
        effects: [{ id: 'overflow', desc: 'Casts refund 20 Qi.', trigger: { on: 'cast' }, actions: [{ do: 'qi', target: 'self', amount: 20 }] }],
      }),
      ins('talisman', 'ember_touch', 'Ember Touch', 'Auto-attacks apply [Burn] for [30% Spirit] per second for 3 s.', {
        effects: [{ id: 'ember_touch', desc: 'Auto-attacks burn.', trigger: { on: 'autoAttack' }, actions: [{ do: 'status', target: 'triggerTarget', status: 'burn', scale: { spirit: 0.3 }, duration: 3 }] }],
      }),
      ins('talisman', 'meditation_focus', 'Focused Meditation', 'Gain [4 Qi Regen].', { stats: { qiRegen: 4 } }),
      ins('talisman', 'thunderclap', 'Thunderclap', 'On cast, strike the target with lightning for [80% Spirit] and [Stun] 0.5 s.', {
        effects: [
          {
            id: 'thunderclap',
            desc: 'Casts also stun the target.',
            trigger: { on: 'cast' },
            actions: [
              { do: 'damage', target: 'target', scale: { spirit: 0.8 }, vfx: 'lightning' },
              { do: 'status', target: 'target', status: 'stun', duration: 0.5 },
            ],
          },
        ],
      }),
      ins('talisman', 'arcane_ward', 'Arcane Ward', 'Convert [60% Spirit] into [Defense] at combat start.', {
        effects: [{ id: 'arcane_ward', desc: 'Spirit → Defense.', trigger: { on: 'combatStart' }, actions: [{ do: 'convertStat', from: 'spirit', to: 'defense', ratio: 0.6 }] }],
      }),
      ins('talisman', 'wildfire', 'Wildfire', 'Enemies you [Burn] take [+20%] damage from your abilities.', {
        effects: [
          {
            id: 'wildfire',
            desc: 'Bonus ability damage to burning targets.',
            trigger: { on: 'hit' },
            conditions: [{ if: 'triggerWasAbility' }, { if: 'targetHasStatus', status: 'burn' }],
            actions: [{ do: 'damage', target: 'triggerTarget', scale: { triggerAmount: 0.2 }, kind: 'true', canCrit: false }],
          },
        ],
      }),
      ins('talisman', 'grand_ritual', 'Grand Ritual', 'Gain [20% Spirit] and start combat with [30 Qi].', { statsPct: { spirit: 20 }, stats: { qi: 30 } }),
    ],
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    hanzi: '丹',
    role: 'Support',
    desc: 'Alchemists brew pills that heal, shield and poison.',
    mechanics: 'Heal, Poison, Qi',
    color: '#8fdc4b',
    growthPct: { spirit: 12, hp: 10 },
    growthFlat: {},
    attackScale: { attack: 0.6, spirit: 0.3 },
    insights: [
      ins('alchemist', 'lingering_pill', 'Lingering Pill', 'Your heals also grant a [Qi Shield] of [40%] of the amount healed.', {
        effects: [{ id: 'lingering_pill', desc: 'Heals grant 40% shields.', trigger: { on: 'healed' }, actions: [{ do: 'shield', target: 'triggerTarget', scale: { triggerAmount: 0.4 }, duration: 6 }] }],
      }),
      ins('alchemist', 'vitality_pill', 'Vitality Pill', 'Gain [300 HP] and [25 Spirit].', { stats: { hp: 300, spirit: 25 } }),
      ins('alchemist', 'toxic_brew', 'Toxic Brew', 'Auto-attacks apply [2 Poison].', {
        effects: [{ id: 'toxic_brew', desc: 'Auto-attacks poison.', trigger: { on: 'autoAttack' }, actions: [{ do: 'status', target: 'triggerTarget', status: 'poison', stacks: 2 }] }],
      }),
      ins('alchemist', 'qi_pill', 'Qi Pill', 'Every 3 s grant [8 Qi] to the ally with the lowest HP.', {
        effects: [{ id: 'qi_pill', desc: 'Periodic Qi to lowest ally.', trigger: { on: 'interval', every: 3 }, actions: [{ do: 'qi', target: 'lowestHpAlly', amount: 8 }] }],
      }),
      ins('alchemist', 'panacea', 'Panacea', 'On cast, [Cleanse] all allies.', {
        effects: [{ id: 'panacea', desc: 'Casts cleanse allies.', trigger: { on: 'cast' }, actions: [{ do: 'cleanse', target: 'allAllies' }] }],
      }),
      ins('alchemist', 'golden_elixir', 'Golden Elixir', '[Enlightenment (12)]: allies gain [15% Max HP].', {
        effects: [
          {
            id: 'golden_elixir',
            name: 'Golden Elixir',
            desc: 'Enlightenment (12): allies +15% Max HP.',
            trigger: { on: 'enlightenment', at: 12 },
            actions: [{ do: 'buff', stat: 'hp', pct: 15, target: 'allAllies' }],
            keywords: ['Enlightenment'],
          },
        ],
      }),
      ins('alchemist', 'bitter_pill', 'Bitter Pill', 'Your heals deal [30%] of the amount as [magic damage] to the nearest enemy.', {
        effects: [{ id: 'bitter_pill', desc: 'Heals also damage.', trigger: { on: 'healed' }, actions: [{ do: 'damage', target: 'nearestEnemy', scale: { triggerAmount: 0.3 }, vfx: 'poison_puff' }] }],
      }),
      ins('alchemist', 'herbal_wisdom', 'Herbal Wisdom', 'Gain [20% Spirit] and [3 Qi Regen].', { statsPct: { spirit: 20 }, stats: { qiRegen: 3 } }),
    ],
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow Walker',
    hanzi: '影',
    role: 'Assassin',
    desc: 'Shadow Walkers hunt the weakest enemy with Crit, Poison and executions.',
    mechanics: 'Crit, Poison, Execute',
    color: '#b57cff',
    growthPct: { attack: 10 },
    growthFlat: { crit: 8 },
    attackScale: { attack: 1.1 },
    insights: [
      ins('shadow', 'bloodlust', 'Bloodlust', 'Kills restore [15% Max HP] and grant [10 Attack Speed].', {
        effects: [
          {
            id: 'bloodlust',
            desc: 'Kills heal and speed up.',
            trigger: { on: 'kill' },
            actions: [
              { do: 'heal', target: 'self', scale: { maxHp: 0.15 } },
              { do: 'buff', stat: 'attackSpeed', flat: 10 },
            ],
          },
        ],
      }),
      ins('shadow', 'lethal_precision', 'Lethal Precision', 'Gain [25 Crit].', { stats: { crit: 25 } }),
      ins('shadow', 'venom_coat', 'Venom Coat', 'On [Crit] apply [2 Poison].', {
        effects: [{ id: 'venom_coat', desc: 'Crits poison.', trigger: { on: 'crit' }, actions: [{ do: 'status', target: 'triggerTarget', status: 'poison', stacks: 2 }] }],
      }),
      ins('shadow', 'death_mark', 'Death Mark', 'Enemies below [20%] HP take [+50%] damage from you.', {
        effects: [
          {
            id: 'death_mark',
            desc: 'Bonus damage to nearly dead enemies.',
            trigger: { on: 'hit' },
            conditions: [{ if: 'targetHpBelow', pct: 20 }],
            actions: [{ do: 'damage', target: 'triggerTarget', scale: { triggerAmount: 0.5 }, kind: 'true', canCrit: false }],
          },
        ],
      }),
      ins('shadow', 'shadow_veil', 'Shadow Veil', 'At combat start gain a [Qi Shield] of [30% Max HP] for 5 s.', {
        effects: [{ id: 'shadow_veil', desc: 'Start shielded.', trigger: { on: 'combatStart' }, actions: [{ do: 'shield', target: 'self', scale: { maxHp: 0.3 }, duration: 5 }] }],
      }),
      ins('shadow', 'swift_blades', 'Swift Blades', 'Gain [30 Attack Speed].', { stats: { attackSpeed: 30 } }),
      ins('shadow', 'opportunist', 'Opportunist', '[Surge (8)]: [+60 Crit].', {
        effects: [{ id: 'opportunist', name: 'Opportunist', desc: 'Surge (8): +60 Crit.', trigger: { on: 'surge', duration: 8 }, actions: [{ do: 'buff', stat: 'crit', flat: 60 }], keywords: ['Surge'] }],
      }),
      ins('shadow', 'poison_mastery', 'Poison Mastery', 'Your [Poison] applications are doubled.', {
        effects: [{ id: 'poison_mastery', desc: 'Poison doubled.', trigger: { on: 'statusApplied', status: 'poison' }, actions: [{ do: 'custom', id: 'noop' }] }],
      }),
    ],
  },
  martial: {
    id: 'martial',
    name: 'Martial Artist',
    hanzi: '武',
    role: 'Duelist',
    desc: 'Martial Artists win drawn-out duels with Attack Speed and Omnivamp.',
    mechanics: 'Attack Speed, Omnivamp, Enlightenment',
    color: '#ff5d7a',
    growthPct: { attack: 10 },
    growthFlat: { attackSpeed: 15 },
    attackScale: { attack: 1.0 },
    insights: [
      ins('martial', 'flurry', 'Flurry', 'Gain [35 Attack Speed].', { stats: { attackSpeed: 35 } }),
      ins('martial', 'blood_drinking', 'Blood-Drinking Fist', 'Gain [12% Omnivamp].', { stats: { omnivamp: 12 } }),
      ins('martial', 'tempo', 'Rising Tempo', 'Every auto-attack grants [2 Attack Speed] (max 40).', {
        effects: [{ id: 'tempo', desc: 'Stacking attack speed.', trigger: { on: 'autoAttack' }, actions: [{ do: 'buff', stat: 'attackSpeed', flat: 2, maxStacks: 20 }] }],
      }),
      ins('martial', 'iron_fist', 'Iron Fist', 'Gain [20% Attack].', { statsPct: { attack: 20 } }),
      ins('martial', 'second_wind', 'Second Wind', '[Enlightenment (15)]: heal [40% Max HP] and gain [30 Attack Speed].', {
        effects: [
          {
            id: 'second_wind',
            name: 'Second Wind',
            desc: 'Enlightenment (15): heal and speed up.',
            trigger: { on: 'enlightenment', at: 15 },
            actions: [
              { do: 'heal', target: 'self', scale: { maxHp: 0.4 } },
              { do: 'buff', stat: 'attackSpeed', flat: 30 },
            ],
            keywords: ['Enlightenment'],
          },
        ],
      }),
      ins('martial', 'crushing_blow', 'Crushing Blow', 'Every 4th auto-attack deals [+120% Attack] bonus damage and [Sunders] 5 Defense.', {
        effects: [
          {
            id: 'crushing_blow',
            desc: 'Every 4th attack crushes.',
            trigger: { on: 'autoAttack' },
            cooldown: 0.01,
            actions: [{ do: 'counter', key: 'crush', add: 1 }],
          },
          {
            id: 'crushing_blow_hit',
            desc: '',
            trigger: { on: 'autoAttack' },
            conditions: [{ if: 'counterAtLeast', key: 'crush', value: 4 }],
            actions: [
              { do: 'counter', key: 'crush', add: -4 },
              { do: 'damage', target: 'triggerTarget', scale: { attack: 1.2 }, kind: 'physical', vfx: 'impact' },
              { do: 'status', target: 'triggerTarget', status: 'sunder', stacks: 5 },
            ],
          },
        ],
      }),
      ins('martial', 'duelist_focus', "Duelist's Focus", 'Hitting the same enemy grants [1% Attack] per hit this combat (max 50).', {
        effects: [{ id: 'duelist_focus', desc: 'Stacking attack.', trigger: { on: 'autoAttack' }, actions: [{ do: 'buff', stat: 'attack', pct: 1, maxStacks: 50 }] }],
      }),
      ins('martial', 'hardened', 'Hardened Body', 'Gain [300 HP] and [10 Defense].', { stats: { hp: 300, defense: 10 } }),
    ],
  },
  array: {
    id: 'array',
    name: 'Array Master',
    hanzi: '阵',
    role: 'Mystic',
    desc: 'Array Masters control the battlefield with Frost, debuffs and Qi.',
    mechanics: 'Frost, Debuffs, Meditation',
    color: '#7fd6ff',
    growthPct: { spirit: 15 },
    growthFlat: { qi: 5 },
    attackScale: { attack: 0.7, spirit: 0.3 },
    insights: [
      ins('array', 'chill_winds', 'Chill Winds', 'Auto-attacks apply [3 Frost].', {
        effects: [{ id: 'chill_winds', desc: 'Auto-attacks frost.', trigger: { on: 'autoAttack' }, actions: [{ do: 'status', target: 'triggerTarget', status: 'frost', stacks: 3 }] }],
      }),
      ins('array', 'spirit_lattice', 'Spirit Lattice', 'Gain [35 Spirit] and [2 Qi Regen].', { stats: { spirit: 35, qiRegen: 2 } }),
      ins('array', 'binding_array', 'Binding Array', 'At combat start, [Weaken] all enemies by [15%] for 10 s.', {
        effects: [{ id: 'binding_array', desc: 'Weaken enemies at start.', trigger: { on: 'combatStart' }, actions: [{ do: 'status', target: 'allEnemies', status: 'weaken', stacks: 15, duration: 10 }] }],
      }),
      ins('array', 'qi_circulation', 'Qi Circulation', 'On cast, allies gain [10 Qi].', {
        effects: [{ id: 'qi_circulation', desc: 'Casts give allies Qi.', trigger: { on: 'cast' }, actions: [{ do: 'qi', target: 'otherAllies', amount: 10 }] }],
      }),
      ins('array', 'glacial_core', 'Glacial Core', 'Enemies with [Frost] take [+25%] damage from you.', {
        effects: [
          {
            id: 'glacial_core',
            desc: 'Bonus damage to frosted enemies.',
            trigger: { on: 'hit' },
            conditions: [{ if: 'targetHasStatus', status: 'frost' }],
            actions: [{ do: 'damage', target: 'triggerTarget', scale: { triggerAmount: 0.25 }, kind: 'true', canCrit: false }],
          },
        ],
      }),
      ins('array', 'protective_array', 'Protective Array', 'Every 5 s shield the lowest-HP ally for [80% Spirit].', {
        effects: [{ id: 'protective_array', desc: 'Periodic shields.', trigger: { on: 'interval', every: 5 }, actions: [{ do: 'shield', target: 'lowestHpAlly', scale: { spirit: 0.8 } }] }],
      }),
      ins('array', 'far_sight', 'Far Sight', 'Gain [+1 Range] and [15% Spirit].', { stats: { range: 1 }, statsPct: { spirit: 15 } }),
      ins('array', 'mind_palace', 'Mind Palace', 'Start combat with [40 Qi].', { stats: { qi: 40 } }),
    ],
  },
};

export const CLASS_LIST: ClassDef[] = Object.values(CLASSES);

export function classInsights(classes: ClassId[]): UpgradeDef[] {
  const out: UpgradeDef[] = [];
  for (const c of classes) out.push(...CLASSES[c].insights);
  return out;
}
