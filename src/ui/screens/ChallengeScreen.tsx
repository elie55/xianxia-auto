import { act, run } from '@/app/store';
import { acceptChallenge } from '@/core/run';
import { Hud } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { PAINTED_ICONS } from '@/ui/components/paintedIcons';
import { audio } from '@/audio/AudioManager';

export function ChallengeScreen() {
  const s = run.value!;
  useArena(s);
  const offers = s.challengeOffers ?? [];
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="modal-backdrop soft">
          <div class="reward-wrap anim-rise">
            <div class="brush result-hanzi" style={{ marginTop: 0 }}>
              挑
            </div>
            <div class="result-title display">Challenge Encounter</div>
            <div class="muted" style={{ maxWidth: 640, textAlign: 'center' }}>
              A stronger foe blocks the road. Accept a hardship to earn a greater reward, or fight it as it comes.
            </div>
            <div class="reward-row stagger">
              {offers.map((c) => (
                <button
                  key={c.id}
                  class="reward-card panel challenge"
                  onClick={() => {
                    audio.sfx('ui_confirm');
                    act((st) => acceptChallenge(st, c.id));
                  }}
                >
                  <div class="reward-icon painted">
                    <Icon name={challengeIcon(c.id)} size={PAINTED_ICONS.has(challengeIcon(c.id)) ? 92 : 44} color="var(--vermilion-bright)" />
                  </div>
                  <div class="reward-name display">{c.name}</div>
                  <div class="reward-rar">Challenge</div>
                  <div class="reward-desc red">{c.desc}</div>
                  <div class="reward-desc gold" style={{ marginTop: 8 }}>
                    Reward: {c.rewardDesc}
                  </div>
                </button>
              ))}
              <button
                class="reward-card panel decline"
                onClick={() => {
                  audio.sfx('ui_back');
                  act((st) => acceptChallenge(st, null));
                }}
              >
                <div class="reward-icon painted">
                  <Icon name={PAINTED_ICONS.has('challenge_decline') ? 'challenge_decline' : 'ui_fight'} size={PAINTED_ICONS.has('challenge_decline') ? 92 : 44} color="var(--paper-dim)" />
                </div>
                <div class="reward-name display">Decline</div>
                <div class="reward-rar">Regular fight</div>
                <div class="reward-desc muted">Face the encounter without a hardship. Standard rewards.</div>
              </button>
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

/** Painted icon for a challenge: its own (challenge_<id>), else the generic challenge seal, else the old glyph. */
function challengeIcon(id: string): string {
  if (PAINTED_ICONS.has(`challenge_${id}`)) return `challenge_${id}`;
  return PAINTED_ICONS.has('challenge_generic') ? 'challenge_generic' : 'ui_challenge';
}
