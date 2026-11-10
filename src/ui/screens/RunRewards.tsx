import { useEffect, useState } from 'preact/hooks';
import { meta } from '@/app/store';
import { reducedMotion } from '@/app/motion';
import type { RunPayout } from '@/core/run';
import { ACH_BY_ID } from '@/meta/achievementDefs';
import { RENOWN_TRACK, cosmetic } from '@/meta/cosmetics';
import { defaultProfile } from '@/meta/migrate';
import { levelOf, rankOf, SECT_RANKS } from '@/meta/renown';
import { AchievementMedal, Avatar, CosmeticPreview, RenownBar, cosmeticLine } from '@/ui/components/MetaBits';
import { CountUp } from '@/ui/components/Triumph';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';

/**
 * Sect Rewards, the second step of the run-end screen: what the run paid in Renown, line by line, then the Renown bar
 * fills level by level and each level reached turns over its reward card.
 */
export function RunRewards({ payout }: { payout: RunPayout }) {
  const calm = reducedMotion();
  const from = levelOf(payout.xpBefore);
  const to = levelOf(payout.xpAfter);
  const gained: number[] = [];
  for (let l = from.level + 1; l <= to.level; l++) gained.push(l);
  const lines = payout.lines;
  const [shown, setShown] = useState(calm ? lines.length : 0);
  const [bar, setBar] = useState(calm ? { level: to.level, frac: to.frac, anim: false } : { level: from.level, frac: from.frac, anim: false });
  const [cards, setCards] = useState<number[]>(calm ? gained : []);
  const linesDone = shown >= lines.length;

  // the lines come in one by one
  useEffect(() => {
    if (calm || !lines.length) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= lines.length) clearInterval(t);
    }, 260);
    return () => clearInterval(t);
  }, []);

  // then the bar fills, level by level, and each level reached turns over its reward
  useEffect(() => {
    if (calm || !linesDone) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 380;
    for (let lv = from.level; lv < to.level; lv++) {
      const level = lv;
      timers.push(setTimeout(() => setBar({ level, frac: 1, anim: true }), t));
      t += 720;
      timers.push(
        setTimeout(() => {
          setBar({ level: level + 1, frac: 0, anim: false });
          setCards((c) => [...c, level + 1]);
          audio.sfx('rankup', { volume: 0.5 });
        }, t),
      );
      t += 140;
    }
    timers.push(setTimeout(() => setBar({ level: to.level, frac: to.frac, anim: true }), t));
    return () => timers.forEach(clearTimeout);
  }, [linesDone]);

  const p = { ...defaultProfile(), ...(meta.value.profile ?? {}) };
  const rank = rankOf(bar.level);
  const atCap = bar.level >= 50;
  const achRewards = payout.achievements.flatMap((id) => ACH_BY_ID[id]?.rewards ?? []);
  return (
    <div class="run-rewards panel anim-pop">
      <div class="rr-head">
        <Avatar id={p.avatar} size={64} />
        <div class="rr-head-text">
          <div class="rr-kicker">Sect Rewards</div>
          <div class="display rr-sect">{p.sectName}</div>
        </div>
        <div class="rr-earned">
          <span class="rr-earned-label">Renown earned</span>
          <b class="rr-earned-value">
            +{linesDone ? <CountUp to={payout.total} duration={0.9} /> : 0}
          </b>
        </div>
      </div>
      <div class="rr-body">
        <div class="rr-lines">
          {lines.length === 0 && <p class="rr-empty">No fight was won this run. Every victory, guardian and new discovery pays Renown.</p>}
          {lines.map((l, i) => (
            <div key={l.key} class={`rr-line ${i < shown ? 'in' : ''} ${l.key === 'contract' ? 'bonus' : ''}`}>
              <span class="rr-line-icon">
                <Icon name={l.icon} size={26} />
              </span>
              <span class="rr-label">{l.label}</span>
              <span class="rr-count">{l.count !== undefined ? `×${l.count}` : ''}</span>
              <b class="rr-xp">+{l.xp}</b>
            </div>
          ))}
        </div>
        <div class="rr-progress">
          <div class="rr-level-row">
            <span class={`rr-seal ${cards.length ? 'pop' : ''}`} key={bar.level}>
              <span class="brush">{rank.hanzi}</span>
            </span>
            <span class="rr-level-text">
              <span class="rr-rank">{rank.name}</span>
              <span class="display rr-level">Renown {bar.level}</span>
            </span>
            <span class="rr-level-xp">{atCap ? 'Max Renown' : bar.level === to.level ? `${to.into} / ${to.need} XP` : ''}</span>
          </div>
          <RenownBar frac={bar.frac} class={`rr-bar ${bar.anim ? 'anim' : ''}`} />
          {cards.length > 0 && (
            <div class="rr-cards">
              {cards.map((lv) => {
                const r = RENOWN_TRACK.find((x) => x.level === lv);
                const newRank = SECT_RANKS.find((x) => x.level === lv);
                return (
                  <div key={lv} class={`rr-card ${newRank ? 'rank-up' : ''}`}>
                    <span class="rr-card-level">Renown {lv}</span>
                    {r && <CosmeticPreview kind={r.kind} id={r.id} size={54} />}
                    {r && <span class="rr-card-name">{cosmeticLine(r.kind, r.id)}</span>}
                    {newRank && <span class="rr-card-rank">{newRank.name}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {payout.achievements.length > 0 && (
            <div class="rr-achs">
              <div class="rr-sub">Achievements this run</div>
              {payout.achievements.map((id) => {
                const a = ACH_BY_ID[id];
                if (!a) return null;
                return (
                  <div key={id} class="rr-ach">
                    <AchievementMedal a={a} size={44} />
                    <span class="rr-ach-name">{a.name}</span>
                    <b class="rr-ach-xp">+{a.xp}</b>
                  </div>
                );
              })}
              {achRewards.map((r) => (
                <div key={`${r.kind}:${r.id}`} class="rr-ach reward">
                  <CosmeticPreview kind={r.kind} id={r.id} size={44} />
                  <span class="rr-ach-name">{cosmeticLine(r.kind, r.id)}</span>
                  <span class="rr-ach-xp new">{cosmetic(r.kind, r.id) ? 'Unlocked' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
