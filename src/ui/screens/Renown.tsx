import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { meta, screen, updateMeta } from '@/app/store';
import { ACHIEVEMENTS, CATEGORY_LABEL, type AchievementCategory } from '@/meta/achievementDefs';
import { BANNERS, FRAMES, FOE_AVATARS, HERO_AVATARS, KIND_LABEL, RENOWN_TRACK, SEAL_AVATARS, TITLES, cosmetic, type Cosmetic, type CosmeticKind } from '@/meta/cosmetics';
import { defaultLifetime, defaultProfile } from '@/meta/migrate';
import { cumulativeXp, levelOf, rankOf, SECT_RANKS, MAX_RENOWN } from '@/meta/renown';
import { howToUnlock, unlockedCosmetics } from '@/meta/unlocks';
import { BUILDINGS, RECRUITS, SECT_OPENS } from '@/meta/sect';
import { HERO_BY_ID } from '@/content/heroes';
import { AchievementMedal, Avatar, CosmeticPreview, RenownBar, SectPlate } from '@/ui/components/MetaBits';
import { Icon } from '@/ui/components/Icon';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

type Tab = 'track' | 'achievements' | 'profile';

const TABS: { id: Tab; label: string; hanzi: string }[] = [
  { id: 'track', label: 'Renown', hanzi: '名' },
  { id: 'achievements', label: 'Achievements', hanzi: '功' },
  { id: 'profile', label: 'Sect Profile', hanzi: '宗' },
];

