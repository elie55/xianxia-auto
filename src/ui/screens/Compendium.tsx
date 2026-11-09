import { useState } from 'preact/hooks';
import { screen } from '@/app/store';
import { HEROES } from '@/content/heroes';
import { ENEMIES } from '@/content/enemies';
import { ITEMS } from '@/content/items';
import { RELICS } from '@/content/relics';
import { CLASSES } from '@/content/classes';
import { HeroCard, ItemChip, ItemTip } from '@/ui/components/HeroCard';
import { Icon, STAT_COLOR, STAT_ICON, STAT_LABEL } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { tip } from '@/ui/components/Tooltip';
import { RelicTip } from '@/ui/hud/Hud';
import { audio } from '@/audio/AudioManager';

type Tab = 'disciples' | 'enemies' | 'treasures' | 'insights' | 'classes';

const TABS: { id: Tab; label: string; hanzi: string }[] = [
  { id: 'disciples', label: 'Disciples', hanzi: '弟' },
  { id: 'classes', label: 'Classes', hanzi: '道' },
  { id: 'enemies', label: 'Enemies', hanzi: '妖' },
  { id: 'treasures', label: 'Treasures', hanzi: '宝' },
  { id: 'insights', label: 'Dao Insights', hanzi: '悟' },
];

const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, unique: 3 };

/** The Compendium: every disciple, class, enemy, Treasure and Dao Insight in the game, with full tooltips. */
export function Compendium() {
  const [tab, setTab] = useState<Tab>('disciples');
  return (
    <div class="screen codex-screen">
      <div class="newrun-bg">
        <div class="watermark" style={{ right: 60, top: 40, fontSize: 380 }}>
          典
        </div>
      </div>
      <div class="newrun-header">
        <button
          class="btn small ghost"
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          ‹ Back
        </button>
        <div class="display newrun-title">Compendium</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="codex-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`codex-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => {
              audio.sfx('ui_click');
              setTab(t.id);
            }}
          >
            <span class="brush">{t.hanzi}</span>
            <span class="display">{t.label}</span>
          </button>
        ))}
      </div>
      <div class="codex-body anim-fade" key={tab}>
        {tab === 'disciples' && (
          <div class="codex-cards">
            {HEROES.map((h) => (
              <HeroCard key={h.id} defId={h.id} rank={0} />
            ))}
          </div>
        )}
        {tab === 'classes' && (
          <div class="codex-grid two">
            {Object.values(CLASSES).map((c) => (
              <div key={c.id} class="panel codex-class" style={{ ['--c' as string]: c.color }}>
                <div class="codex-class-head">
                  <span class="brush codex-class-hanzi">{c.hanzi}</span>
                  <div>
                    <div class="display codex-class-name">{c.name}</div>
                    <div class="codex-class-role">{c.role}</div>
                  </div>
                </div>
                <p>{c.desc}</p>
                <p class="muted">
                  <b>Mechanics:</b> {c.mechanics}
                </p>
                <p class="muted">
                  <b>Growth per rank:</b>{' '}
                  {Object.entries(c.growthPct)
                    .map(([k, v]) => `+${v}% ${STAT_LABEL[k]}`)
                    .concat(Object.entries(c.growthFlat).map(([k, v]) => `+${v} ${STAT_LABEL[k]}`))
                    .join(', ')}
                </p>
                <div class="codex-insights">
                  {c.insights.map((i) => (
                    <div key={i.id} class="codex-insight">
                      <span class="gold">{i.name}</span> <RichText text={i.desc} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'enemies' && (
          <div class="codex-grid three">
            {ENEMIES.map((e) => (
              <div key={e.id} class={`panel codex-enemy ${e.boss ? 'boss' : e.elite ? 'elite' : ''}`}>
                <div class="codex-enemy-art">
                  <img src={`./assets/art/sprites/${e.sprite}.png`} alt="" draggable={false} />
                </div>
                <div class="codex-enemy-body">
                  <div class="codex-enemy-head">
                    <div class="display codex-enemy-name">{e.name}</div>
                    {e.hanzi && <span class="brush gold">{e.hanzi}</span>}
                  </div>
                  <div class="codex-enemy-tags">
                    <span class="tag">{e.boss ? 'Realm Guardian' : e.elite ? 'Elite' : 'Regular'}</span>
                    <span class="tag">{e.realm === 'any' ? 'Both realms' : `Realm ${e.realm}`}</span>
                    {e.flying && <span class="tag">Flying</span>}
                    {e.bounty ? <span class="tag gold">Bounty {e.bounty}</span> : null}
                  </div>
                  <div class="codex-enemy-stats">
                    {(['hp', 'attack', 'spirit', 'defense', 'range'] as const).map((k) =>
                      e.baseStats[k] ? (
                        <span key={k} style={{ color: STAT_COLOR[k] }}>
                          <Icon name={STAT_ICON[k]} size={12} /> {e.baseStats[k]}
                        </span>
                      ) : null,
                    )}
                  </div>
                  {e.ability && (
                    <p class="codex-enemy-ability">
                      <b class="gold">{e.ability.name}</b> <span class="faint">· {e.ability.qiCost} Qi</span>
                      <br />
                      <RichText text={e.ability.desc} />
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'treasures' && (
          <div class="codex-grid three">
            {ITEMS.slice()
              .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name))
              .map((it) => (
                <div key={it.id} class={`panel plain codex-row rar-${it.rarity}`} {...tip(<ItemTip itemId={it.id} />)}>
                  <ItemChip itemId={it.id} size={48} />
                  <div class="codex-row-body">
                    <div class="codex-row-name" style={{ color: 'var(--rar)' }}>
                      {it.name} <span class="codex-row-rar">{it.rarity}</span>
                    </div>
                    <div class="codex-row-desc">
                      {it.stats &&
                        Object.entries(it.stats).map(([k, v]) => (
                          <span key={k} class="stat-inline" style={{ color: STAT_COLOR[k], marginRight: 8 }}>
                            <Icon name={STAT_ICON[k]} size={12} /> +{k === 'omnivamp' ? `${v}%` : v}
                          </span>
                        ))}
                      {it.desc && <RichText text={it.desc} />}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
        {tab === 'insights' && (
          <div class="codex-grid three">
            {RELICS.slice()
              .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name))
              .map((r) => (
                <div key={r.id} class={`panel plain codex-row rar-${r.rarity}`} {...tip(<RelicTip relicId={r.id} />)}>
                  <div class={`relic-chip rar-${r.rarity}`} style={{ margin: 6 }}>
                    <Icon name={`relic_${r.icon}`} size={22} />
                  </div>
                  <div class="codex-row-body">
                    <div class="codex-row-name" style={{ color: 'var(--rar)' }}>
                      {r.name} <span class="codex-row-rar">{r.rarity}</span>
                    </div>
                    <div class="codex-row-desc">
                      <RichText text={r.desc} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
