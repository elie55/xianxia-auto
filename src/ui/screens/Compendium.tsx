import { useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { compendiumReturn, meta, screen } from '@/app/store';
import { emptySeen, type SeenKind } from '@/app/discovery';
import { HEROES, HERO_BY_ID } from '@/content/heroes';
import { ENEMIES, ENEMY_BY_ID } from '@/content/enemies';
import { THEMES, THEME_BY_ID, lookFilter } from '@/content/themes';
import { DIFFICULTIES } from '@/content/difficulties';
import { ITEMS, ITEM_BY_ID } from '@/content/items';
import { RELICS, RELIC_BY_ID } from '@/content/relics';
import { CLASSES } from '@/content/classes';
import type { ClassId, EnemyDef, HeroDef, ItemDef, Keyword, QuestDef, RelicDef, Stats } from '@/core/types';
import { HERO_PRICE_BY_RANK, ITEM_PRICE_BY_RARITY, RELIC_PRICE_BY_RARITY } from '@/core/types';
import { heroStats } from '@/core/builder';
import { itemSellValue } from '@/core/run';
import { EMPTY_CTX, HeroCard, KEYWORD_DESC, Portrait, STAT_DESC, fmtStat, tempHero } from '@/ui/components/HeroCard';
import { Icon, KEYWORD_ICON, STAT_COLOR, STAT_ICON, STAT_LABEL } from '@/ui/components/Icon';
import { PAINTED_ICONS } from '@/ui/components/paintedIcons';
import { RichText } from '@/ui/components/RichText';
import { SpriteClip, useSpritePack } from '@/ui/components/SpriteClip';
import { tip } from '@/ui/components/Tooltip';
import { audio } from '@/audio/AudioManager';

type Tab = 'disciples' | 'classes' | 'enemies' | 'treasures' | 'insights';
type Kind = 'hero' | 'item' | 'relic' | 'enemy';
interface Detail {
  kind: Kind;
  id: string;
}
type Sel = Record<string, string | undefined>;

const TABS: { id: Tab; label: string; hanzi: string; seen?: SeenKind }[] = [
  { id: 'disciples', label: 'Disciples', hanzi: '弟', seen: 'heroes' },
  { id: 'classes', label: 'Classes', hanzi: '道' },
  { id: 'enemies', label: 'Enemies', hanzi: '妖', seen: 'enemies' },
  { id: 'treasures', label: 'Treasures', hanzi: '宝', seen: 'items' },
  { id: 'insights', label: 'Dao Insights', hanzi: '悟', seen: 'relics' },
];

/** Foes of battlefields still being made stay out of the Compendium until their contract can be played. */
const ENEMY_LIST = ENEMIES.filter((e) => !e.theme || THEME_BY_ID[e.theme]?.ready);

const ALL_IDS: Record<SeenKind, string[]> = {
  heroes: HEROES.map((h) => h.id),
  enemies: ENEMY_LIST.map((e) => e.id),
  items: ITEMS.map((i) => i.id),
  relics: RELICS.map((r) => r.id),
};

const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, unique: 3 };
const byRarity = (a: { rarity: string; name: string }, b: { rarity: string; name: string }) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name);
const ITEM_LIST = ITEMS.slice().sort(byRarity);
const RELIC_LIST = RELICS.slice().sort(byRarity);

// ───────────────────────── filters ─────────────────────────

