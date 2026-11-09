import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { meta, run, screen, updateMeta } from '@/app/store';
import { DESIGN_H, DESIGN_W, toDesign } from '@/app/scale';
import { getBattleView } from '@/battle/view/BattleView';
import { audio } from '@/audio/AudioManager';

/**
 * First-run tutorial: short chapters tied to run phases. Each step spotlights a HUD element
 * (via a `data-tut` attribute or a custom design-space rect) and explains it in a card.
 * The dimmed area is only a shadow, so the game stays fully interactive while a step is shown.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TutStep {
  id: string;
  title: string;
  text: string;
  /** `data-tut` value of the element to spotlight. */
  target?: string;
  /** Custom spotlight in design space (e.g. the ally half of the arena). */
  rect?: () => Rect | null;
  placement?: 'left' | 'right' | 'above' | 'below' | 'center';
  glyph?: string;
}

export interface TutChapter {
  id: string;
  /** Run phase(s) that trigger this chapter the first time they appear. */
  phases: string[];
  steps: TutStep[];
}

export const CHAPTERS: TutChapter[] = [
  {
    id: 'draft',
    phases: ['chooseHero'],
    steps: [
      {
        id: 'draft-cards',
        target: 'draft-cards',
        placement: 'right',
        glyph: '择',
        title: 'Choose your first disciple',
        text: 'Three wandering cultivators seek a sect. Hover a card to read their stats, class and ability. Classes are roles, not rules: a healer can become your tank.',
      },
      {
        id: 'draft-blessings',
        target: 'draft-blessings',
        placement: 'above',
        glyph: '福',
        title: 'Starting Blessing',
        text: 'A Blessing shapes the whole run: extra Treasure slots, cheaper Time Reversal, a richer start… Pick the one that suits your plan.',
      },
      {
        id: 'draft-accept',
        target: 'draft-accept',
        placement: 'above',
        glyph: '拜',
        title: 'Accept into the sect',
        text: 'With a disciple and a Blessing chosen, accept them. If none suits you, reroll the disciples for one Spirit Stone.',
      },
    ],
  },
  {
    id: 'event',
    phases: ['event'],
    steps: [
      {
        id: 'event-choices',
        target: 'event-choices',
        placement: 'left',
        glyph: '缘',
        title: 'Encounters on the road',
        text: 'Events offer choices with rewards and risks. Some need a disciple to volunteer; some lead into a fight. The outcome is revealed right away.',
      },
    ],
  },
  {
    id: 'board',
    phases: ['board'],
    steps: [
      {
        id: 'board-zone',
        rect: () => (getBattleView().isReady.value ? getBattleView().allyZoneDesign() : null),
        placement: 'right',
        glyph: '阵',
        title: 'Your side of the arena',
        text: 'Drag disciples onto the jade hexes. Put melee fighters in the front hexes and ranged cultivators behind them. The enemy formation waits on the far side.',
      },
      {
        id: 'board-party',
        target: 'party',
        placement: 'above',
        glyph: '队',
        title: 'Party and Reserve',
        text: 'Disciples in the Party fight. The Reserve sits out — only Meditation effects work from there. Drag portraits between slots, onto the board, or onto each other to swap.',
      },
      {
        id: 'board-topbar',
        target: 'topbar',
        placement: 'below',
        glyph: '灵',
        title: 'Spirit Stones, timeline, Tribulation',
        text: 'Spirit Stones buy disciples and Treasures. The timeline shows what lies ahead: fights, elites, events and the Realm Guardian. The Tribulation Level is how strong the enemies are.',
      },
      {
        id: 'board-rail',
        target: 'leftrail',
        placement: 'right',
        glyph: '宝',
        title: 'Treasures and Dao Insights',
        text: 'Treasures are equipped by dragging them onto a disciple (slots grow with rank). Dao Insights are relics that buff the whole sect or unlock quests.',
      },
      {
        id: 'board-fight',
        target: 'fight',
        placement: 'left',
        glyph: '战',
        title: 'Fight',
        text: 'When the formation is ready, fight. Battles resolve on their own — your decisions happen between them. AUTO starts fights as soon as the board is ready.',
      },
    ],
  },
  {
    id: 'battle',
    phases: ['battle'],
    steps: [
      {
        id: 'battle-speed',
        target: 'speed',
        placement: 'below',
        glyph: '速',
        title: 'Watching the fight',
        text: 'Attacks fill Qi; at full Qi a disciple casts their ability. Hover any fighter to inspect them. Use the speed buttons to pace the fight.',
      },
      {
        id: 'battle-timer',
        target: 'timer',
        placement: 'below',
        glyph: '劫',
        title: 'Heavenly Tribulation',
        text: 'If a fight lasts 50 seconds, Tribulation lightning begins striking everyone on the field. Build formations that win quickly.',
      },
      {
        id: 'battle-tracker',
        target: 'tracker',
        placement: 'left',
        glyph: '录',
        title: 'Damage tracker',
        text: 'See who deals damage, who takes it and who heals. Use it to decide which disciples deserve rank-ups and Treasures.',
      },
    ],
  },
  {
    id: 'result',
    phases: ['result'],
    steps: [
      {
        id: 'result-rewards',
        target: 'rewards',
        placement: 'left',
        glyph: '赏',
        title: 'Spoils of victory',
        text: 'Each win pays Spirit Stones plus a bonus per surviving disciple. Treasure and Insight quests pay extra when their conditions are met.',
      },
    ],
  },
  {
    id: 'shop',
    phases: ['shop'],
    steps: [
      {
        id: 'shop-cards',
        target: 'shop-cards',
        placement: 'left',
        glyph: '募',
        title: 'Recruit disciples',
        text: 'Buy disciples to fill your party. Buying a copy of a disciple you already own ranks them up — a breakthrough that unlocks a Dao Path or a new Insight.',
      },
      {
        id: 'shop-left',
        target: 'shop-left',
        placement: 'right',
        glyph: '宝',
        title: 'Treasures and Dao Insights',
        text: 'Treasures equip onto one disciple; Insights strengthen the whole sect. Rarer offers cost more — and sales appear now and then.',
      },
      {
        id: 'shop-toolbar',
        target: 'shop-toolbar',
        placement: 'below',
        glyph: '市',
        title: 'Reroll, freeze, sell',
        text: 'Reroll for new offers (the price rises each time), freeze to keep them for the next shop, and drag anything onto the sell zone for stones.',
      },
    ],
  },
  {
    id: 'rankup',
    phases: ['rankUp'],
    steps: [
      {
        id: 'rankup-choice',
        target: 'upgrade-row',
        placement: 'above',
        glyph: '悟',
        title: 'Breakthrough',
        text: 'Reaching Foundation grants a Dao Path that reshapes the disciple — some even add a second class. Later ranks grant Insights drawn from their classes.',
      },
    ],
  },
  {
    id: 'defeat',
    phases: ['defeat'],
    steps: [
      {
        id: 'defeat-rewind',
        target: 'fate',
        placement: 'left',
        glyph: '逆',
        title: 'Time Reversal',
        text: 'Defeat is not the end. Spend Spirit Stones on a Time Reversal Talisman to unwind the fight and try a new formation. Each use costs more — keep a reserve.',
      },
    ],
  },
];

