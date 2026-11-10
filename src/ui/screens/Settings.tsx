import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { meta, screen, updateMeta, type MetaSave } from '@/app/store';
import { fullscreen, toggleFullscreen } from '@/app/desktop';
import { audio } from '@/audio/AudioManager';
import { resetTutorial } from '@/ui/tutorial/Tutorial';
import { Icon } from '@/ui/components/Icon';

type Settings = MetaSave['settings'];
type Tab = 'audio' | 'display' | 'gameplay' | 'access' | 'controls';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'audio', label: 'Audio', icon: 'ui_music' },
  { id: 'display', label: 'Display', icon: 'ui_settings' },
  { id: 'gameplay', label: 'Gameplay', icon: 'ui_fight' },
  { id: 'access', label: 'Accessibility', icon: 'ui_info' },
  { id: 'controls', label: 'Controls', icon: 'ui_speed' },
];

const HOTKEYS: [string, string][] = [
  ['Space', 'Fight, or Proceed after a battle'],
  ['Esc', 'Pause menu, or back / close'],
  ['1  2  3', 'Battle speed'],
  ['R', 'Reroll the shop'],
  ['F', 'Freeze the shop'],
  ['E  /  Delete', 'Sell the disciple or Treasure under the cursor'],
  ['F11', 'Fullscreen'],
];

/** The Settings screen from the main menu. */
export function Settings() {
  return (
    <div class="screen settings-screen v2">
      <div class="newrun-bg" />
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
        <div class="display newrun-title">Settings</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="settings-body v2 anim-rise">
        <SettingsPanel />
      </div>
    </div>
  );
}

