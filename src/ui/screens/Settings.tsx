import { meta, screen, updateMeta } from '@/app/store';
import { audio } from '@/audio/AudioManager';
import { resetTutorial } from '@/ui/tutorial/Tutorial';

export function Settings() {
  const m = meta.value;
  const set = (fn: (s: typeof m.settings) => void) =>
    updateMeta((mm) => {
      fn(mm.settings);
    });
  return (
    <div class="screen settings-screen">
      <div class="newrun-bg" />
      <div class="newrun-header">
        <button
          class="btn small ghost"
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          ‹ Back
        </button>
        <div class="display newrun-title">Settings</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="settings-body anim-rise">
        <div class="panel settings-panel">
          <Row label="Music volume">
            <input type="range" min={0} max={1} step={0.05} value={m.settings.music} style={{ ['--pct' as string]: `${m.settings.music * 100}%` }} onInput={(e) => set((s) => (s.music = parseFloat((e.target as HTMLInputElement).value)))} />
            <span class="muted">{Math.round(m.settings.music * 100)}%</span>
          </Row>
          <Row label="Sound effects">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={m.settings.sfx}
              style={{ ['--pct' as string]: `${m.settings.sfx * 100}%` }}
              onInput={(e) => set((s) => (s.sfx = parseFloat((e.target as HTMLInputElement).value)))}
              onChange={() => audio.sfx('ui_click')}
            />
            <span class="muted">{Math.round(m.settings.sfx * 100)}%</span>
          </Row>
          <Row label="Default battle speed">
            <div class="row">
              {([1, 2, 3] as const).map((v) => (
                <button key={v} class={`btn small ${m.settings.battleSpeed === v ? 'primary' : 'ghost'}`} onClick={() => set((s) => (s.battleSpeed = v))}>
                  {v}×
                </button>
              ))}
            </div>
          </Row>
          <Row label="Auto-start fights">
            <button class={`btn small ${m.settings.autoBattle ? 'primary' : 'ghost'}`} onClick={() => set((s) => (s.autoBattle = !s.autoBattle))}>
              {m.settings.autoBattle ? 'On' : 'Off'}
            </button>
          </Row>
          <Row label="Screen shake">
            <button class={`btn small ${m.settings.screenShake ? 'primary' : 'ghost'}`} onClick={() => set((s) => (s.screenShake = !s.screenShake))}>
              {m.settings.screenShake ? 'On' : 'Off'}
            </button>
          </Row>
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
          <Row label="Damage numbers">
            <button class={`btn small ${m.settings.showDamage ? 'primary' : 'ghost'}`} onClick={() => set((s) => (s.showDamage = !s.showDamage))}>
              {m.settings.showDamage ? 'On' : 'Off'}
            </button>
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div class="settings-row">
      <div class="settings-label display">{label}</div>
      <div class="row">{children}</div>
    </div>
  );
}
