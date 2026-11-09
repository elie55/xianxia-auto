import { useState } from 'preact/hooks';
import { act, run, showToast } from '@/app/store';
import { draftPick, draftReroll } from '@/core/run';
import { BLESSINGS } from '@/content/difficulties';
import { HeroCard } from '@/ui/components/HeroCard';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { audio } from '@/audio/AudioManager';

export function ChooseHero() {
  const s = run.value!;
  const d = s.draft!;
  const [hero, setHero] = useState<string | null>(null);
  const [blessing, setBlessing] = useState<string | null>(null);
  const confirm = () => {
    if (!hero || !blessing) return;
    audio.sfx('ui_confirm');
    act((st) => draftPick(st, hero, blessing));
  };
  return (
    <div class="screen draft-screen">
      <div class="draft-bg">
        <div class="watermark" style={{ left: 40, top: 60, fontSize: 360 }}>
          择
        </div>
      </div>
      <div class="draft-header anim-fade">
        <div class="brush draft-hanzi">选择弟子</div>
        <div class="display draft-title">Choose Your First Disciple</div>
        <div class="muted">Your sect begins with one cultivator. Recruit more in the shop after each fight.</div>
      </div>
      <div class="draft-cards stagger" data-tut="draft-cards" key={`deal${d.rerolls}`} ref={(el) => {
        if (el && !el.dataset.dealt) {
          el.dataset.dealt = '1';
          audio.sfx('ui_flip', { volume: 0.35 });
        }
      }}>
        {d.heroes.map((id) => (
          <HeroCard
            key={id + d.rerolls}
            defId={id}
            rank={s.blessing === 'scholar' ? 1 : 0}
            size="lg"
            selected={hero === id}
            dimmed={hero !== null && hero !== id}
            onClick={() => {
              audio.sfx('ui_card');
              setHero(id);
            }}
          />
        ))}
      </div>
      <div class="draft-blessings" data-tut="draft-blessings">
        <div class="draft-sub display">Starting Blessing</div>
        <div class="blessing-row stagger">
          {d.blessings.map((bid) => {
            const b = BLESSINGS.find((x) => x.id === bid)!;
            return (
              <button
                key={bid}
                class={`blessing-card panel plain ${blessing === bid ? 'selected' : ''}`}
                onClick={() => {
                  audio.sfx('ui_card');
                  setBlessing(bid);
                }}
              >
                <Icon name={b.icon} size={34} color="var(--gold-bright)" />
                <div>
                  <div class="blessing-name display">{b.name}</div>
                  <div class="blessing-desc">
                    <RichText text={b.desc} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div class="draft-footer">
        <div class="stones-pill">
          <Icon name="stones" size={20} color="var(--gold-bright)" /> {s.stones}
        </div>
        <button
          class="btn ghost"
          disabled={s.stones < 1}
          onClick={() => {
            act((st) => {
              if (!draftReroll(st)) showToast('Not enough Spirit Stones', 'error');
            });
            setHero(null);
            audio.sfx('ui_reroll');
          }}
        >
          <Icon name="ui_reroll" size={18} /> Reroll disciples · <Icon name="stones" size={16} /> 1
        </button>
        <button class="btn primary big" data-tut="draft-accept" disabled={!hero || !blessing} onClick={confirm}>
          <span class="btn-glyph">拜</span> Accept into the Sect
        </button>
      </div>
    </div>
  );
}
