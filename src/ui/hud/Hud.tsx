import { signal } from '@preact/signals';
import { act, meta, run, screen, showToast, updateMeta } from '@/app/store';
import { DIFFICULTIES } from '@/content/difficulties';
import { HERO_BY_ID } from '@/content/heroes';
import { RELIC_BY_ID } from '@/content/relics';
import { ITEM_BY_ID } from '@/content/items';
import { heroItemSlots, type HeroState } from '@/core/builder';
import { equipItem, heroByUid, moveHero, relicDefs, sellHero, sellItem, teamContext, unequipItem, itemQuestState, type RunState, setPosition } from '@/core/run';
import { Icon, STAT_COLOR, STAT_ICON } from '@/ui/components/Icon';
import { RichText } from '@/ui/components/RichText';
import { tip } from '@/ui/components/Tooltip';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { ItemChip, ItemTip, RankGlyph, AbilityTip } from '@/ui/components/HeroCard';
import { drag, startDrag, type DragPayload } from '@/ui/drag';
import { getBattleView } from '@/battle/view/BattleView';
import { audio } from '@/audio/AudioManager';
import { toDesign } from '@/app/scale';
import { isAllyZone } from '@/battle/sim/hex';
import type { NodeKind } from '@/core/types';

/** Incremented a few times per second during battle so tracker panels refresh. */
export const battleTick = signal(0);
export const battleTime = signal(0);
export const battleSpeed = signal<1 | 2 | 3>(meta.value.settings.battleSpeed);
export const showMenu = signal(false);

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
    </>
  );
}

// ───────────────────────── top bar ─────────────────────────

