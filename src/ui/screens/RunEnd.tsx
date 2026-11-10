import { useEffect, useState } from 'preact/hooks';
import { act, clearSavedRun, meta, run, screen, setRun } from '@/app/store';
import { heroByUid, teamContext, type FightRecord } from '@/core/run';
import { finishRunMeta } from '@/meta/runtime';
import { RunRewards } from './RunRewards';
import { HERO_BY_ID } from '@/content/heroes';
import { ENEMY_BY_ID } from '@/content/enemies';
import { BrushBanner, StarPips } from '@/ui/components/Triumph';
import { PAINTED_ICONS } from '@/ui/components/paintedIcons';
import { DIFFICULTIES } from '@/content/difficulties';
import { HeroCard } from '@/ui/components/HeroCard';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';
import { getBattleView } from '@/battle/view/BattleView';
import { fmt } from '@/ui/hud/Hud';

export function RunEnd() {
  const s = run.value!;
  const [summary, setSummary] = useState(false);
  // champions first, then the Sect Rewards the run paid
  const [step, setStep] = useState<'champions' | 'rewards'>('champions');
  useEffect(() => {
    getBattleView().stopBattle();
    getBattleView().setVisible(false);
    audio.playMusic(s.victory ? 'victory' : 'event');
    // every run-ending button pays the run (concludeRun); this catches any other way here
    if (!s.metaPaid) act((st) => finishRunMeta(st));
    clearSavedRun();
    return () => getBattleView().setVisible(true);
  }, []);
  const totals = Object.entries(s.heroTotals).map(([uid, t]) => ({ uid, t, h: heroByUid(s, uid) })).filter((x) => x.h);
  const byDealt = totals.slice().sort((a, b) => b.t.dealt - a.t.dealt);
  const byTaken = totals.slice().sort((a, b) => b.t.taken - a.t.taken);
  const byCrit = totals.slice().sort((a, b) => b.t.bestHit - a.t.bestHit);
  const mvps = uniqueMvps([
    { title: 'The Arcane Edge', stat: 'Damage dealt', value: byDealt[0]?.t.dealt ?? 0, x: byDealt[0] },
    { title: 'The Wall', stat: 'Damage taken', value: byTaken[0]?.t.taken ?? 0, x: byTaken[0] },
    { title: 'The Perfect Cut', stat: 'Best hit', value: byCrit[0]?.t.bestHit ?? 0, x: byCrit[0] },
  ]);
  const ctx = teamContext(s);
  const minutes = Math.round((s.stats.elapsedMs || Date.now() - s.stats.startedAt) / 60000);
  return (
    <div class={`screen runend-screen ${s.victory ? 'won' : 'lost'}`}>
      <div class="runend-bg" />
      <div class="runend-top v2">
        <BrushBanner
          title={s.victory ? 'Ascended' : 'Fallen'}
          seal={s.victory ? '功' : '陨'}
          tone={s.victory ? 'won' : 'lost'}
          size="xl"
          sub={`${DIFFICULTIES[s.tier].name} contract · ${s.realm === 3 ? `Ladder floor ${s.floor}` : `Realm ${s.realm}`}${minutes > 0 ? ` · ${minutes} min` : ''}`}
        />
      </div>
      {step === 'rewards' && s.payout && <RunRewards payout={s.payout} />}
      {step === 'champions' && !summary && (
        <div class="mvp-row stagger">
          {mvps.map((m) =>
            m.x ? (
              <div key={m.title} class="mvp">
                <HeroCard defId={m.x.h!.defId} rank={m.x.h!.rank} hero={m.x.h!} ctx={ctx} size="lg" showStats={false} />
                <div class="mvp-plate panel">
                  <div class="mvp-title">{m.title}</div>
                  <div class="mvp-stat">
                    {m.stat} <b>{fmt(m.value)}</b>
                  </div>
                  <StarPips count={Math.min(3, 1 + m.x.h!.rank)} />
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
      {step === 'champions' && !summary && (s.history?.length ?? 0) > 0 && <RunTimeline history={s.history!} />}
      {step === 'champions' && summary && (
        <div class="panel summary-panel anim-pop">
          <div class="panel-title display">Run Summary</div>
          <div class="summary-grid">
            <Row k="Result" v={s.victory ? 'Victory' : 'Defeat'} />
            <Row k="Fights" v={`${s.stats.wins} won / ${s.stats.fights} fought`} />
            <Row k="Duration" v={`${minutes} min`} />
            <Row k="Spirit Stones earned" v={`${s.stats.stonesEarned}`} />
            <Row k="Damage dealt" v={fmt(s.stats.damage)} />
            <Row k="Best hit" v={fmt(s.stats.bestHit)} />
            <Row k="Time reversals" v={`${s.stats.rewinds}`} />
            <Row k="Dao Insights" v={`${s.relics.length}`} />
          </div>
          <div class="panel-title display" style={{ marginTop: 18 }}>
            Disciples
          </div>
          {totals.map(({ uid, t, h }) => (
            <div key={uid} class="summary-hero">
              <span>{HERO_BY_ID[h!.defId].name}</span>
              <span class="muted">dealt {fmt(t.dealt)}</span>
              <span class="muted">taken {fmt(t.taken)}</span>
              <span class="muted">healed {fmt(t.healed)}</span>
              <span class="muted">kills {t.kills}</span>
            </div>
          ))}
        </div>
      )}
      <div class="runend-footer">
        {step === 'champions' ? (
          <>
            <button class="btn" onClick={() => setSummary(!summary)}>
              {summary ? 'Champions' : 'Summary'}
            </button>
            <button
              class="btn primary big"
              data-hotkey="proceed"
              onClick={() => {
                audio.sfx('ui_confirm');
                setStep('rewards');
              }}
            >
              <span class="btn-glyph">宗</span> Sect Rewards
            </button>
          </>
        ) : (
          <>
            <button
              class="btn ghost"
              onClick={() => {
                audio.sfx('ui_back');
                setRun(null);
                screen.value = 'menu';
              }}
            >
              Main Menu
            </button>
            <button
              class="btn primary big"
              onClick={() => {
                audio.sfx('ui_confirm');
                setRun(null);
                screen.value = 'newRun';
              }}
            >
              <span class="btn-glyph">再</span> New Run
            </button>
          </>
        )}
      </div>
      <div class="faint" style={{ position: 'absolute', right: 30, bottom: 24, fontSize: 14 }}>
        Runs {meta.value.runsPlayed} · Wins {meta.value.runsWon}
      </div>
    </div>
  );
}

/** The run at a glance: every fight as a node medallion, grouped by realm; the hardest-hitting victory is starred. */
function RunTimeline({ history }: { history: FightRecord[] }) {
  const best = history.reduce((a, h, i) => (h.won && h.dealt > (history[a]?.dealt ?? -1) ? i : a), -1);
  const groups: { key: string; label: string; items: { h: FightRecord; i: number }[] }[] = [];
  history.forEach((h, i) => {
    const key = h.realm === 3 ? `3-${h.floor}` : `${h.realm}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: h.realm === 1 ? '一' : h.realm === 2 ? '二' : '天', items: [] };
      groups.push(g);
    }
    g.items.push({ h, i });
  });
  return (
    <div class="run-timeline anim-rise">
      {groups.map((g) => (
        <div key={g.key} class="rt-group">
          <span class="rt-realm brush">{g.label}</span>
          {g.items.map(({ h, i }) => {
            const kind = h.kind === 'single' ? 'challenge' : h.kind;
            const foe = h.foe ? ENEMY_BY_ID[h.foe]?.name : undefined;
            return (
              <div
                key={i}
                class={`rt-node ${h.won ? 'won' : 'lost'} ${i === best ? 'best' : ''} kind-${kind}`}
                title={`${h.won ? 'Won' : 'Lost'} · ${foe ?? 'Fight'} · ${fmt(h.dealt)} damage${h.stones ? ` · ${h.stones} Spirit Stones` : ''}`}
              >
                <Icon name={PAINTED_ICONS.has(`node_${kind}`) ? `node_${kind}` : 'node_fight'} size={40} />
                <span class="rt-mark" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function uniqueMvps<T extends { x?: { uid: string } }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of list) {
    if (!m.x) continue;
    if (seen.has(m.x.uid)) continue;
    seen.add(m.x.uid);
    out.push(m);
  }
  return out;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div class="summary-row">
      <span class="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

export { Icon };
