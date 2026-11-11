import type { MetaSave } from '@/app/store';
import type { RunState } from '@/core/run';
import { Rng } from '@/core/rng';
import { HERO_BY_ID } from '@/content/heroes';
import { HEART_DEMON_JADE, OMEN_BY_ID, SECT_EVENTS, SECT_EVENT_BY_ID, type OmenId, type SectChoiceDef, type SectEventDef, type SectOmen } from '@/content/sectEvents';
import { MASTERY_THRESHOLDS, MAX_MASTERY, masteryLevel } from '@/meta/mastery';
import { levelOf, rankOf } from '@/meta/renown';
import { CURRENCIES, SECT_OPENS, addPurse, canAfford, sectOf, spend, type EventPace, type PendingSectEvent, type Purse, type SectState } from '@/meta/sect';

/**
 * Sect events (docs/META_PROGRESSION.md 6.8), the rules: when an event comes home with a run, what each choice does to
 * the save, and what the omens a run carried pay when it ends. The events themselves are in src/content/sectEvents.ts;
 * src/meta/sectActions.ts and src/meta/runtime.ts apply these to the save.
 */

/** One chance in three per return, and a fourth return in a row without an event always brings one. */
export const EVENT_CHANCE = 1 / 3;
export const EVENT_GUARANTEE = 3;

/** Funds, Herbs and Cores an event pays grow with the sect's rank: as they are for a Humble Sect, +50% per rank. */
export function eventScale(renownXp: number): number {
  return 1 + 0.5 * rankOf(levelOf(renownXp).level).index;
}

/** A gain grown with the rank; Heavenly Jade stays as it is. */
export function scaledGain(gain: Partial<Purse> | undefined, scale: number): Partial<Purse> {
  const out: Partial<Purse> = {};
  for (const k of Object.keys(gain ?? {}) as (keyof Purse)[]) out[k] = k === 'jade' ? gain![k] : Math.round((gain![k] ?? 0) * scale);
  return out;
}

