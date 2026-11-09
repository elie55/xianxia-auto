import { useEffect, useState } from 'preact/hooks';
import { clearSavedRun, meta, run, screen, setRun, updateMeta } from '@/app/store';
import { endlessScore, heroByUid, teamContext } from '@/core/run';
import { HERO_BY_ID } from '@/content/heroes';
import { DIFFICULTIES } from '@/content/difficulties';
import { HeroCard } from '@/ui/components/HeroCard';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';
import { getBattleView } from '@/battle/view/BattleView';
import { fmt } from '@/ui/hud/Hud';

export function RunEnd() {
  const s = run.value!;
  const [summary, setSummary] = useState(false);
  useEffect(() => {
    getBattleView().stopBattle();
    getBattleView().setVisible(false);
    audio.playMusic(s.victory ? 'victory' : 'event');
    const score = endlessScore(s);
    if (s.realm === 3) {
      updateMeta((m) => {
        m.bestEndless = Math.max(m.bestEndless, score);
        m.leaderboard.push({ name: `Run ${m.runsPlayed + 1}`, score, tier: s.tier, date: Date.now() });
        m.leaderboard.sort((a, b) => b.score - a.score);
        m.leaderboard = m.leaderboard.slice(0, 20);
      });
    }
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
      <div class="runend-bg">
        <div class="runend-giant display">{s.victory ? 'Victorious' : 'Fallen'}</div>
      </div>
      <div class="runend-top">
        <div class="brush" style={{ fontSize: 30, color: 'var(--gold)' }}>
          {s.victory ? '功成' : '陨落'}
        </div>
        <div class="display" style={{ fontSize: 18, letterSpacing: '0.3em', color: 'var(--paper-dim)' }}>
          {DIFFICULTIES[s.tier].name} contract · {s.realm === 3 ? `Ladder floor ${endlessScore(s)}` : `Realm ${s.realm}`}
        </div>
      </div>
      {!summary && (
        <div class="mvp-row stagger">
          {mvps.map((m) =>
            m.x ? (
              <div key={m.title} class="mvp">
                <HeroCard defId={m.x.h!.defId} rank={m.x.h!.rank} hero={m.x.h!} ctx={ctx} size="lg" showStats={false} />
                <div class="mvp-plate panel">
                  <div class="mvp-name display">{HERO_BY_ID[m.x.h!.defId].name}</div>
                  <div class="mvp-title">{m.title}</div>
                  <div class="mvp-stat">
                    {m.stat} <b>{fmt(m.value)}</b>
                  </div>
                  <div class="mvp-stars">
                    {'★'.repeat(Math.min(3, 1 + m.x.h!.rank))}
                    <span class="faint">{'★'.repeat(Math.max(0, 2 - m.x.h!.rank))}</span>
                  </div>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
      {summary && (
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
        <button
          class="btn ghost"
          onClick={() => {
            audio.sfx('ui_back');
            setRun(null);
            screen.value = 'menu';
          }}
        >
          Quit to menu
        </button>
        <button class="btn" onClick={() => setSummary(!summary)}>
          {summary ? 'Champions' : 'Summary'}
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
      </div>
      <div class="faint" style={{ position: 'absolute', right: 30, bottom: 24, fontSize: 13 }}>
        Runs {meta.value.runsPlayed} · Wins {meta.value.runsWon}
      </div>
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