/** Sect Renown: the reward track, the achievements and the sect's profile and records (docs/META_PROGRESSION.md). */
export function RenownScreen() {
  const [tab, setTab] = useState<Tab>(() => {
    const q = new URLSearchParams(location.search).get('tab');
    return TABS.some((t) => t.id === q) ? (q as Tab) : 'track';
  });
  const m = meta.value;
  const earned = Object.keys(m.achievements ?? {}).length;
  return (
    <div class="screen renown-screen">
      <div class="newrun-bg">
        <div class="watermark" style={{ right: 60, top: 40, fontSize: 380 }}>
          名
        </div>
      </div>
      <div class="newrun-header renown-header">
        <button
          class="btn small ghost renown-back"
          data-hotkey="back"
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          <Icon name="ui_back" size={20} /> Back
        </button>
        <div class="display newrun-title">Sect Renown</div>
        <div class="renown-header-right" />
      </div>
      <div class="codex-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`codex-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => {
              if (t.id === tab) return;
              audio.sfx('ui_click');
              setTab(t.id);
            }}
          >
            <span class="brush">{t.hanzi}</span>
            <span class="display">{t.label}</span>
            {t.id === 'achievements' && (
              <span class={`codex-tab-count ${earned === ACHIEVEMENTS.length ? 'full' : ''}`}>
                {earned}/{ACHIEVEMENTS.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div class="renown-body anim-fade" key={tab}>
        {tab === 'track' && <TrackTab />}
        {tab === 'achievements' && <AchievementsTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </div>
  );
}

// ───────────────────────── the reward track ─────────────────────────

function TrackTab() {
  const m = meta.value;
  const lv = levelOf(m.renown?.xp ?? 0);
  const rank = rankOf(lv.level);
  const nextRank = SECT_RANKS[rank.index + 1];
  const next = RENOWN_TRACK.find((r) => r.level > lv.level);
  return (
    <div class="renown-track-wrap">
      <div class="panel renown-hero">
        <SectPlate />
        <div class="renown-hero-progress">
          <div class="renown-hero-line">
            <span class="display renown-hero-level">Renown {lv.level}</span>
            <span class="renown-hero-xp">{lv.level >= MAX_RENOWN ? 'The track is complete' : `${lv.into} / ${lv.need} XP to Renown ${lv.level + 1}`}</span>
          </div>
          <RenownBar frac={lv.frac} class="renown-hero-bar" />
          <div class="renown-hero-notes">
            <span>
              Total <b>{Math.floor(m.renown?.xp ?? 0).toLocaleString('en-US')}</b> / {cumulativeXp(MAX_RENOWN).toLocaleString('en-US')} XP
            </span>
            {nextRank && (
              <span>
                Next rank: <b>{nextRank.name}</b> at Renown {nextRank.level}
              </span>
            )}
            {next && (
              <span class="renown-next-reward">
                Next reward: <CosmeticPreview kind={next.kind} id={next.id} size={28} compact /> <b>{cosmetic(next.kind, next.id)?.name}</b>
              </span>
            )}
          </div>
        </div>
        <div class="renown-how">
          <div class="renown-how-title display">Every run pays</div>
          <p>Fights won, elites, guardians and realms sealed, times the contract's multiplier, plus every new Compendium entry and every achievement.</p>
        </div>
      </div>
      <div class="renown-track">
        {RENOWN_TRACK.map((r) => {
          const state = r.level <= lv.level ? 'reached' : r.level === lv.level + 1 ? 'next' : 'locked';
          const newRank = SECT_RANKS.find((x) => x.level === r.level);
          const c = cosmetic(r.kind, r.id);
          return (
            <div key={r.level} class={`track-cell ${state} ${newRank ? 'rank' : ''}`} {...tip(<><h4>Renown {r.level}</h4><div class="sub">{KIND_LABEL[r.kind]}</div><p>{c?.name}</p>{newRank && <p class="gold">The sect becomes a {newRank.name}.</p>}</>, 'below')}>
              <span class="track-level">{r.level}</span>
              <span class="track-preview">
                <CosmeticPreview kind={r.kind} id={r.id} size={46} compact />
              </span>
              <span class="track-name">{c?.name}</span>
              <span class="track-kind">{newRank ? newRank.name : KIND_LABEL[r.kind]}</span>
              {(r.level === SECT_OPENS || BUILDINGS.some((b) => b.unlock === r.level && b.unlock !== SECT_OPENS)) && (
                <span class="track-unlock">
                  Opens {r.level === SECT_OPENS ? 'the Sect' : `the ${BUILDINGS.find((b) => b.unlock === r.level)!.name}`}
                </span>
              )}
              {RECRUITS.filter((x) => x.renown === r.level).map((x) => (
                <span key={x.hero} class="track-unlock">
                  {HERO_BY_ID[x.hero].name} answers the call
                </span>
              ))}
              {state === 'locked' && <Icon name="ui_lock" size={14} class="track-lock" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── achievements ─────────────────────────

const CATEGORIES: AchievementCategory[] = ['progress', 'contracts', 'mastery', 'builds', 'feats', 'discovery', 'secrets'];

export function AchievementsTab() {
  const have = meta.value.achievements ?? {};
  const earnedXp = ACHIEVEMENTS.filter((a) => have[a.id]).reduce((n, a) => n + a.xp, 0);
  const totalXp = ACHIEVEMENTS.reduce((n, a) => n + a.xp, 0);
  return (
    <div class="ach-wrap">
      <div class="ach-summary">
        <span>
          <b>{Object.keys(have).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length}</b> of {ACHIEVEMENTS.length} earned
        </span>
        <span>
          <b>{earnedXp.toLocaleString('en-US')}</b> / {totalXp.toLocaleString('en-US')} Renown from achievements
        </span>
      </div>
      {CATEGORIES.map((cat) => {
        const list = ACHIEVEMENTS.filter((a) => a.category === cat);
        const n = list.filter((a) => have[a.id]).length;
        return (
          <section key={cat} class="ach-section">
            <h3 class="ach-section-title display">
              {CATEGORY_LABEL[cat]} <span class="ach-section-count">{n}/{list.length}</span>
            </h3>
            <div class="ach-grid">
              {list.map((a) => {
                const got = !!have[a.id];
                const secret = !!a.hidden && !got;
                return (
                  <div key={a.id} class={`ach-card ${got ? 'earned' : 'locked'}`}>
                    <AchievementMedal a={a} size={58} locked={!got} secret={secret} />
                    <span class="ach-card-text">
                      <span class="ach-card-name">{secret ? '? ? ?' : a.name}</span>
                      <span class="ach-card-desc">{secret ? 'A secret, earned by chance or curiosity.' : a.desc}</span>
                      {!secret && a.rewards && (
                        <span class="ach-card-reward">
                          {a.rewards.map((r) => (
                            <span key={r.id}>
                              {KIND_LABEL[r.kind]}: {cosmetic(r.kind, r.id)?.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span class="ach-card-xp">
                      <b>+{a.xp}</b>
                      {got && <span class="ach-card-date">{new Date(have[a.id]).toLocaleDateString()}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ───────────────────────── profile ─────────────────────────

function ProfileTab() {
  const m = meta.value;
  const p = { ...defaultProfile(), ...(m.profile ?? {}) };
  const unlocked = unlockedCosmetics(m);
  const [name, setName] = useState(p.sectName);
  const choose = (kind: CosmeticKind, id: string) => {
    audio.sfx('ui_click', { volume: 0.6 });
    updateMeta((mm) => {
      mm.profile = { ...defaultProfile(), ...(mm.profile ?? {}), [kind]: id };
    });
  };
  const saveName = () => {
    const v = name.trim().slice(0, 24) || defaultProfile().sectName;
    setName(v);
    if (v === p.sectName) return;
    updateMeta((mm) => {
      mm.profile = { ...defaultProfile(), ...(mm.profile ?? {}), sectName: v };
    });
  };
  const life = { ...defaultLifetime(), ...(m.lifetime ?? {}) };
  const seen = m.seen;
  const discoveries = (seen?.heroes.length ?? 0) + (seen?.items.length ?? 0) + (seen?.relics.length ?? 0) + (seen?.enemies.length ?? 0);
  const hours = Math.floor(life.playMs / 3600000);
  const mins = Math.round((life.playMs % 3600000) / 60000);
  return (
    <div class="profile-wrap">
      <div class="profile-left">
        <SectPlate />
        <label class="profile-name">
          <span class="profile-label">Sect name</span>
          <span class="codex-search profile-name-field">
            <input type="text" value={name} maxLength={24} spellcheck={false} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          </span>
        </label>
        <div class="panel profile-records">
          <div class="panel-title display">Records</div>
          <Record k="Runs" v={life.runs} />
          <Record k="Victories" v={life.wins} />
          <Record k="Fights won" v={`${life.fightsWon} / ${life.fights}`} />
          <Record k="Foes slain" v={life.kills} />
          <Record k="Critical hits" v={life.crits} />
          <Record k="Best single hit" v={Math.round(life.bestHit).toLocaleString('en-US')} />
          <Record k="Spirit Stones earned" v={life.stonesEarned.toLocaleString('en-US')} />
          <Record k="Best Ladder floor" v={life.bestFloor || 'None yet'} />
          <Record k="Compendium entries" v={discoveries} />
          <Record k="Time in runs" v={hours ? `${hours} h ${mins} min` : `${mins} min`} />
        </div>
      </div>
      <div class="profile-right">
        <Picker title="Avatar" kind="avatar" list={[...SEAL_AVATARS, ...HERO_AVATARS, ...FOE_AVATARS]} current={p.avatar} unlocked={unlocked} onPick={choose}>
          {(c) => <Avatar id={c.id} size={58} />}
        </Picker>
        <Picker title="Title" kind="title" list={TITLES} current={p.title} unlocked={unlocked} onPick={choose} wide>
          {(c) => <span class="picker-title-name">{c.name}</span>}
        </Picker>
        <div class="picker-pair">
          <Picker title="Card frame" kind="frame" list={FRAMES} current={p.frame} unlocked={unlocked} onPick={choose}>
            {(c) => <CosmeticPreview kind="frame" id={c.id} size={54} />}
          </Picker>
          <Picker title="Banner" kind="banner" list={BANNERS} current={p.banner} unlocked={unlocked} onPick={choose}>
            {(c) => <CosmeticPreview kind="banner" id={c.id} size={54} />}
          </Picker>
        </div>
      </div>
    </div>
  );
}

function Record({ k, v }: { k: string; v: ComponentChildren }) {
  return (
    <div class="profile-record">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function Picker({
  title,
  kind,
  list,
  current,
  unlocked,
  onPick,
  wide,
  children,
}: {
  title: string;
  kind: CosmeticKind;
  list: Cosmetic[];
  current: string;
  unlocked: Set<string>;
  onPick: (kind: CosmeticKind, id: string) => void;
  wide?: boolean;
  children: (c: Cosmetic) => ComponentChildren;
}) {
  const open = list.filter((c) => unlocked.has(`${kind}:${c.id}`)).length;
  return (
    <section class={`panel picker ${wide ? 'wide' : ''}`}>
      <div class="picker-head">
        <span class="panel-title display">{title}</span>
        <span class="picker-count">
          {open}/{list.length}
        </span>
      </div>
      <div class={`picker-grid kind-${kind}`}>
        {list.map((c) => {
          const ok = unlocked.has(`${kind}:${c.id}`);
          return (
            <button
              key={c.id}
              class={`picker-item ${c.id === current ? 'on' : ''} ${ok ? '' : 'locked'}`}
              // not `disabled`: a locked entry still shows how to earn it on hover
              aria-disabled={!ok}
              onClick={() => ok && c.id !== current && onPick(kind, c.id)}
              {...tip(<><h4>{c.name}</h4><div class="sub">{KIND_LABEL[kind]}</div>{!ok && <p class="muted">{howToUnlock(kind, c.id, c.how)}</p>}</>, 'below')}
            >
              {children(c)}
              {!ok && <Icon name="ui_lock" size={14} class="picker-lock" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
