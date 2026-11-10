import { describe, expect, it } from 'vitest';
import { Battle } from '@/battle/sim/battle';
import { buildEnemyUnit, buildHeroUnit, type HeroState, type TeamContext } from '@/core/builder';
import { ENEMY_BY_ID } from '@/content/enemies';
import { BASE_HEROES } from '@/content/heroes';
import { offsetToAxial } from '@/battle/sim/hex';
import { Rng } from '@/core/rng';
import { generateEncounter } from '@/core/encounters';
import type { ActionDef } from '@/core/types';

const ctx: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };
const hero = (defId: string, uid: string): HeroState => ({ uid, defId, rank: 0, insightIds: [], items: [], permanent: [] });

/** Every effect key a list of actions plays (vfx on damage / heal / shield, and vfx actions), nested repeats included. */
function keysOf(actions: ActionDef[] | undefined, out = new Set<string>()): Set<string> {
  for (const a of actions ?? []) {
    const any = a as { vfx?: string; key?: string; do: string; actions?: ActionDef[] };
    if (any.vfx) out.add(any.vfx);
    if (any.do === 'vfx' && any.key) out.add(any.key);
    if (any.actions) keysOf(any.actions, out);
  }
  return out;
}

/** One early fight with the disciple in the front row, starting at full Qi so the technique comes at once. */
function techniqueKeys(defId: string, seed: number): Set<string> {
  const enc = generateEncounter(1, 3, 'fight', 0, new Rng(seed));
  const allies = [hero(defId, 'a'), hero('shan_tie', 'b'), hero('mei_yao', 'c')].map((h, i) =>
    buildHeroUnit(h, ctx, i + 1, offsetToAxial(...([[3, 2], [2, 1], [1, 3]] as [number, number][])[i]), true),
  );
  const enemies = enc.enemies.map((e, i) => buildEnemyUnit(ENEMY_BY_ID[e.defId], enc.level, 100 + i, e.pos));
  const b = new Battle({ seed, allies, enemies });
  const me = b.units.find((u) => u.id === 1)!;
  me.qi = me.maxQi;
  b.run();
  return new Set(
    b
      .drainEvents()
      .filter((e) => e.type === 'vfx' && e.id === 1)
      .map((e) => (e as { key: string }).key),
  );
}

describe('Signature techniques', () => {
  it('every launch disciple has a technique effect of their own', () => {
    for (const h of BASE_HEROES) expect(keysOf(h.ability.actions).has(`sig_${h.id}`), h.id).toBe(true);
  });

  it('paths that rewrite a technique keep its signature', () => {
    for (const h of BASE_HEROES)
      for (const p of h.daoPaths) if (p.ability?.actions) expect(keysOf(p.ability.actions).has(`sig_${h.id}`), `${h.id} / ${p.id}`).toBe(true);
  });

  it('each signature plays in a real fight', () => {
    for (const h of BASE_HEROES) {
      let seen = false;
      for (let seed = 1; seed <= 6 && !seen; seed++) seen = techniqueKeys(h.id, seed).has(`sig_${h.id}`);
      expect(seen, h.id).toBe(true);
    }
  });
});
