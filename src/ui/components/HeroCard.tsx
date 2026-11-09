import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Rank } from '@/core/types';
import { RANK_NAMES } from '@/core/types';
import { HERO_BY_ID } from '@/content/heroes';
import { CLASSES } from '@/content/classes';
import { heroAbility, heroClasses, heroDaoPath, heroInsights, heroStats, type HeroState, type TeamContext } from '@/core/builder';
import { Icon, KEYWORD_ICON, STAT_COLOR, STAT_ICON, STAT_LABEL } from './Icon';
import { RichText } from './RichText';
import { tip } from './Tooltip';
import { ITEM_BY_ID } from '@/content/items';

const EMPTY_CTX: TeamContext = { relics: [], itemSlotBonus: 0, itemSlotsPerRank: false, warriorBlessing: false, qualityBlessing: false };

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
    <div class={`rank-glyph rank-${rank}`} style={{ width: size, height: size, fontSize: size * 0.5 }} {...tip(<><h4>{r.name}</h4><div class="sub">Rank {r.short}</div><p>Cultivation realm of this disciple. Buy a copy of the disciple to break through.</p></>)}>
      <span class="display">{r.short}</span>
    </div>
  );
}

export function ClassBadge({ id, size = 34 }: { id: keyof typeof CLASSES; size?: number }) {
  const c = CLASSES[id];
  return (
    <div
      class="class-badge"
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
  return (
    <div
      class={`hero-card ${p.size ?? 'md'} ${p.selected ? 'selected' : ''} ${p.dimmed ? 'dimmed' : ''} ${p.onClick ? 'clickable' : ''} ${p.class ?? ''}`}
      style={{ ['--accent' as string]: def.accent }}
      onClick={p.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div class="pennant-border" />
      <div class="pennant">
        <Portrait id={def.id} accent={def.accent} hanzi={def.hanzi.slice(0, 1)} />
        {p.price !== undefined && (
          <div class={`price-tag ${p.sale ? 'sale' : ''}`}>
            <Icon name="stones" size={16} /> {p.price}
            {p.sale && <span class="sale-label">SALE</span>}
          </div>
        )}
        {p.owned && <div class="owned-tag">RANK UP</div>}
        <div class="side-badges left">
          {classes.map((c) => (
            <ClassBadge key={c} id={c} />
          ))}
        </div>
        <div class="side-badges right">
          {def.tags.slice(0, 3).map((t) => (
            <div key={t} class={`tag kw-${t}`} {...tip(<><h4 class={`kw-${t}`}>{t}</h4><p>{KEYWORD_DESC[t]}</p></>)}>
              <Icon name={KEYWORD_ICON[t] ?? 'ui_info'} size={12} /> {t}
            </div>
          ))}
        </div>
        <div class="nameplate">
          <div class="hero-name display">{def.name}</div>
          <div class="hero-hanzi brush">{def.hanzi}</div>
          <RankGlyph rank={hero.rank} />
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
              <div key={k} class="stat" {...tip(<><h4 style={{ color: STAT_COLOR[k] }}>{STAT_LABEL[k]}</h4><p>{STAT_DESC[k]}</p></>)}>
                <Icon name={STAT_ICON[k]} size={15} color={STAT_COLOR[k]} />
                <span>{fmtStat(k, stats[k])}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="ability-diamond" {...tip(<AbilityTip hero={hero} />)}>
          <Icon name={classes[0] ? `class_${classes[0]}` : 'ui_info'} size={22} />
        </div>
      </div>
      {p.footer && <div class="card-footer">{p.footer}</div>}
    </div>
  );
}

function fmtStat(k: string, v: number): string {
  if (k === 'omnivamp') return `${Math.round(v)}%`;
  if (k === 'crit') return `${Math.round(v)}`;
  return `${Math.round(v)}`;
}

export function AbilityTip({ hero }: { hero: HeroState }) {
  const def = HERO_BY_ID[hero.defId];
  const ability = heroAbility(hero);
  const dao = heroDaoPath(hero);
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
      <Icon name={`item_${it.icon}`} size={size * 0.6} />
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
