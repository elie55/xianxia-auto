import { useEffect, useState } from 'preact/hooks';
import { act, run } from '@/app/store';
import { chooseUpgrade, heroByUid, teamContext } from '@/core/run';
import { HERO_BY_ID } from '@/content/heroes';
import { CLASSES } from '@/content/classes';
import { RANK_NAMES } from '@/core/types';
import { HeroCard, ClassBadge } from '@/ui/components/HeroCard';
import { Icon, STAT_COLOR, STAT_ICON, STAT_LABEL } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { audio } from '@/audio/AudioManager';
import { useArena } from './BoardScreen';

const SPLASH: Record<number, string> = { 1: 'Foundation Established', 2: 'Golden Core Formed', 3: 'Nascent Soul Awakened' };

export function RankUpScreen() {
  const s = run.value!;
  useArena(s);
  const c = s.rankUpChoices!;
  const h = heroByUid(s, c.uid)!;
  const def = HERO_BY_ID[h.defId];
  const [splash, setSplash] = useState(true);
  const isDao = h.rank >= 1 && !h.daoPathId;
  useEffect(() => {
    audio.sfx('rankup', { volume: 0.8 });
    const t = setTimeout(() => setSplash(false), 1500);
    return () => clearTimeout(t);
  }, [c.uid, h.rank]);
  const rank = RANK_NAMES[h.rank];
  return (
    <div class="screen rankup-screen">
      <div class="rankup-bg" />
      {splash && (
        <div class="rankup-splash" onClick={() => setSplash(false)}>
          <div class="splash-glyph brush">{rank.hanzi}</div>
          <div class={`splash-title display rank-${h.rank}`}>{SPLASH[h.rank] ?? 'Breakthrough'}</div>
          <div class="splash-sub">
            {def.name} · {rank.name}
          </div>
          <div class="splash-rays" />
        </div>
      )}
      {!splash && (
        <div class="rankup-body anim-fade">
          <div class="rankup-left">
            <HeroCard defId={h.defId} rank={h.rank} hero={h} ctx={teamContext(s)} size="lg" showStats />
          </div>
          <div class="rankup-right">
            <div class="brush rankup-hanzi">{isDao ? '道' : '悟'}</div>
            <div class="display rankup-title">{isDao ? 'Choose a Dao Path' : 'Choose an Insight'}</div>
            <div class="muted" style={{ marginBottom: 20 }}>
              {isDao ? `${def.name} has reached Foundation. Each path reshapes their cultivation — some even grant a second class.` : `${def.name} gains an Insight drawn from ${h.daoPathId ? 'their classes' : 'their class'}.`}
            </div>
            <div class="upgrade-row stagger" data-tut="upgrade-row">
              {c.options.map((u) => (
                <button
                  key={u.id}
                  class="upgrade-card panel"
                  onClick={() => {
                    audio.sfx('ui_confirm');
                    act((st) => chooseUpgrade(st, u.id));
                  }}
                >
                  <div class="upgrade-top">
                    {u.addClass ? <ClassBadge id={u.addClass} size={40} /> : <div class="upgrade-icon"><Icon name={u.classPool ? `class_${u.classPool}` : `class_${def.classes[0]}`} size={26} color="var(--gold-bright)" /></div>}
                  </div>
                  <div class="upgrade-name display">{u.name}</div>
                  <div class="upgrade-kind">{isDao ? 'Dao Path' : `${u.classPool ? CLASSES[u.classPool].name : 'Class'} Insight`}</div>
                  <div class="upgrade-desc">
                    <RichText text={u.desc} />
                  </div>
                  {(u.stats || u.statsPct) && (
                    <div class="upgrade-stats">
                      {u.stats &&
                        Object.entries(u.stats).map(([k, v]) => (
                          <span key={k} style={{ color: STAT_COLOR[k] }}>
                            <Icon name={STAT_ICON[k]} size={12} /> +{v} {STAT_LABEL[k]}
                          </span>
                        ))}
                      {u.statsPct &&
                        Object.entries(u.statsPct).map(([k, v]) => (
                          <span key={k} style={{ color: STAT_COLOR[k] }}>
                            <Icon name={STAT_ICON[k]} size={12} /> +{v}% {STAT_LABEL[k]}
                          </span>
                        ))}
                    </div>
                  )}
                  {u.addClass && <div class="upgrade-class">Gains the {CLASSES[u.addClass].name} class</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
