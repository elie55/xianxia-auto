/**
 * Healer balance: each healer (on each of its Dao Paths) supports the same team (Shan Tie and Bai Hu in front, Li Jian
 * striking) through Realm I elite and guardian fights from the first four contracts, at the first contract's level
 * (+3 for the elites, +2 per rank), with the run holding a given number of Spirit Stones (Jin Ding's Golden Elixir
 * reads them). Prints wins, the fight margin (the team's HP left minus the enemies', in percent) and the healing done.
 *   npx tsx scripts/healer-balance.mts [rank 1-3, default 1] [fights per kind, default 150] [stones, default 0,30,60] [healers...]
 */
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { generateEncounter } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import type { Rank } from '@/core/types';

const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const rank = Number(process.argv[2] ?? 1) as Rank;
const FIGHTS = Number(process.argv[3] ?? 150);
const stonesList = (process.argv[4] ?? '0,30,60').split(',').map(Number);
const healers = process.argv.slice(5).length ? process.argv.slice(5) : ['mei_yao', 'jin_ding', 'gu_lao', 'yue_ling'];
const mk = (defId: string, path?: string): HeroState => ({ uid: defId, defId, rank, insightIds: [], items: [], permanent: [], daoPathId: path ?? HERO_BY_ID[defId].daoPaths[0].id });

for (const hero of healers) {
  for (const path of HERO_BY_ID[hero].daoPaths.map((p) => p.id)) {
    const row: string[] = [];
    for (const stones of hero === 'jin_ding' ? stonesList : [0]) {
      let wins = 0, margin = 0, healed = 0;
      for (const kind of ['elite', 'boss'] as const) {
        for (let seed = 1; seed <= FIGHTS; seed++) {
          const node = kind === 'elite' ? 7 : 11;
          const enc = generateEncounter(1, node, kind, seed % 4, new Rng(seed));
          const level = generateEncounter(1, node, kind, 0, new Rng(seed)).level + (kind === 'elite' ? 3 : 0) + rank * 2;
          const lineup: [HeroState, [number, number]][] = [[mk('shan_tie'), [3, 1]], [mk('bai_hu'), [3, 3]], [mk('li_jian'), [2, 2]], [mk(hero, path), [1, 2]]];
          const allies = lineup.map(([h, at], i) => buildHeroUnit(h, ctx, i + 1, offsetToAxial(...at), true));
          const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], level, 100 + i, e.pos));
          const battle = new Battle({ seed, allies, enemies, stonesHeld: stones });
          const res = battle.run();
          const left = (side: 'ally' | 'enemy') => {
            const us = battle.units.filter((u) => u.side === side && !u.isSummon);
            return us.reduce((a, u) => a + Math.max(0, u.hp), 0) / Math.max(1, us.reduce((a, u) => a + u.maxHp, 0));
          };
          margin += ((left('ally') - left('enemy')) * 100) / (2 * FIGHTS);
          if (res.winner === 'ally') wins++;
          const me = res.units.find((x) => x.defId === hero)!;
          healed += (me.tracker.healing + me.tracker.shielding) / (2 * FIGHTS);
        }
      }
      row.push(`${hero === 'jin_ding' ? `${String(stones).padStart(2)} stones: ` : ''}wins ${String(wins).padStart(3)}/${2 * FIGHTS} margin ${margin.toFixed(1).padStart(5)} heal+shield ${String(Math.round(healed)).padStart(5)}`);
    }
    console.log(`${hero.padEnd(9)} ${path.padEnd(22)} ${row.join(' | ')}`);
  }
}
