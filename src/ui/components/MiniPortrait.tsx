import { useState } from 'preact/hooks';
import { HERO_BY_ID } from '@/content/heroes';
import { ENEMY_BY_ID } from '@/content/enemies';

export function MiniPortrait({ defId, size = 64, enemy = false, class: cls, ring }: { defId: string; size?: number; enemy?: boolean; class?: string; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const def = enemy ? ENEMY_BY_ID[defId] : HERO_BY_ID[defId];
  const accent = def?.accent ?? '#3fbf9f';
  const hanzi = (def?.hanzi ?? def?.name ?? '?').slice(0, 1);
  return (
    <div class={`mini-portrait ${cls ?? ''}`} style={{ width: size, height: size, ['--accent' as string]: accent, ['--ring' as string]: ring ?? 'rgba(212,168,75,0.6)' }}>
      {!failed && !enemy && <img src={`./assets/art/heroes/${defId}/portrait.png`} alt="" draggable={false} onError={() => setFailed(true)} />}
      {(failed || enemy) && (
        <div class="mini-fallback">
          <span class="brush" style={{ fontSize: size * 0.5 }}>
            {hanzi}
          </span>
        </div>
      )}
    </div>
  );
}
