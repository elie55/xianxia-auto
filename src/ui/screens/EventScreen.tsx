import { useEffect, useState } from 'preact/hooks';
import { act, run } from '@/app/store';
import { eventContext, finishEvent, pickFromPending, resolveEventChoice } from '@/core/run';
import { EVENT_BY_ID } from '@/content/events';
import { HERO_BY_ID } from '@/content/heroes';
import { Hud, RelicTip } from '@/ui/hud/Hud';
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
            {!artFailed && <img src={`./assets/art/events/${ev.art}.png`} alt="" onError={() => setArtFailed(true)} />}
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
                <div class="event-choices">
                  {ev.choices.map((c) => {
                    const available = !c.available || c.available(ctx);
                    const active = pendingChoice === c.id;
                    return (
                      <button key={c.id} class={`event-choice ${available ? '' : 'disabled'} ${active ? 'active' : ''}`} disabled={!available} onClick={() => choose(c.id)}>
                        <div class="choice-label display">
                          {c.label}
                          {c.cost ? (
                            <span class="price-inline">
                              <Icon name="stones" size={12} /> {c.cost}
                            </span>
                          ) : null}
                        </div>
                        <div class="choice-desc">
                          <RichText text={c.desc} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {pendingChoice && (
                  <div class="hero-picker anim-rise">
                    <div class="muted" style={{ fontSize: 13 }}>
                      Choose a disciple:
                    </div>
                    <div class="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                      {s.roster.map((h) => (
                        <button key={h.uid} class={`champion-pick ${hero === h.uid ? 'on' : ''}`} onClick={() => setHero(h.uid)}>
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
                    <div class="muted" style={{ fontSize: 13, width: '100%' }}>
                      {s.pendingPick.title} {s.pendingPick.count > 1 ? `(${s.pendingPick.count} left)` : ''}
                    </div>
                    {s.pendingPick.kind === 'item' &&
                      s.pendingPick.items?.map((it) => (
                        <button key={it.id} class={`pick-card rar-${it.rarity}`} onClick={() => act((st) => (pickFromPending(st, it.id), audio.sfx('ui_buy')))} {...tip(<ItemTip itemId={it.id} />)}>
                          <ItemChip itemId={it.id} size={48} />
                          <span class="pick-name">{it.name}</span>
                          <span class="pick-rar">{it.rarity}</span>
                        </button>
                      ))}
                    {s.pendingPick.kind === 'relic' &&
                      s.pendingPick.relics?.map((r) => (
                        <button key={r.id} class={`pick-card rar-${r.rarity}`} onClick={() => act((st) => (pickFromPending(st, r.id), audio.sfx('ui_buy')))} {...tip(<RelicTip relicId={r.id} />)}>
                          <div class={`relic-chip rar-${r.rarity}`}>
                            <Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={22} />
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