export const tutorial = signal<{ chapter: TutChapter; index: number } | null>(null);

function seen(): string[] {
  return meta.value.tutorialSeen ?? [];
}

function markSeen(id: string): void {
  if (seen().includes(id)) return;
  updateMeta((m) => {
    m.tutorialSeen = [...(m.tutorialSeen ?? []), id];
  });
}

export function startChapter(chapter: TutChapter): void {
  tutorial.value = { chapter, index: 0 };
}

export function nextStep(): void {
  const t = tutorial.value;
  if (!t) return;
  audio.sfx('ui_click');
  if (t.index + 1 >= t.chapter.steps.length) {
    markSeen(t.chapter.id);
    tutorial.value = null;
  } else tutorial.value = { chapter: t.chapter, index: t.index + 1 };
}

export function skipTutorial(): void {
  const t = tutorial.value;
  if (t) markSeen(t.chapter.id);
  updateMeta((m) => {
    m.tutorialDisabled = true;
  });
  tutorial.value = null;
  audio.sfx('ui_back');
}

export function resetTutorial(): void {
  updateMeta((m) => {
    m.tutorialSeen = [];
    m.tutorialDisabled = false;
  });
}

/** Watches the run phase and opens the matching chapter the first time it appears. */
export function useTutorialDriver(): void {
  const scr = screen.value;
  const phase = run.value?.phase ?? null;
  useEffect(() => {
    const t = tutorial.value;
    // leaving the phase closes the chapter (and counts it as seen so it does not nag)
    if (t && (scr !== 'run' || !phase || !t.chapter.phases.includes(phase))) {
      markSeen(t.chapter.id);
      tutorial.value = null;
    }
    if (scr !== 'run' || !phase || meta.value.tutorialDisabled || new URLSearchParams(location.search).has('notut')) return;
    const chapter = CHAPTERS.find((c) => c.phases.includes(phase) && !seen().includes(c.id));
    if (!chapter) return;
    const timer = setTimeout(() => {
      if (run.value?.phase === phase && screen.value === 'run' && !tutorial.value) startChapter(chapter);
    }, 700);
    return () => clearTimeout(timer);
  }, [scr, phase]);
}

