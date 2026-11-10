import { meta, updateMeta } from '@/app/store';
import {
  BUILDING_BY_ID,
  RECIPES,
  RECRUIT_BY_HERO,
  STUDIES,
  canAfford,
  heirloomStartLevel,
  isOpen,
  levelCap,
  levelCost,
  recruitState,
  sealSlots,
  sectOf,
  spend,
  type SectState,
  type UpgradableId,
} from '@/meta/sect';

/** Writes a changed sect back into the save. */
function save(fn: (s: SectState) => SectState | void): void {
  updateMeta((m) => {
    const cur = sectOf(m);
    m.sect = fn(cur) ?? cur;
  });
}

export type SectResult = { ok: true } | { ok: false; reason: string };
const no = (reason: string): SectResult => ({ ok: false, reason });

/** Raises the Scripture Pavilion, the Artifact Forge or the Recruitment Hall one level, within the rank's cap. */
export function upgradeBuilding(id: UpgradableId): SectResult {
  const m = meta.peek();
  const s = sectOf(m);
  const xp = m.renown?.xp ?? 0;
  if (!isOpen(id, xp)) return no('Not open yet');
  const next = s.buildings[id] + 1;
  if (next > levelCap(xp)) return no('The sect must rise in rank first');
  const cost = levelCost(next, BUILDING_BY_ID[id].material!);
  if (!canAfford(s.purse, cost)) return no('Not enough Funds or materials');
  save((st) => {
    st.purse = spend(st.purse, cost);
    st.buildings[id] = next;
    // from Forge level 4, heirlooms start at level 2: the ones already made catch up
    if (id === 'forge') st.heirlooms = st.heirlooms.map((h) => ({ ...h, level: Math.max(h.level, heirloomStartLevel(next)) }));
  });
  return { ok: true };
}

/** Studies a Scripture Pavilion bundle: its Dao Insights join what runs can offer. */
export function research(studyId: string): SectResult {
  const m = meta.peek();
  const s = sectOf(m);
  const st = STUDIES.find((x) => x.id === studyId);
  if (!st || !isOpen('pavilion', m.renown?.xp ?? 0)) return no('Not available');
  if (s.research.includes(studyId)) return no('Already studied');
  if (st.level > s.buildings.pavilion) return no(`Needs Pavilion level ${st.level}`);
  if (!canAfford(s.purse, st.cost)) return no('Not enough Funds or Spirit Herbs');
  save((x) => {
    x.purse = spend(x.purse, st.cost);
    x.research = [...x.research, studyId];
  });
  return { ok: true };
}

/** Seals or unseals a Treasure or Dao Insight (never offered in a run while sealed). */
export function toggleSeal(id: string): SectResult {
  const m = meta.peek();
  const s = sectOf(m);
  if (!isOpen('pavilion', m.renown?.xp ?? 0)) return no('Not open yet');
  if (s.seals.includes(id)) {
    save((x) => {
      x.seals = x.seals.filter((y) => y !== id);
    });
    return { ok: true };
  }
  if (s.seals.length >= sealSlots(s.buildings.pavilion)) return no('Every seal is in use: raise the Pavilion or lift one');
  save((x) => {
    x.seals = [...x.seals, id];
  });
  return { ok: true };
}

/** Crafts an heirloom from a recipe the Forge knows. */
export function craft(recipeId: string): SectResult {
  const m = meta.peek();
  const s = sectOf(m);
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r || !isOpen('forge', m.renown?.xp ?? 0)) return no('Not available');
  if (s.heirlooms.some((h) => h.id === recipeId)) return no('Already crafted');
  if (r.forge > s.buildings.forge) return no(`Needs Forge level ${r.forge}`);
  if (!canAfford(s.purse, r.cost)) return no('Not enough Funds or Beast Cores');
  save((x) => {
    x.purse = spend(x.purse, r.cost);
    x.heirlooms = [...x.heirlooms, { id: recipeId, level: heirloomStartLevel(x.buildings.forge) }];
    if (!x.carry) x.carry = recipeId;
  });
  return { ok: true };
}

/** Recruits an exclusive disciple waiting at the Recruitment Hall: from now on they can join drafts and shops. */
export function recruit(hero: string): SectResult {
  const m = meta.peek();
  const s = sectOf(m);
  const r = RECRUIT_BY_HERO[hero];
  const state = recruitState(m, hero);
  if (!r) return no('Not available');
  if (state === 'recruited') return no('Already recruited');
  if (state === 'locked') return no(`Answers the call at Renown ${r.renown}`);
  if (!canAfford(s.purse, r.cost)) return no('Not enough Funds or Heavenly Jade');
  save((x) => {
    x.purse = spend(x.purse, r.cost);
    x.disciples = [...x.disciples, hero];
  });
  return { ok: true };
}

/** The heirloom to carry into the next run ('' for none). */
export function setCarry(recipeId: string): void {
  save((x) => {
    x.carry = recipeId;
  });
}
