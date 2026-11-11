import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { meta, screen, showToast } from '@/app/store';
import { ITEM_BY_ID, SHOP_ITEMS } from '@/content/items';
import { RELIC_BY_ID, RESEARCH_RELICS, SHOP_RELICS } from '@/content/relics';
import { HEIRLOOM_MAX_LEVEL, heirloomItemId } from '@/content/heirlooms';
import { levelOf, rankOf, SECT_RANKS } from '@/meta/renown';
import {
  BOUNTIES,
  BOUNTY_BY_ID,
  BUILDINGS,
  BUILDING_BY_ID,
  CURRENCIES,
  DOCTRINE_LIST,
  blessingCountFor,
  trainedBlessings,
  MAX_BUILDING_LEVEL,
  RECIPES,
  RECRUITS,
  STUDIES,
  canAfford,
  draftSizeFor,
  freeRerollsFor,
  isOpen,
  levelCap,
  levelCost,
  recruitState,
  sealSlots,
  sectOf,
  studyRelics,
  type BuildingId,
  type Purse,
  type SectState,
  type UpgradableId,
} from '@/meta/sect';
import { craft, learnDoctrine, recruit, research, setCarry, setDoctrine, toggleSeal, upgradeBuilding, veinAdd, veinRemove, veinReset, type SectResult } from '@/meta/sectActions';
import { VEIN_NODES, VEIN_RINGS, veinAddBlocked, veinPoints, veinRemoveBlocked, veinSpent, type VeinNode } from '@/content/vein';
import { TRAINING_BLESSINGS } from '@/content/difficulties';
import { HERO_BY_ID } from '@/content/heroes';
import { SectPlate } from '@/ui/components/MetaBits';
import { HeroCard, ItemTip } from '@/ui/components/HeroCard';
import { RelicTip } from '@/ui/hud/Hud';
import { Icon } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Where each building stands on the mountain-sect painting (design pixels, medallion centre). */
const SPOT: Record<BuildingId, { x: number; y: number }> = {
  hall: { x: 1540, y: 360 },
  pavilion: { x: 880, y: 300 },
  forge: { x: 1230, y: 610 },
  bounty: { x: 640, y: 760 },
  // at the foot of the stairs, where new disciples arrive
  recruit: { x: 1390, y: 820 },
  // the temple on the left-hand mountain, below the Pavilion
  doctrine: { x: 700, y: 500 },
  // the falls, where the mountain's spirit vein surfaces
  vein: { x: 930, y: 880 },
  // the terrace beside the Main Hall, under the maples
  training: { x: 1730, y: 640 },
};

/**
 * The Sect (docs/META_PROGRESSION.md, section 6): the sect between runs, painted as a mountain sect with its buildings.
 * Each building opens a panel beside the painting: the Main Hall, the Scripture Pavilion (studies and seals), the
 * Artifact Forge (heirlooms), the Bounty Board and the Recruitment Hall (exclusive disciples).
 */
