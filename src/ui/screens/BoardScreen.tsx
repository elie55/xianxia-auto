import { useEffect, useRef } from 'preact/hooks';
import { act, meta, run, showToast } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import { baseWinStones, battleConfig, finishBattle, heroByUid, startBattle, teamContext, type RunState } from '@/core/run';
import { heroAbility, heroStats } from '@/core/builder';
import { ENEMY_BY_ID } from '@/content/enemies';
import { getBattleView } from '@/battle/view/BattleView';
import { Hud, HeroSlotTip, battleSpeed, battleTick, battleTime, handleDrop, hoverTarget } from '@/ui/hud/Hud';
import { drag, setDropHandlers, startDrag } from '@/ui/drag';
import { hideTooltip, showTooltipAtDesign, tip } from '@/ui/components/Tooltip';
import { UnitTip } from '@/ui/components/UnitTip';
import { Icon, STAT_COLOR, STAT_ICON } from '@/ui/components/Icon';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { HERO_BY_ID } from '@/content/heroes';
import { audio } from '@/audio/AudioManager';
import { BossBar, BossIntro } from '@/ui/hud/Boss';
import { toDesign } from '@/app/scale';

/** Keeps the Pixi arena in sync with the run state. Used by every run phase that shows the board. */
export function useArena(s: RunState): void {
  const view = getBattleView();
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void view.mount(document.getElementById('pixi-root')!).then(() => view.setRealm(s.realm));
    setDropHandlers(handleDrop, hoverTarget);
    return () => setDropHandlers(null, null);
  }, []);
  useEffect(() => {
    void view.setRealm(s.realm);
  }, [s.realm]);
  useEffect(() => {
    if (s.phase === 'battle') return;
    const cfg = battleConfig(s);
    if (cfg) view.updatePlacement(cfg.allies, cfg.enemies);
    else view.updatePlacement(battleConfigAlliesOnly(s), []);
    view.setHighlight(null);
  }, [s]);
}

function battleConfigAlliesOnly(s: RunState) {
  // no encounter (events): still show the party standing on the board
  const fake = { ...s, currentEncounter: { id: 'none', label: '', enemies: [], level: 0, kind: 'fight' as const } };
  return battleConfig(fake)?.allies ?? [];
}

