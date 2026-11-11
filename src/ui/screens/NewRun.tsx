import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { meta, screen, setRun } from '@/app/store';
import { DIFFICULTIES } from '@/content/difficulties';
import { THEMES } from '@/content/themes';
import { ladderFloorOf, newRun, resetItemQuests } from '@/core/run';
import { randomSeed } from '@/core/rng';
import { Icon } from '@/ui/components/Icon';
import { tip } from '@/ui/components/Tooltip';
import { HEIRLOOM_RECIPES, heirloomItemId } from '@/content/heirlooms';
import { isOpen, runSectFor, sectOf } from '@/meta/sect';
import { setCarry, setDoctrine, setPure, takeOmens } from '@/meta/sectActions';
import { OMEN_BY_ID } from '@/content/sectEvents';
import { omenText } from '@/meta/sectEvents';
import { DOCTRINE_BY_ID } from '@/content/doctrines';
import { ItemTip } from '@/ui/components/HeroCard';
import { RichText } from '@/ui/components/RichText';
import { audio } from '@/audio/AudioManager';
import { cssUrl } from '@/ui/assetUrl';

/** Each contract's colour, from the calm jade of the mortal road to the crimson of the Tribulation. */
const TIER_COLOR = ['#9fd8c4', '#6fe3c4', '#8fd5ff', '#f3cf78', '#ffb347', '#ff7a5a', '#c27cff', '#ff3d5a'];
/** The icon of the modifier each contract adds. */
const MOD_ICON: Record<number, string> = { 1: 'kw_bleed', 2: 'stat_hp', 3: 'stones', 4: 'ui_bag', 5: 'stat_attack', 6: 'ui_shop', 7: 'kw_lightning' };
const MAX_TIER = DIFFICULTIES.length - 1;
/** A contract's own Realm I battlefield, painted behind its seal once that battlefield exists. */
const fieldArt = (tier: number) => {
  const t = THEMES.find((th) => th.tier === tier && th.realm === 1 && th.ready);
  return t ? cssUrl(`assets/art/bg/${t.art}.jpg`) : undefined;
};

