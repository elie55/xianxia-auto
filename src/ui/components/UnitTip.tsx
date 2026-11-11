import type { Unit } from '@/battle/sim/unit';
import { CLASSES } from '@/content/classes';
import { RANK_NAMES } from '@/core/types';
import { battleTick } from '@/ui/hud/Hud';
import { Icon, STAT_COLOR, STAT_ICON, STAT_LABEL } from './Icon';
import { RichText } from './RichText';
import { STATUS_COLORS } from '@/battle/view/Vfx';
import { MASTERY_PASSIVES } from '@/content/mastery';
import { MasteryPassiveLine } from './HeroCard';

const SHOWN = ['attack', 'attackSpeed', 'spirit', 'crit', 'defense', 'range'] as const;

/** Live tooltip for a unit standing on the arena (ally or enemy). Re-renders a few times per second in battle. */
export function UnitTip({ unit }: { unit: Unit }) {
  void battleTick.value;
  const u = unit;
  const hp = Math.max(0, u.hp);
  const hpPct = Math.min(100, (hp / Math.max(1, u.maxHp)) * 100);
  const shieldPct = Math.min(100 - hpPct, (u.shield / Math.max(1, u.maxHp)) * 100);
  const qiPct = u.maxQi > 0 ? Math.min(100, (u.qi / u.maxQi) * 100) : 0;
  const statuses: { label: string; color: string }[] = [];
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  if (u.burns.length) statuses.push({ label: `Burning ${Math.round(u.burns.reduce((a, b) => a + b.dps, 0))}/s`, color: hex(STATUS_COLORS.burn) });
  if (u.poison > 0) statuses.push({ label: `Poison ${Math.ceil(u.poison)}`, color: hex(STATUS_COLORS.poison) });
  if (u.frost > 0) statuses.push({ label: `Frost ${Math.round(u.frost)}`, color: hex(STATUS_COLORS.frost) });
  if (u.bleeds.length) statuses.push({ label: 'Bleeding', color: hex(STATUS_COLORS.bleed) });
  if (u.tauntTargetId !== null) statuses.push({ label: 'Taunted', color: hex(STATUS_COLORS.taunt) });
  if (u.seals.length) statuses.push({ label: u.seals.length > 1 ? `Sealed ×${u.seals.length}` : 'Sealed', color: hex(STATUS_COLORS.seal) });
  if (u.shield > 0) statuses.push({ label: `Shield ${Math.round(u.shield)}`, color: '#bfe4ff' });
  // Zhong Ming's stored damage, released by her Golden Bell
  if (u.counter('resonance') > 0) statuses.push({ label: `Resonance ${Math.round(u.counter('resonance'))}`, color: '#f0b45a' });
  const passive = u.masteryPassive ? MASTERY_PASSIVES[u.defId] : undefined;
  return (
    <>
      <h4 style={{ color: u.side === 'ally' ? 'var(--jade-bright)' : 'var(--vermilion-bright)' }}>
        {u.name} {u.hanzi && <span class="brush gold">{u.hanzi}</span>}
      </h4>
      <div class="sub">{u.side === 'ally' ? `${RANK_NAMES[u.rank].name} disciple` : u.boss ? 'Realm Guardian' : u.elite ? 'Elite' : 'Enemy'}</div>
      {u.classes.length > 0 && (
        <div class="tip-classes">
          {u.classes.map((c) => (
            <span key={c} style={{ color: CLASSES[c]?.color }}>
              {CLASSES[c] && <span class="brush">{CLASSES[c].hanzi}</span>} {CLASSES[c]?.name ?? c}
              {CLASSES[c] && <span class="faint"> · {CLASSES[c].role}</span>}
            </span>
          ))}
        </div>
      )}
      <div class="tip-bar">
        <i style={{ width: `${hpPct}%`, background: u.side === 'ally' ? 'linear-gradient(180deg,#7ef29a,#2f9c4b)' : 'linear-gradient(180deg,#ff7a6b,#b82a1f)' }} />
        {shieldPct > 0 && <i style={{ left: `${hpPct}%`, width: `${shieldPct}%`, background: 'linear-gradient(180deg,#e6f3ff,#9fd5ff)' }} />}
        <span>
          {Math.round(hp)} / {u.maxHp}
          {u.shield > 0 ? ` (+${Math.round(u.shield)})` : ''}
        </span>
      </div>
      {u.maxQi > 0 && (
        <div class="tip-bar" style={{ height: 7 }}>
          <i style={{ width: `${qiPct}%`, background: 'linear-gradient(180deg,#8fd5ff,#2f7fc4)' }} />
        </div>
      )}
      <div class="tip-stats">
        {SHOWN.map((k) => (
          <div key={k} class="tip-stat" style={{ color: STAT_COLOR[k] }}>
            <Icon name={STAT_ICON[k]} size={13} /> {k === 'attackSpeed' ? `${u.attacksPerSecond.toFixed(2)}/s` : Math.round(u.stat(k))}
            <span class="faint" style={{ fontWeight: 400, fontSize: 14 }}>{STAT_LABEL[k]}</span>
          </div>
        ))}
      </div>
      {u.ability && (
        <p>
          <b class="gold">{u.ability.name}</b> <span class="faint">· {u.ability.qiCost} Qi</span>
          <br />
          <RichText text={u.ability.desc} />
        </p>
      )}
      {passive && <MasteryPassiveLine name={passive.name} desc={passive.desc} />}
      {statuses.length > 0 && (
        <div class="tip-statuses">
          {statuses.map((s) => (
            <span key={s.label} class="tip-status" style={{ color: s.color }}>
              {s.label}
            </span>
          ))}
        </div>
      )}
      {u.side === 'ally' && u.heroUid && <p class="hint">Drag to move · drop a Treasure to equip</p>}
    </>
  );
}
