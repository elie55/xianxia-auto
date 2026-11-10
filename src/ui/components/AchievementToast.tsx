import { useEffect } from 'preact/hooks';
import { achievementToasts } from '@/meta/runtime';
import { ACH_BY_ID } from '@/meta/achievementDefs';
import { AchievementMedal } from '@/ui/components/MetaBits';
import { audio } from '@/audio/AudioManager';

/** A stamped seal at the top of the screen when an achievement is earned; several queue up and show one by one. */
export function AchievementToast() {
  const id = achievementToasts.value[0];
  useEffect(() => {
    if (!id) return;
    audio.sfx('rankup', { volume: 0.45 });
    const t = setTimeout(() => {
      achievementToasts.value = achievementToasts.peek().slice(1);
    }, 3600);
    return () => clearTimeout(t);
  }, [id]);
  const a = id ? ACH_BY_ID[id] : null;
  if (!a) return null;
  return (
    <div class="ach-toast" key={id} role="status" aria-live="polite">
      <AchievementMedal a={a} size={60} />
      <span class="ach-toast-text">
        <span class="ach-toast-kicker">Achievement</span>
        <span class="display ach-toast-name">{a.name}</span>
        <span class="ach-toast-xp">+{a.xp} Renown</span>
      </span>
    </div>
  );
}
