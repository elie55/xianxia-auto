import { useEffect, useRef, useState } from 'preact/hooks';
import { act, run } from '@/app/store';
import { eventContext, finishEvent, pickFromPending, resolveEventChoice, teamContext } from '@/core/run';
import { EVENT_BY_ID } from '@/content/events';
import { HERO_BY_ID } from '@/content/heroes';
import { Hud, HeroSlotTip, RelicTip } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { ItemChip, ItemTip } from '@/ui/components/HeroCard';
import { RELIC_BY_ID } from '@/content/relics';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

export function EventScreen() {
  const s = run.value!;
  useArena(s);
  const ce = s.currentEvent!;
  const ev = EVENT_BY_ID[ce.eventId];
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // the disciple picker opens under the choices: bring it (and its Confirm button) into view
  useEffect(() => {
    if (pendingChoice) pickerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pendingChoice]);
  useEffect(() => {
    audio.playMusic('event');
  }, []);
  const { ctx } = eventContext(s);
  const choose = (choiceId: string) => {
    const c = ev.choices.find((x) => x.id === choiceId)!;
    if (c.needsHero && !hero) {
      setPendingChoice(choiceId);
      return;
    }
    audio.sfx('ui_confirm');
    act((st) => resolveEventChoice(st, choiceId, hero ?? undefined));
  };
  const outcome = ce.outcome;
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="event-panel panel anim-pop">
          <div class="event-art">
            {!artFailed && <img src={`./assets/art/events/${ev.art}.jpg`} alt="" onError={() => setArtFailed(true)} />}
            {artFailed && (
              <div class="event-art-fallback">
                <span class="brush">{ev.hanzi ?? '缘'}</span>
              </div>
            )}
            <div class="event-art-fade" />
          </div>
          <div class="event-body">
            <div class="event-kicker">{s.timeline[s.nodeIndex]?.kind === 'rest' ? 'SECT REST' : s.timeline[s.nodeIndex]?.kind === 'trial' ? 'HEAVENLY TRIAL' : 'ENCOUNTER ON THE ROAD'}</div>
            <div class="event-title display">{ev.title}</div>
            {!outcome && (
              <>
                <p class="event-text">{ev.text}</p>
                <div class="event-choices" data-tut="event-choices">
                  {ev.choices.map((c) => {
                    const available = !c.available || c.available(ctx);
                    const active = pendingChoice === c.id;
                    return (
                      <button key={c.id} class={`event-choice ${available ? '' : 'disabled'} ${active ? 'active' : ''}`} disabled={!available} onClick={() => choose(c.id)}>
                        <div class="choice-icon">
                          <Icon name={choiceIcon(c.desc)} size={50} />
                        </div>
                        <div class="choice-main">
                          <div class="choice-label display">
                            {c.label}
                            {c.cost ? (
                              <span class="price-inline">
                                <Icon name="stones" size={16} /> {c.cost}
                              </span>
                            ) : null}
                          </div>
                          <div class="choice-desc">
                            <RichText text={c.desc} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {pendingChoice && (
                  <div class="hero-picker anim-rise" ref={pickerRef}>
                    <div class="muted" style={{ fontSize: 14 }}>
                      Choose a disciple:
                    </div>
                    <div class="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                      {s.roster.map((h) => (
                        <button key={h.uid} class={`champion-pick ${hero === h.uid ? 'on' : ''}`} onClick={() => setHero(h.uid)} {...tip(<HeroSlotTip h={h} s={s} ctx={teamContext(s)} hint={false} />, 'above')}>
                          <MiniPortrait defId={h.defId} size={52} />
                          <span>{HERO_BY_ID[h.defId].name}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      class="btn primary small"
                      disabled={!hero}
                      onClick={() => {
                        audio.sfx('ui_confirm');
                        act((st) => resolveEventChoice(st, pendingChoice, hero ?? undefined));
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </>
            )}
            {outcome && (
              <>
                <p class="event-text outcome">{outcome.text}</p>
                {s.pendingPick && (
                  <div class="pick-grid">
                    <div class="muted" style={{ fontSize: 14, width: '100%' }}>
                      {s.pendingPick.title} {s.pendingPick.count > 1 ? `(${s.pendingPick.count} left)` : ''}
                    </div>
                    {s.pendingPick.kind === 'item' &&
                      s.pendingPick.items?.map((it) => (
                        <button key={it.id} class={`pick-card rar-${it.rarity}`} onClick={() => act((st) => (pickFromPending(st, it.id), audio.sfx('ui_buy')))} {...tip(<ItemTip itemId={it.id} />)}>
                          <ItemChip itemId={it.id} size={112} />
                          <span class="pick-name">{it.name}</span>
                          <span class="pick-rar">{it.rarity}</span>
                        </button>
                      ))}
                    {s.pendingPick.kind === 'relic' &&
                      s.pendingPick.relics?.map((r) => (
                        <button key={r.id} class={`pick-card rar-${r.rarity}`} onClick={() => act((st) => (pickFromPending(st, r.id), audio.sfx('ui_buy')))} {...tip(<RelicTip relicId={r.id} />)}>
                          <div class={`relic-chip rar-${r.rarity}`}>
                            <Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={78} />
                          </div>
                          <span class="pick-name">{r.name}</span>
                          <span class="pick-desc">
                            <RichText text={r.desc} />
                          </span>
                        </button>
                      ))}
                  </div>
                )}
                {!s.pendingPick && (
                  <button
                    class="btn primary"
                    style={{ alignSelf: 'flex-end', marginTop: 12 }}
                    onClick={() => {
                      audio.sfx('ui_confirm');
                      act((st) => finishEvent(st));
                    }}
                  >
                    {outcome.fight ? 'To the valley' : 'Continue'} <Icon name="ui_proceed" size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Hud>
    </div>
  );
}

/** Painted icon for an event choice, read from what its description promises. */
function choiceIcon(desc: string): string {
  const d = desc.toLowerCase();
  if (/1v1|defeat the creature/.test(d)) return 'choice_fight';
  if (/ranks? up/.test(d)) return 'choice_breakthrough';
  if (/permanently gains/.test(d)) return 'choice_cultivate';
  if (/50%|wager|lose \[?\d+%/.test(d)) return 'choice_gamble';
  if (/dao insight/.test(d)) return 'choice_insight';
  if (/treasure/.test(d)) return 'choice_treasure';
  if (/nothing happens/.test(d)) return 'choice_leave';
  if (/heal|restore/.test(d)) return 'choice_heal';
  if (/disciple/.test(d)) return 'choice_disciple';
  if (/spirit stones/.test(d)) return 'stones';
  return 'choice_leave';
}
