import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { meta, screen, setRun } from '@/app/store';
import { DIFFICULTIES } from '@/content/difficulties';
import { ladderFloorOf, newRun, resetItemQuests } from '@/core/run';
import { randomSeed } from '@/core/rng';
import { Icon } from '@/ui/components/Icon';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

/** Each contract's colour, from the calm jade of the mortal road to the crimson of the Tribulation. */
const TIER_COLOR = ['#9fd8c4', '#6fe3c4', '#8fd5ff', '#f3cf78', '#ffb347', '#ff7a5a', '#c27cff', '#ff3d5a'];
/** The icon of the modifier each contract adds. */
const MOD_ICON: Record<number, string> = { 1: 'kw_bleed', 2: 'stat_hp', 3: 'stones', 4: 'ui_bag', 5: 'stat_attack', 6: 'ui_shop', 7: 'kw_lightning' };
const MAX_TIER = DIFFICULTIES.length - 1;

export function NewRun() {
  const m = meta.value;
  const [tier, setTier] = useState(Math.min(m.unlockedTier, MAX_TIER));
  const [seedText, setSeedText] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const start = () => {
    const seed = seedText.trim() ? hashSeed(seedText.trim()) : randomSeed();
    resetItemQuests();
    setRun(newRun(tier, seed));
    screen.value = 'run';
    audio.sfx('ui_confirm');
  };
  const d = DIFFICULTIES[tier];
  const active = DIFFICULTIES.filter((x) => x.tier <= tier && x.tier > 0).reverse();
  const next = m.unlockedTier < MAX_TIER ? DIFFICULTIES[m.unlockedTier + 1] : null;
  return (
    <div class="screen newrun-screen v2">
      <div class="newrun-bg">
        <div class="watermark" style={{ right: 60, bottom: -40, fontSize: 420 }}>
          契
        </div>
      </div>
      <div class="newrun-header">
        <button
          class="btn small ghost"
          data-hotkey="back"
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          <Icon name="ui_back" size={20} /> Back
        </button>
        <div class="display newrun-title">New Run</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="newrun-body anim-rise">
        <div class="newrun-label">SELECT A HEAVENLY CONTRACT FOR YOUR ASCENSION</div>
        <div class="tier-row v2">
          {DIFFICULTIES.map((x) => {
            const locked = x.tier > m.unlockedTier;
            const cleared = x.tier <= m.bestTierCleared;
            return (
              <button
                key={x.tier}
                class={`tier-card ${x.tier === tier ? 'active' : ''} ${locked ? 'locked' : ''}`}
                style={{ ['--tc' as string]: TIER_COLOR[x.tier] }}
                disabled={locked}
                onClick={() => {
                  if (x.tier === tier) return;
                  audio.sfx('ui_click');
                  setTier(x.tier);
                }}
                {...tip(
                  <>
                    <h4>{x.name}</h4>
                    <div class="sub">Contract {x.tier} of {MAX_TIER}</div>
                    <p>{x.desc}</p>
                    {locked && <p class="muted">Clear both realms on {DIFFICULTIES[x.tier - 1].name} to unlock it.</p>}
                  </>,
                  'below',
                )}
              >
                {x.short !== x.hanzi && <span class="tier-letter display">{x.short}</span>}
                {cleared && (
                  <span class="tier-cleared" aria-label="Cleared">
                    <Icon name="ui_check" size={14} />
                  </span>
                )}
                <span class="tier-seal">
                  <span class="brush">{x.hanzi}</span>
                  {locked && <Icon name="ui_lock" size={30} class="tier-lock" />}
                </span>
                <span class="tier-card-name">{x.name}</span>
                <span class="tier-pips" aria-label={`Difficulty ${x.tier} of ${MAX_TIER}`}>
                  {Array.from({ length: MAX_TIER }, (_, i) => (
                    <i key={i} class={i < x.tier ? 'lit' : ''} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div class="newrun-columns">
          <div class="panel newrun-mods v2">
            <div class="panel-title display">
              Contract Modifiers {active.length > 0 && <span class="mods-count">{active.length}</span>}
            </div>
            {active.length === 0 ? (
              <div class="mods-empty">
                <span class="brush">凡</span>
                <p>The Mortal contract carries no modifiers: the gentlest road to ascension.</p>
                <p class="muted">Clear both realms on it to unlock Qi Condensation.</p>
              </div>
            ) : (
              <>
                {active.map((x) => (
                  <div key={x.tier} class={`mod-chip ${x.tier === tier ? 'own' : ''}`} style={{ ['--tc' as string]: TIER_COLOR[x.tier] }}>
                    <span class="mod-medal">
                      <Icon name={MOD_ICON[x.tier] ?? 'ui_challenge'} size={26} />
                    </span>
                    <span class="mod-text">{x.desc}</span>
                    <span class="brush mod-tier" {...tip(x.name, 'left')}>
                      {x.hanzi}
                    </span>
                  </div>
                ))}
                <p class="mods-note">Each contract keeps the modifiers of the ones before it.</p>
              </>
            )}
          </div>
          <div class="newrun-center">
            <div class="contract-seal" style={{ ['--tc' as string]: TIER_COLOR[tier] }}>
              <div class="seal-ring" />
              <div class="brush seal-glyph">{d.hanzi}</div>
            </div>
            <div class="display seal-title" style={{ color: TIER_COLOR[tier] }}>
              {d.name}
            </div>
            <div class="seal-sub">
              {active.length === 0 ? 'No modifiers' : `${active.length} modifier${active.length > 1 ? 's' : ''}`} <span class="faint">·</span> Ladder bonus <b class="gold">+{tier * 2}</b>
            </div>
            <div class="seed-adv">
              <button
                class={`adv-toggle ${advanced ? 'open' : ''}`}
                onClick={() => {
                  audio.sfx('ui_click', { volume: 0.5 });
                  setAdvanced(!advanced);
                }}
              >
                <i class="chev" /> Advanced
                {!advanced && seedText.trim() && <span class="seed-set">Seed {seedText.trim()}</span>}
              </button>
              {advanced && (
                <div class="seed-panel">
                  <label class="seed-field">
                    <span class="seed-label">Seed</span>
                    <input class="seed-input v2" placeholder="Random" value={seedText} spellcheck={false} maxLength={24} onInput={(e) => setSeedText((e.target as HTMLInputElement).value)} />
                    <button
                      class="seed-dice"
                      aria-label="Roll a seed"
                      onClick={(e) => {
                        e.preventDefault();
                        audio.sfx('ui_click', { volume: 0.5 });
                        setSeedText(randomSeed().toString(36).toUpperCase().slice(0, 6));
                      }}
                      {...tip('Roll a seed', 'below')}
                    >
                      <Icon name="ui_reroll" size={18} />
                    </button>
                  </label>
                  <p class="seed-hint">A seed fixes the luck of a run: the same seed and the same choices give the same drafts, shops and fights. Leave it empty for a random run.</p>
                </div>
              )}
            </div>
          </div>
          <div class="panel newrun-board v2">
            <div class="panel-title display">
              <Icon name="ui_leaderboard" size={18} /> Heavenly Ladder
            </div>
            <div class="ladder-bests">
              <Best icon="ui_fight" label="Runs">
                {m.runsPlayed}
              </Best>
              <Best icon="ui_trophy" label="Victories">
                {m.runsWon}
              </Best>
              <Best icon="ui_star" label="Best floor">
                {m.lifetime?.bestFloor || (m.leaderboard.length ? ladderFloorOf(m.bestEndless) : 'None')}
              </Best>
              <Best icon="ui_rank" label="Highest cleared">
                {m.bestTierCleared >= 0 ? (
                  <span style={{ color: TIER_COLOR[m.bestTierCleared] }}>{DIFFICULTIES[m.bestTierCleared].name}</span>
                ) : (
                  'None yet'
                )}
              </Best>
            </div>
            {next ? (
              <div class="ladder-next" style={{ ['--tc' as string]: TIER_COLOR[next.tier] }}>
                <span class="brush ladder-next-seal">{next.hanzi}</span>
                <div>
                  <div class="ladder-next-label">Next contract</div>
                  <div class="display ladder-next-name">{next.name}</div>
                  <div class="ladder-next-how">Clear both realms on {DIFFICULTIES[m.unlockedTier].name} to unlock it.</div>
                </div>
              </div>
            ) : (
              <div class="ladder-next done" style={{ ['--tc' as string]: TIER_COLOR[MAX_TIER] }}>
                <span class="brush ladder-next-seal">劫</span>
                <div>
                  <div class="ladder-next-label">Every contract unlocked</div>
                  <div class="ladder-next-how">The Heavenly Tribulation awaits.</div>
                </div>
              </div>
            )}
            <div class="ladder-sub">Best ascents</div>
            {m.leaderboard.length === 0 ? (
              <p class="ladder-empty">No ascensions recorded yet. Clear both realms to climb the Ladder.</p>
            ) : (
              m.leaderboard.slice(0, 5).map((e, i) => (
                <div key={i} class="board-row v2">
                  <span class="board-rank">{i + 1}</span>
                  <span class="brush board-tier" style={{ color: TIER_COLOR[e.tier] ?? 'var(--gold)' }} {...tip(DIFFICULTIES[e.tier]?.name ?? '', 'left')}>
                    {DIFFICULTIES[e.tier]?.hanzi}
                  </span>
                  <span class="board-name">{e.name}</span>
                  <span class="gold">Floor {e.floor ?? ladderFloorOf(e.score)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div class="newrun-footer">
        <button class="btn gold big" onClick={start}>
          <span class="btn-glyph">启</span> Begin Ascension
        </button>
      </div>
    </div>
  );
}

function Best({ icon, label, children }: { icon: string; label: string; children: ComponentChildren }) {
  return (
    <div class="ladder-best">
      <Icon name={icon} size={22} />
      <span class="ladder-best-label">{label}</span>
      <b class="ladder-best-value">{children}</b>
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
