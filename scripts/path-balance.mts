/**
 * Dao Path and mastery passive balance: for each disciple (or the ids given), the same four-disciple team (a tank, a
 * damage dealer, a healer and the disciple, all at Foundation) fights Realm I elite fights (3 Tribulation levels up)
 * and Realm I guardian fights, taken in turn from the first four contracts, with no Dao Path, with each of its three
 * paths, and with each path plus its mastery V passive. A passive changes how every later moment of a fight plays
 * out, so small differences are noise: use 300 fights.
 *   margin: per fight, the team's HP left minus the enemies' HP left (as fractions, x100: +100 is a flawless win,
 *           -100 a wipe that scratched nobody), averaged. It moves with offence and defence alike, unlike win counts.
 *   path worth: what a Dao Path adds over no path (average of the three); passive worth: what the passive adds on top
 *   of a path (average of the three). A passive should be worth about half a path.
 *   npx tsx scripts/path-balance.mts [hero_id,hero_id,...] [fights per kind, default 80]
 */
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { generateEncounter } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { MASTERY_PASSIVES } from '@/content/mastery';

const baseCtx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const mk = (defId: string, path: string | null = HERO_BY_ID[defId].daoPaths[0].id): HeroState => ({ uid: defId, defId, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: path ?? undefined });
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : undefined;
const FIGHTS = Number(process.argv[3] ?? 80);

interface Score { wins: number; boss: number; elite: number }

function measure(hero: string, path: string | null, ctx: TeamContext): Score {
  const tank = hero === 'shan_tie' ? 'bai_hu' : 'shan_tie';
  const heal = hero === 'mei_yao' ? 'gu_lao' : 'mei_yao';
  const dps = hero === 'li_jian' ? 'long_mu' : 'li_jian';
  const melee = (HERO_BY_ID[hero].baseStats.range ?? 1) <= 2;
  const out: Score = { wins: 0, boss: 0, elite: 0 };
  for (const kind of ['elite', 'boss'] as const) {
    for (let seed = 1; seed <= FIGHTS; seed++) {
      const me = mk(hero, path);
      const lineup: [HeroState, [number, number]][] = melee
        ? [[mk(tank), [3, 1]], [me, [3, 3]], [mk(dps), [1, 2]], [mk(heal), [1, 0]]]
        : [[mk(tank), [3, 1]], [mk(dps), [3, 3]], [me, [1, 2]], [mk(heal), [1, 0]]];
      const allies = lineup.map(([h, at], i) => buildHeroUnit(h, ctx, i + 1, offsetToAxial(...at), true));
      // the foes of four contracts in turn (one guardian's quirks must not decide), all at the first contract's level;
      // the elites fight 3 Tribulation levels higher, so they are not all flawless wins
      const node = kind === 'elite' ? 7 : 11;
      const enc = generateEncounter(1, node, kind, seed % 4, new Rng(seed));
      const level = generateEncounter(1, node, kind, 0, new Rng(seed)).level + (kind === 'elite' ? 3 : 0);
      const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], level, 100 + i, e.pos));
      const battle = new Battle({ seed, allies, enemies });
      const res = battle.run();
      const left = (side: 'ally' | 'enemy') => {
        const us = battle.units.filter((u) => u.side === side && !u.isSummon);
        return us.reduce((a, u) => a + Math.max(0, u.hp), 0) / Math.max(1, us.reduce((a, u) => a + u.maxHp, 0));
      };
      const margin = (left('ally') - left('enemy')) * 100;
      if (kind === 'elite') out.elite += margin / FIGHTS;
      else {
        out.boss += margin / FIGHTS;
        if (res.winner === 'ally') out.wins++;
      }
    }
  }
  return out;
}

const f = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
for (const hero of Object.keys(MASTERY_PASSIVES)) {
  if (only && !only.includes(hero)) continue;
  const none = measure(hero, null, baseCtx);
  const rows: string[] = [];
  let pathWorth = 0;
  let passiveWorth = 0;
  for (const path of HERO_BY_ID[hero].daoPaths.map((p) => p.id)) {
    const off = measure(hero, path, baseCtx);
    const on = measure(hero, path, { ...baseCtx, masteryPassives: [hero] });
    const pw = (off.boss - none.boss + off.elite - none.elite) / 2;
    const mw = (on.boss - off.boss + on.elite - off.elite) / 2;
    pathWorth += pw / 3;
    passiveWorth += mw / 3;
    rows.push(`  ${path.padEnd(22)} wins ${String(off.wins).padStart(3)} -> ${String(on.wins).padStart(3)} /${FIGHTS} · guardian margin ${f(off.boss).padStart(6)} -> ${f(on.boss).padStart(6)} · elite margin ${f(off.elite).padStart(6)} -> ${f(on.elite).padStart(6)} · path ${f(pw)} · passive ${f(mw)}`);
  }
  const ratio = pathWorth > 0.5 ? ` (${Math.round((passiveWorth / pathWorth) * 100)}% of a path)` : '';
  console.log(`== ${hero} · ${MASTERY_PASSIVES[hero].name}: no path ${none.wins}/${FIGHTS} wins, margins ${f(none.boss)} / ${f(none.elite)} · path worth ${f(pathWorth)} · passive worth ${f(passiveWorth)}${ratio}`);
  console.log(rows.join('\n'));
}