function measure(step: TutStep): Rect | null {
  if (step.rect) return step.rect();
  if (!step.target) return null;
  const el = document.querySelector(`[data-tut="${step.target}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const tl = toDesign(r.left, r.top);
  const br = toDesign(r.right, r.bottom);
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

export function TutorialLayer() {
  const t = tutorial.value;
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!t) {
      setRect(null);
      return;
    }
    const step = t.chapter.steps[t.index];
    let raf = 0;
    let last = '';
    const tick = () => {
      const r = measure(step);
      const key = r ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : '';
      if (key !== last) {
        last = key;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [t]);
  if (!t) return null;
  const step = t.chapter.steps[t.index];
  const pad = 12;
  const hole = rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
  const cardW = 420;
  const cardH = 230;
  let left = DESIGN_W / 2 - cardW / 2;
  let top = DESIGN_H / 2 - cardH / 2;
  const placement = hole ? (step.placement ?? 'below') : 'center';
  if (hole) {
    const gap = 26;
    switch (placement) {
      case 'right':
        left = hole.x + hole.w + gap;
        top = hole.y + hole.h / 2 - cardH / 2;
        break;
      case 'left':
        left = hole.x - cardW - gap;
        top = hole.y + hole.h / 2 - cardH / 2;
        break;
      case 'above':
        left = hole.x + hole.w / 2 - cardW / 2;
        top = hole.y - cardH - gap;
        break;
      case 'below':
        left = hole.x + hole.w / 2 - cardW / 2;
        top = hole.y + hole.h + gap;
        break;
      default:
        break;
    }
  }
  left = Math.max(24, Math.min(DESIGN_W - cardW - 24, left));
  top = Math.max(24, Math.min(DESIGN_H - cardH - 24, top));
  const total = t.chapter.steps.length;
  return (
    <div class="tut-layer">
      {hole ? <div class="tut-hole" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} /> : <div class="tut-dim" />}
      {hole && step.glyph && <div class="tut-pulse-glyph" style={{ left: hole.x + hole.w - 22, top: hole.y - 40 }}>{step.glyph}</div>}
      <div class="tut-card panel" style={{ left, top }}>
        <div class="tut-step display">
          Tutorial · {t.index + 1} / {total}
        </div>
        <div class="tut-title display">{step.title}</div>
        <div class="tut-text">{step.text}</div>
        <div class="tut-actions">
          <button class="tut-skip" onClick={skipTutorial}>
            Skip tutorial
          </button>
          <button class="btn small primary" onClick={nextStep}>
            {t.index + 1 >= total ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