export function NewRun() {
  const m = meta.value;
  const [tier, setTier] = useState(Math.min(m.unlockedTier, MAX_TIER));
  const [seedText, setSeedText] = useState('');
  const [advanced, setAdvanced] = useState(false);
  // the heirloom the sect sends along (src/meta/sect.ts): the last one picked, if it still exists
  const sect = sectOf(m);
  const forgeOpen = isOpen('forge', m.renown?.xp ?? 0);
  const owned = forgeOpen ? sect.heirlooms : [];
  const [carry, setCarryState] = useState(owned.some((h) => h.id === sect.carry) ? sect.carry : '');
  // the doctrine to follow (src/content/doctrines.ts): one the Doctrine Hall has taught
  const xp = m.renown?.xp ?? 0;
  const learned = isOpen('doctrine', xp) ? sect.doctrines.map((id) => DOCTRINE_BY_ID[id]).filter(Boolean) : [];
  const [doctrine, setDoctrineState] = useState(learned.some((d) => d.id === sect.doctrine) ? sect.doctrine : '');
  // a Pure run leaves the doctrine and the heirloom at home and pays +20% Sect Renown
  const sectOpen = isOpen('hall', xp);
  const [pure, setPureState] = useState(sectOpen && sect.pure);
  const start = () => {
    const seed = seedText.trim() ? hashSeed(seedText.trim()) : randomSeed();
    resetItemQuests();
    if (carry !== sect.carry) setCarry(carry);
    if (doctrine !== sect.doctrine) setDoctrine(doctrine);
    if (pure !== sect.pure) setPure(pure);
    const sectRun = runSectFor(meta.value, carry, { doctrine, pure });
    setRun(newRun(tier, seed, sectRun));
    // the omens go with this run (a Pure run leaves its boons for the next one)
    takeOmens(sectRun.omens);
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
                class={`tier-card ${x.tier === tier ? 'active' : ''} ${locked ? 'locked' : ''} ${fieldArt(x.tier) ? 'has-art' : ''}`}
                style={{ ['--tc' as string]: TIER_COLOR[x.tier], ['--art' as string]: fieldArt(x.tier) }}
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
            {learned.length > 0 && (
              <div class={`heirloom-pick doctrine-pick ${pure ? 'off' : ''}`}>
                <span class="heirloom-pick-label">Doctrine</span>
                <button
                  class={`heirloom-chip ${doctrine === '' ? 'on' : ''}`}
                  disabled={pure}
                  onClick={() => {
                    audio.sfx('ui_click', { volume: 0.5 });
                    setDoctrineState('');
                  }}
                  {...tip('Follow no doctrine.', 'below')}
                >
                  None
                </button>
                {learned.map((d) => (
                  <button
                    key={d.id}
                    class={`heirloom-chip doctrine-chip ${doctrine === d.id ? 'on' : ''}`}
                    disabled={pure}
                    onClick={() => {
                      audio.sfx('ui_click', { volume: 0.5 });
                      setDoctrineState(d.id);
                    }}
                    {...tip(
                      <>
                        <h4>{d.name}</h4>
                        <p>
                          <b style={{ color: '#7fdcae' }}>+</b> <RichText text={d.upside} />
                        </p>
                        <p>
                          <b style={{ color: '#e8907e' }}>−</b> <RichText text={d.cost} />
                        </p>
                      </>,
                      'below',
                    )}
                  >
                    <Icon name={d.icon} size={28} />
                    <span class="brush doctrine-chip-hanzi">{d.hanzi}</span>
                  </button>
                ))}
              </div>
            )}
            {owned.length > 0 && (
              <div class={`heirloom-pick ${pure ? 'off' : ''}`}>
                <span class="heirloom-pick-label">Heirloom</span>
                <button
                  class={`heirloom-chip ${carry === '' ? 'on' : ''}`}
                  disabled={pure}
                  onClick={() => {
                    audio.sfx('ui_click', { volume: 0.5 });
                    setCarryState('');
                  }}
                  {...tip('Start the run without an heirloom.', 'below')}
                >
                  None
                </button>
                {owned.map((h) => {
                  const r = HEIRLOOM_RECIPES.find((x) => x.id === h.id);
                  if (!r) return null;
                  return (
                    <button
                      key={h.id}
                      class={`heirloom-chip ${carry === h.id ? 'on' : ''}`}
                      disabled={pure}
                      onClick={() => {
                        audio.sfx('ui_click', { volume: 0.5 });
                        setCarryState(h.id);
                      }}
                      {...tip(<ItemTip itemId={heirloomItemId(h.id, h.level)} />, 'below')}
                    >
                      <Icon name={`item_${r.icon}`} size={30} />
                      <span class="heirloom-pips">
                        {[1, 2, 3].map((i) => (
                          <i key={i} class={i <= h.level ? 'lit' : ''} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {sect.omens.length > 0 && (
              <div class="heirloom-pick omen-pick">
                <span class="heirloom-pick-label">Omens</span>
                {sect.omens.map((o) => {
                  const def = OMEN_BY_ID[o.id];
                  const waits = pure && !!def.boon;
                  return (
                    <span
                      key={`${o.id}-${o.hero ?? ''}`}
                      class={`heirloom-chip omen-chip ${waits ? 'waits' : 'on'}`}
                      {...tip(
                        <>
                          <h4>{def.name}</h4>
                          <p>
                            <RichText text={omenText(o)} />
                          </p>
                          <p class="muted">{waits ? 'A Pure run leaves this boon for your next run.' : 'From a sect event: it goes with this run.'}</p>
                        </>,
                        'below',
                      )}
                    >
                      <Icon name={def.icon} size={30} />
                    </span>
                  );
                })}
              </div>
            )}
            <div class="seed-adv">
              <button
                class={`adv-toggle ${advanced ? 'open' : ''}`}
                onClick={() => {
                  audio.sfx('ui_click', { volume: 0.5 });
                  setAdvanced(!advanced);
                }}
              >
                <i class="chev" /> Advanced
                {!advanced && pure && <span class="seed-set pure-set">Pure run</span>}
                {!advanced && seedText.trim() && <span class="seed-set">Seed {seedText.trim()}</span>}
              </button>
              {advanced && (
                <div class="seed-panel">
                  {sectOpen && (
                    <label class={`pure-toggle ${pure ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={pure}
                        onChange={(e) => {
                          audio.sfx('ui_click', { volume: 0.5 });
                          setPureState((e.target as HTMLInputElement).checked);
                        }}
                      />
                      <span class="pure-box" aria-hidden="true">
                        {pure && <Icon name="ui_check" size={14} />}
                      </span>
                      <span class="pure-text">
                        <b>Pure run</b>
                        <span>No doctrine, heirloom or other sect bonus. The run pays +20% Sect Renown, and a Ladder record is marked Pure.</span>
                      </span>
                    </label>
                  )}
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
                  <span class="board-name">
                    {e.name}
                    {e.pure && (
                      <span class="board-pure" {...tip('A Pure run: no doctrine, heirloom or sect bonus.', 'left')}>
                        Pure
                      </span>
                    )}
                  </span>
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