/** Tabbed settings: on the Settings screen, and inside the pause menu during a run. */
export function SettingsPanel({ inRun = false }: { inRun?: boolean }) {
  const [tab, setTab] = useState<Tab>('audio');
  const m = meta.value;
  const st = m.settings;
  const set = (fn: (s: Settings) => void) =>
    updateMeta((mm) => {
      fn(mm.settings);
    });
  const osReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div class={`settings-v2 ${inRun ? 'in-run' : ''}`}>
      <nav class="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`settings-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => {
              audio.sfx('ui_click', { volume: 0.5 });
              setTab(t.id);
            }}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div class="panel settings-pane" key={tab}>
        {tab === 'audio' && (
          <>
            <Row label="Master volume" hint="Scales music and effects together.">
              <Slider value={st.master ?? 1} onInput={(v) => set((s) => (s.master = v))} />
            </Row>
            <Row label="Music">
              <Slider value={st.music} onInput={(v) => set((s) => (s.music = v))} />
            </Row>
            <Row label="Sound effects">
              <Slider value={st.sfx} onInput={(v) => set((s) => (s.sfx = v))} onChange={() => audio.sfx('ui_click')} />
            </Row>
            <Row label="Mute in background" hint="Silence the game while its window is not in focus.">
              <Toggle on={!!st.muteUnfocused} onClick={() => set((s) => (s.muteUnfocused = !s.muteUnfocused))} />
            </Row>
          </>
        )}
        {tab === 'display' && (
          <>
            <Row label="Fullscreen" hint="F11 toggles it anywhere in the game.">
              <Toggle on={fullscreen.value} onClick={() => void toggleFullscreen()} />
            </Row>
            <Row label="Text size" hint="Labels, tooltips and descriptions.">
              <Choice value={st.textScale ?? 1} options={[1, 1.1, 1.2].map((v) => [v, `${Math.round(v * 100)}%`] as [number, string])} onPick={(v) => set((s) => (s.textScale = v))} />
            </Row>
            <Row label="Frame rate" hint="A cap saves power on laptops.">
              <Choice
                value={st.frameCap ?? 0}
                options={[
                  [0, 'Uncapped'],
                  [60, '60'],
                  [30, '30'],
                ]}
                onPick={(v) => set((s) => (s.frameCap = v as 0 | 30 | 60))}
              />
            </Row>
            <Row label="Damage numbers">
              <Toggle on={st.showDamage} onClick={() => set((s) => (s.showDamage = !s.showDamage))} />
            </Row>
            <Row label="Screen shake" hint="Also the brief freeze on heavy hits.">
              <Toggle on={st.screenShake} onClick={() => set((s) => (s.screenShake = !s.screenShake))} />
            </Row>
            <Row label="Battle camera" hint="Frames the fight and leans in on techniques and kills.">
              <Toggle on={st.battleCamera !== false} onClick={() => set((s) => (s.battleCamera = s.battleCamera === false))} />
            </Row>
          </>
        )}
        {tab === 'gameplay' && (
          <>
            <Row label="Default battle speed">
              <Choice
                value={st.battleSpeed}
                options={[
                  [1, '1×'],
                  [2, '2×'],
                  [3, '3×'],
                ]}
                onPick={(v) => set((s) => (s.battleSpeed = v as 1 | 2 | 3))}
              />
            </Row>
            <Row label="Auto-start fights" hint="Skip the Fight button once your sect is placed.">
              <Toggle on={st.autoBattle} onClick={() => set((s) => (s.autoBattle = !s.autoBattle))} />
            </Row>
            <Row label="Tooltip delay">
              <Choice
                value={st.tooltipDelay ?? 0}
                options={[
                  [0, 'Instant'],
                  [150, 'Short'],
                  [350, 'Medium'],
                  [700, 'Long'],
                ]}
                onPick={(v) => set((s) => (s.tooltipDelay = v))}
              />
            </Row>
            <Row label="Confirm before selling" hint="Ask before a disciple or Treasure is sold.">
              <Toggle on={!!st.confirmSell} onClick={() => set((s) => (s.confirmSell = !s.confirmSell))} />
            </Row>
            {!inRun && (
              <Row label="Tutorial">
                <button
                  class="btn small ghost"
                  onClick={() => {
                    resetTutorial();
                    audio.sfx('ui_confirm');
                  }}
                >
                  Replay on next run
                </button>
              </Row>
            )}
          </>
        )}
        {tab === 'access' && (
          <>
            <Row label="Reduce flashes and motion" hint={`Calmer casts and deaths: no screen shake, freeze-frames or bright flashes, and still menus. System follows your device (now ${osReduced ? 'on' : 'off'}).`}>
              <Choice
                value={st.reduceMotion === undefined ? 'system' : st.reduceMotion ? 'on' : 'off'}
                options={[
                  ['system', 'System'],
                  ['on', 'On'],
                  ['off', 'Off'],
                ]}
                onPick={(v) => set((s) => (s.reduceMotion = v === 'system' ? undefined : v === 'on'))}
              />
            </Row>
            <Row label="Colour vision" hint="Team colours on health bars and auras.">
              <Choice
                value={st.palette ?? 'default'}
                options={[
                  ['default', 'Default'],
                  ['deutan', 'Red-green'],
                  ['tritan', 'Blue-yellow'],
                ]}
                onPick={(v) => set((s) => (s.palette = v as Settings['palette']))}
              />
              <span class="palette-swatch" aria-hidden="true">
                <i class="ally" />
                <i class="enemy" />
              </span>
            </Row>
            <Row label="Text size" hint="Also under Display.">
              <Choice value={st.textScale ?? 1} options={[1, 1.1, 1.2].map((v) => [v, `${Math.round(v * 100)}%`] as [number, string])} onPick={(v) => set((s) => (s.textScale = v))} />
            </Row>
          </>
        )}
        {tab === 'controls' && (
          <>
            <div class="hotkey-table">
              {HOTKEYS.map(([k, what]) => (
                <div key={k} class="hotkey-line">
                  <span class="hotkey-keys">
                    {k.split(/\s{2,}/).map((part) => (part === '/' ? <span class="faint"> / </span> : <kbd class="keycap">{part}</kbd>))}
                  </span>
                  <span>{what}</span>
                </div>
              ))}
            </div>
            <p class="muted settings-note">Drag disciples onto the arena to place them, and Treasures onto a disciple to equip them. Hover anything for details.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class="settings-row v2">
      <div class="settings-label display">{label}</div>
      <div class="row settings-control">{children}</div>
      {hint && <div class="settings-hint">{hint}</div>}
    </div>
  );
}

function Slider({ value, onInput, onChange }: { value: number; onInput: (v: number) => void; onChange?: () => void }) {
  return (
    <>
      <input type="range" min={0} max={1} step={0.05} value={value} style={{ ['--pct' as string]: `${value * 100}%` }} onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))} onChange={onChange} />
      <span class="settings-value">{Math.round(value * 100)}%</span>
    </>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      class={`btn small ${on ? 'primary' : 'ghost'} settings-toggle`}
      onClick={() => {
        audio.sfx('ui_click', { volume: 0.5 });
        onClick();
      }}
    >
      {on ? 'On' : 'Off'}
    </button>
  );
}

function Choice<T extends string | number>({ value, options, onPick }: { value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div class="row settings-choice">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          class={`btn small ${value === v ? 'primary' : 'ghost'}`}
          onClick={() => {
            audio.sfx('ui_click', { volume: 0.5 });
            onPick(v);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
