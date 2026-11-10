import { effect, untracked } from '@preact/signals';
import { meta, run, updateMeta, type MetaSave } from '@/app/store';
import type { RunState } from '@/core/run';

export type SeenKind = 'heroes' | 'items' | 'relics' | 'enemies';
export type SeenLists = NonNullable<MetaSave['seen']>;
export const SEEN_KINDS: SeenKind[] = ['heroes', 'items', 'relics', 'enemies'];

export const emptySeen = (): SeenLists => ({ heroes: [], items: [], relics: [], enemies: [] });

/**
 * What a run has shown the player: the draft, shop offers, rewards and picks, the sect with its Treasures and
 * Dao Insights, and the foes of the current encounter.
 */
export function seenIn(s: RunState): Record<SeenKind, Set<string>> {
  const heroes = new Set<string>();
  const items = new Set<string>();
  const relics = new Set<string>();
  const enemies = new Set<string>();
  for (const h of s.roster) {
    heroes.add(h.defId);
    for (const i of h.items) items.add(i);
  }
  for (const i of s.inventory ?? []) items.add(i);
  for (const r of s.relics ?? []) relics.add(r.id);
  for (const id of s.draft?.heroes ?? []) heroes.add(id);
  if (s.shop) {
    for (const o of s.shop.heroes ?? []) if (o) heroes.add(o.defId);
    for (const o of s.shop.items ?? []) if (o) items.add(o.itemId);
    for (const o of [...(s.shop.relics ?? []), ...(s.shop.teamSize ?? [])]) if (o) relics.add(o.relicId);
  }
  for (const r of s.pendingReward ?? []) relics.add(r.id);
  for (const i of s.pendingPick?.items ?? []) items.add(i.id);
  for (const r of s.pendingPick?.relics ?? []) relics.add(r.id);
  for (const u of s.currentEncounter?.enemies ?? []) enemies.add(u.defId);
  return { heroes, items, relics, enemies };
}

/** Records everything each run shows the player, so the Compendium can reveal it (discovery). */
export function installDiscovery(): void {
  effect(() => {
    const s = run.value;
    if (!s) return;
    const found = seenIn(s);
    const cur = untracked(() => meta.value.seen) ?? emptySeen();
    const add = SEEN_KINDS.map((k) => [...found[k]].filter((id) => !cur[k].includes(id)));
    if (add.every((a) => a.length === 0)) return;
    untracked(() =>
      updateMeta((m) => {
        const seen = (m.seen ??= emptySeen());
        SEEN_KINDS.forEach((k, i) => seen[k].push(...add[i]));
      }),
    );
  });
}
