import type { UpgradeDef } from '@/core/types';

/**
 * Disciple mastery content (docs/META_PROGRESSION.md, section 6.6): a second page of lore (mastery I) and the first
 * exclusive fourth Dao Paths (mastery III), offered at Foundation beside a disciple's three. The rules and thresholds
 * live in src/meta/mastery.ts.
 */

/** The second page of each disciple's lore, read in the Compendium from mastery I. */
export const LORE_II: Record<string, string> = {
  li_jian: "For nine years he swept the training yard and was never taught. He learned by reading the leaves: where they fell, a strike had landed. The sword was the elders' parting gift when they cast him out. They meant it as an insult.",
  shan_tie: 'Villagers below the falls still tell of the year the river ran around a man instead of over him. He never said a word about it. Asked why he endures, he only shrugs: someone has to stand in front.',
  hong_lian: "Her first talisman burned down her family's paper shop. Her second rebuilt it, briefly, out of fire. She has been chasing the third ever since: one that burns only what she wants burned.",
  mei_yao: 'She was apprenticed to an alchemist who poisoned half a city and cured the other half in the same week. She kept his recipes and burned his notes on which was which. Her patients survive. Her enemies are less certain.',
  ying_wu: "She was raised by an assassins' guild that no longer exists. Nobody knows what happened to it. She does not talk about it, and the people who ask tend to change the subject on their own.",
  tie_quan: "He once broke a sword with his bare hand to prove a point. The point was that the sword's owner should apologise. He did.",
  xuan_bing: 'The frozen lake has a hollow at its centre where she sat for seven winters. Fish still circle it. In spring the ice there is the last to melt, as if the lake were keeping her seat.',
  lei_zhen: 'Since the tenth bolt, storms follow him from province to province. Farmers pay him to stay through the dry season and pay him more to leave before the harvest. He has never once complained about the weather.',
  long_mu: 'The dragon asked one thing for its eye: that she never shoot a creature running away. She has kept the promise. She has also become very good at standing where things will run towards her.',
  bai_hu: 'Raised by tigers, found by monks, expelled by both for his table manners. He respects strength, sunlight and anyone who can outrun him, which so far is no one.',
  qing_feng: 'He practised one thrust ten thousand times a day for twenty years. The day he mastered it, he fought a single duel, won it before his opponent finished bowing, and spent the evening apologising.',
  yue_ling: 'She was born under a lunar eclipse, which the village elders called an omen. They argued for years about what kind. When she healed the whole village through the plague winter, they stopped arguing and started bringing her tea.',
  hei_yan: 'He left the demonic sects with their most precious treasure: himself. They still send hunters. He sends them back with directions to the nearest inn and a note recommending the noodles.',
  zhu_sha: 'Her masters forbade her to test pills on herself, so she tested them on her masters. Two are still recovering. One has never felt better and will not stop telling people.',
  gu_lao: 'He was a general before he was a monk, and he remembers every soldier he lost by name. He chants them each morning. The list stopped growing the day he started walking beside his companions instead of ahead of them.',
  feng_huang: 'Each time she rises from the ashes she keeps one thing from the life before: a scar, a song, a grudge. She will not say which she kept this time, only that it was worth dying for.',
  ling_shuang: 'The nine swords belonged to nine elders who sealed a calamity beneath the glacier. When the swords followed her out, the elders came along to see who had woken them. They have not decided yet whether to be pleased.',
};

/**
 * The first exclusive fourth Dao Paths: a sidegrade beside the three a disciple already has, never stronger than the
 * best of them. Offered at Foundation once the sect's mastery of that disciple reaches III.
 */
