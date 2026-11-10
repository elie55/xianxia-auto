import { useEffect } from 'preact/hooks';
import { deny, flyTo } from '@/ui/flourish';
import { act, run, showToast } from '@/app/store';
import { beginRankUps, buyHero, buyItem, buyRelic, heroSellValue, itemSellValue, proceedFromShop, rerollCost, shopReroll, toggleFreeze, type RunState } from '@/core/run';
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
  // what the dragged disciple or Treasure would sell for
  const refund = dragging?.started ? (dragging.payload.kind === 'hero' ? heroSellValue(s, dragging.payload.uid) : itemSellValue(dragging.payload.itemId)) : null;
  const ctx = teamContext(s);
  const offerEl = (key: string) => document.querySelector(`[data-offer="${key}"]`);
  const lastFilled = (sel: string) => [...document.querySelectorAll(sel)].filter((el) => el.firstElementChild).pop() ?? null;
  const onBuyHero = (key: string) => {
    const src = offerEl(key);
    const defId = shop.heroes.find((o) => o?.key === key)?.defId;
    let ok = false;
    act((st) => {
      const r = buyHero(st, key);
      if (!r.ok) {
        if (r.reason === 'Not enough Spirit Stones') deny(src);
        else {
          if (r.reason) showToast(r.reason, 'error');
          audio.sfx('ui_error');
        }
        return;
      }
      ok = true;
      audio.sfx('ui_buy');
      if (r.rankedUp) beginRankUps(st, 'shop');
    });
    if (ok) flyTo(src, () => document.querySelector(`.bottombar .hero-slot[data-hero-def="${defId}"] .slot-portrait`) ?? document.querySelector('.bottombar'), { pick: 'img', size: 120 });
  };
  const onBuyItem = (key: string) => {
    const src = offerEl(key);
    let ok = false;
    act((st) => {
      const r = buyItem(st, key);
      if (!r.ok) {
        if (r.reason === 'Not enough Spirit Stones') deny(src);
        else {
          if (r.reason) showToast(r.reason, 'error');
          audio.sfx('ui_error');
        }
      } else {
        ok = true;
        audio.sfx('ui_buy');
      }
    });
    if (ok) flyTo(src, () => lastFilled('.leftrail .inv-slot'), { pick: '.item-chip', size: 64 });
  };
  const onBuyRelic = (key: string, toBar = false) => {
    const src = offerEl(key);
    let ok = false;
    act((st) => {
      const r = buyRelic(st, key);
      if (!r.ok) {
        if (r.reason === 'Not enough Spirit Stones') deny(src);
        else {
          if (r.reason) showToast(r.reason, 'error');
          audio.sfx('ui_error');
        }
      } else {
        ok = true;
        audio.sfx('ui_buy');
      }
    });
    if (ok) flyTo(src, () => (toBar ? document.querySelector('.bottombar') : [...document.querySelectorAll('.leftrail .relic-grid .relic-chip')].pop() ?? null), { pick: toBar ? '.icon' : '.relic-chip', size: 64 });
  };
  const heroKeys = shop.heroes.map((o) => o?.key ?? '-').join(',');
  useEffect(() => {
    audio.sfx('ui_flip', { volume: 0.35 });
  }, [heroKeys]);
  return (
    <div class="screen">
      <Hud showTracker={false}>
        <div class="shop-panel panel anim-pop">
          <div class="shop-toolbar" data-tut="shop-toolbar">
            <button
              class="btn small"
              data-hotkey="reroll"
              disabled={s.stones < cost}
              {...tip(<><h4>Reroll <kbd class="keycap">R</kbd></h4><p>Replace every offer for the price shown.</p></>, 'below')}
              onClick={(e) => {
                const btn = e.currentTarget;
                act((st) => {
                  if (shopReroll(st)) audio.sfx('ui_reroll');
                  else deny(btn);
                });
              }}
            >
              <Icon name="ui_reroll" size={16} /> Reroll shop · <Icon name="stones" size={16} /> {cost}
            </button>
            <button class={`btn small ${s.shopFrozen ? 'primary' : ''}`} data-hotkey="freeze" onClick={() => act((st) => (toggleFreeze(st), audio.sfx('ui_click')))} {...tip(<><h4>Freeze <kbd class="keycap">F</kbd></h4><p>Keep the current offers for the next shop.</p></>, 'below')}>
              <Icon name="ui_freeze" size={16} /> {s.shopFrozen ? 'Unfreeze shop' : 'Freeze shop'}
            </button>
            <div class={`sell-zone v2 ${dragging?.started ? 'armed' : ''} ${dragging?.over === 'sell' ? 'over' : ''}`} data-drop="sell" {...tip(<><h4>Sell</h4><p>Drag a disciple or Treasure here to sell it for Spirit Stones. Disciples refund part of their price; equipped Treasures are refunded too.</p><p>Or point at one and press <kbd class="keycap">E</kbd>.</p></>, 'below')}>
              <span class="sell-brazier">
                <Icon name="ui_sell" size={22} />
              </span>
              {refund !== null ? (
                <span class="sell-label">
                  Sell for <b>+{refund}</b> <Icon name="stones" size={16} />
                </span>
              ) : (
                <span class="sell-label">Drop here to sell</span>
              )}
            </div>
            <div class="grow" />
            <button
              class="btn primary"
              onClick={() => {
                audio.sfx('ui_confirm');
                act((st) => proceedFromShop(st));
              }}
            >
              {s.retryNode ? 'Fight again' : 'Proceed'} <Icon name="ui_proceed" size={14} />
            </button>
          </div>
          <div class="shop-body">
            <div class="shop-left" data-tut="shop-left">
              <div class="shop-section-title">Treasures</div>
              {shop.items.map((o, i) =>
                o ? (
                  <ShopItemRow key={o.key} s={s} offer={o} onBuy={() => onBuyItem(o.key)} />
                ) : (
                  <div key={i} class="shop-row sold">Sold</div>
                ),
              )}
              <div class="shop-section-title" style={{ marginTop: 14 }}>
                Dao Insights
              </div>
              {shop.relics.map((o, i) =>
                o ? (
                  <ShopRelicRow key={o.key} s={s} offer={o} onBuy={() => onBuyRelic(o.key)} />
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
                            data-offer={o.key}
                            {...tip(<RelicTip relicId={o.relicId} />)}
                            onClick={() => onBuyRelic(o.key, true)}
                          >
                            <Icon name={`relic_${RELIC_BY_ID[o.relicId].icon}`} size={52} color="var(--gold-bright)" />
                            <span class="ts-name">{RELIC_BY_ID[o.relicId].name}</span>
                            <span class="price-inline">
                              <Icon name="stones" size={20} /> {o.price}
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
                {shop.heroes.map((o, i) => {
                  const owned = !!o && s.roster.some((h) => h.defId === o.defId);
                  return (
                    <div key={o ? o.key : `sold${i}`} class="shop-card-wrap" data-offer={o?.key}>
                      <div class={`rankup-ribbon ${owned ? '' : 'hidden'}`} {...(owned ? tip(<><h4>Rank Up</h4><p>You already own this disciple. Buying the card again raises their rank.</p></>) : {})}>
                        <Icon name="ui_rank" size={18} /> Rank Up
                      </div>
                      {o ? (
                        <HeroCard defId={o.defId} rank={o.rank} price={o.price} sale={o.sale} owned={owned} onClick={() => onBuyHero(o.key)} ctx={ctx} compact />
                      ) : (
                        <div class="hero-card sold-card">
                          <div class="pennant-border" />
                          <div class="pennant center">
                            <span class="faint display">Recruited</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div class="shop-footnote faint">Buying a disciple you already own ranks them up · Drag disciples or Treasures onto the sell zone to sell them</div>
            </div>
          </div>
        </div>
      </Hud>
    </div>
  );
}

function ShopItemRow({ s, offer, onBuy }: { s: RunState; offer: { key: string; itemId: string; price: number; sale: boolean }; onBuy: () => void }) {
  const it = ITEM_BY_ID[offer.itemId];
  const can = s.stones >= offer.price;
  return (
    <button class={`shop-row rar-${it.rarity} ${can ? "" : "poor"}`} data-offer={offer.key} onClick={onBuy} {...tip(<ItemTip itemId={offer.itemId} />)}>
      <ItemChip itemId={offer.itemId} size={58} />
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
        <Icon name="stones" size={20} /> {offer.price}
      </div>
    </button>
  );
}

function ShopRelicRow({ s, offer, onBuy }: { s: RunState; offer: { key: string; relicId: string; price: number; sale: boolean }; onBuy: () => void }) {
  const r = RELIC_BY_ID[offer.relicId];
  const can = s.stones >= offer.price;
  return (
    <button class={`shop-row relic rar-${r.rarity} ${can ? "" : "poor"}`} data-offer={offer.key} onClick={onBuy} {...tip(<RelicTip relicId={offer.relicId} />)}>
      <div class={`relic-chip rar-${r.rarity}`}>
        <Icon name={`relic_${r.icon}`} size={44} />
      </div>
      <div class="shop-row-info">
        <div class={`shop-row-name rar-${r.rarity}`}>{r.name}</div>
        <div class="shop-row-desc">
          <RichText text={r.desc} />
        </div>
      </div>
      <div class={`price-inline ${offer.sale ? 'sale' : ''}`}>
        {offer.sale && <span class="sale-label">SALE</span>}
        <Icon name="stones" size={20} /> {offer.price}
      </div>
    </button>
  );
}
