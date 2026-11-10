import type { ComponentChildren } from 'preact';
import { act, run } from '@/app/store';
import { chooseReward, finishRewardPick, pickFromPending, skipReward, SKIP_REWARD_STONES } from '@/core/run';
import { RELIC_BY_ID } from '@/content/relics';
import { Hud, RelicTip } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { ItemChip, ItemTip } from '@/ui/components/HeroCard';
import { BrushBanner } from '@/ui/components/Triumph';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

/**
 * Reward picks are a celebration: big cards with rarity frames and glow flip in one by one with a burst, lift on
 * hover, and a Skip trades the offer for a few Spirit Stones.
 */
export function RewardScreen() {
  const s = run.value!;
  useArena(s);
  const relics = s.pendingReward;
  const pick = s.pendingPick;
  const offering = !!relics || !!pick;
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="modal-backdrop soft">
          <div class="reward-wrap v2">
            <BrushBanner title={pick ? pick.title : 'Spoils'} seal="赏" tone="gold" sub={pick && pick.count > 1 ? `Choose ${pick.count}` : offering ? 'Choose one' : undefined} />
            <div class="reward-row v2">
              {relics?.map((r, i) => (
                <RewardCard
                  key={r.id}
                  i={i}
                  rarity={r.rarity}
                  kind="Dao Insight"
                  name={r.name}
                  art={<Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={96} />}
                  desc={r.desc}
                  tipBody={<RelicTip relicId={r.id} />}
                  onPick={() => act((st) => chooseReward(st, r.id))}
                />
              ))}
              {!relics &&
                pick?.kind === 'item' &&
                pick.items?.map((it, i) => (
                  <RewardCard
                    key={it.id}
                    i={i}
                    rarity={it.rarity}
                    kind="Treasure"
                    name={it.name}
                    art={<ItemChip itemId={it.id} size={104} />}
                    desc={it.desc}
                    tipBody={<ItemTip itemId={it.id} />}
                    onPick={() =>
                      act((st) => {
                        pickFromPending(st, it.id);
                        if (!st.pendingPick) finishRewardPick(st);
                      })
                    }
                  />
                ))}
              {!relics &&
                pick?.kind === 'relic' &&
                pick.relics?.map((r, i) => (
                  <RewardCard
                    key={r.id}
                    i={i}
                    rarity={r.rarity}
                    kind="Dao Insight"
                    name={r.name}
                    art={<Icon name={`relic_${RELIC_BY_ID[r.id].icon}`} size={96} />}
                    desc={r.desc}
                    tipBody={<RelicTip relicId={r.id} />}
                    onPick={() =>
                      act((st) => {
                        pickFromPending(st, r.id);
                        if (!st.pendingPick) finishRewardPick(st);
                      })
                    }
                  />
                ))}
            </div>
            <div class="reward-footer">
              {offering ? (
                <button
                  class="btn ghost reward-skip"
                  onClick={() => {
                    audio.sfx('stones', { volume: 0.4 });
                    act((st) => skipReward(st));
                  }}
                >
                  Skip <span class="skip-gain">+{SKIP_REWARD_STONES} <Icon name="stones" size={18} /></span>
                </button>
              ) : (
                <button class="btn primary big" onClick={() => act((st) => finishRewardPick(st))}>
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

function RewardCard({ i, rarity, kind, name, art, desc, tipBody, onPick }: { i: number; rarity: string; kind: string; name: string; art: ComponentChildren; desc?: string; tipBody: ComponentChildren; onPick: () => void }) {
  return (
    <button
      class={`reward-card v2 panel rar-${rarity}`}
      style={{ ['--i' as string]: i }}
      onClick={() => {
        audio.sfx('ui_buy');
        onPick();
      }}
      {...tip(tipBody)}
    >
      <span class="reward-burst" aria-hidden="true" />
      <span class="reward-rays" aria-hidden="true" />
      <div class={`reward-medal rar-${rarity}`}>{art}</div>
      <div class="reward-name display">{name}</div>
      <div class="reward-rar">
        {rarity} {kind}
      </div>
      {desc && (
        <div class="reward-desc">
          <RichText text={desc} />
        </div>
      )}
      <div class="reward-choose display">Choose</div>
    </button>
  );
}