export const MASTERY_PATHS: Record<string, UpgradeDef> = {
  li_jian: {
    id: 'li_returning_sword',
    name: 'Returning Sword',
    desc: 'Gain [+15 Attack Speed]. Flying Sword turns back and strikes its target again for [90% Attack].',
    stats: { attackSpeed: 15 },
    ability: {
      extraActions: [{ do: 'damage', target: 'target', scale: { attack: 0.9 }, kind: 'physical', projectile: 'flying_sword', vfx: 'sig_li_jian' }],
    },
  },
  shan_tie: {
    id: 'shan_mountain_embrace',
    name: "Mountain's Embrace",
    desc: 'Gain [10 Defense]. Unmoving Mountain also gives the allies beside you a [Qi Shield] of [10% of your Max HP].',
    stats: { defense: 10 },
    ability: {
      extraActions: [{ do: 'shield', target: 'alliesAdjacent', scale: { maxHp: 0.1 }, duration: 6 }],
    },
    keywords: ['Shield'],
  },
  hong_lian: {
    id: 'hong_phoenix_pyre',
    name: 'Phoenix Pyre',
    desc: 'Crimson Lotus sets [every enemy] ablaze instead of the 3 nearest, for [12 + 32% Spirit] per second for 4 s.',
    ability: {
      actions: [
        { do: 'status', target: 'allEnemies', status: 'burn', scale: { base: 12, spirit: 0.32 }, duration: 4 },
        { do: 'vfx', key: 'sig_hong_lian', target: 'allEnemies' },
      ],
    },
    keywords: ['Burn'],
  },
  ying_wu: {
    id: 'ying_thousand_shadows',
    name: 'Thousand Shadows',
    desc: 'Gain [10% Attack]. After Shadow Step, she vanishes again behind the [highest-HP enemy] and strikes it for [170% Attack].',
    statsPct: { attack: 10 },
    ability: {
      extraActions: [
        { do: 'blink', target: 'highestHpEnemy' },
        { do: 'damage', target: 'highestHpEnemy', scale: { attack: 1.7 }, kind: 'physical', vfx: 'sig_ying_wu' },
      ],
    },
  },
  tie_quan: {
    id: 'tie_unbowed_fist',
    name: 'Unbowed Fist',
    desc: 'Gain [200 HP]. Hundred Fists strikes [8] times for [50% Attack] each and [Stuns] the target for 0.6 s. Each cast still grants [10 Attack Speed].',
    stats: { hp: 200 },
    ability: {
      actions: [
        { do: 'repeat', times: 8, interval: 0.1, actions: [{ do: 'damage', target: 'target', scale: { attack: 0.5 }, kind: 'physical', vfx: 'sig_tie_quan' }] },
        { do: 'status', target: 'target', status: 'stun', duration: 0.6 },
        { do: 'buff', stat: 'attackSpeed', flat: 10 },
      ],
    },
  },
  xuan_bing: {
    id: 'xuan_winters_breath',
    name: "Winter's Breath",
    desc: 'Gain [10 Spirit]. Every [5 s], every enemy gains [6 Frost].',
    stats: { spirit: 10 },
    effects: [{ id: 'winters_breath', desc: 'Every 5 s, every enemy gains 6 Frost.', trigger: { on: 'interval', every: 5, after: 2 }, actions: [{ do: 'status', target: 'allEnemies', status: 'frost', stacks: 6, duration: 5 }] }],
    keywords: ['Frost'],
  },
  lei_zhen: {
    id: 'lei_tenth_bolt',
    name: 'The Tenth Bolt',
    desc: 'Gain [10 Spirit]. Heavenly Thunder calls a [fourth bolt] on the [highest-HP enemy] for [160% Spirit].',
    stats: { spirit: 10 },
    ability: {
      extraActions: [{ do: 'damage', target: 'highestHpEnemy', scale: { spirit: 1.6 }, vfx: 'sig_lei_zhen' }],
    },
  },
  long_mu: {
    id: 'long_dragons_promise',
    name: "Dragon's Promise",
    desc: 'Gain [15 Attack Speed]. Sun-Shooting Arrow pins every enemy it pierces: a [0.6 s Stun].',
    stats: { attackSpeed: 15 },
    ability: {
      extraActions: [{ do: 'status', target: 'lineThroughTarget', status: 'stun', duration: 0.6 }],
    },
  },
  bai_hu: {
    id: 'bai_pouncing_tiger',
    name: 'Pouncing Tiger',
    desc: 'Tiger Roar becomes a pounce: leap onto the [lowest-HP enemy], strike it for [180% Attack] and [Taunt] the enemies around you for 2 s. Still gain [10% Attack] this combat.',
    ability: {
      actions: [
        { do: 'blink', target: 'lowestHpEnemy' },
        { do: 'damage', target: 'lowestHpEnemy', scale: { attack: 1.8 }, kind: 'physical', vfx: 'sig_bai_hu' },
        { do: 'status', target: { kind: 'enemiesAdjacent', radius: 2 }, status: 'taunt', duration: 2 },
        { do: 'buff', stat: 'attack', pct: 10 },
      ],
    },
  },
  qing_feng: {
    id: 'qing_one_thrust',
    name: 'One Thrust',
    desc: 'Gale Thrust strikes only its target, for [320% Attack]. Gain [10 Crit].',
    stats: { crit: 10 },
    ability: {
      actions: [{ do: 'damage', target: 'target', scale: { attack: 3.2 }, kind: 'physical', vfx: 'sig_qing_feng' }],
    },
  },
  yue_ling: {
    id: 'yue_eclipse_omen',
    name: 'Eclipse Omen',
    desc: 'Gain [15 Spirit]. Moonlit Qi also [Weakens] every enemy: [-15% Attack] for 4 s.',
    stats: { spirit: 15 },
    ability: {
      extraActions: [{ do: 'status', target: 'allEnemies', status: 'weaken', stacks: 15, duration: 4 }],
    },
  },
  hei_yan: {
    id: 'hei_abyssal_gaze',
    name: 'Abyssal Gaze',
    desc: 'Gain [250 HP]. Obsidian Shell also [Taunts] the enemies beside you for 2 s and [Weakens] them: [-20% Attack] for 4 s.',
    stats: { hp: 250 },
    ability: {
      extraActions: [
        { do: 'status', target: { kind: 'enemiesAdjacent', radius: 1 }, status: 'taunt', duration: 2 },
        { do: 'status', target: { kind: 'enemiesAdjacent', radius: 1 }, status: 'weaken', stacks: 20, duration: 4 },
      ],
    },
  },
  zhu_sha: {
    id: 'zhu_never_the_same',
    name: 'Never the Same Pill',
    desc: 'Cinnabar Smoke also sets every enemy ablaze: [Burn] for [8 + 22% Spirit] per second for 4 s.',
    ability: {
      extraActions: [{ do: 'status', target: 'allEnemies', status: 'burn', scale: { base: 8, spirit: 0.22 }, duration: 4 }],
    },
    keywords: ['Burn'],
  },
  gu_lao: {
    id: 'gu_litany_of_names',
    name: 'Litany of Names',
    desc: 'Gain [10 Spirit]. Sutra Chant also gives every ally [+10% Attack] and [+10% Spirit] for 6 s.',
    stats: { spirit: 10 },
    ability: {
      extraActions: [
        { do: 'buff', target: 'allAllies', stat: 'attack', pct: 10, duration: 6, unique: 'gu_litany_attack' },
        { do: 'buff', target: 'allAllies', stat: 'spirit', pct: 10, duration: 6, unique: 'gu_litany_spirit' },
      ],
    },
  },
  feng_huang: {
    id: 'feng_nirvana_blaze',
    name: 'Nirvana Blaze',
    desc: 'Gain [150 HP]. The first time she dies each combat, every enemy [Burns] for [55% Spirit] per second for 4 s.',
    stats: { hp: 150 },
    effects: [{ id: 'nirvana_blaze', desc: 'Her first death sets every enemy ablaze.', trigger: { on: 'death' }, once: true, actions: [{ do: 'status', target: 'allEnemies', status: 'burn', scale: { spirit: 0.55 }, duration: 4 }] }],
    keywords: ['Burn'],
  },
  ling_shuang: {
    id: 'ling_elders_verdict',
    name: "The Elders' Verdict",
    desc: 'After the three waves, a last sword falls on [every enemy]: [45% Attack] + [20% Spirit] and [8 Frost].',
    ability: {
      extraActions: [
        { do: 'damage', target: 'allEnemies', scale: { attack: 0.45, spirit: 0.2 }, kind: 'physical', vfx: 'frost_sword_rain' },
        { do: 'status', target: 'allEnemies', status: 'frost', stacks: 8, duration: 5 },
      ],
    },
    keywords: ['Frost'],
  },
  mei_yao: {
    id: 'mei_blossom_rain',
    name: 'Plum Blossom Rain',
    desc: 'Nine-Turn Pill costs [75 Qi] instead of 60, and its blossoms also heal [every other ally] for [60% Spirit].',
    ability: {
      qiCost: 75,
      extraActions: [{ do: 'heal', target: 'otherAllies', scale: { spirit: 0.6 } }],
    },
  },
};

/** Finds a disciple's exclusive path by its id. */
export function masteryPathById(heroId: string, pathId: string): UpgradeDef | undefined {
  const p = MASTERY_PATHS[heroId];
  return p && p.id === pathId ? p : undefined;
}
