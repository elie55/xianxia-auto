import { signal } from '@preact/signals';
import { Assets } from 'pixi.js';
import { HEROES } from '@/content/heroes';
import { ENEMIES } from '@/content/enemies';
import { loadSpritePack } from '@/battle/view/SpritePack';
import { FLIPBOOK_SHEETS } from '@/battle/view/BattleView';

/** Progress of the start-up preload that the loading veil shows. */
export const preload = signal({ done: 0, total: 1, finished: false });

/** Paintings and UI art shown by DOM screens (warm the HTTP cache so screens never pop in). */
const ART = [
  'art/ui/logo.webp',
  'art/bg/menu_keyart2.jpg',
  'art/ui/button_dark.png',
  'art/ui/button_dark_9.png',
  'art/bg/ui_hall.jpg',
  'art/bg/ui_draft.jpg',
  'art/bg/ui_breakthrough.jpg',
  'art/bg/ui_victory.jpg',
  'art/bg/ui_defeat.jpg',
  'art/bg/realm1_bamboo.jpg',
  'art/bg/realm2_abyss.jpg',
  'art/bg/realm3_ladder.jpg',
  'art/ui/frame_ornate.png',
  'art/ui/button_jade.png',
  'art/ui/button_jade_9.png',
  'art/ui/button_gold.png',
  'art/ui/button_gold_9.png',
  'art/ui/button_red_9.png',
  'art/ui/fallen_skull.webp',
];

function image(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Loads the paintings, portraits, flipbook sheets and every sprite pack behind the loading veil.
 * The veil lifts when everything is in (at least ~0.9 s so the seal registers) or after 9 s at most;
 * loading simply continues in the background after that. `skipVeil` (QA URLs) lifts it at once.
 */
export function startPreload(skipVeil: boolean): void {
  const tasks: (() => Promise<unknown>)[] = [];
  for (const a of ART) tasks.push(() => image(`./assets/${a}`));
  for (const h of HEROES) tasks.push(() => image(`./assets/art/heroes/${h.portrait ?? h.id}/portrait.png`));
  for (const n of FLIPBOOK_SHEETS) tasks.push(() => Assets.load(`./assets/art/fx/${n}.jpg`).catch(() => null));
  const packs = new Set<string>([...HEROES.map((h) => h.sprite ?? h.id), ...ENEMIES.map((e) => e.sprite)]);
  for (const id of packs) tasks.push(() => loadSpritePack(id));

  preload.value = { done: 0, total: tasks.length, finished: skipVeil };
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task().catch(() => null);
      done++;
      preload.value = { ...preload.value, done };
    }
  };
  const all = Promise.all(Array.from({ length: 6 }, worker));
  const minShow = new Promise((r) => setTimeout(r, 900));
  const maxWait = new Promise((r) => setTimeout(r, 9000));
  void Promise.race([Promise.all([all, minShow]), maxWait]).then(() => {
    preload.value = { ...preload.value, finished: true };
  });
}