/** "60 Sect Funds and 5 Heavenly Jade". */
export function purseText(p: Partial<Purse> | undefined): string {
  const parts = CURRENCIES.filter((c) => p?.[c.key]).map((c) => `${p![c.key]} ${c.name}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

/** An event's or a choice's text with its disciple and numbers in place. */
export function fillText(text: string, ctx: { hero?: string; gain?: Partial<Purse>; reward?: Partial<Purse> }): string {
  return text
    .replaceAll('{hero}', (ctx.hero && HERO_BY_ID[ctx.hero]?.name) || 'A disciple')
    .replaceAll('{gain}', purseText(ctx.gain))
    .replaceAll('{reward}', purseText(ctx.reward));
}

/** Disciples who may ask for seclusion: some mastery won, mastery V not reached, and not already in seclusion. */
export function seclusionCandidates(m: MetaSave): string[] {
  const away = new Set(sectOf(m).omens.filter((o) => o.id === 'seclusion').map((o) => o.hero));
  return Object.entries(m.mastery ?? {})
    .filter(([id, wins]) => HERO_BY_ID[id] && wins >= 1 && masteryLevel(wins) < MAX_MASTERY && !away.has(id))
    .map(([id]) => id)
    .sort();
}

/** Can this event come now? Its Renown reached, a disciple for seclusion, and none of its omens already waiting. */
export function eventAvailable(def: SectEventDef, m: MetaSave): boolean {
  if (levelOf(m.renown?.xp ?? 0).level < def.renown) return false;
  if (def.needsHero) return seclusionCandidates(m).length > 0;
  const waiting = new Set(sectOf(m).omens.map((o) => o.id));
  return !def.choices.some((c) => c.omen && waiting.has(c.omen));
}

/**
 * The sect event a paid run brings home, if any, and the new pacing. Seeded by the run, so a run always brings the
 * same. An undecided event keeps waiting (and the pacing waits with it); the next event never repeats the last.
 */
export function rollSectEvent(m: MetaSave, seed: number): { event: PendingSectEvent | null; pace: EventPace; fresh: boolean } {
  const s = sectOf(m);
  if (levelOf(m.renown?.xp ?? 0).level < SECT_OPENS) return { event: null, pace: s.pace, fresh: false };
  if (s.event) return { event: s.event, pace: s.pace, fresh: false };
  const rng = new Rng((seed ^ 0x5ec7e7) >>> 0);
  const roll = rng.next();
  const pool = SECT_EVENTS.filter((e) => e.id !== s.pace.last && eventAvailable(e, m));
  if (!pool.length || (roll >= EVENT_CHANCE && s.pace.since < EVENT_GUARANTEE)) return { event: null, pace: { ...s.pace, since: s.pace.since + 1 }, fresh: false };
  const def = rng.weighted(pool, pool.map((e) => e.weight ?? 1));
  const hero = def.needsHero ? rng.pick(seclusionCandidates(m)) : undefined;
  return { event: { id: def.id, ...(hero ? { hero } : {}) }, pace: { since: 0, last: def.id }, fresh: true };
}

/** A choice as the scroll shows it: its text filled in, what it costs and pays, and whether the sect can afford it. */
export interface ChoiceView {
  def: SectChoiceDef;
  desc: string;
  gain: Partial<Purse>;
  reward?: Partial<Purse>;
  affordable: boolean;
}

export function choiceViews(m: MetaSave, ev: PendingSectEvent): ChoiceView[] {
  const def = SECT_EVENT_BY_ID[ev.id];
  if (!def) return [];
  const s = sectOf(m);
  const scale = eventScale(m.renown?.xp ?? 0);
  return def.choices.map((c) => {
    const gain = scaledGain(c.gain, scale);
    const reward = c.reward ? scaledGain(c.reward, scale) : undefined;
    return { def: c, desc: fillText(c.desc, { hero: ev.hero, gain, reward }), gain, reward, affordable: !c.cost || canAfford(s.purse, c.cost) };
  });
}

export type ChoiceResult = { ok: true; sect: SectState; outcome: string; gained: Partial<Purse>; spent?: Partial<Purse>; omen?: SectOmen } | { ok: false; reason: string };

/** What choosing does to the sect: pays its cost and its gain at once, and sends its omen into the next run. */
export function resolveSectChoice(m: MetaSave, choiceId: string): ChoiceResult {
  const s = sectOf(m);
  const ev = s.event;
  if (!ev) return { ok: false, reason: 'No event waits' };
  const view = choiceViews(m, ev).find((v) => v.def.id === choiceId);
  if (!view) return { ok: false, reason: 'Not available' };
  if (!view.affordable) return { ok: false, reason: 'The sect cannot afford it' };
  const c = view.def;
  const purse = addPurse(c.cost ? spend(s.purse, c.cost) : s.purse, view.gain);
  const omen: SectOmen | undefined = c.omen ? { id: c.omen, ...(c.omen === 'seclusion' && ev.hero ? { hero: ev.hero } : {}), ...(view.reward ? { reward: view.reward } : {}) } : undefined;
  const sect: SectState = { ...s, purse, event: null, omens: omen ? [...s.omens, omen] : s.omens };
  return { ok: true, sect, outcome: fillText(c.outcome, { hero: ev.hero }), gained: view.gain, spent: c.cost, omen };
}

/** The save's omens once a run has taken some of them. */
export function omensLeft(all: SectOmen[], taken: SectOmen[]): SectOmen[] {
  const key = (o: SectOmen) => `${o.id}|${o.hero ?? ''}`;
  const gone = new Set(taken.map(key));
  return all.filter((o) => !gone.has(key(o)));
}

/** An omen in a few words, for the New Run screen and the run-end rewards. */
export function omenText(o: SectOmen): string {
  return fillText(OMEN_BY_ID[o.id]?.desc ?? '', { hero: o.hero, reward: o.reward });
}

/** Did the run beat a foe it met through an omen? */
const beat = (s: RunState, foe: string) => (s.history ?? []).some((h) => h.won && h.foe === foe);

export interface OmenResults {
  results: { id: OmenId; text: string; purse?: Partial<Purse> }[];
  purse: Partial<Purse>;
  mastery: Record<string, number>;
  ups: { hero: string; level: number }[];
}

/**
 * What the omens a finished run carried pay: the Crimson Cloud challenge won pays its prize, the Heart Demon beaten
 * pays Heavenly Jade, and a disciple back from seclusion rises one mastery level.
 */
export function omenResults(s: RunState, mastery: Record<string, number> | undefined): OmenResults {
  const out: OmenResults = { results: [], purse: {}, mastery: { ...(mastery ?? {}) }, ups: [] };
  const add = (p: Partial<Purse>) => {
    for (const k of Object.keys(p) as (keyof Purse)[]) out.purse[k] = (out.purse[k] ?? 0) + (p[k] ?? 0);
  };
  for (const o of s.sect?.omens ?? []) {
    if (o.id === 'rival' && beat(s, 'crimson_senior')) {
      const prize = o.reward ?? {};
      add(prize);
      out.results.push({ id: o.id, text: 'The Crimson Cloud Sect bowed to yours.', purse: prize });
    } else if (o.id === 'heart_demon' && beat(s, 'heart_demon')) {
      const prize = { jade: HEART_DEMON_JADE };
      add(prize);
      out.results.push({ id: o.id, text: 'The Heart Demon is no more.', purse: prize });
    } else if (o.id === 'seclusion' && o.hero && HERO_BY_ID[o.hero]) {
      const wins = out.mastery[o.hero] ?? 0;
      const level = masteryLevel(wins);
      if (level < MAX_MASTERY) {
        out.mastery[o.hero] = Math.max(wins, MASTERY_THRESHOLDS[level]);
        out.ups.push({ hero: o.hero, level: level + 1 });
      }
      out.results.push({ id: o.id, text: `${HERO_BY_ID[o.hero].name} came back from seclusion.` });
    }
  }
  return out;
}

/** The event waiting at the sect, with its text filled in (for the scroll and the menu banner). */
export function pendingEvent(m: MetaSave): { ev: PendingSectEvent; def: SectEventDef; text: string } | null {
  const ev = sectOf(m).event;
  const def = ev && SECT_EVENT_BY_ID[ev.id];
  return ev && def ? { ev, def, text: fillText(def.text, { hero: ev.hero }) } : null;
}
