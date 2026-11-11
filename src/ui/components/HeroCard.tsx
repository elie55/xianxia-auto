import type { ComponentChildren } from 'preact';
import { PAINTED_ICONS } from '@/ui/components/paintedIcons';
import { useState } from 'preact/hooks';
import type { Rank } from '@/core/types';
import { RANK_NAMES } from '@/core/types';
import { HERO_BY_ID } from '@/content/heroes';
import type { HeroDef, Keyword } from '@/core/types';
import { CLASSES } from '@/content/classes';
import { heroAbility, heroClasses, heroDaoPath, heroInsights, heroMasteryPassive, heroStats, type HeroState, type TeamContext } from '@/core/builder';
import { Icon, KEYWORD_ICON, STAT_COLOR, STAT_ICON, STAT_LABEL } from './Icon';
import { RichText } from './RichText';
import { hideTooltip, showTooltip, tip } from './Tooltip';
import { ITEM_BY_ID } from '@/content/items';
import { meta } from '@/app/store';
import { MASTERY_FRAME_LEVEL, masteryOf } from '@/meta/mastery';

export const EMPTY_CTX: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };

export function tempHero(defId: string, rank: Rank): HeroState {
  return { uid: `tmp-${defId}`, defId, rank, insightIds: [], items: [], permanent: [] };
}

export function Portrait({ id, accent, hanzi, class: cls }: { id: string; accent: string; hanzi: string; class?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div class={`portrait ${cls ?? ''}`} style={{ ['--accent' as string]: accent }}>
      {!failed && <img src={`./assets/art/heroes/${id}/portrait.png`} alt="" draggable={false} onError={() => setFailed(true)} />}
      {failed && (
        <div class="portrait-fallback">
          <span class="brush">{hanzi}</span>
        </div>
      )}
      <div class="portrait-vignette" />
    </div>
  );
}

