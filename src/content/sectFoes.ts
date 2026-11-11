import type { EnemyDef } from '@/core/types';

/**
 * Foes met through sect events (docs/META_PROGRESSION.md 6.8): the Crimson Cloud Sect's disciples, who wait in Realm I in
 * place of the elite once the sect accepts their challenge, and the Heart Demon, met alone at the Heavenly Trial. The
 * encounter generator never draws them (Realm I pools are the contracts' own lists, and the Ladder skips Realm I foes).
 * The three rivals together cost about what the Realm I elite fight does (an elite of 6 and about 4 of regulars).
 */
export const SECT_FOES: EnemyDef[] = [
  {
    id: 'crimson_swordsman',
    name: 'Crimson Cloud Swordsman',
    hanzi: '赤霞剑修',
    baseStats: { hp: 560, attack: 36, attackSpeed: 10, crit: 15, defense: 20, range: 1 },
    attackInterval: 0.95,
    ability: {
      id: 'crimson_sword_qi',
      name: 'Crimson Sword Qi',
      desc: 'A crimson slash for 160% Attack that makes the target Bleed.',
      qiCost: 50,
      animation: 'attack',
      actions: [
        { do: 'damage', target: 'target', scale: { attack: 1.6 }, kind: 'physical', vfx: 'fire_slash' },
        { do: 'status', target: 'target', status: 'bleed', scale: { attack: 0.25 }, duration: 3 },
      ],
    },
    sprite: 'crimson_swordsman',
    cost: 2.5,
    realm: 1,
    accent: '#e0473a',
    classes: ['sword'],
  },
  {
    id: 'crimson_adept',
    name: 'Crimson Cloud Talisman Adept',
    hanzi: '赤霞符修',
    baseStats: { hp: 380, attack: 18, spirit: 48, crit: 5, defense: 12, range: 4 },
    attackInterval: 1.2,
    ability: {
      id: 'blazing_talisman',
      name: 'Blazing Talisman',
      desc: 'A fire talisman bursts on the target and those beside it for 90% Spirit and sets them Burning.',
      qiCost: 55,
      actions: [
        { do: 'damage', target: { kind: 'enemiesAroundTarget', radius: 1 }, scale: { spirit: 0.9 }, vfx: 'talisman_blast' },
        { do: 'status', target: { kind: 'enemiesAroundTarget', radius: 1 }, status: 'burn', scale: { base: 6, spirit: 0.3 }, duration: 4 },
      ],
    },
    sprite: 'crimson_adept',
    projectile: 'fire_talisman',
    cost: 2.5,
    realm: 1,
    accent: '#ff7a3d',
    classes: ['talisman'],
  },
  {
    id: 'crimson_senior',
    name: 'Crimson Cloud Senior Brother',
    hanzi: '赤霞师兄',
    baseStats: { hp: 1700, attack: 44, crit: 10, defense: 35, range: 1, moveSpeed: 1.8 },
    attackInterval: 1.3,
    ability: {
      id: 'senior_rebuke',
      name: "Senior Brother's Rebuke",
      desc: 'Sweeps his glaive around him for 140% Attack and rallies his juniors: +25 Attack Speed for 5 s.',
      qiCost: 65,
      animation: 'attack',
      actions: [
        { do: 'damage', target: { kind: 'enemiesAdjacent', radius: 1 }, scale: { attack: 1.4 }, kind: 'physical', vfx: 'spear_sweep' },
        { do: 'buff', target: 'allAllies', stat: 'attackSpeed', flat: 25, duration: 5, unique: 'senior_rally' },
      ],
    },
    passives: [{ id: 'sect_pride', name: 'Sect Pride', desc: 'Below 50% HP: +30% Attack.', trigger: { on: 'hpBelow', pct: 50 }, once: true, actions: [{ do: 'buff', target: 'self', stat: 'attack', pct: 30 }] }],
    sprite: 'crimson_senior',
    scale: 1.15,
    elite: true,
    cost: 5,
    realm: 1,
    accent: '#c8322a',
    bounty: 5,
  },
  {
    id: 'heart_demon',
    name: 'Heart Demon',
    hanzi: '心魔',
    baseStats: { hp: 800, attack: 28, spirit: 20, crit: 15, defense: 15, omnivamp: 15, range: 1 },
    attackInterval: 1.0,
    ability: {
      id: 'whispered_doubt',
      name: 'Whispered Doubt',
      desc: 'Strikes at the doubt in its foe for 150% Attack and freezes them with dread: Stunned for 1 s.',
      qiCost: 55,
      animation: 'attack',
      actions: [
        { do: 'damage', target: 'target', scale: { attack: 1.5 }, kind: 'physical', vfx: 'shadow_slash' },
        { do: 'status', target: 'target', status: 'stun', duration: 1 },
      ],
    },
    // it wears the face of whoever faces it, and doubt left alone grows: a duel a sturdy champion cannot simply outlast
    passives: [
      {
        id: 'mirror_of_doubt',
        name: 'Mirror of Doubt',
        desc: "As the duel begins it takes its foe's shape: at least 70% of their Attack and Defense, and their Max HP.",
        trigger: { on: 'combatStart' },
        actions: [{ do: 'custom', id: 'heartMirror', params: { share: 0.7, hpShare: 1 } }],
      },
      {
        id: 'growing_doubt',
        name: 'Growing Doubt',
        desc: 'Every 6 s it gains +15% Attack.',
        trigger: { on: 'interval', every: 6, after: 6 },
        actions: [{ do: 'buff', target: 'self', stat: 'attack', pct: 15 }],
      },
    ],
    sprite: 'heart_demon',
    cost: 3,
    realm: 1,
    accent: '#8a4dff',
  },
];

/** The Crimson Cloud disciples who answer an accepted challenge: their Senior Brother and his two juniors. */
export const RIVAL_FOES = ['crimson_senior', 'crimson_swordsman', 'crimson_adept'];
