/**
 * Dao Path balance: for each disciple (or the ids given), the same four-disciple team (a tank, a damage dealer, a
 * healer and the disciple, all at Foundation) fights 40 Realm I elite fights and 40 Realm I guardian fights with each
 * of the disciple's Dao Paths, its exclusive mastery path (marked *) included. Guardian wins are the clearest signal.
 *   npx tsx scripts/path-balance.mts [hero_id,hero_id,...]
 */
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { generateEncounter } from '@/core/encounters';
import { Rng } from '@/core/rng';
import { offsetToAxial } from '@/battle/sim/hex';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HERO_BY_ID } from '@/content/heroes';
import { MASTERY_PATHS } from '@/content/mastery';
const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const mk = (defId: string, path?: string): HeroState => ({ uid: defId, defId, rank: 1, insightIds: [], items: [], permanent: [], daoPathId: path ?? HERO_BY_ID[defId].daoPaths[0].id });
const only = process.argv[2]?.split(',');
for (const hero of Object.keys(MASTERY_PATHS)) {
  if (only && !only.includes(hero)) continue;
  const tank = hero === 'shan_tie' ? 'bai_hu' : 'shan_tie';
  const heal = hero === 'mei_yao' ? 'gu_lao' : 'mei_yao';
  const dps = hero === 'li_jian' ? 'long_mu' : 'li_jian';
  const melee = (HERO_BY_ID[hero].baseStats.range ?? 1) <= 2;
  const paths = [...HERO_BY_ID[hero].daoPaths.map((p) => p.id), MASTERY_PATHS[hero].id];
  const rows: string[] = [];
  for (const path of paths) {
    const out = { eliteDealt: 0, eliteHeal: 0, bossWins: 0, bossDealt: 0 };
    for (const kind of ['elite', 'boss'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const me = mk(hero, path);
        const lineup: [HeroState, [number, number]][] = melee
          ? [[mk(tank), [3, 1]], [me, [3, 3]], [mk(dps), [1, 2]], [mk(heal), [1, 0]]]
          : [[mk(tank), [3, 1]], [mk(dps), [3, 3]], [me, [1, 2]], [mk(heal), [1, 0]]];
        const allies = lineup.map(([h, at], i) => buildHeroUnit(h, ctx, i + 1, offsetToAxial(...at), true));
        const enc = generateEncounter(1, kind === 'elite' ? 7 : 11, kind, 0, new Rng(seed));
        const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
        const res = new Battle({ seed, allies, enemies }).run();
        const u = res.units.find((x) => x.defId === hero)!;
        if (kind === 'elite') { out.eliteDealt += u.tracker.damageDealt; out.eliteHeal += u.tracker.healing + u.tracker.shielding; }
        else { out.bossDealt += u.tracker.damageDealt; if (res.winner === 'ally') out.bossWins++; }
      }
    }
    const mark = path === MASTERY_PATHS[hero].id ? ' *' : '';
    rows.push(`  ${(path + mark).padEnd(26)} guardian wins ${String(out.bossWins).padStart(2)}/40 · dealt ${String(Math.round(out.bossDealt / 40)).padStart(5)} | elite dealt ${String(Math.round(out.eliteDealt / 40)).padStart(5)} · heal+shield ${Math.round(out.eliteHeal / 40)}`);
  }
  console.log('==', hero); console.log(rows.join('\n'));
}