function TopBar({ s }: { s: RunState }) {
  const diff = DIFFICULTIES[s.tier];
  const level = s.currentEncounter?.level ?? 0;
  const inBattle = s.phase === 'battle';
  const realmName = s.realm === 1 ? 'Azure Bamboo Province' : s.realm === 2 ? 'Blood Moon Abyss' : `Heavenly Ladder · Floor ${s.floor}`;
  return (
    <div class="topbar" data-tut="topbar">
      <div class="topbar-left">
        <div class="stones-pill big anim-pop" key={s.stones} {...tip(<><h4 class="gold">Spirit Stones</h4><p>Currency for disciples, Treasures and Dao Insights. Earned after every victory.</p></>)}>
          <Icon name="stones" size={22} color="var(--gold-bright)" /> {s.stones}
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
        {s.timeline.map((n, i) => {
          const state = i < s.nodeIndex ? 'done' : i === s.nodeIndex ? 'current' : 'future';
          return (
            <div key={i} class={`tl-node ${state} ${n.kind}`} {...tip(<><h4>{NODE_LABEL[n.kind]}</h4><div class="sub">Node {i + 1} of {s.timeline.length}</div></>, 'below')}>
              <Icon name={NODE_ICON[n.kind]} size={n.kind === 'boss' ? 22 : 16} />
            </div>
          );
        })}
      </div>
      <div class="topbar-right">
        <div class="trib-level" {...tip(<><h4>Tribulation Level {level}</h4><p>Enemy power at this node. Higher levels mean sturdier, deadlier foes.</p><p class="muted">Contract: {diff.name}</p></>, 'left')}>
          <Icon name="kw_enlightenment" size={20} color="var(--gold-bright)" />
          <span>{level}</span>
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
        <button class="speed-btn" onClick={() => (showMenu.value = true)} {...tip(<><h4>Menu</h4></>, 'left')}>
          <Icon name="ui_settings" size={16} />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── left rail: insights + inventory ─────────────────────────

function LeftRail({ s }: { s: RunState }) {
  const relics = relicDefs(s);
  const dragging = drag.value;
  const canDropItem = dragging?.payload.kind === 'item' && !!dragging.payload.fromHero;
  return (
    <div class="leftrail" data-tut="leftrail">
      <div class="rail-title">
        Dao Insights <span class="faint">{relics.length}</span>
      </div>
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
        {s.relics.length === 0 && <div class="faint rail-empty">No Dao Insights yet.</div>}
      </div>
      <div class="rail-title" style={{ marginTop: 14 }}>
        Treasures <span class="faint">{s.inventory.length}/{s.inventorySize}</span>
      </div>
      <div class={`inventory ${canDropItem ? 'drop-ok' : ''}`} data-drop="inventory">
        {Array.from({ length: s.inventorySize }).map((_, i) => {
          const itemId = s.inventory[i];
          return (
            <div key={i} class="inv-slot">
              {itemId && <ItemChip itemId={itemId} size={40} draggable onDragStart={(e) => startDrag({ kind: 'item', itemId }, e)} class="clickable" />}
            </div>
          );
        })}
      </div>
      <div class="faint rail-hint">Drag a Treasure onto a disciple to equip it.</div>
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
  const units = view.battle?.units.filter((u) => u.side === 'ally' && u.onBoard) ?? [];
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
      <div class="tracker-title display">{label}</div>
      {rows.length === 0 && <div class="faint" style={{ fontSize: 12 }}>Combat statistics appear here.</div>}
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
  return (
    <div class="bottombar" data-tut="party">
      <div class="bb-label display">
        Party <span class="faint">{s.party.filter(Boolean).length}/{s.partySize}</span>
      </div>
      <div class="slot-row">
        {s.party.map((uid, i) => (
          <HeroSlot key={`p${i}`} s={s} uid={uid} ctx={ctx} drop={`party:${i}`} dragging={dragging} />
        ))}
      </div>
      <div class="bb-divider" />
      <div class="slot-row">
        {s.reserve.map((uid, i) => (
          <HeroSlot key={`r${i}`} s={s} uid={uid} ctx={ctx} drop={`reserve:${i}`} dragging={dragging} reserve />
        ))}
      </div>
      <div class="bb-label display">
        Reserve <span class="faint">{s.reserve.filter(Boolean).length}/{s.reserveSize}</span>
      </div>
    </div>
  );
}

function HeroSlot({ s, uid, ctx, drop, dragging, reserve }: { s: RunState; uid: string | null; ctx: ReturnType<typeof teamContext>; drop: string; dragging: ReturnType<typeof drag.peek>; reserve?: boolean }) {
  const h = uid ? heroByUid(s, uid) : undefined;
  const def = h ? HERO_BY_ID[h.defId] : undefined;
  const over = dragging?.over === drop || (dragging?.over === `hero:${uid}` && !!uid);
  const acceptsHero = dragging?.payload.kind === 'hero';
  const acceptsItem = dragging?.payload.kind === 'item' && !!h;
  return (
    <div class={`hero-slot ${h ? 'filled' : 'empty'} ${over && (acceptsHero || acceptsItem) ? 'drop-ok' : ''} ${reserve ? 'reserve' : ''}`} data-drop={h ? `hero:${uid}` : drop}>
      {h && def && (
        <>
          <div class="slot-items">
            {Array.from({ length: heroItemSlots(h, ctx) }).map((_, i) => {
              const itemId = h.items[i];
              return (
                <div key={i} class="slot-item">
                  {itemId && <ItemChip itemId={itemId} size={26} draggable onDragStart={(e) => startDrag({ kind: 'item', itemId, fromHero: h.uid }, e)} />}
                </div>
              );
            })}
          </div>
          <div
            class="slot-portrait"
            onPointerDown={(e) => startDrag({ kind: 'hero', uid: h.uid }, e)}
            {...tip(<HeroSlotTip h={h} />, 'above')}
          >
            <MiniPortrait defId={h.defId} size={64} />
            <div class="slot-rank">
              <RankGlyph rank={h.rank} size={22} />
            </div>
            {reserve && <div class="slot-med" {...tip(<><h4 class="kw-Meditation">Reserve</h4><p>Only [Meditation] effects work from here.</p></>)}><Icon name="kw_meditation" size={12} /></div>}
          </div>
          <div class="slot-name">{def.name}</div>
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

function HeroSlotTip({ h }: { h: HeroState }) {
  const def = HERO_BY_ID[h.defId];
  return (
    <>
      <h4>
        {def.name} <span class="brush gold">{def.hanzi}</span>
      </h4>
      <div class="sub">{def.title}</div>
      <AbilityTip hero={h} />
      <p class="hint">Drag to the board, to the reserve, or onto the sell zone in the shop.</p>
    </>
  );
}

// ───────────────────────── drag ghost + drop logic ─────────────────────────

function DragGhost() {
  const d = drag.value;
  if (!d || !d.started) return null;
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

/** Shared drop resolution for all run screens. */
export function handleDrop(payload: DragPayload, target: string | null, clientX: number, clientY: number): void {
  const s = run.value!;
  const inShop = s.phase === 'shop';
  if (target === 'sell' && inShop) {
    if (payload.kind === 'hero') {
      if (s.roster.length <= 1) return void showToast('You cannot sell your last disciple', 'error');
      act((st) => sellHero(st, payload.uid));
      audio.sfx('ui_sell');
    } else {
      act((st) => sellItem(st, payload.itemId, payload.fromHero));
      audio.sfx('ui_sell');
    }
    return;
  }
  if (payload.kind === 'item') {
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
  // hero
  if (target?.startsWith('party:') || target?.startsWith('reserve:')) {
    const [kind, idx] = target.split(':');
    act((st) => moveHero(st, payload.uid, { kind: kind as 'party' | 'reserve', index: Number(idx) }));
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
    audio.sfx('ui_drop');
  }
}

export function hoverTarget(payload: DragPayload, clientX: number, clientY: number): string | null {
  const d = toDesign(clientX, clientY);
  const view = getBattleView();
  const hex = view.hexAtDesign(d.x, d.y);
  if (payload.kind === 'hero') {
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
  const m = meta.value;
  return (
    <div class="modal-backdrop" onClick={() => (showMenu.value = false)}>
      <div class="panel modal-panel anim-pop" onClick={(e) => e.stopPropagation()}>
        <div class="panel-title display">Paused</div>
        <div class="settings-row">
          <div class="settings-label display">Music</div>
          <input type="range" min={0} max={1} step={0.05} value={m.settings.music} onInput={(e) => updateMeta((mm) => (mm.settings.music = parseFloat((e.target as HTMLInputElement).value)))} />
        </div>
        <div class="settings-row">
          <div class="settings-label display">Sound</div>
          <input type="range" min={0} max={1} step={0.05} value={m.settings.sfx} onInput={(e) => updateMeta((mm) => (mm.settings.sfx = parseFloat((e.target as HTMLInputElement).value)))} />
        </div>
        <div class="col" style={{ marginTop: 18, gap: 10 }}>
          <button class="btn primary" onClick={() => (showMenu.value = false)}>
            Resume
          </button>
          <button
            class="btn ghost"
            onClick={() => {
              showMenu.value = false;
              getBattleView().stopBattle();
              screen.value = 'menu';
            }}
          >
            Save & return to menu
          </button>
        </div>
      </div>
    </div>
  );
}

export { ItemTip, itemQuestState, ITEM_BY_ID, STAT_COLOR, STAT_ICON };
