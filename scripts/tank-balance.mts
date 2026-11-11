/**
 * Tank balance: each candidate tank (on each of its Dao Paths) stands in front of the same team (Li Jian, Long Mu and
 * Mei Yao, all at the same rank) through Realm I elite and guardian fights from the first four contracts, at the
 * first contract's level (+3 for the elites). Prints wins and the fight margin (the team's HP left minus the enemies',
 * in percent), plus the tank's damage dealt, damage taken and healing/shielding in the elite fights.
 *   npx tsx scripts/tank-balance.mts [rank 1-3, default 2] [fights per kind, default 200] [tank ids...]
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
const rank = Number(process.argv[2] ?? 2) as Rank;
const FIGHTS = Number(process.argv[3] ?? 200);
const tanks = process.argv.slice(4).length ? process.argv.slice(4) : ['zhong_ming', 'shan_tie', 'bai_hu', 'hei_yan'];
const mk = (defId: string, path?: string): HeroState => ({ uid: defId, defId, rank, insightIds: [], items: [], permanent: [], daoPathId: rank >= 1 ? (path ?? HERO_BY_ID[defId].daoPaths[0].id) : undefined });

for (const tank of tanks) {
  for (const path of HERO_BY_ID[tank].daoPaths.map((p) => p.id)) {
    let wins = 0, margin = 0, dealt = 0, taken = 0, support = 0;
    for (const kind of ['elite', 'boss'] as const) {
      for (let seed = 1; seed <= FIGHTS; seed++) {
        const node = kind === 'elite' ? 7 : 11;
        const enc = generateEncounter(1, node, kind, seed % 4, new Rng(seed));
        const level = generateEncounter(1, node, kind, 0, new Rng(seed)).level + (kind === 'elite' ? 3 : 0) + rank * 2;
        const lineup: [HeroState, [number, number]][] = [[mk(tank, path), [3, 2]], [mk('li_jian'), [2, 1]], [mk('long_mu'), [1, 3]], [mk('mei_yao'), [1, 1]]];
        const allies = lineup.map(([h, at], i) => buildHeroUnit(h, ctx, i + 1, offsetToAxial(...at), true));
        const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], level, 100 + i, e.pos));
        const battle = new Battle({ seed, allies, enemies });
        const res = battle.run();
        const left = (side: 'ally' | 'enemy') => {
          const us = battle.units.filter((u) => u.side === side && !u.isSummon);
          return us.reduce((a, u) => a + Math.max(0, u.hp), 0) / Math.max(1, us.reduce((a, u) => a + u.maxHp, 0));
        };
        margin += ((left('ally') - left('enemy')) * 100) / (2 * FIGHTS);
        if (res.winner === 'ally') wins++;
        if (kind === 'elite') {
          const u = res.units.find((x) => x.defId === tank)!;
          dealt += u.tracker.damageDealt / FIGHTS;
          taken += u.tracker.damageTaken / FIGHTS;
          support += (u.tracker.healing + u.tracker.shielding) / FIGHTS;
        }
      }
    }
    console.log(`${tank.padEnd(11)} ${path.padEnd(22)} wins ${String(wins).padStart(3)}/${2 * FIGHTS} · margin ${margin.toFixed(1).padStart(6)} · elite dealt ${String(Math.round(dealt)).padStart(5)} · taken ${String(Math.round(taken)).padStart(5)} · heal+shield ${Math.round(support)}`);
  }
}
