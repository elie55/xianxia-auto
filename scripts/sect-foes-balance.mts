/**
 * Sect event foes against what they replace (docs/META_PROGRESSION.md 6.8), on the first four contracts:
 *  - the Crimson Cloud disciples against Realm I's elite fight, with the same team (Shan Tie and Bai Hu in front, a
 *    carry, Mei Yao healing; rank II from a rank I base so they meet the node's level as a real run would);
 *  - the Heart Demon against Realm I's Heavenly Trial, fought alone by each of a few champions.
 * Prints wins and the fight margin (the side's HP left minus the enemies', in percent).
 *   npx tsx scripts/sect-foes-balance.mts [fights per contract, default 100] [rank 0-2, default 1]
 */
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { generateEncounter, placeEnemies, tribulationLevel } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { ALLY_MAX_COL, BOARD_ROWS, offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { RIVAL_FOES } from '@/content/sectFoes';
import type { Rank } from '@/core/types';

const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const FIGHTS = Number(process.argv[2] ?? 100);
const rank = Number(process.argv[3] ?? 1) as Rank;
const mk = (defId: string): HeroState => ({ uid: defId, defId, rank, insightIds: [], items: [], permanent: [], daoPathId: rank >= 1 ? HERO_BY_ID[defId].daoPaths[0].id : undefined });

function fight(allies: ReturnType<typeof buildHeroUnit>[], defIds: string[], positions: ReturnType<typeof placeEnemies> | null, level: number, seed: number) {
  const pos = positions ?? placeEnemies(defIds, new Rng(seed));
  const enemies = pos.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], level, 100 + i, e.pos));
  const b = new Battle({ seed, allies, enemies });
  const res = b.run();
  const left = (side: 'ally' | 'enemy') => {
    const us = b.units.filter((u) => u.side === side && !u.isSummon);
    return us.reduce((a, u) => a + Math.max(0, u.hp), 0) / Math.max(1, us.reduce((a, u) => a + u.maxHp, 0));
  };
  return { won: res.winner === 'ally', margin: (left('ally') - left('enemy')) * 100 };
}

const team = () =>
  ([['shan_tie', [3, 1]], ['bai_hu', [3, 3]], ['li_jian', [2, 2]], ['mei_yao', [1, 0]]] as const).map(([id, at], i) => buildHeroUnit(mk(id), ctx, i + 1, offsetToAxial(at[0], at[1]), true));

console.log(`rank ${rank}, ${FIGHTS} fights per contract`);
for (const tier of [0, 1, 2, 3]) {
  const level = tribulationLevel(1, 7, tier);
  let elite = { wins: 0, margin: 0 };
  let rival = { wins: 0, margin: 0 };
  for (let seed = 1; seed <= FIGHTS; seed++) {
    const enc = generateEncounter(1, 7, 'elite', tier, new Rng(seed));
    const a = fight(team(), [], enc.enemies, level, seed);
    elite = { wins: elite.wins + (a.won ? 1 : 0), margin: elite.margin + a.margin / FIGHTS };
    const r = fight(team(), RIVAL_FOES, null, level, seed);
    rival = { wins: rival.wins + (r.won ? 1 : 0), margin: rival.margin + r.margin / FIGHTS };
  }
  console.log(`contract ${tier} (level ${level}): Realm I elite wins ${elite.wins}/${FIGHTS} margin ${elite.margin.toFixed(1)} · Crimson Cloud wins ${rival.wins}/${FIGHTS} margin ${rival.margin.toFixed(1)}`);
}

const champions = ['li_jian', 'shan_tie', 'hong_lian', 'bai_hu', 'mei_yao'];
for (const tier of [0, 1, 2, 3]) {
  const level = tribulationLevel(1, 6, tier);
  const row: string[] = [];
  for (const champ of champions) {
    let trial = 0;
    let demon = 0;
    for (let seed = 1; seed <= FIGHTS; seed++) {
      const solo = () => [buildHeroUnit(mk(champ), ctx, 1, offsetToAxial(ALLY_MAX_COL, Math.floor(BOARD_ROWS / 2)), true)];
      const enc = generateEncounter(1, 6, 'single', tier, new Rng(seed));
      if (fight(solo(), [], enc.enemies, level, seed).won) trial++;
      if (fight(solo(), ['heart_demon'], null, level, seed).won) demon++;
    }
    row.push(`${champ} ${trial}/${demon}`);
  }
  console.log(`contract ${tier} (level ${level}) Heavenly Trial / Heart Demon wins: ${row.join(' · ')}`);
}
