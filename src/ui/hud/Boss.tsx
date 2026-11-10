import { useEffect, useState } from 'preact/hooks';
import type { RunState } from '@/core/run';
import { ENEMY_BY_ID } from '@/content/enemies';
import { themeFor } from '@/content/themes';
import { getBattleView } from '@/battle/view/BattleView';
import { audio } from '@/audio/AudioManager';
import { battleTick } from './Hud';

/** The guardian's title under its name, per realm. */
export function bossEpithet(s: RunState): string {
  if (s.realm === 1) return `Guardian of the ${themeFor(s.tier, 1).name}`;
  if (s.realm === 2) return `Sovereign of the ${themeFor(s.tier, 2).name}`;
  return `Warden of the Heavenly Ladder · Floor ${s.floor}`;
}

/**
 * Boss fights: a full-width bar under the top bar with the guardian's seal, name and title, a thick HP bar with its
 * shield and the phase marks where its passives trigger (e.g. 50% for the dragon's scales), and an Enraged state.
 */
export function BossBar({ s }: { s: RunState }) {
  void battleTick.value; // 10 refreshes per second of fight
  const boss = getBattleView().battle?.units.find((u) => u.boss && u.side === 'enemy' && u.onBoard);
  if (!boss) return null;
  const def = ENEMY_BY_ID[boss.defId];
  const hp = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  const shield = Math.max(0, boss.shield / boss.maxHp);
  const squeeze = hp + shield > 1 ? 1 / (hp + shield) : 1;
  const phases = (def?.passives ?? []).flatMap((p) => (p.trigger && p.trigger.on === 'hpBelow' ? [p.trigger.pct] : []));
  const enraged = boss.hasMod('enrage');
  return (
    <div class={`boss-bar ${enraged ? 'enraged' : ''} ${boss.alive ? '' : 'slain'}`}>
      <div class="boss-seal brush">{def?.hanzi?.slice(0, 1) ?? '妖'}</div>
      <div class="boss-main">
        <div class="boss-head">
          <span class="boss-name display">{def?.name ?? boss.name}</span>
          <span class="boss-epithet">{bossEpithet(s)}</span>
          {enraged && <span class="boss-enraged display">Enraged</span>}
        </div>
        <div class="boss-hp">
          <i class="boss-hp-fill" style={{ width: `${hp * squeeze * 100}%` }} />
          {shield > 0 && <i class="boss-hp-shield" style={{ left: `${hp * squeeze * 100}%`, width: `${shield * squeeze * 100}%` }} />}
          {phases.map((p) => (
            <b key={p} class={`boss-notch ${hp * 100 <= p ? 'passed' : ''}`} style={{ left: `${p}%` }} />
          ))}
          <span class="boss-hp-text">
            {Math.ceil(boss.hp).toLocaleString()} / {Math.round(boss.maxHp).toLocaleString()}
            {shield > 0 && <em> +{Math.round(boss.shield).toLocaleString()}</em>}
          </span>
        </div>
      </div>
    </div>
  );
}

const introSeen = new Set<string>();

/**
 * Arriving at the Realm Guardian: a short splash (the guardian slides in under its brush-written name and title, with a
 * roar). Plays once per boss node; click to skip; it also ends when the fight starts.
 */
export function BossIntro({ s }: { s: RunState }) {
  const enc = s.currentEncounter;
  const key = enc ? `${s.seed}:${s.realm}:${s.floor}:${enc.id}` : '';
  const bossId = enc?.kind === 'boss' ? enc.enemies.find((e) => ENEMY_BY_ID[e.defId]?.boss)?.defId : undefined;
  const [show, setShow] = useState(() => !!bossId && s.phase === 'board' && !introSeen.has(key));
  useEffect(() => {
    if (!show) return;
    introSeen.add(key);
    audio.sfx('boss_roar', { volume: 0.8 });
    const t = setTimeout(() => setShow(false), 2800);
    return () => clearTimeout(t);
  }, [show]);
  if (!show || !bossId || s.phase !== 'board') return null;
  const def = ENEMY_BY_ID[bossId];
  return (
    <div class="boss-intro" onClick={() => setShow(false)}>
      <div class="boss-intro-veil" />
      <div class="boss-intro-hanzi brush">{def.hanzi ?? '妖'}</div>
      <img class="boss-intro-art" src={`./assets/art/sprites/${def.sprite}.png`} alt="" draggable={false} />
      <div class="boss-intro-text">
        <div class="boss-intro-kicker display">Realm Guardian</div>
        <div class="boss-intro-name display">{def.name}</div>
        <i class="boss-intro-stroke" />
        <div class="boss-intro-epithet">{bossEpithet(s)}</div>
      </div>
    </div>
  );
}
