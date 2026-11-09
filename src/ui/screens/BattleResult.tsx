import { useEffect, useState } from 'preact/hooks';
import { act, run, screen, updateMeta, meta } from '@/app/store';
import { currentRewindCost, endRun, proceedFromResult, rewind, rewindAvailable, type RunState } from '@/core/run';
import { Hud, fmt } from '@/ui/hud/Hud';
import { useArena } from './BoardScreen';
import { Icon } from '@/ui/components/Icon';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { audio } from '@/audio/AudioManager';
import { getBattleView } from '@/battle/view/BattleView';

export function BattleResult() {
  const s = run.value!;
  useArena(s);
  const r = s.lastResult;
  const won = s.phase === 'result';
  const [tab, setTab] = useState<'tracker' | 'stats'>('tracker');
  useEffect(() => {
    audio.playMusic(won ? (s.realm === 2 ? 'realm2shop' : 'shop') : 'event');
    getBattleView().stopBattle();
  }, []);
  // after a reload from an older save the battle record may be gone: the screen still works, minus the stats
  const allies = r ? r.units.filter((u) => u.side === 'ally' && u.onBoard) : [];
  const enemies = r ? r.units.filter((u) => u.side === 'enemy') : [];
  const maxDmg = Math.max(1, ...allies.map((u) => u.tracker.damageDealt));
  const b = s.lastBreakdown;
  const cost = currentRewindCost(s);
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="modal-backdrop soft">
          <div class="result-wrap anim-rise">
            <div class={`result-title display ${won ? 'won' : 'lost'}`}>{won ? 'Battle Won' : 'Disciples Fallen'}</div>
            <div class="brush result-hanzi">{won ? '胜' : '败'}</div>
            <div class="result-columns">
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
                      <div key={u.id} class={`result-row ${u.alive ? '' : 'dead'}`}>
                        <MiniPortrait defId={u.defId} size={44} />
                        <div class="result-bars">
                          <div class="rbar">
                            <i style={{ width: `${(u.tracker.damageDealt / maxDmg) * 100}%`, background: '#ff6b9a' }} />
                            <span>{fmt(u.tracker.damageDealt)}</span>
                          </div>
                          <div class="rbar">
                            <i style={{ width: `${Math.min(100, (u.tracker.damageTaken / maxDmg) * 100)}%`, background: '#ffb347' }} />
                            <span>{fmt(u.tracker.damageTaken)}</span>
                          </div>
                          <div class="rbar">
                            <i style={{ width: `${Math.min(100, ((u.tracker.healing + u.tracker.shielding) / maxDmg) * 100)}%`, background: '#8dff9a' }} />
                            <span>{fmt(u.tracker.healing + u.tracker.shielding)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                {tab === 'stats' && (
                  <table class="result-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Dealt</th>
                        <th>Taken</th>
                        <th>Healed</th>
                        <th>Crits</th>
                        <th>Kills</th>
                        <th>Casts</th>
                        <th>Best hit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allies.map((u) => (
                        <tr key={u.id} class={u.alive ? '' : 'dead'}>
                          <td>
                            <MiniPortrait defId={u.defId} size={30} />
                          </td>
                          <td>{fmt(u.tracker.damageDealt)}</td>
                          <td>{fmt(u.tracker.damageTaken)}</td>
                          <td>{fmt(u.tracker.healing + u.tracker.shielding)}</td>
                          <td>{u.tracker.crits}</td>
                          <td>{u.tracker.kills}</td>
                          <td>{u.tracker.casts}</td>
                          <td>{fmt(u.tracker.bestHit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div class="legend faint">
                  <span style={{ color: '#ff6b9a' }}>■</span> damage dealt <span style={{ color: '#ffb347' }}>■</span> damage taken <span style={{ color: '#8dff9a' }}>■</span> healing & shields
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
                        <Line label="Total earned" value={b.total} big />
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
