import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { ENEMY_BY_ID } from '@/content/enemies';
import { HEROES } from '@/content/heroes';
import { offsetToAxial } from '@/battle/sim/hex';
import { Rng } from '@/core/rng';
import { generateEncounter } from '@/core/encounters';

const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };

function hero(defId: string, uid: string, rank: 0 | 1 | 2 | 3 = 0, daoPathId?: string): HeroState {
  return { uid, defId, rank, daoPathId, insightIds: [], items: [], permanent: [] };
}

describe('battle simulation', () => {
  it('three starting disciples beat a node-1 encounter', () => {
    const rng = new Rng(42);
    const enc = generateEncounter(1, 0, 'fight', 0, rng);
    const allies = [
      buildHeroUnit(hero('shan_tie', 'a'), ctx, 1, offsetToAxial(3, 2), true),
      buildHeroUnit(hero('li_jian', 'b'), ctx, 2, offsetToAxial(2, 1), true),
      buildHeroUnit(hero('hong_lian', 'c'), ctx, 3, offsetToAxial(1, 3), true),
    ];
    const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
    const b = new Battle({ seed: 7, allies, enemies });
    const res = b.run();
    expect(res.winner).toBe('ally');
    expect(res.duration).toBeLessThan(50);
  });

  it('is deterministic for the same seed', () => {
    const mk = () => {
      const rng = new Rng(99);
      const enc = generateEncounter(1, 3, 'fight', 0, rng);
      const allies = [
        buildHeroUnit(hero('tie_quan', 'a', 1, 'tie_tempo'), ctx, 1, offsetToAxial(3, 2), true),
        buildHeroUnit(hero('lei_zhen', 'b'), ctx, 2, offsetToAxial(1, 2), true),
        buildHeroUnit(hero('mei_yao', 'c'), ctx, 3, offsetToAxial(0, 1), true),
      ];
      const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
      const b = new Battle({ seed: 123, allies, enemies });
      const r = b.run();
      return JSON.stringify({ w: r.winner, d: r.duration, u: r.units.map((u) => [u.alive, u.tracker.damageDealt]) });
    };
    expect(mk()).toBe(mk());
  });

  it('every hero and dao path builds and fights without throwing', () => {
    for (const h of HEROES) {
      for (const path of [undefined, ...h.daoPaths.map((p) => p.id)]) {
        const rng = new Rng(5);
        const enc = generateEncounter(1, 2, 'fight', 0, rng);
        const allies = [buildHeroUnit(hero(h.id, 'x', path ? 1 : 0, path), ctx, 1, offsetToAxial(3, 2), true)];
        const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
        const b = new Battle({ seed: 1, allies, enemies, maxTime: 90 });
        expect(() => b.run()).not.toThrow();
        expect(b.over).toBe(true);
      }
    }
  });

  it('boss encounters resolve and bosses can summon', () => {
    const rng = new Rng(3);
    const enc = generateEncounter(2, 11, 'boss', 0, rng);
    const allies = HEROES.slice(0, 5).map((h, i) => buildHeroUnit(hero(h.id, `h${i}`, 3), ctx, i + 1, offsetToAxial(i % 4, i % 5), true));
    const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
    const b = new Battle({
      seed: 9,
      allies,
      enemies,
      spawnEnemy: (id, uid) => buildEnemyUnit(ENEMY_BY_ID[id], enc.level, uid, null),
    });
    const res = b.run();
    expect(['ally', 'enemy']).toContain(res.winner);
    expect(res.units.length).toBeGreaterThan(enemies.length + allies.length - 1);
  });
});
