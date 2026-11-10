import { useEffect, useState } from 'preact/hooks';
import { preload } from '@/app/preload';
import { Icon } from '@/ui/components/Icon';

const MOODS = ['Gathering qi', 'Tempering the meridians', 'Unrolling the sect scrolls', 'Sharpening the flying swords', 'Lighting the incense'];

/** Gameplay tips shown while the paintings load, each with a painted icon. */
const TIPS: { icon: string; text: string }[] = [
  { icon: 'choice_breakthrough', text: 'Buy a second copy of a disciple you own to break through to the next cultivation realm.' },
  { icon: 'node_fight', text: 'Sturdy disciples belong on the front hexes; casters and archers fight best from the back row.' },
  { icon: 'choice_treasure', text: 'Drop a Treasure on a disciple’s socket to swap exactly that one.' },
  { icon: 'choice_insight', text: 'Dao Insights stack: building around a class unlocks its strongest synergies.' },
  { icon: 'ui_rewind', text: 'A Time Reversal Talisman replays a lost fight, at a price that grows each time.' },
  { icon: 'node_elite', text: 'Elites pay in epic Dao Insights. The Realm Guardian seals the rift.' },
  { icon: 'node_event', text: 'Events on the road can hand out Treasures, Spirit Stones, or a hard bargain.' },
];

/** Start-up veil: the sect seal, a painted progress bar and a gameplay tip while paintings, portraits and sprite packs load. */
export function LoadingVeil() {
  const p = preload.value;
  const [gone, setGone] = useState(() => preload.peek().finished);
  const [tick, setTick] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setTick((i) => i + 1), 3200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!p.finished) return;
    const t = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(t);
  }, [p.finished]);
  if (gone) return null;
  const pct = Math.min(100, Math.round((p.done / Math.max(1, p.total)) * 100));
  const tip = TIPS[tick % TIPS.length];
  return (
    <div class={`loading-veil ${p.finished ? 'out' : ''}`}>
      <div class="veil-logo" role="img" aria-label="Nine Heavens" />
      <div class="veil-bar v2">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div class="veil-mood">
        {MOODS[tick % MOODS.length]}… <span class="faint">{pct}%</span>
      </div>
      <div class="veil-tip v2" key={tick}>
        <span class="veil-tip-icon">
          <Icon name={tip.icon} size={44} />
        </span>
        <span>{tip.text}</span>
      </div>
    </div>
  );
}
