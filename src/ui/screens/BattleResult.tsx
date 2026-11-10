import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import { act, run, screen, updateMeta, meta } from '@/app/store';
import { currentRewindCost, endRun, proceedFromResult, rewind, rewindAvailable, type RunState } from '@/core/run';
import type { BattleResult as BattleRecord } from '@/battle/sim/battle';
import { HERO_BY_ID } from '@/content/heroes';
import { Hud, fmt } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { BrushBanner } from '@/ui/components/Triumph';
import { flyStones, stonesHeld } from '@/ui/flourish';
import { reducedMotion } from '@/app/motion';
import { audio } from '@/audio/AudioManager';
import { getBattleView } from '@/battle/view/BattleView';

/** Palette colours for the tracker (gold dealt, crimson taken, jade healing), shared with the legend. */
const BAR = { dealt: '#e8c46a', taken: '#d0505a', heal: '#5fd0a0' };

type UnitRecord = BattleRecord['units'][number];

/** The disciple who carried the fight, and the title for what they led the team in. */
function pickMvp(allies: UnitRecord[]): { u: UnitRecord; title: string; stat: string; value: number } | null {
  if (!allies.length) return null;
  const heal = (u: UnitRecord) => u.tracker.healing + u.tracker.shielding;
  // what each disciple actually did, in HP: damage counts fully, healing and shields half, hits soaked a third
  // (shares of the team total over-rewarded a lone healer or tank next to a disciple who did most of the damage)
  let best: UnitRecord | null = null;
  let bestScore = -1;
  for (const u of allies) {
    const score = u.tracker.damageDealt + 0.5 * heal(u) + 0.33 * u.tracker.damageTaken;
    if (score > bestScore) {
      bestScore = score;
      best = u;
    }
  }
  if (!best) return null;
  // the title names what they led the team in: damage first, then healing, then holding the line
  const leads = (f: (u: UnitRecord) => number) => f(best!) > 0 && allies.every((u) => f(u) <= f(best!));
  const kinds = [
    { lead: leads((u) => u.tracker.damageDealt), title: best.tracker.kills >= 3 ? 'Reaper of the Field' : 'Blade of the Sect', stat: 'damage dealt', value: best.tracker.damageDealt },
    { lead: leads(heal), title: 'The Merciful Hand', stat: 'healed and shielded', value: heal(best) },
    { lead: leads((u) => u.tracker.damageTaken), title: 'The Unmoving Wall', stat: 'damage taken', value: best.tracker.damageTaken },
  ];
  const pick = kinds.find((k) => k.lead) ?? kinds[0];
  return { u: best, title: pick.title, stat: pick.stat, value: pick.value };
}

