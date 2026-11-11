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
  mei_yao: {
    id: 'mei_blossom_rain',
    name: 'Plum Blossom Rain',
    desc: 'Nine-Turn Pill heals [every ally] for [80 + 110% Spirit] and [Cleanses] them, instead of one ally.',
    ability: {
      actions: [{ do: 'heal', target: 'allAllies', scale: { base: 80, spirit: 1.1 }, cleanse: true, vfx: 'sig_mei_yao' }],
    },
  },
};

/** Finds a disciple's exclusive path by its id. */
export function masteryPathById(heroId: string, pathId: string): UpgradeDef | undefined {
  const p = MASTERY_PATHS[heroId];
  return p && p.id === pathId ? p : undefined;
}
