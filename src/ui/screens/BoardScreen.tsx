import { useEffect, useRef } from 'preact/hooks';
import { act, meta, run, showToast } from '@/app/store';
import { Battle } from '@/battle/sim/battle';
import { battleConfig, finishBattle, heroByUid, startBattle, type RunState } from '@/core/run';
import { getBattleView } from '@/battle/view/BattleView';
import { Hud, battleSpeed, battleTick, battleTime, handleDrop, hoverTarget } from '@/ui/hud/Hud';
import { setDropHandlers, startDrag } from '@/ui/drag';
import { Icon } from '@/ui/components/Icon';
import { MiniPortrait } from '@/ui/components/MiniPortrait';
import { HERO_BY_ID } from '@/content/heroes';
import { audio } from '@/audio/AudioManager';
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

  // start the simulation when entering the battle phase
  useEffect(() => {
    if (!isBattle) return;
    const cfg = battleConfig(s);
    if (!cfg) return;
    const battle = new Battle(cfg);
    let lastTick = -1;
    view.onTime = (t) => {
      battleTime.value = t;
      const q = Math.floor(t * 4);
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

  // drag heroes directly from the canvas
  useEffect(() => {
    if (isBattle) return;
    const canvas = view.app.canvas as HTMLCanvasElement | undefined;
    if (!canvas) return;
    const down = (e: PointerEvent) => {
      const d = toDesign(e.clientX, e.clientY);
      const uid = view.heroAtDesign(d.x, d.y);
      if (uid) startDrag({ kind: 'hero', uid }, e);
    };
    canvas.addEventListener('pointerdown', down);
    return () => canvas.removeEventListener('pointerdown', down);
  }, [isBattle, view.app.canvas]);

  const enc = s.currentEncounter;
  return (
    <div class="screen board-screen">
      <Hud>
        {!isBattle && enc && (
          <div class="encounter-banner anim-rise">
            <div class="enc-kind">{enc.kind === 'boss' ? 'REALM GUARDIAN' : enc.kind === 'elite' ? 'ELITE ENCOUNTER' : enc.kind === 'single' ? 'HEAVENLY TRIAL' : s.activeChallenge ? `CHALLENGE: ${s.activeChallenge.name.toUpperCase()}` : 'REGULAR ENCOUNTER'}</div>
            <div class="enc-name display">{enc.label}</div>
            {s.activeChallenge && <div class="enc-mod">{s.activeChallenge.desc}</div>}
            {s.fightReward?.desc && <div class="enc-mod gold">Reward: {s.fightReward.desc}</div>}
          </div>
        )}
        {!isBattle && single && (
          <div class="champion-panel panel anim-pop">
            <div class="panel-title display">Choose your champion</div>
            <div class="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              One disciple faces the creature alone.
            </div>
            <div class="row" style={{ gap: 12 }}>
              {s.roster.map((h) => (
                <button key={h.uid} class={`champion-pick ${s.singleChampion === h.uid ? 'on' : ''}`} onClick={() => act((st) => (st.singleChampion = h.uid))}>
                  <MiniPortrait defId={h.defId} size={56} />
                  <span>{HERO_BY_ID[h.defId].name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!isBattle && (
          <div class="board-actions">
            <div class="faint board-hint">Drag disciples onto the jade hexes · front row for melee, back row for ranged</div>
            <button
              class="btn primary big fight-btn"
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
    <div class={`battle-timer ${trib ? 'trib' : ''}`}>
      <Icon name="kw_enlightenment" size={16} />
      {mm.toString().padStart(2, '0')}:{ss.toString().padStart(2, '0')}
    </div>
  );
}

export function heroName(s: RunState, uid: string): string {
  const h = heroByUid(s, uid);
  return h ? HERO_BY_ID[h.defId].name : '';
}