export function SectScreen() {
  const m = meta.value;
  const xp = m.renown?.xp ?? 0;
  const s = sectOf(m);
  const [open, setOpen] = useState<BuildingId | null>(() => {
    const q = new URLSearchParams(location.search).get('b') as BuildingId | null;
    return q && BUILDING_BY_ID[q] && isOpen(q, xp) ? q : null;
  });
  const pick = (id: BuildingId) => {
    if (!isOpen(id, xp)) return;
    audio.sfx('ui_click');
    setOpen((cur) => (cur === id ? null : id));
  };
  return (
    <div class="screen sect-screen">
      <div class="sect-bg" />
      <div class="newrun-header sect-header">
        <button
          class="btn small ghost sect-back"
          data-hotkey={open ? undefined : 'back'}
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          <Icon name="ui_back" size={20} /> Back
        </button>
        <div class="display newrun-title">The Sect</div>
        <PurseBar purse={s.purse} />
      </div>
      <div class={`sect-map ${open ? 'dim' : ''}`}>
        {BUILDINGS.map((b) => {
          const unlocked = isOpen(b.id, xp);
          const lvl = b.id === 'hall' ? rankOf(levelOf(xp).level).index + 1 : b.upgradable ? s.buildings[b.id as UpgradableId] : 0;
          return (
            <button
              key={b.id}
              class={`sect-building ${unlocked ? '' : 'locked'} ${open === b.id ? 'on' : ''}`}
              style={{ left: SPOT[b.id].x, top: SPOT[b.id].y }}
              onClick={() => pick(b.id)}
              aria-disabled={!unlocked}
              {...tip(unlocked ? <><h4>{b.name}</h4><p>{b.desc}</p></> : <><h4>{b.name}</h4><p class="muted">Opens at Renown {b.unlock}.</p></>, 'below')}
            >
              <span class="sect-medal">
                <Icon name={b.icon} size={84} />
                {!unlocked && <Icon name="ui_lock" size={30} class="sect-lock" />}
                {unlocked && hasNews(b.id, m, s) && <i class="sect-dot" />}
              </span>
              <span class="sect-plaque">
                <span class="brush sect-plaque-hanzi">{b.hanzi}</span>
                <span class="display">{b.name}</span>
                {unlocked && lvl > 0 && <span class="sect-level">{ROMAN[lvl]}</span>}
                {!unlocked && <span class="sect-level faint">Renown {b.unlock}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {open && (
        <aside class="sect-drawer">
          <button
            class="codex-drawer-close"
            data-hotkey="back"
            aria-label="Close"
            onClick={() => {
              audio.sfx('ui_back');
              setOpen(null);
            }}
            {...tip('Close (Esc)', 'left')}
          >
            <Icon name="ui_close" size={20} />
          </button>
          <div class="sect-drawer-scroll" key={open}>
            <DrawerHead id={open} level={open === 'hall' ? rankOf(levelOf(xp).level).index + 1 : open === 'bounty' ? 0 : s.buildings[open]} />
            {open === 'hall' && <HallPanel />}
            {open === 'pavilion' && <PavilionPanel />}
            {open === 'forge' && <ForgePanel />}
            {open === 'bounty' && <BountyPanel />}
            {open === 'recruit' && <RecruitPanel />}
            {open === 'doctrine' && <DoctrinePanel />}
            {open === 'vein' && <VeinPanel />}
            {open === 'training' && <TrainingPanel />}
          </div>
        </aside>
      )}
    </div>
  );
}

function hasNews(id: BuildingId, m: ReturnType<typeof meta.peek>, s: SectState): boolean {
  const xp = m.renown?.xp ?? 0;
  if (id === 'vein' && veinPoints(s.buildings.vein) > veinSpent(s.vein)) return true;
  if (id === 'pavilion' || id === 'forge' || id === 'recruit' || id === 'doctrine' || id === 'vein' || id === 'training') {
    const lvl = s.buildings[id];
    if (lvl < levelCap(xp) && canAfford(s.purse, levelCost(lvl + 1, BUILDING_BY_ID[id].material!))) return true;
  }
  if (id === 'doctrine') return DOCTRINE_LIST.some((d) => !s.doctrines.includes(d.id) && d.hall <= s.buildings.doctrine && canAfford(s.purse, d.price));
  if (id === 'pavilion') return STUDIES.some((st) => !s.research.includes(st.id) && st.level <= s.buildings.pavilion && canAfford(s.purse, st.cost));
  if (id === 'forge') return RECIPES.some((r) => !s.heirlooms.some((h) => h.id === r.id) && r.forge <= s.buildings.forge && canAfford(s.purse, r.cost));
  if (id === 'recruit') return RECRUITS.some((r) => recruitState(m, r.hero) === 'waiting' && canAfford(s.purse, r.cost));
  return false;
}

// ───────────────────────── shared pieces ─────────────────────────

export function PurseBar({ purse }: { purse: Purse }) {
  return (
    <div class="purse-bar">
      {CURRENCIES.map((c) => (
        <span key={c.key} class="purse-coin" {...tip(<><h4>{c.name}</h4><p>{c.desc}</p></>, 'below')}>
          <Icon name={c.icon} size={30} />
          <b>{purse[c.key].toLocaleString('en-US')}</b>
        </span>
      ))}
    </div>
  );
}

function Cost({ cost, purse }: { cost: Partial<Purse>; purse: Purse }) {
  return (
    <span class="sect-cost">
      {CURRENCIES.filter((c) => cost[c.key]).map((c) => (
        <span key={c.key} class={purse[c.key] >= (cost[c.key] ?? 0) ? '' : 'short'} {...tip(c.name, 'below')}>
          <Icon name={c.icon} size={22} /> {cost[c.key]}
        </span>
      ))}
    </span>
  );
}

function act(r: SectResult, sfx = 'rankup') {
  if (r.ok) audio.sfx(sfx, { volume: 0.6 });
  else {
    audio.sfx('ui_error', { volume: 0.6 });
    showToast(r.reason, 'error');
  }
}

function DrawerHead({ id, level }: { id: BuildingId; level: number }) {
  const b = BUILDING_BY_ID[id];
  return (
    <div class="sect-head">
      <span class="sect-medal small">
        <Icon name={b.icon} size={64} />
      </span>
      <div>
        <div class="display sect-head-name">
          {b.name} {level > 0 && <span class="sect-head-level">Level {ROMAN[level]}</span>}
        </div>
        <p class="sect-head-desc">{b.desc}</p>
      </div>
    </div>
  );
}

function Sec({ title, aside, children }: { title: string; aside?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="drawer-sec">
      <h4 class="drawer-sec-title display">
        <Icon name="ui_bullet" size={16} /> {title}
        {aside && <span class="drawer-sec-aside">{aside}</span>}
      </h4>
      {children}
    </section>
  );
}

/** The level row of an upgradable building: its level, the rank's cap and the cost of the next level. */
function LevelRow({ id }: { id: UpgradableId }) {
  const m = meta.value;
  const s = sectOf(m);
  const xp = m.renown?.xp ?? 0;
  const lvl = s.buildings[id];
  const cap = levelCap(xp);
  const next = lvl + 1;
  const cost = levelCost(next, BUILDING_BY_ID[id].material!);
  const capRank = SECT_RANKS[Math.min(SECT_RANKS.length - 1, next - 1)];
  return (
    <div class="sect-level-row">
      <span class="sect-level-pips">
        {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
          <i key={i} class={i < lvl ? 'lit' : i < cap ? 'open' : ''} />
        ))}
      </span>
      {lvl >= MAX_BUILDING_LEVEL ? (
        <span class="sect-note">Fully built.</span>
      ) : next > cap ? (
        <span class="sect-note">Level {ROMAN[next]} needs the sect to be {capRank ? `${/^[AEIOU]/.test(capRank.name) ? 'an' : 'a'} ${capRank.name} (Renown ${capRank.level})` : 'of a higher rank'}.</span>
      ) : (
        <>
          <Cost cost={cost} purse={s.purse} />
          <button class="btn small primary" disabled={!canAfford(s.purse, cost)} onClick={() => act(upgradeBuilding(id))}>
            Raise to {ROMAN[next]}
          </button>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Main Hall ─────────────────────────

function HallPanel() {
  const m = meta.value;
  const s = sectOf(m);
  const xp = m.renown?.xp ?? 0;
  const lv = levelOf(xp).level;
  const rank = rankOf(lv);
  return (
    <>
      <div class="sect-hall-plate">
        <SectPlate />
      </div>
      <Sec title="Ranks and building levels" aside={`${rank.name}`}>
        <div class="sect-ranks">
          {SECT_RANKS.slice(0, 5).map((r, i) => (
            <div key={r.level} class={`sect-rank ${i === rank.index ? 'on' : i < rank.index ? 'past' : ''}`}>
              <span class="brush">{r.hanzi}</span>
              <span class="sect-rank-name">{r.name}</span>
              <span class="sect-rank-lvl">Renown {r.level}</span>
              <span class="sect-rank-cap">Buildings up to {ROMAN[i + 1]}</span>
            </div>
          ))}
        </div>
      </Sec>
      <Sec title="The sect today">
        <div class="drawer-stats">
          <div class="drawer-stat">
            <Icon name="relic_library" size={22} />
            <span>Scripture Pavilion</span>
            <b>{isOpen('pavilion', xp) ? `Level ${ROMAN[s.buildings.pavilion]}` : 'Renown 3'}</b>
          </div>
          <div class="drawer-stat">
            <Icon name="relic_furnace" size={22} />
            <span>Artifact Forge</span>
            <b>{isOpen('forge', xp) ? `Level ${ROMAN[s.buildings.forge]}` : 'Renown 5'}</b>
          </div>
          <div class="drawer-stat">
            <Icon name="ui_compendium" size={22} />
            <span>Studies</span>
            <b>
              {s.research.length} / {STUDIES.length}
            </b>
          </div>
          <div class="drawer-stat">
            <Icon name="item_pouch" size={22} />
            <span>Heirlooms</span>
            <b>
              {s.heirlooms.length} / {RECIPES.length}
            </b>
          </div>
          <div class="drawer-stat">
            <Icon name={BUILDING_BY_ID.recruit.icon} size={22} />
            <span>Recruitment Hall</span>
            <b>{isOpen('recruit', xp) ? `Level ${ROMAN[s.buildings.recruit]}` : `Renown ${BUILDING_BY_ID.recruit.unlock}`}</b>
          </div>
          <div class="drawer-stat">
            <Icon name="choice_disciple" size={22} />
            <span>Exclusive disciples</span>
            <b>
              {s.disciples.length} / {RECRUITS.length}
            </b>
          </div>
        </div>
      </Sec>
      <Sec title="How runs pay the sect">
        {CURRENCIES.map((c) => (
          <p key={c.key} class="sect-coin-line">
            <Icon name={c.icon} size={26} /> <b>{c.name}.</b> {c.desc}
          </p>
        ))}
        <p class="drawer-note">Everything a run pays is multiplied by its contract: harder contracts, richer sect.</p>
      </Sec>
    </>
  );
}

// ───────────────────────── Scripture Pavilion ─────────────────────────

function PavilionPanel() {
  const m = meta.value;
  const s = sectOf(m);
  const [tab, setTab] = useState<'items' | 'relics'>('relics');
  const slots = sealSlots(s.buildings.pavilion);
  const seen = m.seen;
  const items = SHOP_ITEMS.filter((i) => seen?.items.includes(i.id));
  const relics = [...SHOP_RELICS, ...RESEARCH_RELICS.filter((r) => s.research.includes(r.research!))].filter((r) => seen?.relics.includes(r.id) || s.research.includes(r.research ?? ''));
  const list = tab === 'items' ? items : relics;
  return (
    <>
      <LevelRow id="pavilion" />
      <Sec title="Studies" aside={`${s.research.length} of ${STUDIES.length} done`}>
        <div class="sect-cards">
          {STUDIES.map((st) => {
            const done = s.research.includes(st.id);
            const locked = st.level > s.buildings.pavilion;
            return (
              <div key={st.id} class={`sect-card ${done ? 'done' : ''}`}>
                <div class="sect-card-head">
                  <span class="display sect-card-name">{st.name}</span>
                  {done ? <span class="sect-badge">Studied</span> : locked ? <span class="sect-badge faint">Pavilion {ROMAN[st.level]}</span> : null}
                </div>
                <p class="sect-card-blurb">{st.blurb}</p>
                <div class="sect-card-relics">
                  {studyRelics(st.id).map((r) => (
                    <span key={r.id} class={`sect-relic rar-${r.rarity}`} {...tip(<RelicTip relicId={r.id} />)}>
                      <Icon name={`relic_${r.icon}`} size={34} />
                      <span>{r.name}</span>
                    </span>
                  ))}
                </div>
                {!done && (
                  <div class="sect-card-foot">
                    <Cost cost={st.cost} purse={s.purse} />
                    <button class="btn small primary" disabled={locked || !canAfford(s.purse, st.cost)} onClick={() => act(research(st.id))}>
                      Study
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Sec>
      <Sec title="Seals" aside={`${s.seals.length} of ${slots} in use`}>
        <p class="sect-note">A sealed Treasure or Dao Insight is never offered in a run: not in the shop, not as a reward. Only what you have met can be sealed.</p>
        {s.seals.length > 0 && (
          <div class="seal-list">
            {s.seals.map((id) => {
              const it = ITEM_BY_ID[id];
              const r = RELIC_BY_ID[id];
              return (
                <button key={id} class="seal-chip on" onClick={() => act(toggleSeal(id), 'ui_click')} {...tip(it ? <ItemTip itemId={id} /> : <RelicTip relicId={id} />)}>
                  <Icon name={it ? `item_${it.icon}` : `relic_${r?.icon}`} size={28} />
                  <span>{it?.name ?? r?.name}</span>
                  <Icon name="ui_close" size={12} class="seal-x" />
                </button>
              );
            })}
          </div>
        )}
        <div class="seal-tabs">
          <button class={`codex-chip ${tab === 'relics' ? 'on' : ''}`} onClick={() => setTab('relics')}>
            Dao Insights
          </button>
          <button class={`codex-chip ${tab === 'items' ? 'on' : ''}`} onClick={() => setTab('items')}>
            Treasures
          </button>
        </div>
        <div class="seal-grid">
          {list.length === 0 && <p class="sect-note">Nothing met yet. Runs reveal Treasures and Dao Insights.</p>}
          {list.map((x) => {
            const sealed = s.seals.includes(x.id);
            const isItem = tab === 'items';
            return (
              <button
                key={x.id}
                class={`seal-pick rar-${x.rarity} ${sealed ? 'on' : ''}`}
                onClick={() => act(toggleSeal(x.id), 'ui_click')}
                {...tip(isItem ? <ItemTip itemId={x.id} /> : <RelicTip relicId={x.id} />)}
              >
                <Icon name={isItem ? `item_${x.icon}` : `relic_${x.icon}`} size={34} />
                <span class="seal-pick-name">{x.name}</span>
                {sealed && <span class="brush seal-stamp">封</span>}
              </button>
            );
          })}
        </div>
      </Sec>
    </>
  );
}

// ───────────────────────── Artifact Forge ─────────────────────────

function ForgePanel() {
  const m = meta.value;
  const s = sectOf(m);
  return (
    <>
      <LevelRow id="forge" />
      <Sec title="Heirlooms" aside={`${s.heirlooms.length} of ${RECIPES.length} made`}>
        <p class="sect-note">
          Pick one on the New Run screen and it starts the run in your inventory. Each run won with it raises it a level, up to {ROMAN[HEIRLOOM_MAX_LEVEL]}. From Forge level IV, new heirlooms start at level II.
        </p>
        <div class="sect-cards">
          {RECIPES.map((r) => {
            const made = s.heirlooms.find((h) => h.id === r.id);
            const locked = r.forge > s.buildings.forge;
            const carried = s.carry === r.id;
            const itemId = heirloomItemId(r.id, made?.level ?? 1);
            return (
              <div key={r.id} class={`sect-card forge ${made ? 'done' : ''}`}>
                <div class="sect-card-row">
                  <span class="sect-item rar-unique" {...tip(<ItemTip itemId={itemId} />)}>
                    <Icon name={`item_${r.icon}`} size={58} />
                  </span>
                  <div class="sect-card-text">
                    <div class="sect-card-head">
                      <span class="display sect-card-name">{r.name}</span>
                      {made ? <span class="sect-badge">Level {ROMAN[made.level]}</span> : locked ? <span class="sect-badge faint">Forge {ROMAN[r.forge]}</span> : null}
                    </div>
                    <p class="sect-card-blurb">{r.blurb}</p>
                    {made && ITEM_BY_ID[itemId]?.desc && (
                      <p class="sect-card-effect">
                        <RichText text={ITEM_BY_ID[itemId].desc!} />
                      </p>
                    )}
                  </div>
                </div>
                <div class="sect-card-foot">
                  {made ? (
                    <button
                      class={`btn small ${carried ? 'primary' : 'ghost'}`}
                      onClick={() => {
                        audio.sfx('ui_click', { volume: 0.6 });
                        setCarry(carried ? '' : r.id);
                      }}
                    >
                      {carried ? 'Carried into the next run' : 'Carry into the next run'}
                    </button>
                  ) : (
                    <>
                      <Cost cost={r.cost} purse={s.purse} />
                      <button class="btn small primary" disabled={locked || !canAfford(s.purse, r.cost)} onClick={() => act(craft(r.id))}>
                        Craft
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Sec>
    </>
  );
}

// ───────────────────────── Recruitment Hall ─────────────────────────

function RecruitPanel() {
  const m = meta.value;
  const s = sectOf(m);
  const lvl = s.buildings.recruit;
  return (
    <>
      <LevelRow id="recruit" />
      <Sec title="Exclusive disciples" aside={`${s.disciples.length} of ${RECRUITS.length} recruited`}>
        <p class="sect-note">An exclusive disciple answers the call when the sect reaches their Renown. Recruit them once, and from then on they can appear in every run's draft and shop.</p>
        <div class="sect-cards">
          {RECRUITS.map((r) => {
            const st = recruitState(m, r.hero);
            const def = HERO_BY_ID[r.hero];
            return (
              <div key={r.hero} class={`sect-card recruit ${st}`}>
                <div class="sect-card-row">
                  <div class="recruit-card">
                    <HeroCard defId={r.hero} rank={0} size="md" />
                  </div>
                  <div class="sect-card-text">
                    <div class="sect-card-head">
                      <span class="display sect-card-name">{def.name}</span>
                      {st === 'recruited' ? <span class="sect-badge">Recruited</span> : st === 'locked' ? <span class="sect-badge faint">Renown {r.renown}</span> : <span class="sect-badge glow">At the gate</span>}
                    </div>
                    <p class="sect-card-blurb">{r.blurb}</p>
                    <p class="sect-card-effect">{def.lore}</p>
                  </div>
                </div>
                <div class="sect-card-foot">
                  {st === 'recruited' ? (
                    <span class="sect-note">Joins your drafts and shops.</span>
                  ) : st === 'locked' ? (
                    <span class="sect-note">Answers the sect's call at Renown {r.renown}.</span>
                  ) : (
                    <>
                      <Cost cost={r.cost} purse={s.purse} />
                      <button class="btn small primary" disabled={!canAfford(s.purse, r.cost)} onClick={() => act(recruit(r.hero))}>
                        Recruit
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Sec>
      <Sec title="What the hall's levels do">
        <div class="drawer-stats">
          <div class="drawer-stat">
            <Icon name="ui_reroll" size={22} />
            <span>Free draft rerolls each run (one from level III)</span>
            <b>{freeRerollsFor(lvl)}</b>
          </div>
          <div class="drawer-stat">
            <Icon name="choice_disciple" size={22} />
            <span>Disciples in the opening draft (four at level V)</span>
            <b>{draftSizeFor(lvl)}</b>
          </div>
        </div>
      </Sec>
    </>
  );
}

// ───────────────────────── Doctrine Hall ─────────────────────────

function DoctrinePanel() {
  const m = meta.value;
  const s = sectOf(m);
  return (
    <>
      <LevelRow id="doctrine" />
      <Sec title="Doctrines" aside={`${s.doctrines.length} of ${DOCTRINE_LIST.length} learned`}>
        <p class="sect-note">A run can follow one learned doctrine, picked on the New Run screen. Each gives something and takes something. A Pure run follows none.</p>
        <div class="sect-cards">
          {DOCTRINE_LIST.map((d) => {
            const learned = s.doctrines.includes(d.id);
            const locked = d.hall > s.buildings.doctrine;
            const followed = s.doctrine === d.id;
            return (
              <div key={d.id} class={`sect-card doctrine ${learned ? 'done' : ''} ${locked ? 'locked' : ''}`}>
                <div class="sect-card-row">
                  <span class="doctrine-medal">
                    <Icon name={d.icon} size={50} />
                    <span class="brush doctrine-hanzi">{d.hanzi}</span>
                  </span>
                  <div class="sect-card-text">
                    <div class="sect-card-head">
                      <span class="display sect-card-name">{d.name}</span>
                      {learned ? <span class="sect-badge">Learned</span> : locked ? <span class="sect-badge faint">Hall {ROMAN[d.hall]}</span> : null}
                    </div>
                    <p class="doctrine-line up">
                      <span class="doctrine-mark">+</span>
                      <span>
                        <RichText text={d.upside} />
                      </span>
                    </p>
                    <p class="doctrine-line down">
                      <span class="doctrine-mark">−</span>
                      <span>
                        <RichText text={d.cost} />
                      </span>
                    </p>
                  </div>
                </div>
                <div class="sect-card-foot">
                  {learned ? (
                    <button
                      class={`btn small ${followed ? 'primary' : 'ghost'}`}
                      onClick={() => {
                        audio.sfx('ui_click', { volume: 0.6 });
                        setDoctrine(followed ? '' : d.id);
                      }}
                    >
                      {followed ? 'Followed in the next run' : 'Follow in the next run'}
                    </button>
                  ) : (
                    <>
                      <Cost cost={d.price} purse={s.purse} />
                      <button class="btn small primary" disabled={locked || !canAfford(s.purse, d.price)} onClick={() => act(learnDoctrine(d.id))}>
                        Learn
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Sec>
    </>
  );
}

// ───────────────────────── Spirit Vein ─────────────────────────

function VeinPanel() {
  const m = meta.value;
  const s = sectOf(m);
  const points = veinPoints(s.buildings.vein);
  const spent = veinSpent(s.vein);
  return (
    <>
      <LevelRow id="vein" />
      <div class="vein-points">
        <span class="brush vein-points-glyph">脉</span>
        <span>
          <b>{points - spent}</b> of {points} points free
        </span>
        <button
          class="btn small ghost"
          disabled={spent === 0}
          onClick={() => {
            audio.sfx('ui_back', { volume: 0.6 });
            veinReset();
          }}
          {...tip('Takes every point back, for free.', 'below')}
        >
          Refund all
        </button>
      </div>
      <p class="sect-note">Every point is a small blessing the sect sends with each run. Move them freely between runs. A Pure run goes without.</p>
      {VEIN_RINGS.map((ring) => {
        const nodes = VEIN_NODES.filter((n) => n.ring === ring.ring);
        const open = veinSpent(s.vein, ring.ring) >= ring.needs;
        // the Root is a grid; the Trunk and the Crown come in pairs where only one side can be taken
        const groups = ring.ring === 1 ? nodes.map((n) => [n]) : [...new Set(nodes.map((n) => n.pair))].map((p) => nodes.filter((n) => n.pair === p));
        return (
          <Sec key={ring.ring} title={`${ring.name}`} aside={open ? (ring.ring === 1 ? 'The help' : 'Take one of each pair') : `Opens after ${ring.needs} points below`}>
            <div class={`vein-ring ring-${ring.ring} ${open ? '' : 'closed'}`}>
              {groups.map((g, i) => (
                <div key={i} class={`vein-group ${g.length > 1 ? 'pair' : ''}`}>
                  {g.flatMap((n, j) => [
                    ...(j > 0 ? [<span key={`or-${n.id}`} class="vein-or">or</span>] : []),
                    <VeinCard key={n.id} node={n} rank={s.vein[n.id] ?? 0} add={veinAddBlocked(s.vein, n.id, points)} remove={veinRemoveBlocked(s.vein, n.id)} />,
                  ])}
                </div>
              ))}
            </div>
          </Sec>
        );
      })}
    </>
  );
}

function VeinCard({ node, rank, add, remove }: { node: VeinNode; rank: number; add: string | null; remove: string | null }) {
  return (
    <div class={`vein-node ${rank > 0 ? 'on' : ''}`}>
      <span class="vein-medal">
        <Icon name={node.icon} size={34} />
      </span>
      <div class="vein-text">
        <div class="display vein-name">{node.name}</div>
        <p class="vein-desc">
          <RichText text={node.desc} />
        </p>
        <span class="vein-pips" aria-label={`${rank} of ${node.max}`}>
          {Array.from({ length: node.max }, (_, i) => (
            <i key={i} class={i < rank ? 'lit' : ''} />
          ))}
          {node.cost > 1 && <span class="vein-cost">{node.cost} points</span>}
        </span>
      </div>
      <div class="vein-buttons">
        <button class="vein-btn" aria-label={`Add a point to ${node.name}`} disabled={!!add} onClick={() => act(veinAdd(node.id), 'ui_click')} {...tip(add ?? 'Place a point', 'left')}>
          +
        </button>
        <button class="vein-btn" aria-label={`Take a point from ${node.name}`} disabled={!!remove} onClick={() => act(veinRemove(node.id), 'ui_back')} {...tip(remove ?? 'Take the point back', 'left')}>
          −
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Training Grounds ─────────────────────────

function TrainingPanel() {
  const m = meta.value;
  const s = sectOf(m);
  const lvl = s.buildings.training;
  return (
    <>
      <LevelRow id="training" />
      <Sec title="Blessings" aside={`${trainedBlessings(lvl).length} of ${TRAINING_BLESSINGS.length} taught`}>
        <p class="sect-note">Every blessing the grounds teach joins the opening draft's pool, beside the six every sect knows. A Pure run keeps them: they add choices, not power.</p>
        <div class="sect-cards">
          {TRAINING_BLESSINGS.map((b) => {
            const taught = (b.training ?? 99) <= lvl;
            return (
              <div key={b.id} class={`sect-card training ${taught ? 'done' : 'locked'}`}>
                <div class="sect-card-row">
                  <span class="doctrine-medal training-medal">
                    <Icon name={b.icon} size={46} />
                  </span>
                  <div class="sect-card-text">
                    <div class="sect-card-head">
                      <span class="display sect-card-name">{b.name}</span>
                      {taught ? <span class="sect-badge">In the draft</span> : <span class="sect-badge faint">Grounds {ROMAN[b.training ?? 5]}</span>}
                    </div>
                    <p class="sect-card-blurb">
                      <RichText text={b.desc} />
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Sec>
      <Sec title="What the grounds' levels do">
        <div class="drawer-stats">
          <div class="drawer-stat">
            <Icon name="choice_disciple" size={22} />
            <span>Blessings in the opening draft (four at level V)</span>
            <b>{blessingCountFor(lvl)}</b>
          </div>
        </div>
      </Sec>
    </>
  );
}

// ───────────────────────── Bounty Board ─────────────────────────

function BountyPanel() {
  const m = meta.value;
  const s = sectOf(m);
  return (
    <>
      <Sec title="Standing bounties" aside={`${s.bounties.done.length} of ${BOUNTIES.length} met this cycle`}>
        <p class="sect-note">A bounty is checked when a run ends. Meet it and it pays its reward, and a new bounty takes its place. Nothing expires.</p>
        <div class="sect-cards">
          {s.bounties.active.map((id) => {
            const b = BOUNTY_BY_ID[id];
            if (!b) return null;
            return (
              <div key={id} class="sect-card bounty">
                <div class="sect-card-head">
                  <span class="brush sect-bounty-seal">榜</span>
                  <span class="display sect-card-name">{b.name}</span>
                </div>
                <p class="sect-card-blurb">{b.desc}</p>
                <div class="sect-card-foot">
                  <span class="sect-reward">
                    Reward
                    {CURRENCIES.filter((c) => b.reward[c.key]).map((c) => (
                      <span key={c.key}>
                        <Icon name={c.icon} size={22} /> {b.reward[c.key]}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
          {s.bounties.active.length === 0 && <p class="sect-note">The board fills when the sect opens.</p>}
        </div>
      </Sec>
    </>
  );
}
