import type { MetaSave } from '@/app/store';
import { ACH_BY_ID } from '@/meta/achievementDefs';
import { DEFAULT_COSMETICS, HERO_AVATARS, RENOWN_TRACK, type CosmeticKind } from '@/meta/cosmetics';
import { levelOf } from '@/meta/renown';
import { MASTER_TITLES, heroOfMasterTitle, masterTitleId, masteryOf } from '@/meta/mastery';
import { HERO_BY_ID } from '@/content/heroes';

const key = (kind: CosmeticKind, id: string) => `${kind}:${id}`;

/** Every cosmetic this save may use, as "kind:id" keys: defaults, the Renown track, achievements, winning disciples. */
export function unlockedCosmetics(m: MetaSave): Set<string> {
  const out = new Set<string>();
  for (const [kind, id] of Object.entries(DEFAULT_COSMETICS)) out.add(key(kind as CosmeticKind, id));
  const level = levelOf(m.renown?.xp ?? 0).level;
  for (const r of RENOWN_TRACK) if (r.level <= level) out.add(key(r.kind, r.id));
  for (const id of Object.keys(m.achievements ?? {})) for (const r of ACH_BY_ID[id]?.rewards ?? []) out.add(key(r.kind, r.id));
  const winners = new Set(m.lifetime?.winnersWith ?? []);
  for (const a of HERO_AVATARS) if (a.hero && winners.has(a.hero)) out.add(key('avatar', a.id));
  // disciple mastery IV: the disciple's title
  for (const hero of Object.keys(MASTER_TITLES)) if (masteryOf(m, hero) >= 4) out.add(key('title', masterTitleId(hero)));
  return out;
}

export function isUnlocked(m: MetaSave, kind: CosmeticKind, id: string): boolean {
  return unlockedCosmetics(m).has(key(kind, id));
}

/** The Renown level that unlocks a cosmetic on the track, if it is on the track. */
export function trackLevelOf(kind: CosmeticKind, id: string): number | undefined {
  return RENOWN_TRACK.find((r) => r.kind === kind && r.id === id)?.level;
}

/** How a locked cosmetic is earned, in words. */
export function howToUnlock(kind: CosmeticKind, id: string, how?: string): string {
  const lvl = trackLevelOf(kind, id);
  if (lvl) return `Reach Renown ${lvl}.`;
  const ach = Object.values(ACH_BY_ID).find((a) => a.rewards?.some((r) => r.kind === kind && r.id === id));
  if (ach) return `Achievement: ${ach.hidden ? 'a secret' : ach.name}.`;
  const hero = kind === 'title' ? heroOfMasterTitle(id) : undefined;
  if (hero) return `Reach mastery IV with ${HERO_BY_ID[hero].name}.`;
  return how ?? 'Locked.';
}