export function BoardScreen() {
  const s = run.value!;
  useArena(s);
  const view = getBattleView();
  const isBattle = s.phase === 'battle';
  const single = !!s.fightReward?.single;
  const canFight = !single || !!s.singleChampion;
  const rootRef = useRef<HTMLDivElement>(null);

  // start the simulation when entering the battle phase
  useEffect(() => {
    if (!isBattle) return;
    const cfg = battleConfig(s);
    if (!cfg) return;
    const battle = new Battle(cfg);
    let lastTick = -1;
    view.onTime = (t) => {
      battleTime.value = t;
      // live HUD (damage meter, unit tooltips) refreshes 10 times per second of fight time
      const q = Math.floor(t * 10);
      if (q !== lastTick) {
        lastTick = q;
        battleTick.value++;
      }
    };
    view.onEnd = (r) => {
      view.onEnd = null;
      act((st) => finishBattle(st, r));
    };
    view.startBattle(battle, battleSpeed.value);
    battleTick.value++; // the meter switches to the new fight at once
    audio.playMusic(s.currentEncounter?.kind === 'boss' ? 'boss' : 'battle');
    audio.sfx('fight_start');
    return () => {
      view.onTime = null;
    };
  }, [isBattle]);

  // auto start
  useEffect(() => {
    if (s.phase === 'board' && meta.value.settings.autoBattle && canFight) {
      const t = setTimeout(() => act((st) => startBattle(st)), 900);
      return () => clearTimeout(t);
    }
  }, [s.phase, canFight]);

  useEffect(() => {
    if (s.phase === 'board') audio.playMusic(s.realm === 2 ? 'realm2shop' : 'shop');
  }, [s.phase]);

  // drag heroes directly from the canvas; hover any unit for a live tooltip
  const ready = view.isReady.value;
  useEffect(() => {
    if (!ready) return;
    const canvas = view.canvasEl;
    const surface = rootRef.current;
    if (!canvas || !surface) return;
    // the screen root sits above the canvas and receives its pointer events; ignore events on HUD children
    const onArena = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t === surface || !!t.closest('#pixi-root'));
    };
    let hovered: number | null = null;
    const down = (e: PointerEvent) => {
      if (isBattle || !onArena(e)) return;
      const d = toDesign(e.clientX, e.clientY);
      const uid = view.heroAtDesign(d.x, d.y);
      if (uid) {
        hovered = null;
        hideTooltip();
        startDrag({ kind: 'hero', uid, fromBoard: true }, e);
      }
    };
    const move = (e: PointerEvent) => {
      if (drag.value) {
        hovered = null;
        return;
      }
      const d = toDesign(e.clientX, e.clientY);
      const u = onArena(e) ? view.unitAtDesign(d.x, d.y) : null;
      if (!u) {
        if (hovered !== null) {
          hovered = null;
          hideTooltip();
        }
        surface.style.cursor = '';
        return;
      }
      surface.style.cursor = u.side === 'ally' && !isBattle ? 'grab' : 'default';
      const head = view.unitHeadDesign(u.id);
      if (!head) return;
      if (u.id !== hovered || isBattle) {
        hovered = u.id;
        showTooltipAtDesign(head.x, head.y, <UnitTip unit={u} />, 'above');
      }
    };
    const leave = () => {
      hovered = null;
      surface.style.cursor = '';
      hideTooltip();
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerleave', leave);
    return () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerleave', leave);
      hideTooltip();
    };
  }, [isBattle, ready]);

  const enc = s.currentEncounter;
  return (
    <div class="screen board-screen" ref={rootRef}>
      <Hud>
        {!isBattle && enc && (
          <div class={`encounter-banner v2 kind-${enc.kind} anim-rise`}>
            <div class="enc-kind">{enc.kind === 'boss' ? 'REALM GUARDIAN' : enc.kind === 'elite' ? 'ELITE ENCOUNTER' : enc.kind === 'single' ? 'HEAVENLY TRIAL' : s.activeChallenge ? `CHALLENGE: ${s.activeChallenge.name.toUpperCase()}` : 'ENCOUNTER'}</div>
            <div class="enc-name display">{foeTitle(enc)}</div>
            <div class="enc-foes">
              {foeGroups(enc).map((g) => (
                <span key={g.id} class={`enc-foe ${ENEMY_BY_ID[g.id]?.boss ? 'boss' : ENEMY_BY_ID[g.id]?.elite ? 'elite' : ''}`} {...tip(<><h4>{ENEMY_BY_ID[g.id]?.name}</h4><p>{g.n > 1 ? `${g.n} of them in this fight.` : 'One in this fight.'}</p></>, 'below')}>
                  <img src={`./assets/art/sprites/${ENEMY_BY_ID[g.id]?.sprite ?? g.id}.png`} alt="" draggable={false} />
                  {g.n > 1 && <b>×{g.n}</b>}
                </span>
              ))}
            </div>
            {s.activeChallenge && <div class="enc-mod">{s.activeChallenge.desc}</div>}
            <div class="enc-mod gold">
              <Icon name="stones" size={16} /> {encounterReward(s, enc.kind)}
            </div>
          </div>
        )}
        {!isBattle && single && (
          <div class="champion-panel panel anim-pop">
            <div class="panel-title display">Choose your champion</div>
            <div class="muted" style={{ fontSize: 14, marginBottom: 10 }}>
              One disciple faces the creature alone.
            </div>
            <div class="row" style={{ gap: 12 }}>
              {s.roster.map((h) => {
                const st = heroStats(h, teamContext(s), null);
                return (
                  <button key={h.uid} class={`champion-pick v2 ${s.singleChampion === h.uid ? 'on' : ''}`} onClick={() => act((st2) => (st2.singleChampion = h.uid))} {...tip(<HeroSlotTip h={h} s={s} ctx={teamContext(s)} hint={false} />, 'below')}>
                    <MiniPortrait defId={h.defId} size={64} />
                    <span class="pick-name">{HERO_BY_ID[h.defId].name}</span>
                    <span class="pick-stats">
                      <span style={{ color: STAT_COLOR.hp }}>
                        <Icon name={STAT_ICON.hp} size={14} /> {Math.round(st.hp)}
                      </span>
                      <span style={{ color: STAT_COLOR.attack }}>
                        <Icon name={STAT_ICON.attack} size={14} /> {Math.round(st.attack)}
                      </span>
                    </span>
                    <span class="pick-ability">{heroAbility(h).name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!isBattle && (
          <div class="board-actions">
            <div class="faint board-hint">Drag disciples onto the jade hexes · front row for melee, back row for ranged</div>
            <button
              class="btn primary big fight-btn"
              data-tut="fight"
              data-hotkey="fight"
              {...tip(<><h4>Fight <kbd class="keycap">Space</kbd></h4><p>Starts the battle. It resolves on its own; your choices happen between fights.</p>{single && <p class="muted">A Heavenly Trial: pick one champion first.</p>}</>, 'above')}
              disabled={!canFight || s.party.filter(Boolean).length === 0}
              onClick={() => {
                if (s.party.filter(Boolean).length === 0 && !single) return void showToast('Place at least one disciple', 'error');
                audio.sfx('ui_confirm');
                act((st) => startBattle(st));
              }}
            >
              <span class="btn-glyph">战</span> Fight
            </button>
          </div>
        )}
        {isBattle && <BattleTimer />}
        {isBattle && enc?.kind === 'boss' && <BossBar s={s} />}
        {!isBattle && enc?.kind === 'boss' && <BossIntro key={enc.id} s={s} />}
      </Hud>
    </div>
  );
}

function BattleTimer() {
  const t = battleTime.value;
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  const trib = t >= 50;
  return (
    <div class={`battle-timer ${trib ? 'trib' : ''}`} data-tut="timer">
      <Icon name="kw_enlightenment" size={16} />
      {mm.toString().padStart(2, '0')}:{ss.toString().padStart(2, '0')}
    </div>
  );
}

export function heroName(s: RunState, uid: string): string {
  const h = heroByUid(s, uid);
  return h ? HERO_BY_ID[h.defId].name : '';
}

/** Foes of an encounter grouped by kind, toughest first. */
function foeGroups(enc: { enemies: { defId: string }[] }): { id: string; n: number }[] {
  const m = new Map<string, number>();
  for (const e of enc.enemies) m.set(e.defId, (m.get(e.defId) ?? 0) + 1);
  const rank = (id: string) => (ENEMY_BY_ID[id]?.boss ? 3 : ENEMY_BY_ID[id]?.elite ? 2 : 1);
  return [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => rank(b.id) - rank(a.id) || b.n - a.n);
}

/** "Flood Dragon of the Jade River", or "3 Bamboo Demons · 2 Blood Bats". */
function foeTitle(enc: { enemies: { defId: string }[]; label: string }): string {
  const groups = foeGroups(enc);
  const top = ENEMY_BY_ID[groups[0]?.id];
  if (!top) return enc.label;
  if (top.boss || (top.elite && groups[0].n === 1)) return top.name;
  return groups
    .slice(0, 2)
    .map((g) => (g.n > 1 ? `${g.n} ${plural(ENEMY_BY_ID[g.id]?.name ?? g.id)}` : ENEMY_BY_ID[g.id]?.name ?? g.id))
    .join(' · ');
}

function plural(name: string): string {
  return /s$/.test(name) ? name : name.replace(/(\w+)$/, (w) => (/[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's'));
}

/** What winning this fight pays. */
function encounterReward(s: RunState, kind: string): string {
  const stones = baseWinStones(s);
  if (s.fightReward?.desc) return `Reward: ${s.fightReward.desc}`;
  if (s.activeChallenge) return `Reward: ${s.activeChallenge.rewardDesc}`;
  if (kind === 'boss') return 'Seal the rift and ascend';
  if (kind === 'elite') return `${stones} Spirit Stones and a choice of epic Dao Insights`;
  return `${stones} Spirit Stones, +1 per surviving disciple`;
}
