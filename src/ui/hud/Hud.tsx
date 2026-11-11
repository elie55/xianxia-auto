import { signal } from '@preact/signals';
import { act, compendiumReturn, meta, run, screen, showToast, updateMeta } from '@/app/store';
import { useEffect, useState } from 'preact/hooks';
import { isDesktop, quitGame } from '@/app/desktop';
import { SettingsPanel } from '@/ui/screens/Settings';
import { DIFFICULTIES } from '@/content/difficulties';
import { HERO_BY_ID } from '@/content/heroes';
import { RELIC_BY_ID } from '@/content/relics';
import { ITEM_BY_ID } from '@/content/items';
import { heroAbility, heroItemSlots, heroStats, type HeroState, type TeamContext } from '@/core/builder';
import { concludeRun } from '@/meta/runtime';
import { equipItem, equipItemAt, heroByUid, moveHero, relicDefs, runDoctrine, sellHero, sellItem, teamContext, unequipItem, itemQuestState, type RunState, setPosition } from '@/core/run';
import { Icon, STAT_COLOR, STAT_ICON, STAT_LABEL } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { tip } from '@/ui/components/Tooltip';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { ItemChip, ItemTip, RankGlyph, AbilityTip, ClassLine, fmtStat } from '@/ui/components/HeroCard';
import { drag, startDrag, type DragPayload } from '@/ui/drag';
import { getBattleView } from '@/battle/view/BattleView';
import { audio } from '@/audio/AudioManager';
import { toDesign } from '@/app/scale';
import { isAllyZone } from '@/battle/sim/hex';
import { RANK_NAMES, type NodeKind } from '@/core/types';
import { realmElites, realmGuardians, tribulationLevel } from '@/core/encounters';
import { ENEMY_BY_ID } from '@/content/enemies';
import { themeFor } from '@/content/themes';
import { PAINTED_ICONS } from '@/ui/components/paintedIcons';
import { baseWinStones, heroSellValue, itemSellValue, runOmen } from '@/core/run';
import { RIVAL_FOES } from '@/content/sectFoes';
import { HEART_DEMON_JADE } from '@/content/sectEvents';
import { purseText } from '@/meta/sectEvents';
import { stonesHeld } from '@/ui/flourish';

/** Incremented a few times per second during battle so tracker panels refresh. */
export const battleTick = signal(0);
export const battleTime = signal(0);
export const battleSpeed = signal<1 | 2 | 3>(meta.value.settings.battleSpeed);
export const showMenu = signal(false);
/** A sale waiting for the player's OK (Settings › Gameplay › Confirm before selling). */
export const pendingSell = signal<{ payload: DragPayload; label: string; value: number } | null>(null);

const NODE_ICON: Record<NodeKind, string> = {
  fight: 'ui_fight',
  elite: 'ui_elite',
  boss: 'ui_boss',
  event: 'ui_event',
  challenge: 'ui_challenge',
  trial: 'ui_trial',
  rest: 'ui_rest',
};
const NODE_LABEL: Record<NodeKind, string> = {
  fight: 'Encounter',
  elite: 'Elite encounter',
  boss: 'Realm Guardian',
  event: 'Event',
  challenge: 'Challenge',
  trial: 'Heavenly Trial',
  rest: 'Sect Rest',
};

const nodeIcon = (k: NodeKind) => (PAINTED_ICONS.has(`node_${k}`) ? `node_${k}` : NODE_ICON[k]);
const FIGHT_NODES: NodeKind[] = ['fight', 'elite', 'boss', 'challenge'];

