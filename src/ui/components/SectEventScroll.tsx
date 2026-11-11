import { useState } from 'preact/hooks';
import { meta, showToast } from '@/app/store';
import { OMEN_BY_ID, type SectOmen } from '@/content/sectEvents';
import { CURRENCIES, type Purse } from '@/meta/sect';
import { choiceViews, omenText, pendingEvent, purseText, type ChoiceView } from '@/meta/sectEvents';
import { chooseSectEvent } from '@/meta/sectActions';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { audio } from '@/audio/AudioManager';

/** The painted icon for a sect event's choice: the omen it sends, else what it pays, else a parting gesture. */
function choiceIcon(v: ChoiceView): string {
  if (v.def.omen) return OMEN_BY_ID[v.def.omen].icon;
  const coin = CURRENCIES.find((c) => v.gain[c.key]);
  return coin ? coin.icon : 'choice_leave';
}

/**
 * A sect event (docs/META_PROGRESSION.md 6.8), as a scroll over the Sect's painting: its art and story, two or three
 * choices, then what came of the choice. "Decide later" leaves it waiting.
 */
export function SectEventScroll({ onClose }: { onClose: () => void }) {
  // the event as it was when the scroll opened (choosing clears it from the save)
  const [shown] = useState(() => pendingEvent(meta.peek()));
  const [done, setDone] = useState<{ choice: ChoiceView; outcome: string; gained: Partial<Purse>; spent?: Partial<Purse>; omen?: SectOmen } | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  if (!shown) return null;
  const { ev, def, text } = shown;
  const views = choiceViews(meta.value, ev);
  const choose = (v: ChoiceView) => {
    const r = chooseSectEvent(v.def.id);
    if (!r.ok) {
      audio.sfx('ui_error', { volume: 0.6 });
      showToast(r.reason, 'error');
      return;
    }
    audio.sfx('ui_confirm');
    setDone({ choice: v, outcome: r.outcome, gained: r.gained, spent: r.spent, omen: r.omen });
  };
  const gainedAny = done && CURRENCIES.some((c) => done.gained[c.key]);
  return (
    <div class="sect-event-backdrop">
      <div class="event-panel panel anim-pop sect-event" role="dialog" aria-label={def.title}>
        <div class="event-art">
          {!artFailed && <img src={`./assets/art/events/${def.art}.jpg`} alt="" onError={() => setArtFailed(true)} />}
          {artFailed && (
            <div class="event-art-fallback">
              <span class="brush">{def.hanzi}</span>
            </div>
          )}
          <div class="event-art-fade" />
        </div>
        <div class="event-body">
          <div class="event-kicker">AT THE SECT</div>
          <div class="event-title display">{def.title}</div>
          {!done && (
            <>
              <p class="event-text">{text}</p>
              <div class="event-choices">
                {views.map((v) => (
                  <button key={v.def.id} class={`event-choice ${v.affordable ? '' : 'disabled'}`} disabled={!v.affordable} onClick={() => choose(v)}>
                    <div class="choice-icon">
                      <Icon name={choiceIcon(v)} size={50} />
                    </div>
                    <div class="choice-main">
                      <div class="choice-label display">
                        {v.def.label}
                        {v.def.cost && (
                          <span class="price-inline">
                            {CURRENCIES.filter((c) => v.def.cost![c.key]).map((c) => (
                              <span key={c.key}>
                                <Icon name={c.icon} size={18} /> {v.def.cost![c.key]}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <div class="choice-desc">
                        <RichText text={v.desc} />
                        {!v.affordable && v.def.cost && <span class="sect-event-short"> The sect needs {purseText(v.def.cost)}.</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                class="btn ghost small sect-event-later"
                data-hotkey="back"
                onClick={() => {
                  audio.sfx('ui_back');
                  onClose();
                }}
              >
                Decide later
              </button>
            </>
          )}
          {done && (
            <>
              <div class="event-outcome anim-rise">
                <div class="outcome-medal">
                  <Icon name={choiceIcon(done.choice)} size={64} />
                </div>
                <div class="outcome-main">
                  <p class="event-text outcome">{done.outcome}</p>
                  {gainedAny && <div class="outcome-gain">+{purseText(done.gained)}</div>}
                  {done.spent && <div class="outcome-gain loss">−{purseText(done.spent)}</div>}
                </div>
              </div>
              {done.omen && (
                <div class="sect-omen-line anim-rise">
                  <Icon name={OMEN_BY_ID[done.omen.id].icon} size={44} />
                  <span>
                    <b>For your next run: {OMEN_BY_ID[done.omen.id].name}.</b> <RichText text={omenText(done.omen)} />
                  </span>
                </div>
              )}
              <button
                class="btn primary"
                data-hotkey="proceed"
                style={{ alignSelf: 'flex-end', marginTop: 12 }}
                onClick={() => {
                  audio.sfx('ui_confirm');
                  onClose();
                }}
              >
                Continue <Icon name="ui_proceed" size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
