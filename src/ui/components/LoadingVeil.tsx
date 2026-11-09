import { useEffect, useState } from 'preact/hooks';
import { preload } from '@/app/preload';

const TIPS = ['Gathering qi', 'Tempering the meridians', 'Unrolling the sect scrolls', 'Sharpening the flying swords', 'Lighting the incense'];

/** Start-up veil: the sect seal and a progress bar while paintings, portraits and sprite packs load. */
export function LoadingVeil() {
  const p = preload.value;
  const [gone, setGone] = useState(() => preload.peek().finished);
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 1500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!p.finished) return;
    const t = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(t);
  }, [p.finished]);
  if (gone) return null;
  const pct = Math.min(100, Math.round((p.done / Math.max(1, p.total)) * 100));
  return (
    <div class={`loading-veil ${p.finished ? 'out' : ''}`}>
      <div class="veil-logo" role="img" aria-label="Nine Heavens" />
      <div class="veil-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div class="veil-tip">
        {TIPS[tipIndex]}… <span class="faint">{pct}%</span>
      </div>
    </div>
  );
}
