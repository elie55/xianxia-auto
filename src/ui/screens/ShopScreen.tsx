import { useEffect } from 'preact/hooks';
import { act, run, showToast } from '@/app/store';
import { beginRankUps, buyHero, buyItem, buyRelic, proceedFromShop, rerollCost, shopReroll, toggleFreeze, type RunState } from '@/core/run';
import { ITEM_BY_ID } from '@/content/items';
import { RELIC_BY_ID } from '@/content/relics';
import { HeroCard, ItemChip, ItemTip } from '@/ui/components/HeroCard';
import { Icon, STAT_COLOR, STAT_ICON, STAT_LABEL } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { tip } from '@/ui/components/Tooltip';
import { Hud, RelicTip } from '@/ui/hud/Hud';
import { drag } from '@/ui/drag';
import { useArena } from './BoardScreen';
import { teamContext } from '@/core/run';
import { audio } from '@/audio/AudioManager';

export function ShopScreen() {
  const s = run.value!;
  useArena(s);
  useEffect(() => {
    audio.playMusic(s.realm === 2 ? 'realm2shop' : 'shop');
  }, []);
  const shop = s.shop!;
  const dragging = drag.value;
  const cost = rerollCost(s);
  const ctx = teamContext(s);
  const onBuyHero = (key: string) => {
    act((st) => {
      const r = buyHero(st, key);
      if (!r.ok) {
        if (r.reason) showToast(r.reason, 'error');
        audio.sfx('ui_error');
        return;
      }
      audio.sfx('ui_buy');
      if (r.rankedUp) beginRankUps(st, 'shop');
    });
  };
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="shop-panel panel anim-pop">
          <div class="shop-toolbar" data-tut="shop-toolbar">
            <button
              class="btn small"
              disabled={s.stones < cost}
              onClick={() => {
                act((st) => {
                  if (shopReroll(st)) audio.sfx('ui_reroll');
                  else showToast('Not enough Spirit Stones', 'error');
                });
              }}
            >
              <Icon name="ui_reroll" size={16} /> Reroll shop · <Icon name="stones" size={13} /> {cost}
            </button>
            <button class={`btn small ${s.shopFrozen ? 'primary' : ''}`} onClick={() => act((st) => (toggleFreeze(st), audio.sfx('ui_click')))} {...tip(<><h4>Freeze</h4><p>Keep the current offers for the next shop.</p></>, 'below')}>
              <Icon name="ui_freeze" size={16} /> {s.shopFrozen ? 'Unfreeze shop' : 'Freeze shop'}
            </button>
            <div class={`sell-zone ${dragging?.started ? 'armed' : ''} ${dragging?.over === 'sell' ? 'over' : ''}`} data-drop="sell">
              <Icon name="ui_sell" size={18} />
              {dragging?.started ? (dragging.payload.kind === 'hero' ? 'Sell disciple' : 'Sell treasure') : 'Drop here to sell'}
            </div>
            <div class="grow" />
            <button
              class="btn primary"
              onClick={() => {
                audio.sfx('ui_confirm');
                act((st) => proceedFromShop(st));
              }}
            >
              Proceed <Icon name="ui_proceed" size={14} />
            </button>
          </div>
          <div class="shop-body">
            <div class="shop-left" data-tut="shop-left">
              <div class="shop-section-title">Treasures</div>
              {shop.items.map((o, i) =>
                o ? (
                  <ShopItemRow key={o.key} s={s} offer={o} onBuy={() => act((st) => {
                    const r = buyItem(st, o.key);
                    if (!r.ok) {
                      if (r.reason) showToast(r.reason, 'error');
                      audio.sfx('ui_error');
                    } else audio.sfx('ui_buy');
                  })} />
                ) : (
                  <div key={i} class="shop-row sold">Sold</div>
                ),
              )}
              <div class="shop-section-title" style={{ marginTop: 14 }}>
                Dao Insights
              </div>
              {shop.relics.map((o, i) =>
                o ? (
                  <ShopRelicRow key={o.key} s={s} offer={o} onBuy={() => act((st) => {
                    const r = buyRelic(st, o.key);
                    if (!r.ok) {
                      if (r.reason) showToast(r.reason, 'error');
                      audio.sfx('ui_error');
                    } else audio.sfx('ui_buy');
                  })} />
                ) : (
                  <div key={i} class="shop-row sold">Sold</div>
                ),
              )}
              {shop.teamSize.some(Boolean) && (
                <>
                  <div class="shop-section-title" style={{ marginTop: 14 }}>
                    Sect Expansion
                  </div>
                  <div class="row" style={{ gap: 10 }}>
                    {shop.teamSize.map(
                      (o) =>
                        o && (
                          <button
                            key={o.key}
                            class="team-size-offer"
                            {...tip(<RelicTip relicId={o.relicId} />)}
                            onClick={() =>
                              act((st) => {
                                const r = buyRelic(st, o.key);
                                if (!r.ok) {
                                  if (r.reason) showToast(r.reason, 'error');
                                  audio.sfx('ui_error');
                                } else audio.sfx('ui_buy');
                              })
                            }
                          >
                            <Icon name={`relic_${RELIC_BY_ID[o.relicId].icon}`} size={26} color="var(--gold-bright)" />
                            <span class="ts-name">{RELIC_BY_ID[o.relicId].name}</span>
                            <span class="price-inline">
                              <Icon name="stones" size={12} /> {o.price}
                            </span>
                          </button>
                        ),
                    )}
                  </div>
                </>
              )}
            </div>
            <div class="shop-right">
              <div class="shop-section-title">Disciples</div>
              <div class="shop-cards" data-tut="shop-cards">
                {shop.heroes.map((o, i) =>
                  o ? (
                    <HeroCard key={o.key} defId={o.defId} rank={o.rank} price={o.price} sale={o.sale} owned={s.roster.some((h) => h.defId === o.defId)} onClick={() => onBuyHero(o.key)} ctx={ctx} />
                  ) : (
                    <div key={i} class="hero-card sold-card">
                      <div class="pennant-border" />
                      <div class="pennant center">
                        <span class="faint display">Recruited</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div class="shop-footnote faint">Buying a disciple you already own ranks them up · Drag disciples or Treasures onto the sell zone to sell them</div>
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

function ShopItemRow({ s, offer, onBuy }: { s: RunState; offer: { itemId: string; price: number; sale: boolean }; onBuy: () => void }) {
  const it = ITEM_BY_ID[offer.itemId];
  const can = s.stones >= offer.price;
  return (
    <button class={`shop-row ${can ? '' : 'poor'}`} onClick={onBuy} {...tip(<ItemTip itemId={offer.itemId} />)}>
      <ItemChip itemId={offer.itemId} size={44} />
      <div class="shop-row-info">
        <div class={`shop-row-name rar-${it.rarity}`}>{it.name}</div>
        <div class="shop-row-stats">
          {it.stats &&
            Object.entries(it.stats).map(([k, v]) => (
              <span key={k} style={{ color: STAT_COLOR[k] }}>
                <Icon name={STAT_ICON[k]} size={12} /> +{v}
                {k === 'omnivamp' ? '%' : ''}
              </span>
            ))}
          {it.desc && !it.stats && <span class="muted">{STAT_LABEL.attack ? '' : ''}<RichText text={it.desc} /></span>}
        </div>
      </div>
      <div class={`price-inline ${offer.sale ? 'sale' : ''}`}>
        {offer.sale && <span class="sale-label">SALE</span>}
        <Icon name="stones" size={13} /> {offer.price}
      </div>
    </button>
  );
}

function ShopRelicRow({ s, offer, onBuy }: { s: RunState; offer: { relicId: string; price: number; sale: boolean }; onBuy: () => void }) {
  const r = RELIC_BY_ID[offer.relicId];
  const can = s.stones >= offer.price;
  return (
    <button class={`shop-row relic ${can ? '' : 'poor'}`} onClick={onBuy} {...tip(<RelicTip relicId={offer.relicId} />)}>
      <div class={`relic-chip rar-${r.rarity}`} style={{ margin: 6 }}>
        <Icon name={`relic_${r.icon}`} size={22} />
      </div>
      <div class="shop-row-info">
        <div class={`shop-row-name rar-${r.rarity}`}>{r.name}</div>
        <div class="shop-row-desc">
          <RichText text={r.desc} />
        </div>
      </div>
      <div class={`price-inline ${offer.sale ? 'sale' : ''}`}>
        {offer.sale && <span class="sale-label">SALE</span>}
        <Icon name="stones" size={13} /> {offer.price}
      </div>
    </button>
  );
}