export function RankGlyph({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const r = RANK_NAMES[rank];
  return (
    <div
      class={`rank-glyph seal rank-${rank} has-tip`}
      style={{ width: size, height: size }}
      {...tip(<><h4>{r.name}</h4><div class="sub">Cultivation realm {rank + 1} of 4 · {r.hanzi}</div><p>Cultivation realm of this disciple. Buy a copy of the disciple to break through.</p></>)}
    >
      {/* a cultivation seal: the realm's hanzi, with one pip per realm reached */}
      <span class="brush seal-hanzi" style={{ fontSize: Math.round(size * 0.5) }}>
        {r.hanzi}
      </span>
      <span class="seal-pips" style={{ gap: Math.max(1, Math.round(size * 0.05)), bottom: Math.round(size * 0.1) }}>
        {Array.from({ length: rank + 1 }, (_, i) => (
          <i key={i} style={{ width: Math.max(2, Math.round(size * 0.09)), height: Math.max(2, Math.round(size * 0.09)) }} />
        ))}
      </span>
    </div>
  );
}

export function ClassBadge({ id, size = 34 }: { id: keyof typeof CLASSES; size?: number }) {
  const c = CLASSES[id];
  return (
    <div
      class="class-badge has-tip"
      style={{ width: size, height: size, ['--c' as string]: c.color }}
      {...tip(
        <>
          <h4 style={{ color: c.color }}>{c.name} {c.hanzi}</h4>
          <div class="sub">{c.role}</div>
          <p>{c.desc}</p>
          <p class="muted">Mechanics: {c.mechanics}</p>
          <p class="muted">Growth per rank: {Object.entries(c.growthPct).map(([k, v]) => `+${v}% ${STAT_LABEL[k]}`).concat(Object.entries(c.growthFlat).map(([k, v]) => `+${v} ${STAT_LABEL[k]}`)).join(', ')}</p>
        </>,
      )}
    >
      <span class="brush">{c.hanzi}</span>
    </div>
  );
}

export interface HeroCardProps {
  defId: string;
  rank: Rank;
  hero?: HeroState;
  ctx?: TeamContext;
  price?: number;
  sale?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  owned?: boolean;
  size?: 'md' | 'lg';
  onClick?: () => void;
  footer?: ComponentChildren;
  showStats?: boolean;
  /** The narrower shop card: fewer trait chips fit on a row. */
  compact?: boolean;
  class?: string;
}

export function HeroCard(p: HeroCardProps) {
  const def = HERO_BY_ID[p.defId];
  const hero = p.hero ?? tempHero(p.defId, p.rank);
  const ctx = p.ctx ?? EMPTY_CTX;
  const classes = heroClasses(hero);
  const stats = heroStats(hero, ctx, null);
  const ability = heroAbility(hero);
  const dao = heroDaoPath(hero);
  const insights = heroInsights(hero);
  const [hover, setHover] = useState(false);
  const showStats = p.showStats ?? (hover || p.selected);
  const main = CLASSES[classes[0]];
  const classLine = classes.length > 1 ? classes.map((c) => CLASSES[c].name).join(' · ') : `${main.name} · ${main.role}`;
  const usesSpirit = stats.spirit > stats.attack;
  // traits on ONE row of this card size (at most three); whatever does not fit folds into a "+N" chip
  const rowWidth = p.compact ? 225 : p.size === 'lg' ? 315 : 275;
  const chipWidth = (t: string) => t.length * 8 + 39;
  let traits: Keyword[] = def.tags.slice(0, 3);
  if (def.tags.length > 3 || traits.reduce((a, t) => a + chipWidth(t), 0) > rowWidth) {
    traits = [];
    let used = 40; // room for the "+N" chip
    for (const t of def.tags.slice(0, 3)) {
      if (traits.length && used + chipWidth(t) > rowWidth) break;
      traits.push(t);
      used += chipWidth(t);
    }
  }
  const moreTraits = def.tags.filter((t) => !traits.includes(t));
  return (
    <div
      // the card frame the player picked in the sect profile (src/meta/cosmetics.ts)
      class={`hero-card ${p.size ?? 'md'} frame-${meta.value.profile?.frame ?? 'gold'} ${masteryOf(meta.value, p.defId) >= MASTERY_FRAME_LEVEL ? 'gilded' : ''} ${p.selected ? 'selected' : ''} ${p.dimmed ? 'dimmed' : ''} ${p.onClick ? 'clickable' : ''} ${showStats ? 'stats-open' : ''} ${p.class ?? ''}`}
      style={{ ['--accent' as string]: def.accent }}
      onClick={p.onClick}
      onMouseEnter={() => setHover(true)}
      // hovering anywhere on the card shows the full ability; badges, traits and stats keep their own tooltips
      onMouseOver={(e) => {
        if (!(e.target as HTMLElement).closest('.has-tip')) showTooltip(e, <AbilityTip hero={hero} ctx={ctx} />, 'right');
      }}
      onMouseLeave={() => {
        setHover(false);
        hideTooltip();
      }}
    >
      <div class="pennant-border" />
      <div class="pennant">
        <Portrait id={def.id} accent={def.accent} hanzi={def.hanzi.slice(0, 1)} />
        {p.price !== undefined && (
          <div class={`price-tag ${p.sale ? 'sale' : ''}`}>
            <Icon name="stones" size={20} /> {p.price}
            {p.sale && <span class="sale-label">SALE</span>}
          </div>
        )}
        {p.owned && <div class="owned-tag">RANK UP</div>}
        <div class="side-badges left">
          {classes.map((c) => (
            <ClassBadge key={c} id={c} />
          ))}
        </div>
        <div class="card-rank">
          <RankGlyph rank={hero.rank} size={40} />
        </div>
        <div class="nameplate">
          <div class="hero-name display">{def.name}</div>
          <div class="hero-class-line" style={{ ['--cls' as string]: main.color }}>
            <span class="hero-hanzi brush">{def.hanzi}</span>
            <span class="hero-class">{classLine}</span>
          </div>
        </div>
        {/* traits, ability and key stats live on the card itself, below the art (they used to sit on the portrait) */}
        <div class="card-info">
          <div class="trait-strip">
            {traits.map((t) => (
              <div key={t} class={`trait kw-${t} has-tip`} {...tip(<><h4 class={`kw-${t}`}>{t}</h4><p>{KEYWORD_DESC[t]}</p>{tagSource(def, t) && <p class="muted">{tagSource(def, t)}</p>}</>)}>
                <Icon name={KEYWORD_ICON[t] ?? 'ui_info'} size={14} /> {t}
              </div>
            ))}
            {moreTraits.length > 0 && (
              <div class="trait more has-tip" {...tip(<>{moreTraits.map((t) => <p key={t}><b class={`kw-${t}`}>{t}:</b> {KEYWORD_DESC[t]}</p>)}</>)}>
                +{moreTraits.length}
              </div>
            )}
          </div>
          <div class="card-ability">
            <Icon name="stat_qi" size={16} color="#8fd5ff" />
            <span class="card-ability-name">{ability.name}</span>
            <span class="card-ability-qi">{ability.qiCost} Qi</span>
          </div>
          <div class="card-keystats">
            <span>
              <Icon name="stat_hp" size={14} color={STAT_COLOR.hp} /> <b>{Math.round(stats.hp)}</b> HP
            </span>
            <span>
              <Icon name={STAT_ICON[usesSpirit ? 'spirit' : 'attack']} size={14} color={STAT_COLOR[usesSpirit ? 'spirit' : 'attack']} /> <b>{Math.round(usesSpirit ? stats.spirit : stats.attack)}</b> {usesSpirit ? 'SPI' : 'ATK'}
            </span>
            <span>
              <Icon name={STAT_ICON.range} size={14} color={STAT_COLOR.range} /> {stats.range <= 1 ? 'Melee' : <><b>{Math.round(stats.range)}</b> Range</>}
            </span>
          </div>
        </div>
        <div class={`stats ${showStats ? 'open' : ''}`}>
          <div class="bar hp">
            <i style={{ width: '100%' }} />
            <span>
              <Icon name="stat_hp" size={11} /> {Math.round(stats.hp)}
            </span>
          </div>
          <div class="qi-row">
            <Icon name="stat_qi" size={14} color="#8fd5ff" /> <b>{ability.qiCost}</b> <span class="muted">Qi to cast</span>
          </div>
          <div class="stat-grid">
            {(['attack', 'attackSpeed', 'spirit', 'range', 'crit', 'defense', 'qiRegen', 'omnivamp'] as const).map((k) => (
              <div key={k} class="stat has-tip" {...tip(<><h4 style={{ color: STAT_COLOR[k] }}>{STAT_LABEL[k]}</h4><p>{STAT_DESC[k]}</p></>)}>
                <Icon name={STAT_ICON[k]} size={15} color={STAT_COLOR[k]} />
                <span>{fmtStat(k, stats[k])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {p.footer && <div class="card-footer">{p.footer}</div>}
    </div>
  );
}

/** Explains a card tag the hero does not have at base rank: which Dao Path brings it. */
function tagSource(def: HeroDef, t: Keyword): string | null {
  if (def.ability.keywords?.includes(t)) return null;
  const path = def.daoPaths.find((p) => p.keywords?.includes(t));
  return path ? `Unlocked by the ${path.name} Dao Path at Foundation rank.` : null;
}

export function fmtStat(k: string, v: number): string {
  if (k === 'omnivamp') return `${Math.round(v)}%`;
  if (k === 'crit') return `${Math.round(v)}`;
  return `${Math.round(v)}`;
}

/** A disciple's classes in their colours (tooltips). */
export function ClassLine({ hero }: { hero: HeroState }) {
  return (
    <div class="tip-classes">
      {heroClasses(hero).map((c) => (
        <span key={c} style={{ color: CLASSES[c].color }}>
          <span class="brush">{CLASSES[c].hanzi}</span> {CLASSES[c].name}
          <span class="faint"> · {CLASSES[c].role}</span>
        </span>
      ))}
    </div>
  );
}

/** A mastery V passive in a tooltip. */
export function MasteryPassiveLine({ name, desc }: { name: string; desc: string }) {
  return (
    <p class="tip-mastery">
      <b class="mastery-gold">{name}</b> <span class="faint">· Mastery V passive</span>
      <br />
      <RichText text={desc} />
    </p>
  );
}

export function AbilityTip({ hero, ctx }: { hero: HeroState; ctx?: TeamContext }) {
  const def = HERO_BY_ID[hero.defId];
  const ability = heroAbility(hero);
  const dao = heroDaoPath(hero);
  const passive = heroMasteryPassive(hero, ctx);
  const insights = heroInsights(hero);
  return (
    <>
      <h4>{ability.name}</h4>
      <div class="sub">Active ability · {ability.qiCost} Qi</div>
      <p>
        <RichText text={ability.desc} />
      </p>
      {def.passives?.map((pz) => (
        <p key={pz.id}>
          <b class="gold">{pz.name ?? 'Passive'}:</b> <RichText text={pz.desc} />
        </p>
      ))}
      {dao && (
        <p>
          <b class="jade">{dao.name}:</b> <RichText text={dao.desc} />
        </p>
      )}
      {passive && <MasteryPassiveLine name={passive.name} desc={passive.desc} />}
      {insights.map((i) => (
        <p key={i.id}>
          <b class="gold">{i.name}:</b> <RichText text={i.desc} />
        </p>
      ))}
      {def.companion && (
        <p class="kw-Companion">
          Dao Companion: {HERO_BY_ID[def.companion]?.name}
        </p>
      )}
      <p class="faint" style={{ fontStyle: 'italic' }}>{def.lore}</p>
    </>
  );
}

export function ItemChip({ itemId, size = 40, onClick, class: cls, draggable, onDragStart }: { itemId: string; size?: number; onClick?: () => void; class?: string; draggable?: boolean; onDragStart?: (e: PointerEvent) => void }) {
  const it = ITEM_BY_ID[itemId];
  if (!it) return null;
  return (
    <div
      class={`item-chip rar-${it.rarity} ${cls ?? ''} ${onClick ? 'clickable' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      onPointerDown={draggable ? onDragStart : undefined}
      {...tip(<ItemTip itemId={itemId} />)}
    >
      <Icon name={`item_${it.icon}`} size={size * (PAINTED_ICONS.has(`item_${it.icon}`) ? 0.88 : 0.6)} />
    </div>
  );
}

export function ItemTip({ itemId, questProgress }: { itemId: string; questProgress?: { progress: number; done: boolean } }) {
  const it = ITEM_BY_ID[itemId];
  if (!it) return null;
  return (
    <>
      <h4 class={`rar-${it.rarity}`} style={{ color: 'var(--rar)' }}>
        {it.name}
      </h4>
      <div class="sub">{it.rarity} Treasure</div>
      {it.stats && (
        <p class="stat-list">
          {Object.entries(it.stats).map(([k, v]) => (
            <span key={k} class="stat-inline" style={{ color: STAT_COLOR[k] }}>
              <Icon name={STAT_ICON[k]} size={13} /> +{k === 'omnivamp' ? `${v}%` : v} {STAT_LABEL[k]}
            </span>
          ))}
        </p>
      )}
      {it.desc && (
        <p>
          <RichText text={it.desc} />
        </p>
      )}
      {it.quest && (
        <p class="muted">
          Quest: {it.quest.desc} {questProgress ? `(${Math.min(questProgress.progress, it.quest.goal)}/${it.quest.goal}${questProgress.done ? ' ✓' : ''})` : ''}
          <br />
          Reward: {it.quest.rewardDesc}
        </p>
      )}
    </>
  );
}

export const KEYWORD_DESC: Record<string, string> = {
  Burn: 'Deals true damage every second for the duration. Ignores Defense.',
  Poison: 'Stacks. Deals 2 true damage per stack each second; loses 1 stack per second.',
  Frost: 'Stacks. Each stack slows Attack Speed and movement by 1% (max 60%). At 60 stacks the target is frozen for 1.5 s.',
  Lightning: 'Instant magic damage that often stuns briefly.',
  Crit: 'Chance to deal double damage. Above 100% Crit increases the multiplier further.',
  Shield: 'Qi Shields absorb damage before HP. They fade after a few seconds unless lasting.',
  Surge: 'Triggers at the start of combat and lasts for a limited time.',
  Enlightenment: 'Triggers after a set number of seconds and lasts for the rest of combat.',
  Meditation: 'This effect also works while the disciple sits in the Reserve.',
  Companion: 'Dao Companions grow stronger each second when both fight on the board.',
  Heal: 'Restores HP.',
  Taunt: 'Forces enemies to attack this unit.',
  Omnivamp: 'Heals for a percentage of all damage dealt.',
  Execute: 'Instantly slays enemies below an HP threshold.',
  Qi: 'Qi fills from attacks; at full Qi the disciple casts their ability.',
  Resonance: 'Part of the damage she takes is stored as Resonance. Ringing the Golden Bell releases it as a shockwave.',
};

export const STAT_DESC: Record<string, string> = {
  hp: 'Health pool. Fully restored before each fight.',
  qi: 'Qi the disciple starts each combat with.',
  attack: 'Base damage of auto-attacks and physical abilities.',
  attackSpeed: 'Attacks per second = base × (1 + AS/100). Capped at 5 per second.',
  spirit: 'Power of spells, burns, heals and most magical effects.',
  crit: 'Percent chance to deal double damage.',
  defense: 'Reduces physical and magic damage: 100 Defense halves incoming damage.',
  range: 'Attack range in hexes. 1 = melee.',
  qiRegen: 'Qi gained passively every second.',
  omnivamp: 'Heals for this percentage of all damage dealt.',
  moveSpeed: 'Hexes travelled per second.',
};