/** What a node holds: its kind, Tribulation level, what happens there, the reward and the foes (when known). */
function NodeTip({ s, index }: { s: RunState; index: number }) {
  const n = s.timeline[index];
  const state = index < s.nodeIndex ? 'done' : index === s.nodeIndex ? 'current' : 'future';
  const level = tribulationLevel(s.realm, index, s.tier, s.floor);
  const stones = baseWinStones(s);
  const desc: Record<NodeKind, string> = {
    fight: "A band of the realm's creatures blocks the road.",
    elite: 'A champion of the realm, far stronger than a band.',
    boss: 'The Realm Guardian. Defeat it to seal the rift and ascend.',
    event: 'A chance meeting on the road: choices, treasures and risks.',
    challenge: 'A stronger foe. Accept a hardship for a greater reward, or fight it as it comes.',
    trial: 'One disciple faces a creature alone.',
    rest: 'A pause at the sect: train, fortify or gamble.',
  };
  const reward: Partial<Record<NodeKind, string>> = {
    fight: `${stones} Spirit Stones, +1 per surviving disciple`,
    elite: `${stones} Spirit Stones and a choice of epic Dao Insights`,
    boss: 'The realm is sealed',
    challenge: 'A rare or epic reward if you accept a hardship',
    trial: 'A choice of rare Treasures',
  };
  // omens sect events sent into the run: the Crimson Cloud disciples at Realm I's elite, the Heart Demon at its trial
  const rival = n.kind === 'elite' && s.realm === 1 ? runOmen(s, 'rival') : undefined;
  const demon = n.kind === 'trial' && s.realm === 1 && !!runOmen(s, 'heart_demon');
  if (rival) {
    desc.elite = 'The Crimson Cloud Sect answers your challenge: their Senior Brother and two juniors bar the road.';
    reward.elite = `${reward.elite}, and ${purseText(rival.reward)} for the sect`;
  }
  if (demon) {
    desc.trial = 'The Heart Demon your sect chose to hunt waits here, to be fought alone.';
    reward.trial = `+20% Attack, Spirit and Max HP for the champion, and ${HEART_DEMON_JADE} Heavenly Jade for the sect`;
  }
  // foes: the real ones for the node you stand on, the known champion for elites and the guardian
  const live = state === 'current' && s.currentEncounter && FIGHT_NODES.includes(n.kind) ? s.currentEncounter.enemies.map((e) => e.defId) : [];
  const known = n.kind === 'boss' ? realmGuardians(s.realm, s.tier) : rival ? RIVAL_FOES : n.kind === 'elite' ? realmElites(s.realm, s.tier) : demon ? ['heart_demon'] : [];
  const foes = [...new Set(live.length ? live : known)].slice(0, 5);
  return (
    <div class="node-tip">
      <div class="node-tip-head">
        <Icon name={nodeIcon(n.kind)} size={50} />
        <div>
          <h4>{NODE_LABEL[n.kind]}</h4>
          <div class="sub">
            Node {index + 1} of {s.timeline.length} · {state === 'done' ? 'Cleared' : state === 'current' ? 'You are here' : `${index - s.nodeIndex} ahead`}
          </div>
        </div>
      </div>
      {FIGHT_NODES.includes(n.kind) && (
        <div class="node-tip-level">
          Tribulation level <b>{level}</b>
        </div>
      )}
      <p>{desc[n.kind]}</p>
      {reward[n.kind] && <p class="gold">Reward: {reward[n.kind]}</p>}
      {foes.length > 0 && (
        <div class="node-tip-foes">
          {!live.length && known.length > 1 && <div class="faint">One of:</div>}
          {foes.map((id) => {
            const e = ENEMY_BY_ID[id];
            return e ? (
              <div key={id} class={`node-foe ${e.boss ? 'boss' : ''}`}>
                <img src={`./assets/art/sprites/${e.sprite}.png`} alt="" draggable={false} />
                <span>{e.name}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export function Hud({ children, showTracker = true }: { children?: preact.ComponentChildren; showTracker?: boolean }) {
  const s = run.value!;
  return (
    <>
      <TopBar s={s} />
      <LeftRail s={s} />
      {showTracker && <RightRail s={s} />}
      <BottomBar s={s} />
      {children}
      <DragGhost />
      {showMenu.value && <PauseMenu />}
      {pendingSell.value && <SellConfirm />}
    </>
  );
}

// ───────────────────────── top bar ─────────────────────────

function TopBar({ s }: { s: RunState }) {
  const diff = DIFFICULTIES[s.tier];
  const level = s.currentEncounter?.level ?? tribulationLevel(s.realm, s.nodeIndex, s.tier, s.floor);
  const inBattle = s.phase === 'battle';
  const realmName = s.realm === 1 || s.realm === 2 ? themeFor(s.tier, s.realm).name : `Heavenly Ladder · Floor ${s.floor}`;
  return (
    <div class="topbar" data-tut="topbar">
      <div class="topbar-left">
        <div class="stones-pill big anim-pop" key={s.stones - stonesHeld.value} {...tip(<><h4 class="gold">Spirit Stones</h4><p>Currency for disciples, Treasures and Dao Insights. Earned after every victory.</p></>)}>
          <Icon name="stones" size={22} color="var(--gold-bright)" /> {s.stones - stonesHeld.value}
        </div>
        <div class="realm-label">
          <span class="brush realm-hanzi">{s.realm === 1 ? '一' : s.realm === 2 ? '二' : '天'}</span>
          <div>
            <div class="realm-name display">Realm {s.realm === 3 ? '∞' : s.realm}</div>
            <div class="realm-sub">{realmName}</div>
          </div>
        </div>
      </div>
      <div class="timeline">
        <div class="tl-track">
          <i style={{ width: `${(Math.min(s.nodeIndex, s.timeline.length - 1) / Math.max(1, s.timeline.length - 1)) * 100}%` }} />
        </div>
        {s.timeline.map((n, i) => {
          const state = i < s.nodeIndex ? 'done' : i === s.nodeIndex ? 'current' : 'future';
          return (
            <div key={i} class={`tl-node ${state} ${n.kind}`} {...tip(() => <NodeTip s={s} index={i} />, 'below')}>
              <Icon name={nodeIcon(n.kind)} size={n.kind === 'boss' ? 46 : n.kind === 'elite' ? 38 : 34} />
              {state === 'done' && <i class="tl-done" />}
            </div>
          );
        })}
      </div>
      <div class="topbar-right">
        <div class="trib-level" {...tip(<><h4>Tribulation Level {level}</h4><p>Enemy power at this node. Higher levels mean sturdier, deadlier foes.</p><p class="muted">Contract: {diff.name}</p></>, 'left')}>
          <Icon name="kw_enlightenment" size={20} color="var(--gold-bright)" />
          <span class="trib-label">Tribulation</span>
          <span class="trib-value">{level}</span>
        </div>
        {(inBattle || s.phase === 'board') && (
          <div class="speed-controls" data-tut="speed">
            <button
              class={`speed-btn ${meta.value.settings.autoBattle ? 'on' : ''}`}
              {...tip(<><h4>Auto</h4><p>Start fights automatically when the board is ready.</p></>, 'left')}
              onClick={() => updateMeta((m) => (m.settings.autoBattle = !m.settings.autoBattle))}
            >
              <Icon name="ui_auto" size={14} /> AUTO
            </button>
            {([1, 2, 3] as const).map((v) => (
              <button
                key={v}
                class={`speed-btn ${battleSpeed.value === v ? 'on' : ''}`}
                data-hotkey={`speed-${v}`}
                {...tip(<><h4>Battle speed {v}× <kbd class="keycap">{v}</kbd></h4></>, 'left')}
                onClick={() => {
                  battleSpeed.value = v;
                  getBattleView().setSpeed(v);
                  updateMeta((m) => (m.settings.battleSpeed = v));
                }}
              >
                {v}×
              </button>
            ))}
          </div>
        )}
        <button class="speed-btn" data-hotkey="menu" onClick={() => (showMenu.value = true)} {...tip(<><h4>Menu <kbd class="keycap">Esc</kbd></h4></>, 'left')}>
          <Icon name="ui_settings" size={16} />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── left rail: insights + inventory ─────────────────────────

/** The player's choice for the Treasure drawer (null: automatic, open in the shop and while moving a Treasure). */
const drawerPref = signal<boolean | null>(null);

function LeftRail({ s }: { s: RunState }) {
  const relics = relicDefs(s);
  const doctrine = runDoctrine(s);
  const dragging = drag.value;
  const canDropItem = dragging?.payload.kind === 'item' && !!dragging.payload.fromHero;
  // the drawer opens by itself where Treasures are handled; the player's toggle holds until the next screen
  useEffect(() => {
    drawerPref.value = null;
  }, [s.phase]);
  const open = drawerPref.value ?? (s.phase === 'shop' || dragging?.payload.kind === 'item');
  const filled = s.inventory.filter(Boolean).length;
  return (
    <div class={`leftrail v2 ${open ? 'open' : 'closed'}`} data-tut="leftrail">
      <div class="rail-insights" {...tip(<><h4>Dao Insights {relics.length}</h4><p>Relics that buff the whole sect or unlock quests. Hover one for details.</p></>, 'below')}>
        {(doctrine || s.sect?.pure) && (
          <span
            class={`rail-insight-tag rail-doctrine ${doctrine ? '' : 'pure'}`}
            {...tip(
              doctrine ? (
                <>
                  <h4>Doctrine: {doctrine.name}</h4>
                  <p>
                    <b style={{ color: '#7fdcae' }}>+</b> <RichText text={doctrine.upside} />
                  </p>
                  <p>
                    <b style={{ color: '#e8907e' }}>−</b> <RichText text={doctrine.cost} />
                  </p>
                </>
              ) : (
                <>
                  <h4>Pure run</h4>
                  <p>No doctrine, heirloom or sect bonus. The run pays +20% Sect Renown.</p>
                </>
              ),
              'below',
            )}
          >
            {doctrine ? <Icon name={doctrine.icon} size={24} /> : null}
            <span class="brush">{doctrine ? doctrine.hanzi : '纯'}</span>
          </span>
        )}
        <span class="rail-insight-tag">
          <span class="brush">悟</span>
          <b>{relics.length}</b>
        </span>
        <div class="relic-grid">
          {s.relics.map((rs) => {
            const r = RELIC_BY_ID[rs.id];
            if (!r) return null;
            return (
              <div key={rs.id} class={`relic-chip rar-${r.rarity}`} {...tip(<RelicTip relicId={rs.id} progress={rs.questProgress} done={rs.questDone} />)}>
                <Icon name={`relic_${r.icon}`} size={22} />
                {r.quest && !rs.questDone && <i class="quest-dot" />}
              </div>
            );
          })}
        </div>
      </div>
      <div class="rail-drawer">
        <button
          class="drawer-tab"
          onClick={() => {
            audio.sfx('ui_click', { volume: 0.5 });
            drawerPref.value = !open;
          }}
          {...tip(<><h4>Treasures {filled}/{s.inventorySize}</h4><p>{open ? 'Click to fold the drawer away.' : 'Click to open your Treasures.'} Drag a Treasure onto a disciple to equip it.</p></>, 'right')}
        >
          <Icon name="ui_bag" size={22} color="var(--gold-bright)" />
          <span class="drawer-count">
            {filled}/{s.inventorySize}
          </span>
          <span class="drawer-arrow">{open ? '‹' : '›'}</span>
        </button>
        <div class="drawer-body">
          <div class="rail-title">
            Treasures <span class="faint">{filled}/{s.inventorySize}</span>
          </div>
          <div class={`inventory ${canDropItem ? 'drop-ok' : ''}`} data-drop="inventory">
            {Array.from({ length: s.inventorySize }).map((_, i) => {
              const itemId = s.inventory[i];
              return (
                <div key={i} class="inv-slot" data-sell={itemId ? `item:${itemId}` : undefined}>
                  {itemId && <ItemChip itemId={itemId} size={36} draggable onDragStart={(e) => startDrag({ kind: 'item', itemId }, e)} class="clickable" />}
                </div>
              );
            })}
          </div>
          <div class="faint rail-hint">Drag a Treasure onto a disciple to equip it.</div>
        </div>
      </div>
    </div>
  );
}

export function RelicTip({ relicId, progress, done }: { relicId: string; progress?: number; done?: boolean }) {
  const r = RELIC_BY_ID[relicId];
  if (!r) return null;
  return (
    <>
      <h4 class={`rar-${r.rarity}`} style={{ color: 'var(--rar)' }}>
        {r.name}
      </h4>
      <div class="sub">{r.rarity} Dao Insight</div>
      <p>
        <RichText text={r.desc} />
      </p>
      {r.quest && (
        <p class="muted">
          Quest: {r.quest.desc}
          {progress !== undefined && ` (${Math.min(progress, r.quest.goal)}/${r.quest.goal}${done ? ' ✓' : ''})`}
          <br />
          Reward: {r.quest.rewardDesc}
        </p>
      )}
    </>
  );
}

// ───────────────────────── right rail: tracker ─────────────────────────

const trackerTab = signal<'damageDealt' | 'damageTaken' | 'healing'>('damageDealt');

function RightRail({ s }: { s: RunState }) {
  void battleTick.value;
  const view = getBattleView();
  // a Reflection's deeds are already its owner's: it gets no row of its own
  const units = view.battle?.units.filter((u) => u.side === 'ally' && u.onBoard && u.ownerId === null) ?? [];
  const tab = trackerTab.value;
  const rows =
    units.length > 0
      ? units.map((u) => ({ defId: u.defId, name: u.name, value: tab === 'healing' ? u.tracker.healing + u.tracker.shielding : u.tracker[tab], alive: u.alive }))
      : (s.lastResult?.units ?? []).filter((u) => u.side === 'ally' && u.onBoard).map((u) => ({ defId: u.defId, name: u.name, value: tab === 'healing' ? u.tracker.healing + u.tracker.shielding : u.tracker[tab], alive: u.alive }));
  const max = Math.max(1, ...rows.map((r) => r.value));
  rows.sort((a, b) => b.value - a.value);
  const label = tab === 'damageDealt' ? 'Damage Dealt' : tab === 'damageTaken' ? 'Damage Taken' : 'Healing & Shields';
  const color = tab === 'damageDealt' ? '#ff6b9a' : tab === 'damageTaken' ? '#ffb347' : '#8dff9a';
  return (
    <div class="rightrail panel plain" data-tut="tracker">
      <div class="tracker-tabs">
        <button class={tab === 'damageDealt' ? 'on' : ''} onClick={() => (trackerTab.value = 'damageDealt')} {...tip(<h4>Damage dealt</h4>, 'left')}>
          <Icon name="ui_damage" size={16} />
        </button>
        <button class={tab === 'damageTaken' ? 'on' : ''} onClick={() => (trackerTab.value = 'damageTaken')} {...tip(<h4>Damage taken</h4>, 'left')}>
          <Icon name="ui_taken" size={16} />
        </button>
        <button class={tab === 'healing' ? 'on' : ''} onClick={() => (trackerTab.value = 'healing')} {...tip(<h4>Healing & shields</h4>, 'left')}>
          <Icon name="ui_healing" size={16} />
        </button>
      </div>
      <div class="tracker-title display">
        {label}
        {units.length > 0 ? (
          <span class="tracker-badge live" {...tip(<><h4>Live</h4><p>Updates during the fight.</p></>, 'left')}>
            <i /> Live
          </span>
        ) : rows.length > 0 ? (
          <span class="tracker-badge">Last fight</span>
        ) : null}
      </div>
      {rows.length === 0 && <div class="faint" style={{ fontSize: 14 }}>Combat statistics appear here.</div>}
      {rows.map((r) => (
        <div key={r.defId} class={`tracker-row ${r.alive ? '' : 'dead'}`}>
          <MiniPortrait defId={r.defId} size={34} />
          <div class="tracker-info">
            <div class="tracker-value">{fmt(r.value)}</div>
            <div class="tracker-bar">
              <i style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function fmt(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}K`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

// ───────────────────────── bottom bar: party + reserve ─────────────────────────

function BottomBar({ s }: { s: RunState }) {
  const ctx = teamContext(s);
  const dragging = drag.value;
  // Slot geometry for the 1920-wide bar: hero blocks shrink (down to 72 px portraits) only when Sect Expansions crowd it.
  const P = Math.max(1, s.party.length);
  const R = Math.max(0, s.reserve.length);
  const labelW = P + R >= 8 ? 64 : 96;
  // a reserve block grows a second socket column when its disciple carries more than three Treasures
  const reserveCols = s.reserve.some((ru) => {
    const rh = ru ? heroByUid(s, ru) : undefined;
    return !!rh && heroItemSlots(rh, ctx) > 3;
  })
    ? 2
    : 1;
  const avail = 1920 - 68 - 2 * labelW - 70 - (146 + 28 * (reserveCols - 1)) * R - 14 * (P + R);
  const slotW = Math.min(244, Math.floor(avail / P));
  const portrait = Math.max(72, Math.min(104, slotW - 136));
  // side column = block minus its padding (8 + 8), the portrait ring (+4) and the gap (8); up to three sockets per row
  const side = slotW - 16 - (portrait + 4) - 8;
  const sock = Math.max(18, Math.min(36, Math.floor((side - 2 * 4) / 3)));
  const vars = { ['--slot-w' as string]: `${slotW}px`, ['--portrait' as string]: `${portrait}px`, ['--sock' as string]: `${sock}px`, ['--label-w' as string]: `${labelW}px` };
  return (
    <div class="bottombar" data-tut="party" style={vars}>
      <div class="bb-label display" {...tip(<><h4>Party</h4><p>Disciples who fight. Drag a portrait onto the board to place them, or onto another slot to swap.</p><p class="muted">Sect Expansion Insights raise the party size.</p></>, 'above')}>
        Party <span class="faint">{s.party.filter(Boolean).length}/{s.partySize}</span>
      </div>
      <div class="slot-row">
        {s.party.map((uid, i) => (
          <HeroSlot key={`p${i}`} s={s} uid={uid} ctx={ctx} drop={`party:${i}`} dragging={dragging} portrait={portrait} sock={sock} />
        ))}
      </div>
      <div class="bb-divider" />
      <div class="slot-row">
        {s.reserve.map((uid, i) => (
          <HeroSlot key={`r${i}`} s={s} uid={uid} ctx={ctx} drop={`reserve:${i}`} dragging={dragging} reserve portrait={portrait} sock={sock} />
        ))}
      </div>
      <div class="bb-label display" {...tip(<><h4>Reserve</h4><p>Disciples who sit out the fight. Only [Meditation] effects work from here. Keep copies for rank-ups or swap them in later.</p></>, 'above')}>
        Reserve <span class="faint">{s.reserve.filter(Boolean).length}/{s.reserveSize}</span>
      </div>
    </div>
  );
}

function HeroSlot({ s, uid, ctx, drop, dragging, reserve, portrait = 104, sock = 34 }: { s: RunState; uid: string | null; ctx: ReturnType<typeof teamContext>; drop: string; dragging: ReturnType<typeof drag.peek>; reserve?: boolean; portrait?: number; sock?: number }) {
  const h = uid ? heroByUid(s, uid) : undefined;
  const def = h ? HERO_BY_ID[h.defId] : undefined;
  const over = dragging?.over === drop || ((dragging?.over === `hero:${uid}` || !!dragging?.over?.startsWith(`socket:${uid}:`)) && !!uid);
  // the socket a dragged Treasure would land in (its Treasure is the one replaced)
  const overSocket = dragging?.payload.kind === 'item' && uid && dragging.over?.startsWith(`socket:${uid}:`) ? Number(dragging.over.slice(dragging.over.lastIndexOf(':') + 1)) : -1;
  const acceptsHero = dragging?.payload.kind === 'hero';
  const acceptsItem = dragging?.payload.kind === 'item' && !!h;
  const size = reserve ? Math.min(portrait, 92) : portrait;
  const chip = reserve ? 20 : sock - 6;
  void battleTick.value; // a disciple can fall (or be reborn) at any moment of a fight
  const fallen = !!h && !reserve && heroFallen(s, h.uid);
  // during a fight: live HP / shield / Qi under the portrait, and a glow while the disciple casts
  const live = h && !reserve && s.phase === 'battle' ? getBattleView().unitForHero(h.uid) : null;
  const casting = !!live && live.alive && live.castUntil > (getBattleView().battleTime() ?? 0);
  return (
    <div class={`hero-slot ${h ? 'filled' : 'empty'} ${over && (acceptsHero || acceptsItem) ? 'drop-ok' : ''} ${reserve ? 'reserve' : ''} ${fallen ? 'fallen' : ''}`} data-drop={h ? `hero:${uid}` : drop} data-sell={h ? `hero:${h.uid}` : undefined} data-hero-def={h?.defId}>
      {h && def && (
        <>
          <div
            class={`slot-portrait ${casting ? 'casting' : ''}`}
            style={{ width: size + 4, height: size + 4 }}
            onPointerDown={(e) => startDrag({ kind: 'hero', uid: h.uid }, e)}
            {...tip(<HeroSlotTip h={h} s={s} ctx={ctx} />, 'above')}
          >
            <MiniPortrait defId={h.defId} size={size} />
            {fallen && <FallenMark />}
            {live && live.onBoard && live.alive && (
              <div class="slot-live" aria-hidden="true">
                <div class="slot-live-hp">
                  <i class="hp" style={{ width: `${Math.max(0, Math.min(100, (live.hp / live.maxHp) * 100))}%` }} />
                  {live.shield > 0 && <i class="sh" style={{ left: `${Math.min(100, (live.hp / live.maxHp) * 100)}%`, width: `${Math.min(100 - Math.min(100, (live.hp / live.maxHp) * 100), (live.shield / live.maxHp) * 100)}%` }} />}
                </div>
                {live.maxQi > 0 && (
                  <div class="slot-live-qi">
                    <i style={{ width: `${Math.max(0, Math.min(100, (live.qi / live.maxQi) * 100))}%` }} />
                  </div>
                )}
              </div>
            )}
            <div class="slot-rank">
              <RankGlyph rank={h.rank} size={Math.round(size * 0.3)} />
            </div>
            {reserve && <div class="slot-med" {...tip(<><h4 class="kw-Meditation">Reserve</h4><p>Only [Meditation] effects work from here.</p></>)}><Icon name="kw_meditation" size={12} /></div>}
          </div>
          <div class="slot-side">
            {!reserve && <div class="slot-name">{def.name}</div>}
            <div class="slot-items" style={{ ['--cols' as string]: socketColumns(heroItemSlots(h, ctx), !!reserve) }}>
              {Array.from({ length: heroItemSlots(h, ctx) }).map((_, i) => {
                const itemId = h.items[i];
                return (
                  <div key={i} class={`slot-item ${overSocket === i ? (itemId ? 'drop-swap' : 'drop-fill') : ''}`} data-drop={`socket:${h.uid}:${i}`} data-sell={itemId ? `item:${itemId}:${h.uid}` : undefined}>
                    {itemId && <ItemChip itemId={itemId} size={chip} draggable onDragStart={(e) => startDrag({ kind: 'item', itemId, fromHero: h.uid }, e)} />}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {!h && (
        <div class="slot-portrait empty">
          <Icon name={reserve ? 'ui_reserve' : 'ui_party'} size={22} color="rgba(255,255,255,0.18)" />
        </div>
      )}
    </div>
  );
}

const TIP_STATS = ['attack', 'spirit', 'defense', 'attackSpeed', 'crit', 'range'] as const;

/** Party-bar hero tooltip: HP and Qi bars with values, the stat grid and the ability. Shows live combat values during a battle. */
/** Socket grid columns: one row up to three Treasures, then 2×2 for four and 3 + 2 for five (reserve: one or two columns). */
function socketColumns(n: number, reserve: boolean): number {
  if (reserve) return n > 3 ? 2 : 1;
  if (n <= 3) return Math.max(1, n);
  return n === 4 ? 2 : 3;
}

/** True while a disciple lies fallen: live during a fight, and on the result screen that follows it. */
function heroFallen(s: RunState, uid: string): boolean {
  if (s.phase === 'battle') {
    const u = getBattleView().unitForHero(uid);
    return !!u && u.onBoard && !u.alive;
  }
  if (s.phase === 'result' || s.phase === 'defeat') {
    const u = s.lastResult?.units.find((x) => x.heroUid === uid);
    return !!u && u.onBoard && !u.alive;
  }
  return false;
}

/** Fallen in battle: the portrait cracks like shattered jade, a soul wisp rises, and a vermilion seal bearing a jade skull is stamped on it. */
function FallenMark() {
  return (
    <div class="fallen-mark">
      <div class="fallen-glass">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M57 4 L51 21 L59 30 L47 46 L54 57 L40 73 L45 96" />
          <path d="M51 21 L33 17 L19 27" />
          <path d="M47 46 L27 49 L10 61" />
          <path d="M54 57 L73 62 L90 79" />
          <path d="M59 30 L79 25 L96 33" />
          <path d="M40 73 L24 82" />
        </svg>
      </div>
      <div class="fallen-soul" />
      <div class="fallen-seal" {...tip(<><h4 class="kw-Execute">Fallen</h4><p>This disciple has fallen in battle. They return for the next fight.</p></>, 'above')}>
        <i class="fallen-skull" aria-hidden="true" />
      </div>
    </div>
  );
}

export function HeroSlotTip({ h, s, ctx, hint = true }: { h: HeroState; s: RunState; ctx: TeamContext; hint?: boolean }) {
  void battleTick.value; // refreshes a few times per second while a battle runs
  const def = HERO_BY_ID[h.defId];
  const stats = heroStats(h, ctx, s.positions[h.uid] ?? null);
  const ability = heroAbility(h);
  const live = s.phase === 'battle' ? getBattleView().unitForHero(h.uid) : null;
  const maxHp = live ? live.maxHp : Math.round(stats.hp);
  const hp = live ? Math.max(0, live.hp) : maxHp;
  const shield = live ? live.shield : 0;
  const maxQi = live ? live.maxQi : ability.qiCost;
  const qi = live ? live.qi : Math.min(maxQi, Math.round(stats.qi));
  const hpPct = Math.min(100, (hp / Math.max(1, maxHp)) * 100);
  const shieldPct = Math.min(100 - hpPct, (shield / Math.max(1, maxHp)) * 100);
  const qiPct = maxQi > 0 ? Math.min(100, (qi / maxQi) * 100) : 0;
  const value = (k: (typeof TIP_STATS)[number]) => (live ? (k === 'attackSpeed' ? `${live.attacksPerSecond.toFixed(2)}/s` : fmtStat(k, live.stat(k))) : fmtStat(k, stats[k]));
  const extra = (['qiRegen', 'omnivamp'] as const).filter((k) => stats[k] > 0);
  return (
    <>
      <h4>
        {def.name} <span class="brush gold">{def.hanzi}</span>
      </h4>
      <div class="sub">
        {def.title} · {RANK_NAMES[h.rank].name}
      </div>
      <ClassLine hero={h} />
      <div class="tip-bar" style={{ height: 13 }}>
        <i style={{ width: `${hpPct}%`, background: 'linear-gradient(180deg,#7ef29a,#2f9c4b)' }} />
        {shieldPct > 0 && <i style={{ left: `${hpPct}%`, width: `${shieldPct}%`, background: 'linear-gradient(180deg,#e6f3ff,#9fd5ff)' }} />}
        <span style={{ fontSize: 14 }}>
          HP {Math.round(hp)} / {maxHp}
          {shield > 0 ? ` (+${Math.round(shield)} shield)` : ''}
        </span>
      </div>
      <div class="tip-bar" style={{ height: 13 }}>
        <i style={{ width: `${qiPct}%`, background: 'linear-gradient(180deg,#8fd5ff,#2f7fc4)' }} />
        <span style={{ fontSize: 14 }}>
          Qi {Math.round(qi)} / {maxQi}
          {live ? '' : ' to cast'}
        </span>
      </div>
      <div class="tip-stats">
        {TIP_STATS.map((k) => (
          <div key={k} class="tip-stat" style={{ color: STAT_COLOR[k] }}>
            <Icon name={STAT_ICON[k]} size={13} /> {value(k)}
            <span class="faint" style={{ fontWeight: 400, fontSize: 14 }}>
              {STAT_LABEL[k]}
            </span>
          </div>
        ))}
        {extra.map((k) => (
          <div key={k} class="tip-stat" style={{ color: STAT_COLOR[k] }}>
            <Icon name={STAT_ICON[k]} size={13} /> {fmtStat(k, stats[k])}
            <span class="faint" style={{ fontWeight: 400, fontSize: 14 }}>
              {STAT_LABEL[k]}
            </span>
          </div>
        ))}
      </div>
      <AbilityTip hero={h} ctx={ctx} />
      {hint && <p class="hint">{live ? 'Live combat values.' : 'Drag to the board, to the reserve, or onto the sell zone in the shop.'}</p>}
    </>
  );
}

// ───────────────────────── drag ghost + drop logic ─────────────────────────

function DragGhost() {
  const d = drag.value;
  if (!d || !d.started || (d.payload.kind === 'hero' && d.payload.fromBoard)) return null;
  const p = d.payload;
  return (
    <div class="drag-ghost" style={{ left: d.x, top: d.y }}>
      {p.kind === 'hero' && (() => {
        const h = heroByUid(run.value!, p.uid);
        return h ? <MiniPortrait defId={h.defId} size={72} /> : null;
      })()}
      {p.kind === 'item' && <ItemChip itemId={p.itemId} size={46} />}
    </div>
  );
}

function sellNow(payload: DragPayload): void {
  if (payload.kind === 'hero') act((st) => sellHero(st, payload.uid));
  else act((st) => sellItem(st, payload.itemId, payload.fromHero));
  audio.sfx('ui_sell');
}

function SellConfirm() {
  const p = pendingSell.value!;
  const close = () => (pendingSell.value = null);
  return (
    <div class="modal-backdrop" onClick={close}>
      <div class="panel modal-panel sell-confirm anim-pop" onClick={(e) => e.stopPropagation()}>
        <div class="panel-title display">Sell {p.label}?</div>
        <p class="muted">
          You receive <b class="gold">{p.value}</b> Spirit Stones. This cannot be undone.
        </p>
        <div class="row" style={{ gap: 12, marginTop: 18, justifyContent: 'center' }}>
          <button class="btn ghost" data-hotkey="back" onClick={close}>
            Keep
          </button>
          <button
            class="btn danger"
            onClick={() => {
              close();
              sellNow(p.payload);
            }}
          >
            <Icon name="stones" size={18} /> Sell
          </button>
        </div>
      </div>
    </div>
  );
}

/** A Treasure socket drop target, `socket:<uid>:<index>`. */
function parseSocket(target: string | null): { uid: string; index: number } | null {
  if (!target?.startsWith('socket:')) return null;
  const cut = target.lastIndexOf(':');
  return { uid: target.slice(7, cut), index: Number(target.slice(cut + 1)) };
}

/** Shared drop resolution for all run screens. */
export function handleDrop(payload: DragPayload, target: string | null, clientX: number, clientY: number): void {
  const s = run.value!;
  const inShop = s.phase === 'shop';
  if (target === 'sell' && inShop) {
    if (payload.kind === 'hero' && s.roster.length <= 1) return void showToast('You cannot sell your last disciple', 'error');
    if (meta.peek().settings.confirmSell) {
      const hero = payload.kind === 'hero' ? heroByUid(s, payload.uid) : undefined;
      const label = payload.kind === 'hero' ? (hero ? HERO_BY_ID[hero.defId].name : 'this disciple') : (ITEM_BY_ID[payload.itemId]?.name ?? 'this Treasure');
      const value = payload.kind === 'hero' ? heroSellValue(s, payload.uid) : itemSellValue(payload.itemId);
      pendingSell.value = { payload, label, value };
      return;
    }
    sellNow(payload);
    return;
  }
  if (payload.kind === 'item') {
    // onto one socket of a disciple: that exact Treasure is replaced (or the empty socket filled)
    const socket = parseSocket(target);
    if (socket) {
      act((st) => {
        if (!equipItemAt(st, payload.itemId, socket.uid, socket.index, payload.fromHero)) showToast('Cannot equip', 'error');
      });
      audio.sfx('ui_equip');
      return;
    }
    if (target?.startsWith('hero:')) {
      const uid = target.slice(5);
      act((st) => {
        if (!equipItem(st, payload.itemId, uid, payload.fromHero)) showToast('Cannot equip', 'error');
      });
      audio.sfx('ui_equip');
      return;
    }
    if (target === 'inventory' && payload.fromHero) {
      act((st) => {
        if (!unequipItem(st, payload.itemId, payload.fromHero!)) showToast('Inventory is full', 'error');
      });
      audio.sfx('ui_drop');
      return;
    }
    // dropped onto the board: equip to the hero under the pointer
    const uidOnBoard = heroUnderPointer(clientX, clientY);
    if (uidOnBoard) {
      act((st) => {
        if (!equipItem(st, payload.itemId, uidOnBoard, payload.fromHero)) showToast('Cannot equip', 'error');
      });
      audio.sfx('ui_equip');
    }
    return;
  }
  // hero (a disciple dropped on another's Treasure socket counts as dropped on that disciple)
  const socketOwner = parseSocket(target);
  if (socketOwner) target = `hero:${socketOwner.uid}`;
  const lifted = payload.fromBoard ? getBattleView() : null;
  if (target?.startsWith('party:') || target?.startsWith('reserve:')) {
    const [kind, idx] = target.split(':');
    act((st) => moveHero(st, payload.uid, { kind: kind as 'party' | 'reserve', index: Number(idx) }));
    lifted?.dropLifted(null);
    audio.sfx('ui_drop');
    return;
  }
  if (target?.startsWith('hero:')) {
    const other = target.slice(5);
    if (other !== payload.uid) {
      act((st) => {
        const slot = findSlotOf(st, other);
        if (slot) moveHero(st, payload.uid, slot);
      });
      audio.sfx('ui_drop');
    }
    lifted?.dropLifted(null);
    return;
  }
  // board hex
  const d = toDesign(clientX, clientY);
  const hex = getBattleView().hexAtDesign(d.x, d.y);
  if (hex && isAllyZone(hex)) {
    act((st) => {
      if (!st.party.includes(payload.uid)) {
        const free = st.party.indexOf(null);
        if (free < 0) {
          showToast('Party is full', 'error');
          return;
        }
        moveHero(st, payload.uid, { kind: 'party', index: free });
      }
      setPosition(st, payload.uid, hex);
    });
    lifted?.dropLifted(hex);
    audio.sfx('ui_drop');
  } else {
    lifted?.dropLifted(null);
  }
}

export function hoverTarget(payload: DragPayload, clientX: number, clientY: number): string | null {
  const d = toDesign(clientX, clientY);
  const view = getBattleView();
  const hex = view.hexAtDesign(d.x, d.y);
  if (payload.kind === 'hero') {
    if (payload.fromBoard) {
      view.liftHero(payload.uid);
      view.moveLifted(d.x, d.y);
    }
    const ok = !!hex && isAllyZone(hex);
    view.setHighlight(hex, ok);
    return hex ? (ok ? 'board' : 'board-invalid') : null;
  }
  view.setHighlight(null);
  const uid = heroUnderPointer(clientX, clientY);
  return uid ? `hero:${uid}` : null;
}

function heroUnderPointer(clientX: number, clientY: number): string | null {
  const d = toDesign(clientX, clientY);
  return getBattleView().heroAtDesign(d.x, d.y);
}

function findSlotOf(s: RunState, uid: string): { kind: 'party' | 'reserve'; index: number } | null {
  const p = s.party.indexOf(uid);
  if (p >= 0) return { kind: 'party', index: p };
  const r = s.reserve.indexOf(uid);
  if (r >= 0) return { kind: 'reserve', index: r };
  return null;
}

// ───────────────────────── pause menu ─────────────────────────

function PauseMenu() {
  const s = run.value!;
  const [view, setView] = useState<'main' | 'settings' | 'abandon'>('main');
  const inBattle = s.phase === 'battle';
  // the fight holds still while the menu is open
  useEffect(() => {
    const v = getBattleView();
    v.setPaused(true);
    return () => v.setPaused(false);
  }, []);
  const close = () => (showMenu.value = false);
  if (view === 'settings') {
    return (
      <div class="modal-backdrop" onClick={close}>
        <div class="panel modal-panel pause-settings anim-pop" onClick={(e) => e.stopPropagation()}>
          <div class="pause-settings-head">
            <button class="btn small ghost" data-hotkey="back" onClick={() => setView('main')}>
              <Icon name="ui_back" size={20} /> Back
            </button>
            <div class="panel-title display">Settings</div>
            <div style={{ width: 96 }} />
          </div>
          <SettingsPanel inRun />
        </div>
      </div>
    );
  }
  return (
    <div class="modal-backdrop" onClick={close}>
      <div class="panel modal-panel pause-menu anim-pop" onClick={(e) => e.stopPropagation()}>
        <div class="pause-head">
          <span class="brush pause-glyph">停</span>
          <div class="panel-title display">Paused</div>
        </div>
        {view === 'abandon' ? (
          <div class="col pause-actions">
            <p class="muted pause-warning">Abandon this run? Your disciples, Treasures and Dao Insights are lost, and the run counts as a defeat.</p>
            <button
              class="btn danger"
              onClick={() => {
                audio.sfx('ui_confirm');
                close();
                concludeRun(false);
              }}
            >
              <Icon name="ui_skull" size={18} /> Abandon the run
            </button>
            <button class="btn ghost" data-hotkey="back" onClick={() => setView('main')}>
              Keep playing
            </button>
          </div>
        ) : (
          <div class="col pause-actions">
            <button class="btn primary big" onClick={close}>
              <Icon name="ui_proceed" size={20} /> Resume
            </button>
            <button class="btn" onClick={() => setView('settings')}>
              <Icon name="ui_settings" size={18} /> Settings
            </button>
            <button
              class="btn"
              disabled={inBattle}
              title={inBattle ? 'Available between fights' : undefined}
              onClick={() => {
                close();
                compendiumReturn.value = 'run';
                screen.value = 'compendium';
              }}
            >
              <Icon name="ui_compendium" size={18} /> Compendium
            </button>
            <button
              class="btn"
              onClick={() => {
                close();
                getBattleView().stopBattle();
                screen.value = 'menu';
              }}
            >
              <Icon name="ui_home" size={18} /> Save & return to menu
            </button>
            <button class="btn danger" onClick={() => setView('abandon')}>
              <Icon name="ui_skull" size={18} /> Abandon run
            </button>
            {isDesktop && (
              <button class="btn ghost" onClick={() => quitGame()}>
                <Icon name="ui_quit" size={18} /> Quit to desktop
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { ItemTip, itemQuestState, ITEM_BY_ID, STAT_COLOR, STAT_ICON };
