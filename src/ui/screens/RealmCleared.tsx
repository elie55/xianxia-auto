import { useEffect } from 'preact/hooks';
import { act, meta, run, updateMeta } from '@/app/store';
import { endRun, nextRealm } from '@/core/run';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';
import { getBattleView } from '@/battle/view/BattleView';

export function RealmCleared() {
  const s = run.value!;
  useEffect(() => {
    getBattleView().stopBattle();
    audio.playMusic('victory');
    audio.sfx('victory');
    if (s.realm === 2) {
      updateMeta((m) => {
        m.unlockedTier = Math.max(m.unlockedTier, Math.min(7, s.tier + 1));
        m.bestTierCleared = Math.max(m.bestTierCleared, s.tier);
      });
    }
  }, []);
  const realmName = s.realm === 1 ? 'Azure Bamboo Province' : s.realm === 2 ? 'Blood Moon Abyss' : `Heavenly Ladder · Floor ${s.floor}`;
  return (
    <div class={`screen cleared-screen realm-${s.realm === 1 ? 1 : s.realm === 2 ? 2 : 3}`}>
      <div class="cleared-bg" style={{ ['--realm-art' as string]: `url(./assets/art/bg/${s.realm === 1 ? 'realm1_bamboo' : s.realm === 2 ? 'realm2_abyss' : 'realm3_ladder'}.jpg)` }} />
      <div class="cleared-body anim-rise">
        <div class="brush cleared-glyph">封</div>
        <div class="display cleared-title">Rift Sealed</div>
        <div class="cleared-sub">{realmName} is safe once more</div>
        <div class="cleared-stats panel">
          <Stat label="Fights won" value={`${s.stats.wins}`} />
          <Stat label="Spirit Stones earned" value={`${s.stats.stonesEarned}`} />
          <Stat label="Damage dealt" value={Math.round(s.stats.damage).toLocaleString()} />
          <Stat label="Best hit" value={Math.round(s.stats.bestHit).toLocaleString()} />
          <Stat label="Time reversals" value={`${s.stats.rewinds}`} />
          <Stat label="Disciples" value={`${s.roster.length}`} />
        </div>
        <div class="row" style={{ gap: 16, marginTop: 10 }}>
          {s.realm === 1 && (
            <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
              <span class="btn-glyph">进</span> Enter the Blood Moon Abyss
            </button>
          )}
          {s.realm === 2 && (
            <>
              <button
                class="btn gold big"
                onClick={() => {
                  audio.sfx('ui_confirm');
                  updateMeta((m) => {
                    m.runsWon++;
                    m.runsPlayed++;
                  });
                  act((st) => endRun(st, true));
                }}
              >
                <span class="btn-glyph">归</span> Return victorious
              </button>
              <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
                <span class="btn-glyph">登</span> Ascend the Heavenly Ladder
              </button>
            </>
          )}
          {s.realm === 3 && (
            <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
              <span class="btn-glyph">升</span> Climb to floor {s.floor + 1}
            </button>
          )}
        </div>
        {s.realm === 2 && <div class="muted" style={{ fontSize: 14 }}>The Ladder is endless. Each floor grows deadlier; your defeat records a score. Unlocked contract: {Math.min(7, meta.value.unlockedTier)}.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div class="cleared-stat">
      <div class="faint" style={{ fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div class="display" style={{ fontSize: 24, color: 'var(--gold-bright)' }}>
        {value}
      </div>
    </div>
  );
}

export { Icon };
