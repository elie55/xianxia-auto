import { useState } from 'preact/hooks';
import { meta } from '@/app/store';
import { HERO_BY_ID } from '@/content/heroes';
import { DIFFICULTIES } from '@/content/difficulties';
import { ladderFloorOf } from '@/core/run';
import { MAX_MASTERY, MASTERY_THRESHOLDS } from '@/meta/mastery';
import { hallOfMasters, unrecordedVictories, type MasterEntry, type VictoryRecord } from '@/meta/hall';
import { AchievementsTab } from '@/ui/screens/Renown';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { Icon } from '@/ui/components/Icon';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

type HallTab = 'victories' | 'masters' | 'ladder' | 'merit';
const TABS: { id: HallTab; label: string; hanzi: string }[] = [
  { id: 'victories', label: 'Victories', hanzi: '功' },
  { id: 'masters', label: 'Masters', hanzi: '师' },
  { id: 'ladder', label: 'The Ladder', hanzi: '梯' },
  { id: 'merit', label: 'Hall of Merit', hanzi: '德' },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');

/** A disciple's portrait as a statue: bronze, gilded, or the empty pedestal's shadow. */
function Statue({ id, kind, size }: { id: string; kind: 'gold' | 'bronze' | 'empty'; size: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span class={`hall-figure ${kind}`} style={{ height: size }}>
      {!failed ? <img src={`./assets/art/heroes/${id}/portrait.png`} alt="" draggable={false} onError={() => setFailed(true)} /> : <MiniPortrait defId={id} size={Math.round(size * 0.6)} />}
    </span>
  );
}

/**
 * The Hall of Ancestors (docs/META_PROGRESSION.md 6.9): the statues of the sect's victories, its masters, the best
 * Ladder ascents and the Hall of Merit.
 */
export function AncestorsPanel() {
  const [tab, setTab] = useState<HallTab>('victories');
  return (
    <>
      <div class="hall-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`codex-chip hall-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => {
              audio.sfx('ui_click', { volume: 0.5 });
              setTab(t.id);
            }}
          >
            <span class="brush">{t.hanzi}</span> {t.label}
          </button>
        ))}
      </div>
      {tab === 'victories' && <Victories />}
      {tab === 'masters' && <Masters />}
      {tab === 'ladder' && <Ladder />}
      {tab === 'merit' && (
        <div class="hall-merit">
          <AchievementsTab />
        </div>
      )}
    </>
  );
}

function Victories() {
  const m = meta.value;
  const list = (m.hall?.victories ?? []) as VictoryRecord[];
  const older = unrecordedVictories(m);
  return (
    <div class="hall-section">
      <p class="sect-note">Every victory raises a statue of its champion: the disciple who dealt the most damage on the way to clearing the contract.</p>
      {list.length === 0 && <p class="hall-empty">No statue yet. Clear both realms of a contract and your champion will stand here.</p>}
      <div class="hall-statues">
        {list.map((v, i) => (
          <div key={`${v.at}-${i}`} class="hall-statue">
            <Statue id={v.mvp} kind="bronze" size={150} />
            <div class="hall-plaque">
              <b class="display">{HERO_BY_ID[v.mvp]?.name ?? v.mvp}</b>
              <span class="hall-plaque-line">
                {DIFFICULTIES[v.tier]?.name ?? 'Contract'} contract{v.pure ? ' · Pure' : ''}
              </span>
              <span class="hall-plaque-line faint">
                {fmtDate(v.at)}
                {v.minutes ? ` · ${v.minutes} min` : ''}
              </span>
              <span class="hall-plaque-line">{fmtNum(v.dealt)} damage</span>
              {v.floor ? <span class="hall-plaque-line gold">Ladder floor {v.floor}</span> : null}
              <span class="hall-team">
                {v.team.map((id) => (
                  <span key={id} {...tip(HERO_BY_ID[id]?.name ?? id, 'above')}>
                    <MiniPortrait defId={id} size={26} />
                  </span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
      {older > 0 && (
        <p class="hall-older">
          <Icon name="ui_trophy" size={18} /> {older} {older === 1 ? 'victory' : 'victories'} won before the Hall kept their statues.
        </p>
      )}
    </div>
  );
}

function Masters() {
  const list = hallOfMasters(meta.value);
  const gilded = list.filter((e) => e.statue === 'gold').length;
  return (
    <div class="hall-section">
      <p class="sect-note">
        A disciple stands gilded at mastery V, in bronze at mastery III and IV. Mastery grows with every fight won with them on the board. <b>{gilded}</b> of {list.length} gilded.
      </p>
      <div class="hall-masters">
        {list.map((e) => (
          <MasterCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}

function MasterCard({ e }: { e: MasterEntry }) {
  const name = HERO_BY_ID[e.id]?.name ?? e.id;
  const next = e.level < MAX_MASTERY ? MASTERY_THRESHOLDS[e.level] : 0;
  return (
    <div class={`hall-master ${e.statue}`} {...tip(<><h4>{name}</h4><p>{e.level > 0 ? `Mastery ${ROMAN[e.level]}` : 'No mastery yet'} · {e.wins} fights won</p>{e.title && <p class="gold">{e.title}</p>}{e.passive && <p>Permanent passive: {e.passive}</p>}{e.toNext > 0 && <p class="muted">{e.toNext} more {e.toNext === 1 ? 'win' : 'wins'} for mastery {ROMAN[e.level + 1]}.</p>}</>, 'above')}>
      <Statue id={e.id} kind={e.statue} size={112} />
      <span class="hall-master-name display">{name}</span>
      <span class="hall-master-level">{e.level > 0 ? `Mastery ${ROMAN[e.level]}` : '—'}</span>
      {e.statue !== 'gold' && (
        <span class="hall-master-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (e.wins / next) * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

function Ladder() {
  const board = meta.value.leaderboard.slice(0, 10);
  return (
    <div class="hall-section">
      <p class="sect-note">The ten best ascents of the Heavenly Ladder, where a cleared contract climbs on, floor after floor.</p>
      {board.length === 0 && <p class="hall-empty">No ascent recorded. Clear both realms of a contract and climb on to the Ladder.</p>}
      <div class="hall-ladder">
        {board.map((e, i) => (
          <div key={`${e.date}-${i}`} class={`hall-ladder-row ${i === 0 ? 'first' : ''}`}>
            <span class="hall-ladder-rank display">{i + 1}</span>
            <span class="hall-ladder-floor">
              Floor <b>{e.floor ?? ladderFloorOf(e.score)}</b>
            </span>
            <span class="hall-ladder-tier">{DIFFICULTIES[e.tier]?.name ?? ''}</span>
            <span class="hall-ladder-score">{fmtNum(e.score)}</span>
            <span class="hall-ladder-date faint">{fmtDate(e.date)}</span>
            {e.pure && <span class="hall-pure">Pure</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