export function BattleResult() {
  const s = run.value!;
  useArena(s);
  const r = s.lastResult;
  const won = s.phase === 'result';
  const [tab, setTab] = useState<'tracker' | 'stats'>('tracker');
  const b = s.lastBreakdown;
  const calm = reducedMotion();
  const [shownTotal, setShownTotal] = useState(won && b && !calm ? 0 : b?.total ?? 0);
  const totalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    audio.playMusic(won ? (s.realm === 2 ? 'realm2shop' : 'shop') : 'event');
    getBattleView().stopBattle();
    if (!won || !b) return;
    if (calm) {
      stonesHeld.value = 0;
      return;
    }
    // the payout: the total counts up under the banner, then the stones fly to the counter
    stonesHeld.value = b.total;
    const n = { v: 0 };
    const count = gsap.to(n, {
      v: b.total,
      duration: 0.9,
      delay: 0.8,
      ease: 'power2.out',
      onStart: () => audio.sfx('stones', { volume: 0.3 }),
      onUpdate: () => setShownTotal(Math.round(n.v)),
    });
    const fly = gsap.delayedCall(1.85, () => flyStones(totalRef.current, b.total));
    // if the window cannot animate, settle on the final numbers
    const safety = setTimeout(() => {
      setShownTotal(b.total);
      if (stonesHeld.value > 0 && !document.querySelector('.flourish-stone')) stonesHeld.value = 0;
    }, 4000);
    return () => {
      count.kill();
      fly.kill();
      clearTimeout(safety);
      stonesHeld.value = 0;
    };
  }, []);
  // after a reload from an older save the battle record may be gone: the screen still works, minus the stats
  const allies = r ? r.units.filter((u) => u.side === 'ally' && u.onBoard) : [];
  const enemies = r ? r.units.filter((u) => u.side === 'enemy') : [];
  const maxDmg = Math.max(1, ...allies.map((u) => u.tracker.damageDealt));
  const cost = currentRewindCost(s);
  const mvp = won ? pickMvp(allies) : null;
  const standing = allies.filter((u) => u.alive).length;
  const cols = [
    { key: 'dealt', label: 'Dealt', get: (u: UnitRecord) => fmt(u.tracker.damageDealt), any: true },
    { key: 'taken', label: 'Taken', get: (u: UnitRecord) => fmt(u.tracker.damageTaken), any: true },
    { key: 'healed', label: 'Healed', get: (u: UnitRecord) => fmt(u.tracker.healing + u.tracker.shielding), any: allies.some((u) => u.tracker.healing + u.tracker.shielding > 0) },
    { key: 'crits', label: 'Crits', get: (u: UnitRecord) => `${u.tracker.crits}`, any: allies.some((u) => u.tracker.crits > 0) },
    { key: 'kills', label: 'Kills', get: (u: UnitRecord) => `${u.tracker.kills}`, any: allies.some((u) => u.tracker.kills > 0) },
    { key: 'casts', label: 'Casts', get: (u: UnitRecord) => `${u.tracker.casts}`, any: allies.some((u) => u.tracker.casts > 0) },
    { key: 'best', label: 'Best hit', get: (u: UnitRecord) => fmt(u.tracker.bestHit), any: true },
  ].filter((c) => c.any);
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="modal-backdrop soft">
          <div class={`result-wrap v2 ${won ? 'won' : 'lost'}`}>
            <BrushBanner
              title={won ? 'Victory' : 'Defeat'}
              seal={won ? '胜' : '败'}
              tone={won ? 'won' : 'lost'}
              sub={
                r
                  ? won
                    ? `${standing} of ${allies.length} disciples standing · ${r.duration.toFixed(1)} s`
                    : `The sect falls after ${r.duration.toFixed(1)} s`
                  : undefined
              }
            />
            <div class={`result-columns ${mvp ? 'with-mvp' : ''}`}>
              {mvp && (
                <div class="panel mvp-card" key="mvp">
                  <div class="mvp-ribbon display">MVP</div>
                  <div class="mvp-medallion">
                    <MiniPortrait defId={mvp.u.defId} size={150} ring="rgba(243,207,120,0.95)" />
                    <span class="mvp-crown" aria-hidden="true" />
                  </div>
                  <div class="mvp-card-name display">{HERO_BY_ID[mvp.u.defId]?.name ?? mvp.u.name}</div>
                  <div class="mvp-card-title">{mvp.title}</div>
                  <div class="mvp-card-stat">
                    <b>{fmt(mvp.value)}</b> {mvp.stat}
                  </div>
                </div>
              )}
              <div class="panel result-stats">
                <div class="result-head">
                  <div class="panel-title display" style={{ marginBottom: 0 }}>
                    Stats
                  </div>
                  <div class="result-tabs">
                    <button class={tab === 'tracker' ? 'on' : ''} onClick={() => setTab('tracker')}>
                      Tracker
                    </button>
                    <button class={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>
                      Hero stats
                    </button>
                  </div>
                  {r && (
                    <div class="faint" style={{ fontSize: 14, textAlign: 'right' }}>
                      Combat duration {r.duration.toFixed(1)} s<br />
                      {enemies.length} enemies
                    </div>
                  )}
                </div>
                <div class="result-vs">
                  {allies.map((u) => (
                    <MiniPortrait key={u.id} defId={u.defId} size={34} class={u.alive ? '' : 'dead'} />
                  ))}
                  <span class="faint">vs</span>
                  {enemies.slice(0, 8).map((u) => (
                    <MiniPortrait key={u.id} defId={u.defId} size={30} enemy class={u.alive ? '' : 'dead'} />
                  ))}
                </div>
                {!r && <p class="muted result-missing">The battle record was not kept when the game closed. Your rewards were already counted.</p>}
                {tab === 'tracker' &&
                  allies
                    .slice()
                    .sort((a, b2) => b2.tracker.damageDealt - a.tracker.damageDealt)
                    .map((u) => (
                      <div key={u.id} class={`result-row ${u.alive ? '' : 'dead'} ${mvp?.u.id === u.id ? 'is-mvp' : ''}`}>
                        <MiniPortrait defId={u.defId} size={44} />
                        <div class="result-bars">
                          <Bar label="Damage dealt" value={u.tracker.damageDealt} max={maxDmg} color={BAR.dealt} />
                          <Bar label="Damage taken" value={u.tracker.damageTaken} max={maxDmg} color={BAR.taken} />
                          <Bar label="Healing and shields" value={u.tracker.healing + u.tracker.shielding} max={maxDmg} color={BAR.heal} />
                        </div>
                      </div>
                    ))}
                {tab === 'stats' && (
                  <table class="result-table">
                    <thead>
                      <tr>
                        <th />
                        {cols.map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allies.map((u) => (
                        <tr key={u.id} class={`${u.alive ? '' : 'dead'} ${mvp?.u.id === u.id ? 'is-mvp' : ''}`}>
                          <td>
                            <MiniPortrait defId={u.defId} size={30} />
                          </td>
                          {cols.map((c) => (
                            <td key={c.key}>{c.get(u)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div class="result-legend faint">
                  <span>
                    <i style={{ background: BAR.dealt }} /> damage dealt
                  </span>
                  <span>
                    <i style={{ background: BAR.taken }} /> damage taken
                  </span>
                  <span>
                    <i style={{ background: BAR.heal }} /> healing & shields
                  </span>
                </div>
              </div>
              <div class="panel result-rewards" data-tut={won ? 'rewards' : 'fate'}>
                <div class="panel-title display">{won ? 'Results' : 'Fate'}</div>
                {won && (
                  <>
                    {b && (
                      <>
                        <Line label="Battle won" value={b.base} />
                        <Line label={`Surviving disciples ×${b.survivorCount}`} value={b.survivors} />
                        {b.relicBonus > 0 && <Line label="Dao Insight bonus" value={b.relicBonus} />}
                        {b.bounty > 0 && <Line label="Bounty" value={b.bounty} />}
                        {b.battleBonus > 0 && <Line label="Earned in combat" value={b.battleBonus} />}
                        {b.challenge > 0 && <Line label="Challenge reward" value={b.challenge} />}
                        {b.quests.map((q) => (
                          <Line key={q.name} label={`Quest · ${q.name}`} value={q.amount} icon="ui_check" />
                        ))}
                        <div class="hairline" style={{ margin: '14px 0' }} />
                        <div ref={totalRef}>
                          <Line label="Total earned" value={shownTotal} big />
                        </div>
                      </>
                    )}
                    <button
                      class="btn primary big"
                      data-hotkey="proceed"
                      style={{ marginTop: 26, width: '100%' }}
                      onClick={() => {
                        audio.sfx('ui_confirm');
                        act((st) => proceedFromResult(st));
                      }}
                    >
                      Proceed
                    </button>
                  </>
                )}
                {!won && (
                  <>
                    <p class="muted" style={{ fontSize: 15 }}>
                      Your disciples lie broken on the battlefield. A Time Reversal Talisman can unwind the fight — at a price that grows each time. You return to the shop to change your sect, then face this battle again.
                    </p>
                    <div class="rewind-cost">
                      <Icon name="ui_rewind" size={22} color="var(--gold-bright)" />
                      <span>
                        Time Reversal · <Icon name="stones" size={16} /> {cost}
                      </span>
                    </div>
                    <div class="muted" style={{ fontSize: 14 }}>
                      You have <b class="gold">{s.stones}</b> Spirit Stones.
                    </div>
                    <button
                      class="btn gold big"
                      style={{ marginTop: 18, width: '100%' }}
                      disabled={!rewindAvailable(s)}
                      onClick={() => {
                        audio.sfx('rankup');
                        act((st) => rewind(st));
                      }}
                    >
                      <Icon name="ui_rewind" size={18} /> Reverse time
                    </button>
                    <button
                      class="btn danger"
                      style={{ marginTop: 12, width: '100%' }}
                      onClick={() => {
                        updateMeta((m) => {
                          m.runsPlayed++;
                        });
                        act((st) => endRun(st, false));
                      }}
                    >
                      Accept fate
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

/** One tracker bar: the track, then its value in a column of its own (never on top of the fill). */
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div class={`rbar-row ${value > 0 ? '' : 'zero'}`} title={label}>
      <div class="rbar">
        <i style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
      <span class="rbar-val" style={{ ['--c' as string]: color }}>
        {fmt(value)}
      </span>
    </div>
  );
}

function Line({ label, value, big, icon }: { label: string; value: number; big?: boolean; icon?: string }) {
  return (
    <div class={`result-line ${big ? 'big' : ''}`}>
      <span class="row">
        {icon && <Icon name={icon} size={14} color="var(--jade-bright)" />}
        {label}
      </span>
      <span class="gold row">
        <Icon name="stones" size={big ? 22 : 16} /> {value}
      </span>
    </div>
  );
}

export function unusedGuard(_s: RunState): void {
  void screen;
  void meta;
}
