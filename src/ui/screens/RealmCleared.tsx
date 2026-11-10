import { useEffect } from 'preact/hooks';
import { act, meta, run, updateMeta } from '@/app/store';
import { nextRealm } from '@/core/run';
import { concludeRun } from '@/meta/runtime';
import { realmGuardians } from '@/core/encounters';
import { arenaFor, themeFor } from '@/content/themes';
import { ENEMY_BY_ID } from '@/content/enemies';
import { Icon } from '@/ui/components/Icon';
import { BrushBanner } from '@/ui/components/Triumph';
import { bossEpithet } from '@/ui/hud/Boss';
import { fmt } from '@/ui/hud/Hud';
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
  const realm = s.realm;
  // each contract has its own battlefields (src/content/themes.ts)
  const realmName = realm === 1 || realm === 2 ? themeFor(s.tier, realm).name : `Heavenly Ladder · Floor ${s.floor}`;
  // the guardian that was just beaten (from the boss fight), else the realm's usual guardian
  const bossId = s.currentEncounter?.enemies.map((e) => e.defId).find((id) => ENEMY_BY_ID[id]?.boss) ?? realmGuardians(realm, s.tier)[0];
  const boss = ENEMY_BY_ID[bossId];
  const next =
    realm === 1
      ? { name: themeFor(s.tier, 2).name, art: themeFor(s.tier, 2).art, line: themeFor(s.tier, 2).teaser }
      : realm === 2
        ? { name: 'The Heavenly Ladder', art: 'realm3_ladder', line: 'An endless climb, every floor deadlier than the last.' }
        : { name: `Floor ${s.floor + 1}`, art: 'realm3_ladder', line: 'The Ladder rises on. Its wardens grow stronger.' };
  const unlocked = realm === 2 ? Math.min(7, meta.value.unlockedTier) : null;
  return (
    <div class={`screen cleared-screen v2 realm-${realm}`}>
      <div class="cleared-bg" style={{ ['--realm-art' as string]: `url(./assets/art/bg/${arenaFor(realm, s.tier).art}.jpg)` }} />
      <div class="cleared-body v2">
        <BrushBanner title="Rift Sealed" seal="封" tone="gold" size="xl" sub={`${realmName} is safe once more`} />
        <div class="cleared-main">
          <div class="sealed-guardian">
            <div class="sealed-medallion">
              <img src={`./assets/art/sprites/${boss?.sprite ?? bossId}.png`} alt="" draggable={false} />
            </div>
            <div class="sealed-talisman" aria-hidden="true">
              <span class="brush">封</span>
              <span class="brush small">镇</span>
            </div>
            <div class="sealed-name display">{boss?.name ?? 'The Guardian'}</div>
            <div class="sealed-epithet">{bossEpithet(s)} · sealed</div>
            {unlocked !== null && (
              <div class="sealed-reward">
                <Icon name="ui_trophy" size={18} color="var(--gold-bright)" /> Contract {unlocked} unlocked
              </div>
            )}
          </div>
          <div class="cleared-medals">
            <Medal icon="node_fight" label="Fights won" value={`${s.stats.wins}`} />
            <Medal icon="stones" label="Spirit Stones" value={`${s.stats.stonesEarned}`} />
            <Medal icon="ui_damage" label="Damage dealt" value={fmt(s.stats.damage)} />
            <Medal icon="kw_crit" label="Best hit" value={fmt(s.stats.bestHit)} />
            <Medal icon="ui_rewind" label="Time reversals" value={`${s.stats.rewinds}`} />
            <Medal icon="ui_party" label="Disciples" value={`${s.roster.length}`} />
          </div>
          <div class="next-realm" style={{ ['--next-art' as string]: `url(./assets/art/bg/${next.art}.jpg)` }}>
            <div class="next-label">Next</div>
            <div class="next-name display">{next.name}</div>
            <div class="next-line">{next.line}</div>
          </div>
        </div>
        <div class="row cleared-actions">
          {realm === 1 && (
            <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
              <span class="btn-glyph">进</span> Enter the {themeFor(s.tier, 2).name}
            </button>
          )}
          {realm === 2 && (
            <>
              <button
                class="btn gold big"
                onClick={() => {
                  audio.sfx('ui_confirm');
                  concludeRun(true);
                }}
              >
                <span class="btn-glyph">归</span> Return victorious
              </button>
              <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
                <span class="btn-glyph">登</span> Ascend the Heavenly Ladder
              </button>
            </>
          )}
          {realm === 3 && (
            <button class="btn primary big" onClick={() => (audio.sfx('ui_confirm'), act((st) => nextRealm(st)))}>
              <span class="btn-glyph">升</span> Climb to floor {s.floor + 1}
            </button>
          )}
        </div>
        {realm === 2 && <div class="muted cleared-note">The Ladder is endless. Each floor grows deadlier; your defeat records a score.</div>}
      </div>
    </div>
  );
}

function Medal({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div class="cleared-medal">
      <div class="medal-disc">
        <Icon name={icon} size={34} color="var(--gold-bright)" />
      </div>
      <div class="medal-value display">{value}</div>
      <div class="medal-label">{label}</div>
    </div>
  );
}
