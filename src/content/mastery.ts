import type { UpgradeDef } from '@/core/types';

/**
 * Disciple mastery content (docs/META_PROGRESSION.md, section 6.6): a second page of lore (mastery I) and each
 * disciple's permanent passive (mastery V). The rules and thresholds live in src/meta/mastery.ts.
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

/** The mastery level from which a disciple carries its passive in every run. */
export const MASTERY_PASSIVE_LEVEL = 5;

/**
 * Mastery V passives: once the sect's mastery of a disciple reaches V, the disciple carries its passive in every run
 * (not in Pure runs), on top of whichever Dao Path it takes. A passive only adds to the kit (stats, effects and extra
 * technique actions in `ability.extraActions`), never a rewritten technique, a changed Qi cost or a forced move, so it
 * works with all three paths. Each is worth about a third of a Dao Path (scripts/path-balance.mts measures it).
 */
export const MASTERY_PASSIVES: Record<string, UpgradeDef> = {
  li_jian: {
    id: 'li_returning_sword',
    name: 'Returning Sword',
    desc: 'Gain [8 Attack Speed]. Flying Sword turns back and strikes its target again for [50% Attack].',
    stats: { attackSpeed: 8 },
    ability: {
      extraActions: [{ do: 'damage', target: 'target', scale: { attack: 0.5 }, kind: 'physical', projectile: 'flying_sword', vfx: 'sig_li_jian' }],
    },
  },
  shan_tie: {
    id: 'shan_mountain_embrace',
    name: "Mountain's Embrace",
    desc: 'Unmoving Mountain also gives the allies beside you a [Qi Shield] of [4% of your Max HP].',
    ability: {
      extraActions: [{ do: 'shield', target: 'alliesAdjacent', scale: { maxHp: 0.04 }, duration: 6 }],
    },
    keywords: ['Shield'],
  },
  hong_lian: {
    id: 'hong_phoenix_pyre',
    name: 'Phoenix Pyre',
    desc: 'Crimson Lotus also sets [every enemy] smouldering: [Burn] for [6 + 16% Spirit] per second for 4 s.',
    ability: {
      extraActions: [{ do: 'status', target: 'allEnemies', status: 'burn', scale: { base: 6, spirit: 0.16 }, duration: 4 }],
    },
    keywords: ['Burn'],
  },
  ying_wu: {
    id: 'ying_thousand_shadows',
    name: 'Thousand Shadows',
    desc: 'Gain [8% Attack]. A shadow of her follows Shadow Step and strikes the [lowest-HP enemy] again for [85% Attack].',
    statsPct: { attack: 8 },
    ability: {
      extraActions: [{ do: 'damage', target: 'lowestHpEnemy', scale: { attack: 0.85 }, kind: 'physical', vfx: 'sig_ying_wu' }],
    },
  },
  tie_quan: {
    id: 'tie_unbowed_fist',
    name: 'Unbowed Fist',
    desc: 'Gain [100 HP]. Hundred Fists also [Stuns] the target for 0.5 s.',
    stats: { hp: 100 },
    ability: {
      extraActions: [{ do: 'status', target: 'target', status: 'stun', duration: 0.5 }],
    },
  },
  xuan_bing: {
    id: 'xuan_winters_breath',
    name: "Winter's Breath",
    desc: 'Every [5 s], every enemy gains [2 Frost].',
    effects: [{ id: 'winters_breath', desc: 'Every 5 s, every enemy gains 2 Frost.', trigger: { on: 'interval', every: 5, after: 2 }, actions: [{ do: 'status', target: 'allEnemies', status: 'frost', stacks: 2, duration: 5 }] }],
    keywords: ['Frost'],
  },
  lei_zhen: {
    id: 'lei_tenth_bolt',
    name: 'The Tenth Bolt',
    desc: 'Heavenly Thunder calls a [fourth bolt] on the [highest-HP enemy] for [100% Spirit].',
    ability: {
      extraActions: [{ do: 'damage', target: 'highestHpEnemy', scale: { spirit: 1.0 }, vfx: 'sig_lei_zhen' }],
    },
  },
  long_mu: {
    id: 'long_dragons_promise',
    name: "Dragon's Promise",
    desc: 'Sun-Shooting Arrow pins its target: a [1 s Stun].',
    ability: {
      extraActions: [{ do: 'status', target: 'target', status: 'stun', duration: 1 }],
    },
  },
  bai_hu: {
    id: 'bai_pouncing_tiger',
    name: 'Pouncing Tiger',
    desc: 'Tiger Roar sends a spirit tiger pouncing onto the [lowest-HP enemy] for [90% Attack].',
    ability: {
      extraActions: [{ do: 'damage', target: 'lowestHpEnemy', scale: { attack: 0.9 }, kind: 'physical', vfx: 'sig_bai_hu' }],
    },
  },
  qing_feng: {
    id: 'qing_one_thrust',
    name: 'One Thrust',
    desc: 'Gain [10 Crit]. Gale Thrust drives its point into the target for another [90% Attack].',
    stats: { crit: 10 },
    ability: {
      extraActions: [{ do: 'damage', target: 'target', scale: { attack: 0.9 }, kind: 'physical', vfx: 'sig_qing_feng' }],
    },
  },
  yue_ling: {
    id: 'yue_eclipse_omen',
    name: 'Eclipse Omen',
    desc: 'Moonlit Qi also [Weakens] every enemy: [-10% Attack] for 4 s.',
    ability: {
      extraActions: [{ do: 'status', target: 'allEnemies', status: 'weaken', stacks: 10, duration: 4 }],
    },
  },
  hei_yan: {
    id: 'hei_abyssal_gaze',
    name: 'Abyssal Gaze',
    desc: 'Gain [125 HP]. Obsidian Shell also [Weakens] the enemies beside you: [-15% Attack] for 4 s.',
    stats: { hp: 125 },
    ability: {
      extraActions: [{ do: 'status', target: { kind: 'enemiesAdjacent', radius: 1 }, status: 'weaken', stacks: 15, duration: 4 }],
    },
  },
  zhu_sha: {
    id: 'zhu_never_the_same',
    name: 'Never the Same Pill',
    desc: 'Cinnabar Smoke also sets every enemy ablaze: [Burn] for [5 + 14% Spirit] per second for 4 s.',
    ability: {
      extraActions: [{ do: 'status', target: 'allEnemies', status: 'burn', scale: { base: 5, spirit: 0.14 }, duration: 4 }],
    },
    keywords: ['Burn'],
  },
  gu_lao: {
    id: 'gu_litany_of_names',
    name: 'Litany of Names',
    desc: 'Sutra Chant also gives every ally [+5% Attack] and [+5% Spirit] for 6 s.',
    ability: {
      extraActions: [
        { do: 'buff', target: 'allAllies', stat: 'attack', pct: 5, duration: 6, unique: 'gu_litany_attack' },
        { do: 'buff', target: 'allAllies', stat: 'spirit', pct: 5, duration: 6, unique: 'gu_litany_spirit' },
      ],
    },
  },
  feng_huang: {
    id: 'feng_nirvana_blaze',
    name: 'Nirvana Blaze',
    desc: 'Gain [100 HP]. The first time she dies each combat, every enemy [Burns] for [35% Spirit] per second for 4 s.',
    stats: { hp: 100 },
    effects: [{ id: 'nirvana_blaze', desc: 'Her first death sets every enemy ablaze.', trigger: { on: 'death' }, once: true, actions: [{ do: 'status', target: 'allEnemies', status: 'burn', scale: { spirit: 0.35 }, duration: 4 }] }],
    keywords: ['Burn'],
  },
  ling_shuang: {
    id: 'ling_elders_verdict',
    name: "The Elders' Verdict",
    desc: 'After the last wave, a final sword falls on [every enemy]: [35% Attack] + [15% Spirit] and [6 Frost].',
    ability: {
      extraActions: [
        { do: 'damage', target: 'allEnemies', scale: { attack: 0.35, spirit: 0.15 }, kind: 'physical', vfx: 'frost_sword_rain' },
        { do: 'status', target: 'allEnemies', status: 'frost', stacks: 6, duration: 5 },
      ],
    },
    keywords: ['Frost'],
  },
  mei_yao: {
    id: 'mei_blossom_rain',
    name: 'Plum Blossom Rain',
    desc: "Nine-Turn Pill's blossoms also heal [every other ally] for [30% Spirit].",
    ability: {
      extraActions: [{ do: 'heal', target: 'otherAllies', scale: { spirit: 0.3 } }],
    },
  },
};