interface Chip {
  id: string;
  label?: string;
  icon?: string;
  hint?: string;
  cls?: string;
  /** Class on the icon itself (keyword colours tint the glyph). */
  iconCls?: string;
  color?: string;
}
interface Group {
  id: string;
  chips: Chip[];
  /** Filtering by this group would tell something about an undiscovered entry: those drop out while it is on. */
  reveals?: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rarityChip = (r: string): Chip => ({ id: r, label: cap(r), cls: `rar-${r} rarity` });
const ITEM_STATS = [...new Set(ITEMS.flatMap((i) => Object.keys(i.stats ?? {})))];
const RELIC_KEYWORDS = [...new Set(RELICS.flatMap((r) => r.keywords ?? []))];

const GROUPS: Record<Tab, Group[]> = {
  disciples: [
    {
      id: 'class',
      reveals: true,
      chips: Object.values(CLASSES).map((c) => ({ id: c.id, label: c.name.split(' ')[0], icon: `class_${c.id}`, hint: `${c.name} · ${c.role}`, color: c.color })),
    },
  ],
  classes: [],
  enemies: [
    {
      id: 'kind',
      chips: [
        { id: 'regular', label: 'Regular', icon: 'node_fight' },
        { id: 'elite', label: 'Elite', icon: 'node_elite' },
        { id: 'boss', label: 'Guardian', icon: 'node_boss' },
      ],
    },
    { id: 'realm', chips: [{ id: '1', label: 'Realm 1' }, { id: '2', label: 'Realm 2' }] },
    // one seal per contract whose battlefields are built (Mortal holds the original foes and the Thunder Ape)
    {
      id: 'contract',
      chips: DIFFICULTIES.filter((d) => d.tier === 0 || THEMES.some((t) => t.tier === d.tier && t.ready)).map((d) => ({
        id: String(d.tier),
        label: d.hanzi,
        hint: d.tier === 0 ? 'Mortal battlefields' : `${d.name} battlefields`,
        cls: 'seal',
      })),
    },
  ],
  treasures: [
    { id: 'rarity', chips: ['common', 'rare', 'epic', 'unique'].map(rarityChip) },
    { id: 'stat', reveals: true, chips: ITEM_STATS.map((k) => ({ id: k, icon: STAT_ICON[k], hint: STAT_LABEL[k] })) },
  ],
  insights: [
    { id: 'rarity', chips: ['common', 'rare', 'epic'].map(rarityChip) },
    { id: 'kw', reveals: true, chips: RELIC_KEYWORDS.map((k) => ({ id: k, icon: KEYWORD_ICON[k], hint: k, iconCls: `kw-${k}` })) },
  ],
};

const hay = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ').toLowerCase();
const enemyKind = (e: EnemyDef) => (e.boss ? 'boss' : e.elite ? 'elite' : 'regular');
/** The contract whose battlefields a foe walks (0 = Mortal). */
const enemyContract = (e: EnemyDef) => (e.theme ? (THEME_BY_ID[e.theme]?.tier ?? 0) : 0);

function heroMatch(h: HeroDef, sel: Sel, q: string): boolean {
  if (sel.class && !h.classes.includes(sel.class as ClassId)) return false;
  return !q || hay(h.name, h.title, h.ability.name, ...h.classes.map((c) => CLASSES[c].name), ...h.tags).includes(q);
}
function enemyMatch(e: EnemyDef, sel: Sel, q: string): boolean {
  if (sel.kind && enemyKind(e) !== sel.kind) return false;
  if (sel.realm && e.realm !== 'any' && String(e.realm) !== sel.realm) return false;
  if (sel.contract && String(enemyContract(e)) !== sel.contract) return false;
  return !q || hay(e.name, e.ability?.name, ...(e.passives ?? []).map((p) => p.name)).includes(q);
}
function itemMatch(i: ItemDef, sel: Sel, q: string): boolean {
  if (sel.rarity && i.rarity !== sel.rarity) return false;
  if (sel.stat && !(i.stats && sel.stat in i.stats)) return false;
  return !q || hay(i.name, i.desc, ...(i.keywords ?? [])).includes(q);
}
function relicMatch(r: RelicDef, sel: Sel, q: string): boolean {
  if (sel.rarity && r.rarity !== sel.rarity) return false;
  if (sel.kw && !(r.keywords ?? []).includes(sel.kw as Keyword)) return false;
  return !q || hay(r.name, r.desc, ...(r.keywords ?? [])).includes(q);
}

// ───────────────────────── screen ─────────────────────────

/**
 * The Compendium: every disciple, class, foe, Treasure and Dao Insight. Entries reveal themselves once a run has shown
 * them (discovery), with counters, filter chips, a search and a detail page per entry.
 */
export function Compendium() {
  // ?screen=compendium&tab=treasures opens a tab directly (QA)
  const [tab, setTabState] = useState<Tab>(() => {
    const q = new URLSearchParams(location.search).get('tab');
    return TABS.some((t) => t.id === q) ? (q as Tab) : 'disciples';
  });
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Sel>({});
  const [foundOnly, setFoundOnly] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [cls, setCls] = useState<ClassId>('sword');
  const lists = meta.value.seen ?? emptySeen();
  const seen = useMemo(
    () => ({ heroes: new Set(lists.heroes), enemies: new Set(lists.enemies), items: new Set(lists.items), relics: new Set(lists.relics) }),
    [lists],
  );
  const count = (k: SeenKind) => ALL_IDS[k].filter((id) => seen[k].has(id)).length;
  const counts = { heroes: count('heroes'), enemies: count('enemies'), items: count('items'), relics: count('relics') };
  const found = counts.heroes + counts.enemies + counts.items + counts.relics;
  const total = ALL_IDS.heroes.length + ALL_IDS.enemies.length + ALL_IDS.items.length + ALL_IDS.relics.length;

  const groups = GROUPS[tab];
  const q = query.trim().toLowerCase();
  const revealing = q !== '' || groups.some((g) => g.reveals && sel[g.id]);
  const filtered = revealing || groups.some((g) => sel[g.id]) || foundOnly;
  // undiscovered entries keep their place as silhouettes, unless a search or a revealing filter is on
  const keep = (isSeen: boolean, match: boolean) => match && (isSeen || (!foundOnly && !revealing));

  const setTab = (t: Tab) => {
    if (t === tab) return;
    audio.sfx('ui_click');
    setTabState(t);
    setSel({});
    setQuery('');
    setDetail(null);
  };
  const open = (kind: Kind, id: string) => {
    audio.sfx('ui_click', { volume: 0.6 });
    setDetail((d) => (d?.kind === kind && d.id === id ? null : { kind, id }));
  };
  const picked = (kind: Kind, id: string) => (detail?.kind === kind && detail.id === id ? 'picked' : '');
  const pick = (g: string, id: string) => {
    audio.sfx('ui_click', { volume: 0.5 });
    setSel((s) => ({ ...s, [g]: s[g] === id ? undefined : id }));
  };

  const heroes = HEROES.filter((h) => keep(seen.heroes.has(h.id), heroMatch(h, sel, q)));
  const enemies = ENEMY_LIST.filter((e) => keep(seen.enemies.has(e.id), enemyMatch(e, sel, q)));
  const items = ITEM_LIST.filter((i) => keep(seen.items.has(i.id), itemMatch(i, sel, q)));
  const relics = RELIC_LIST.filter((r) => keep(seen.relics.has(r.id), relicMatch(r, sel, q)));
  const shown = tab === 'disciples' ? heroes.length : tab === 'enemies' ? enemies.length : tab === 'treasures' ? items.length : tab === 'insights' ? relics.length : 1;

  return (
    <div class="screen codex-screen v2">
      <div class="newrun-bg">
        <div class="watermark" style={{ right: 60, top: 40, fontSize: 380 }}>
          典
        </div>
      </div>
      <div class="newrun-header">
        <button
          class="btn small ghost codex-back"
          // while a detail page is open, Esc closes it instead (its close button takes the hotkey)
          data-hotkey={detail ? undefined : 'back'}
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = compendiumReturn.value;
            compendiumReturn.value = 'menu';
          }}
        >
          <Icon name="ui_back" size={20} /> Back
        </button>
        <div class="display newrun-title">Compendium</div>
        <div
          class="codex-progress"
          {...tip(
            <>
              <h4>Discovery</h4>
              <p>Disciples, Treasures, Dao Insights and foes are recorded here once a run has shown them to you.</p>
              <p class="muted">
                Disciples {counts.heroes}/{ALL_IDS.heroes.length} · Enemies {counts.enemies}/{ALL_IDS.enemies.length} · Treasures {counts.items}/{ALL_IDS.items.length} · Dao Insights {counts.relics}/{ALL_IDS.relics.length}
              </p>
            </>,
            'below',
          )}
        >
          <div class="codex-progress-label">
            <span>Discovered</span> <b>{found}</b> <span class="faint">/ {total}</span>
          </div>
          <div class="codex-progress-bar">
            <i style={{ width: `${(found / total) * 100}%` }} />
          </div>
        </div>
      </div>
      <div class="codex-tabs">
        {TABS.map((t) => {
          const n = t.seen ? counts[t.seen] : 0;
          const of = t.seen ? ALL_IDS[t.seen].length : 0;
          return (
            <button key={t.id} class={`codex-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <span class="brush">{t.hanzi}</span>
              <span class="display">{t.label}</span>
              {t.seen && (
                <span class={`codex-tab-count ${n === of ? 'full' : ''}`}>
                  {n}/{of}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tab !== 'classes' && (
        <div class="codex-toolbar">
          <div class="codex-chips">
            <button
              class={`codex-chip ${groups.every((g) => !sel[g.id]) ? 'on' : ''}`}
              onClick={() => {
                audio.sfx('ui_click', { volume: 0.5 });
                setSel({});
              }}
            >
              All
            </button>
            {groups.map((g) => (
              <div key={g.id} class="codex-chip-group">
                {g.chips.map((c) => (
                  <button
                    key={c.id}
                    class={`codex-chip ${c.label ? '' : 'icon-only'} ${c.cls ?? ''} ${sel[g.id] === c.id ? 'on' : ''}`}
                    style={c.color ? { ['--chip' as string]: c.color } : undefined}
                    onClick={() => pick(g.id, c.id)}
                    {...(c.hint ? tip(c.hint, 'below') : {})}
                  >
                    {c.icon && <Icon name={c.icon} size={22} class={c.iconCls} />}
                    {c.cls?.includes('rarity') && <i class="codex-gem" />}
                    {c.label && <span>{c.label}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div class="codex-tools">
            <button
              class={`codex-chip toggle ${foundOnly ? 'on' : ''}`}
              onClick={() => {
                audio.sfx('ui_click', { volume: 0.5 });
                setFoundOnly(!foundOnly);
              }}
              {...tip('Hide what you have not met yet.', 'below')}
            >
              <i class="codex-check" /> Found only
            </button>
            <label class="codex-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21" />
              </svg>
              <input type="text" placeholder="Search" value={query} spellcheck={false} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
              {query && (
                <button class="codex-search-clear" onClick={() => setQuery('')} aria-label="Clear the search">
                  <Icon name="ui_close" size={14} />
                </button>
              )}
            </label>
          </div>
        </div>
      )}
      <div class="codex-main">
      <div class={`codex-body anim-fade ${tab}`} key={tab}>
        {shown === 0 && (
          <div class="codex-empty">
            <span class="brush">无</span>
            {filtered ? 'Nothing here matches. Clear the filters or the search.' : 'Nothing discovered yet. What you meet in your runs is recorded here.'}
          </div>
        )}
        {tab === 'disciples' && (
          <div class="codex-cards">
            {heroes.map((h) =>
              seen.heroes.has(h.id) ? (
                <button key={h.id} class={`codex-hero ${picked('hero', h.id)}`} onClick={() => open('hero', h.id)}>
                  <HeroCard defId={h.id} rank={0} />
                </button>
              ) : (
                <UnseenHero key={h.id} def={h} />
              ),
            )}
          </div>
        )}
        {tab === 'classes' && <ClassPage id={cls} seen={seen.heroes} onPick={setCls} onHero={(id) => open('hero', id)} />}
        {tab === 'enemies' && (
          <div class="codex-grid enemies">
            {enemies.map((e) =>
              seen.enemies.has(e.id) ? (
                <button key={e.id} class={`panel codex-enemy ${enemyKind(e)} ${picked('enemy', e.id)}`} onClick={() => open('enemy', e.id)}>
                  <EnemyCard e={e} />
                </button>
              ) : (
                <div key={e.id} class={`panel codex-enemy unseen ${enemyKind(e)}`}>
                  <EnemyCard e={e} unseen />
                </div>
              ),
            )}
          </div>
        )}
        {tab === 'treasures' && (
          <div class="codex-grid cards">
            {items.map((it) =>
              seen.items.has(it.id) ? (
                <button key={it.id} class={`codex-card rar-${it.rarity} ${picked('item', it.id)}`} onClick={() => open('item', it.id)}>
                  <div class="codex-medal">
                    <Icon name={`item_${it.icon}`} size={PAINTED_ICONS.has(`item_${it.icon}`) ? 78 : 52} />
                  </div>
                  <div class="codex-card-name">{it.name}</div>
                  <div class="codex-card-rar">{it.rarity} Treasure</div>
                  {it.stats && <StatLine stats={it.stats} />}
                  {it.desc && (
                    <div class="codex-card-desc">
                      <RichText text={it.desc} />
                    </div>
                  )}
                </button>
              ) : (
                <UnseenCard key={it.id} rarity={it.rarity} label="Treasure" />
              ),
            )}
          </div>
        )}
        {tab === 'insights' && (
          <div class="codex-grid cards">
            {relics.map((r) =>
              seen.relics.has(r.id) ? (
                <button key={r.id} class={`codex-card rar-${r.rarity} ${picked('relic', r.id)}`} onClick={() => open('relic', r.id)}>
                  <div class="codex-medal">
                    <Icon name={`relic_${r.icon}`} size={70} />
                  </div>
                  <div class="codex-card-name">{r.name}</div>
                  <div class="codex-card-rar">{r.rarity} Dao Insight</div>
                  <div class="codex-card-desc">
                    <RichText text={r.desc} />
                  </div>
                </button>
              ) : (
                <UnseenCard key={r.id} rarity={r.rarity} label="Dao Insight" />
              ),
            )}
          </div>
        )}
      </div>
      {detail && (
        <aside class="codex-drawer">
          <button
            class="codex-drawer-close"
            data-hotkey="back"
            aria-label="Close"
            onClick={() => {
              audio.sfx('ui_back');
              setDetail(null);
            }}
            {...tip('Close (Esc)', 'left')}
          >
            <Icon name="ui_close" size={20} />
          </button>
          <div class="codex-drawer-scroll" key={`${detail.kind}:${detail.id}`}>
            {detail.kind === 'hero' && <HeroDetail id={detail.id} />}
            {detail.kind === 'enemy' && <EnemyDetail id={detail.id} />}
            {detail.kind === 'item' && <ItemDetail id={detail.id} />}
            {detail.kind === 'relic' && <RelicDetail id={detail.id} />}
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}

// ───────────────────────── grid entries ─────────────────────────

function UnseenHero({ def }: { def: HeroDef }) {
  return (
    <div class="hero-card md unseen" style={{ ['--accent' as string]: '#3d5f5a' }}>
      <div class="pennant-border" />
      <div class="pennant">
        <Portrait id={def.id} accent="#3d5f5a" hanzi="?" />
        <div class="unseen-mark brush">?</div>
        <div class="nameplate">
          <div class="hero-name display">? ? ?</div>
          <div class="hero-class-line">
            <span class="hero-class">Not yet met</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnseenCard({ rarity, label }: { rarity: string; label: string }) {
  return (
    <div class={`codex-card unseen rar-${rarity}`}>
      <div class="codex-medal">
        <span class="brush unseen-glyph">?</span>
      </div>
      <div class="codex-card-name">? ? ?</div>
      <div class="codex-card-rar">
        {rarity} {label}
      </div>
      <div class="codex-card-desc">Not yet found</div>
    </div>
  );
}

const realmPlate = (e: EnemyDef) => (e.theme ? THEME_BY_ID[e.theme]?.art ?? 'realm1_bamboo' : e.realm === 2 ? 'realm2_abyss' : e.boss && e.realm !== 1 ? 'realm3_ladder' : 'realm1_bamboo');
const themeLabel = (e: EnemyDef) => (e.theme ? THEME_BY_ID[e.theme]?.name : undefined);
const kindLabel = (e: EnemyDef) => (e.boss ? 'Realm Guardian' : e.elite ? 'Elite' : 'Regular');
const realmLabel = (e: EnemyDef) => (e.realm === 'any' ? 'Both realms' : `Realm ${e.realm}`);

function EnemyCard({ e, unseen }: { e: EnemyDef; unseen?: boolean }) {
  return (
    <>
      <div class="codex-enemy-art" style={{ ['--plate' as string]: `url(./assets/art/bg/${realmPlate(e)}.jpg)` }}>
        {/* an unseen foe keeps the silhouette filter from CSS; a seen variant shows its recolour */}
        <img src={`./assets/art/sprites/${e.sprite}.png`} alt="" draggable={false} style={unseen ? undefined : { filter: lookFilter(e.look) }} />
      </div>
      <div class="codex-enemy-body">
        <div class="codex-enemy-head">
          <div class="display codex-enemy-name">{unseen ? '? ? ?' : e.name}</div>
          {!unseen && e.hanzi && <span class="brush gold">{e.hanzi}</span>}
        </div>
        <div class="codex-enemy-tags">
          <span class="tag">{kindLabel(e)}</span>
          <span class="tag">{themeLabel(e) ?? realmLabel(e)}</span>
          {!unseen && e.flying && <span class="tag">Flying</span>}
          {!unseen && e.bounty ? <span class="tag gold">Bounty {e.bounty}</span> : null}
        </div>
        {unseen ? (
          <p class="codex-enemy-ability faint">Not yet encountered</p>
        ) : (
          <>
            <StatLine stats={e.baseStats} keys={['hp', 'attack', 'spirit', 'defense', 'range']} plain />
            {e.ability && (
              <p class="codex-enemy-ability">
                <b class="gold">{e.ability.name}</b> <span class="faint">· {e.ability.qiCost} Qi</span>
                <br />
                <RichText text={e.ability.desc} />
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function StatLine({ stats, keys, plain }: { stats: Partial<Stats>; keys?: (keyof Stats)[]; plain?: boolean }) {
  const list = (keys ?? (Object.keys(stats) as (keyof Stats)[])).filter((k) => stats[k]);
  return (
    <div class={plain ? 'codex-enemy-stats' : 'codex-card-stats'}>
      {list.map((k) => (
        <span key={k} style={{ color: STAT_COLOR[k] }}>
          <Icon name={STAT_ICON[k]} size={16} /> {plain ? '' : '+'}
          {k === 'omnivamp' ? `${stats[k]}%` : stats[k]}
        </span>
      ))}
    </div>
  );
}

// ───────────────────────── classes: one page at a time ─────────────────────────

const MECHANIC_ICON: Record<string, string> = {
  'Flying Swords': 'class_sword',
  'Qi Shield': 'kw_shield',
  'Max HP': 'stat_hp',
  Spirit: 'stat_spirit',
  'Attack Speed': 'stat_attackSpeed',
  Debuffs: 'kw_weaken',
};

function scaleText(s: { attack?: number; spirit?: number }): string {
  return [s.attack ? `${Math.round(s.attack * 100)}% Attack` : '', s.spirit ? `${Math.round(s.spirit * 100)}% Spirit` : ''].filter(Boolean).join(' + ');
}

function ClassPage({ id, seen, onPick, onHero }: { id: ClassId; seen: Set<string>; onPick: (id: ClassId) => void; onHero: (id: string) => void }) {
  const c = CLASSES[id];
  const members = HEROES.filter((h) => h.classes.includes(id));
  const growth = [...Object.entries(c.growthPct).map(([k, v]) => [k, `+${v}%`]), ...Object.entries(c.growthFlat).map(([k, v]) => [k, `+${v}`])];
  return (
    <div class="class-book">
      <nav class="class-index">
        {Object.values(CLASSES).map((k) => (
          <button
            key={k.id}
            class={`class-index-item ${k.id === id ? 'on' : ''}`}
            style={{ ['--c' as string]: k.color }}
            onClick={() => {
              if (k.id === id) return;
              audio.sfx('ui_click', { volume: 0.6 });
              onPick(k.id);
            }}
          >
            <Icon name={`class_${k.id}`} size={44} />
            <span class="class-index-text">
              <span class="display">{k.name}</span>
              <span class="class-index-role">{k.role}</span>
            </span>
          </button>
        ))}
      </nav>
      <div class="class-page anim-fade" key={id} style={{ ['--c' as string]: c.color }}>
        <span class="brush class-watermark">{c.hanzi}</span>
        <div class="class-hero">
          <div class="class-emblem">
            <Icon name={`class_${c.id}`} size={150} />
          </div>
          <div class="class-intro">
            <div class="class-role">{c.role}</div>
            <div class="display class-title">{c.name}</div>
            <p class="class-summary">{c.desc}</p>
            <div class="class-mechs">
              {c.mechanics.split(/,\s*/).map((m) => {
                const icon = KEYWORD_ICON[m] ?? MECHANIC_ICON[m];
                return (
                  <span key={m} class={`tag kw-${m}`} {...(KEYWORD_DESC[m] ? tip(<><h4 class={`kw-${m}`}>{m}</h4><p>{KEYWORD_DESC[m]}</p></>, 'below') : {})}>
                    {icon && <Icon name={icon} size={18} />} {m}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div class="class-cols">
          <section class="class-sec class-growth">
            <h3 class="class-sec-title display">Growth per breakthrough</h3>
            <div class="class-growth-rows">
              {growth.map(([k, v]) => (
                <div key={k} class="class-growth-row" {...tip(<><h4 style={{ color: STAT_COLOR[k] }}>{STAT_LABEL[k]}</h4><p>{STAT_DESC[k]}</p></>)}>
                  <Icon name={STAT_ICON[k]} size={22} />
                  <span>{STAT_LABEL[k]}</span>
                  <b style={{ color: STAT_COLOR[k] }}>{v}</b>
                </div>
              ))}
              <div class="class-growth-row">
                <Icon name="stat_attack" size={22} />
                <span>Auto-attack</span>
                <b>{scaleText(c.attackScale)}</b>
              </div>
            </div>
            <h3 class="class-sec-title display">Disciples</h3>
            <div class="class-members">
              {members.map((h) =>
                seen.has(h.id) ? (
                  <button key={h.id} class="class-member" onClick={() => onHero(h.id)} {...tip(<><h4>{h.name}</h4><div class="sub">{h.title}</div></>)}>
                    <Portrait id={h.id} accent={h.accent} hanzi={h.hanzi.slice(0, 1)} />
                    <span>{h.name}</span>
                  </button>
                ) : (
                  <div key={h.id} class="class-member unseen">
                    <Portrait id={h.id} accent="#3d5f5a" hanzi="?" />
                    <span>? ? ?</span>
                  </div>
                ),
              )}
            </div>
          </section>
          <section class="class-sec class-insight-sec">
            <h3 class="class-sec-title display">
              Insights <span class="class-sec-note">Golden Core and Nascent Soul breakthroughs each offer 3 of these</span>
            </h3>
            <div class="class-insight-grid">
              {c.insights.map((i) => (
                <div
                  key={i.id}
                  class="class-insight"
                  {...tip(
                    <>
                      <h4>{i.name}</h4>
                      <div class="sub">{c.name} Insight</div>
                      <p>
                        <RichText text={i.desc} />
                      </p>
                    </>,
                  )}
                >
                  <div class="class-insight-medal">{PAINTED_ICONS.has(`insight_${i.id}`) ? <Icon name={`insight_${i.id}`} size={64} /> : <span class="brush">{c.hanzi}</span>}</div>
                  <span class="class-insight-name">{i.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── detail pages ─────────────────────────

function Section({ title, aside, children }: { title: string; aside?: string; children: ComponentChildren }) {
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

const CLIP_LABEL: Record<string, string> = { idle: 'Idle', attack: 'Attack', cast: 'Technique', death: 'Defeat' };

/** The detail page's stage: the sprite's idle on a painted backplate, with buttons that play its other clips. */
function Stage({ sprite, plate, height, look }: { sprite: string; plate: string; height: number; look?: EnemyDef['look'] }) {
  const def = useSpritePack(sprite);
  const [clip, setClip] = useState({ anim: 'idle', n: 0 });
  const clips = ['idle', 'attack', 'cast'].filter((k) => def?.animations[k]);
  return (
    <div class="drawer-stage" style={{ ['--plate' as string]: `url(./assets/art/bg/${plate}.jpg)` }}>
      <div class="drawer-ground" style={{ filter: lookFilter(look) }}>
        <SpriteClip id={sprite} anim={clip.anim} nonce={clip.n} height={height} onDone={() => setClip((c) => ({ anim: 'idle', n: c.n + 1 }))} />
      </div>
      {clips.length > 1 && (
        <div class="drawer-clips">
          {clips.map((k) => (
            <button
              key={k}
              class={`drawer-clip ${clip.anim === k ? 'on' : ''}`}
              onClick={() => {
                audio.sfx('ui_click', { volume: 0.5 });
                setClip((c) => ({ anim: k, n: c.n + 1 }));
              }}
            >
              {CLIP_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatGrid({ stats, keys }: { stats: Partial<Stats>; keys: (keyof Stats)[] }) {
  return (
    <div class="drawer-stats">
      {keys.map((k) => (
        <div key={k} class="drawer-stat" {...tip(<><h4 style={{ color: STAT_COLOR[k] }}>{STAT_LABEL[k]}</h4><p>{STAT_DESC[k]}</p></>)}>
          <Icon name={STAT_ICON[k]} size={22} />
          <span>{STAT_LABEL[k]}</span>
          <b style={{ color: STAT_COLOR[k] }}>{k === 'range' && (stats[k] ?? 0) <= 1 ? 'Melee' : fmtStat(k, stats[k] ?? 0)}</b>
        </div>
      ))}
    </div>
  );
}

function Keywords({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <Section title="Keywords">
      {list.map((k) => (
        <p key={k} class="drawer-kw">
          <span class={`tag kw-${k}`}>
            {KEYWORD_ICON[k] && <Icon name={KEYWORD_ICON[k]} size={16} />} {k}
          </span>{' '}
          {KEYWORD_DESC[k]}
        </p>
      ))}
    </Section>
  );
}

/** A base price in Spirit Stones (before contract modifiers and sales). */
function PriceTag({ price, what }: { price: number; what: string }) {
  return (
    <span class="tag drawer-price">
      <Icon name="stones" size={18} /> <b>{price}</b> {what}
    </span>
  );
}

function Quest({ quest }: { quest: QuestDef }) {
  return (
    <Section title="Quest" aside={`Goal ${quest.goal}`}>
      <p>
        <RichText text={quest.desc} />
      </p>
      <p class="drawer-reward">
        <Icon name="ui_star" size={18} /> <RichText text={quest.rewardDesc} />
      </p>
    </Section>
  );
}

function HeroDetail({ id }: { id: string }) {
  const h = HERO_BY_ID[id];
  if (!h) return null;
  const stats = heroStats(tempHero(id, 0), EMPTY_CTX, null);
  const main = CLASSES[h.classes[0]];
  return (
    <>
      <Stage sprite={h.sprite} plate="ui_hall" height={250} />
      <div class="drawer-head">
        <span class="brush drawer-hanzi" style={{ color: main.color }}>
          {h.hanzi}
        </span>
        <div>
          <div class="display drawer-name">{h.name}</div>
          <div class="drawer-sub">{h.title}</div>
        </div>
      </div>
      <div class="drawer-tags">
        {h.classes.map((c) => (
          <span key={c} class="tag drawer-class" style={{ ['--c' as string]: CLASSES[c].color }}>
            <Icon name={`class_${c}`} size={22} /> {CLASSES[c].name} · {CLASSES[c].role}
          </span>
        ))}
        <PriceTag price={HERO_PRICE_BY_RANK[0]} what="to recruit" />
      </div>
      <p class="drawer-lore">{h.lore}</p>
      <Section title="Technique" aside={`${h.ability.qiCost} Qi`}>
        <p class="drawer-ability-name">{h.ability.name}</p>
        <p>
          <RichText text={h.ability.desc} />
        </p>
        {h.passives?.map((pz) => (
          <p key={pz.id}>
            <b class="gold">{pz.name ?? 'Passive'}:</b> <RichText text={pz.desc} />
          </p>
        ))}
      </Section>
      <Section title="Base stats" aside="Qi Condensation">
        <StatGrid stats={stats} keys={['hp', 'attack', 'spirit', 'attackSpeed', 'range', 'defense', 'crit', 'qiRegen']} />
      </Section>
      <Section title="Dao Paths" aside="Chosen at Foundation">
        {h.daoPaths.map((d) => (
          <p key={d.id} class="drawer-path">
            <b class="jade">{d.name}</b> <RichText text={d.desc} />
          </p>
        ))}
      </Section>
      {h.companion && HERO_BY_ID[h.companion] && (
        <Section title="Dao Companion">
          <p>
            <b class="kw-Companion">{HERO_BY_ID[h.companion].name}</b> {KEYWORD_DESC.Companion}
          </p>
        </Section>
      )}
      <Keywords list={h.tags.filter((t) => KEYWORD_DESC[t])} />
    </>
  );
}

function EnemyDetail({ id }: { id: string }) {
  const e = ENEMY_BY_ID[id];
  if (!e) return null;
  const keys = (['hp', 'attack', 'spirit', 'attackSpeed', 'range', 'defense', 'crit', 'moveSpeed'] as const).filter((k) => e.baseStats[k] !== undefined);
  return (
    <>
      <Stage sprite={e.sprite} plate={realmPlate(e)} look={e.look} height={Math.round(230 * Math.min(1.25, e.scale ?? 1))} />
      <div class="drawer-head">
        {e.hanzi && (
          <span class="brush drawer-hanzi" style={{ color: e.accent ?? 'var(--vermilion-bright)' }}>
            {e.hanzi}
          </span>
        )}
        <div>
          <div class="display drawer-name">{e.name}</div>
          <div class="drawer-sub">
            {kindLabel(e)} · {themeLabel(e) ?? realmLabel(e)}
          </div>
        </div>
      </div>
      <div class="drawer-tags">
        {e.flying && <span class="tag">Flying</span>}
        {e.bounty ? (
          <span class="tag gold">
            <Icon name="stones" size={16} /> Bounty {e.bounty}
          </span>
        ) : null}
        {e.targeting && e.targeting !== 'nearest' && <span class="tag">Targets {e.targeting === 'lowestHp' ? 'the weakest' : e.targeting === 'farthest' ? 'the farthest' : 'at random'}</span>}
      </div>
      {e.ability && (
        <Section title="Technique" aside={`${e.ability.qiCost} Qi`}>
          <p class="drawer-ability-name">{e.ability.name}</p>
          <p>
            <RichText text={e.ability.desc} />
          </p>
        </Section>
      )}
      {e.passives?.length ? (
        <Section title="Traits">
          {e.passives.map((pz) => (
            <p key={pz.id}>
              <b class="gold">{pz.name ?? 'Passive'}:</b> <RichText text={pz.desc} />
            </p>
          ))}
        </Section>
      ) : null}
      <Section title="Base stats" aside="Grows with the Tribulation Level">
        <StatGrid stats={e.baseStats} keys={[...keys]} />
      </Section>
    </>
  );
}

function ItemDetail({ id }: { id: string }) {
  const it = ITEM_BY_ID[id];
  if (!it) return null;
  const painted = PAINTED_ICONS.has(`item_${it.icon}`);
  return (
    <div class={`drawer-relic rar-${it.rarity}`}>
      <div class="drawer-medal">
        <Icon name={`item_${it.icon}`} size={painted ? 150 : 96} />
      </div>
      <div class="display drawer-name rar-name">{it.name}</div>
      <div class="drawer-sub">{it.rarity} Treasure</div>
      {it.rarity !== 'unique' && (
        <div class="drawer-tags">
          <PriceTag price={it.price ?? ITEM_PRICE_BY_RARITY[it.rarity]} what="in the shop" />
          <PriceTag price={itemSellValue(it.id)} what="when sold" />
        </div>
      )}
      {it.stats && (
        <Section title="Stats">
          <div class="drawer-stat-list">
            {Object.entries(it.stats).map(([k, v]) => (
              <span key={k} style={{ color: STAT_COLOR[k] }}>
                <Icon name={STAT_ICON[k]} size={20} /> +{k === 'omnivamp' ? `${v}%` : v} {STAT_LABEL[k]}
              </span>
            ))}
          </div>
        </Section>
      )}
      {it.desc && (
        <Section title="Effect">
          <p>
            <RichText text={it.desc} />
          </p>
        </Section>
      )}
      {it.quest && <Quest quest={it.quest} />}
      <Keywords list={it.keywords ?? []} />
      <p class="drawer-note">{it.rarity === 'unique' ? 'Never sold in the shop: unique Treasures are found through events.' : 'Equip it on a disciple: drag it onto them, or onto one of their sockets.'}</p>
    </div>
  );
}

function RelicDetail({ id }: { id: string }) {
  const r = RELIC_BY_ID[id];
  if (!r) return null;
  return (
    <div class={`drawer-relic rar-${r.rarity}`}>
      <div class="drawer-medal">
        <Icon name={`relic_${r.icon}`} size={120} />
      </div>
      <div class="display drawer-name rar-name">{r.name}</div>
      <div class="drawer-sub">{r.rarity} Dao Insight</div>
      <div class="drawer-tags">
        <PriceTag price={r.price ?? (r.teamSize ? 40 : RELIC_PRICE_BY_RARITY[r.rarity])} what="in the shop" />
      </div>
      <Section title="Effect">
        <p>
          <RichText text={r.desc} />
        </p>
      </Section>
      {r.quest && <Quest quest={r.quest} />}
      <Keywords list={r.keywords ?? []} />
      <p class="drawer-note">{r.teamSize ? 'Sold in the team-size corner of the shop.' : 'Dao Insights guide the whole sect for the rest of the run.'}</p>
    </div>
  );
}
