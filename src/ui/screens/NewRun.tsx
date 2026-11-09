import { useState } from 'preact/hooks';
import { meta, screen, setRun } from '@/app/store';
import { DIFFICULTIES } from '@/content/difficulties';
import { newRun, resetItemQuests } from '@/core/run';
import { randomSeed } from '@/core/rng';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';

export function NewRun() {
  const m = meta.value;
  const [tier, setTier] = useState(Math.min(m.unlockedTier, 7));
  const [seedText, setSeedText] = useState('');
  const start = () => {
    const seed = seedText.trim() ? hashSeed(seedText.trim()) : randomSeed();
    resetItemQuests();
    setRun(newRun(tier, seed));
    screen.value = 'run';
    audio.sfx('ui_confirm');
  };
  const active = DIFFICULTIES.filter((d) => d.tier <= tier && d.tier > 0).reverse();
  return (
    <div class="screen newrun-screen">
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
          ‹ Back
        </button>
        <div class="display newrun-title">New Run</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="newrun-body anim-rise">
        <div class="newrun-label">SELECT A HEAVENLY CONTRACT FOR YOUR ASCENSION</div>
        <div class="tier-row">
          {DIFFICULTIES.map((d) => {
            const locked = d.tier > m.unlockedTier;
            return (
              <button
                key={d.tier}
                class={`tier-box ${d.tier === tier ? 'active' : ''} ${locked ? 'locked' : ''}`}
                disabled={locked}
                onClick={() => {
                  audio.sfx('ui_click');
                  setTier(d.tier);
                }}
              >
                {locked ? <Icon name="ui_lock" size={26} /> : <span class="display tier-short">{d.short}</span>}
                <span class="tier-name">{d.name}</span>
              </button>
            );
          })}
        </div>
        <div class="newrun-columns">
          <div class="panel newrun-mods">
            <div class="panel-title display">Contract Modifiers</div>
            <div class="muted" style={{ marginBottom: 10 }}>
              Ladder score bonus: <b class="gold">+{tier * 2}</b>
            </div>
            {active.length === 0 && <div class="muted">The Mortal contract carries no modifiers. Clear it to unlock Qi Condensation.</div>}
            {active.map((d) => (
              <div key={d.tier} class="mod-row">
                <span class="display mod-letter">{d.short}</span>
                <span>{d.desc}</span>
              </div>
            ))}
          </div>
          <div class="newrun-center">
            <div class="contract-seal">
              <div class="seal-ring" />
              <div class="brush seal-glyph">{DIFFICULTIES[tier].hanzi}</div>
            </div>
            <div class="display seal-title">{DIFFICULTIES[tier].name}</div>
            <div class="seed-row">
              <span class="muted">Seed</span>
              <input class="seed-input" placeholder="random" value={seedText} onInput={(e) => setSeedText((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <div class="panel newrun-board">
            <div class="panel-title display">
              <Icon name="ui_leaderboard" size={18} /> Heavenly Ladder
            </div>
            {m.leaderboard.length === 0 && <div class="muted">No ascensions recorded yet. Clear both realms to climb the Ladder.</div>}
            {m.leaderboard.slice(0, 8).map((e, i) => (
              <div key={i} class="board-row">
                <span class="muted">#{i + 1}</span>
                <span>{e.name}</span>
                <span class="gold">floor {e.score}</span>
              </div>
            ))}
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

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
