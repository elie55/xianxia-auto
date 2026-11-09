import { act, run } from '@/app/store';
import { chooseReward, finishRewardPick, pickFromPending } from '@/core/run';
import { RELIC_BY_ID } from '@/content/relics';
import { Hud, RelicTip } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { ItemChip, ItemTip } from '@/ui/components/HeroCard';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

export function RewardScreen() {
  const s = run.value!;
  useArena(s);
  const relics = s.pendingReward;
  const pick = s.pendingPick;
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="modal-backdrop soft">
          <div class="reward-wrap anim-rise">
            <div class="brush result-hanzi" style={{ marginTop: 0 }}>
              赏
            </div>
            <div class="result-title display">{pick ? pick.title : 'Choose Your Reward'}</div>
            <div class="reward-row stagger">
              {relics?.map((r) => (
                <button
                  key={r.id}
                  class={`reward-card panel rar-${r.rarity}`}
                  onClick={() => {
                    audio.sfx('ui_buy');
                    act((st) => chooseReward(st, r.id));
                  }}
                  {...tip(<RelicTip relicId={r.id} />)}
                >
                  <div class={`reward-icon rar-${r.rarity}`}>
                    <Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={44} />
                  </div>
                  <div class="reward-name display">{r.name}</div>
                  <div class="reward-rar">{r.rarity} Dao Insight</div>
                  <div class="reward-desc">
                    <RichText text={r.desc} />
                  </div>
                </button>
              ))}
              {!relics &&
                pick?.kind === 'item' &&
                pick.items?.map((it) => (
                  <button
                    key={it.id}
                    class={`reward-card panel rar-${it.rarity}`}
                    onClick={() => {
                      audio.sfx('ui_buy');
                      act((st) => {
                        pickFromPending(st, it.id);
                        if (!st.pendingPick) finishRewardPick(st);
                      });
                    }}
                    {...tip(<ItemTip itemId={it.id} />)}
                  >
                    <div class="reward-icon">
                      <ItemChip itemId={it.id} size={64} />
                    </div>
                    <div class="reward-name display">{it.name}</div>
                    <div class="reward-rar">{it.rarity} Treasure</div>
                    {it.desc && (
                      <div class="reward-desc">
                        <RichText text={it.desc} />
                      </div>
                    )}
                  </button>
                ))}
              {!relics &&
                pick?.kind === 'relic' &&
                pick.relics?.map((r) => (
                  <button
                    key={r.id}
                    class={`reward-card panel rar-${r.rarity}`}
                    onClick={() => {
                      audio.sfx('ui_buy');
                      act((st) => {
                        pickFromPending(st, r.id);
                        if (!st.pendingPick) finishRewardPick(st);
                      });
                    }}
                    {...tip(<RelicTip relicId={r.id} />)}
                  >
                    <div class={`reward-icon rar-${r.rarity}`}>
                      <Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={44} />
                    </div>
                    <div class="reward-name display">{r.name}</div>
                    <div class="reward-rar">{r.rarity} Dao Insight</div>
                    <div class="reward-desc">
                      <RichText text={r.desc} />
                    </div>
                  </button>
                ))}
            </div>
            {!relics && !pick && (
              <button class="btn primary" onClick={() => act((st) => finishRewardPick(st))}>
                Continue
              </button>
            )}
          </div>
        </div>
      </Hud>
    </div>
  );
}
