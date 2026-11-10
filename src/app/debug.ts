import { screen, setRun } from './store';
import {
  addHero,
  addItemToInventory,
  addRelic,
  battleConfig,
  beginRankUps,
  draftPick,
  enterNode,
  equipItem,
  finishBattle,
  newRun,
  openShop,
  queueRankUp,
  resetItemQuests,
  startBattle,
  type RunState,
} from '@/core/run';
import { HEROES } from '@/content/heroes';
import { RELICS } from '@/content/relics';
import { Battle } from '@/battle/sim/battle';
import { getBattleView } from '@/battle/view/BattleView';
import { viewport } from './scale';
import { run } from './store';

/**
 * Developer shortcuts via URL query (dev builds and QA):
 *   ?demo              → a ready-made party of 5 on the board at node 1
 *   ?demo=boss         → same party, placed before the Realm I boss
 *   ?demo=<heroIds>    → comma-separated hero ids for the party
 *   ?demo=event:<id>   → opens the given event (e.g. event:spirit_spring)
 *   ?demo=draft        → the opening draft
 *   ?demo=battle       → starts the first fight immediately
 *   ?demo=single       → board with the "choose your champion" trial panel
 *   ?demo=result       → battle-won result screen
 *   ?demo=defeat       → defeat screen with Time Reversal
 *   ?demo=shop         → the shop
 *   ?demo=rankup       → a breakthrough (Dao Path choice)
 *   ?demo=reward       → Dao Insight reward pick
 *   ?demo=challenge    → challenge offers
 *   ?demo=insight      → class Insight choice (rank 2 breakthrough)
 *   ?demo=cleared      → realm cleared
 *   &realm=1|2|3       → that realm's arena and foes (with any board scene; with boss, its guardian)
 *   &tier=0..7         → the demo run's contract (its battlefields and foes)
 *   ?demo=end          → run end (victory)
 */
export function applyDebugQuery(): boolean {
  const params = new URLSearchParams(location.search);
  // QA hooks on the window (dev builds only)
  if (import.meta.env.DEV) (window as unknown as { __nh: unknown }).__nh = { getBattleView, viewport, run };
  // ?noanim freezes CSS entrance animations so QA screenshots are deterministic
  if (params.has('noanim')) document.body.classList.add('no-anim');
  // ?screen=compendium|settings|credits|newRun|renown|sect jumps straight to a menu screen
  const scr = params.get('screen');
  if (scr === 'compendium' || scr === 'settings' || scr === 'credits' || scr === 'newRun' || scr === 'renown' || scr === 'sect') {
    screen.value = scr;
    return true;
  }
  if (!params.has('demo')) return false;
  const value = params.get('demo') ?? '';
  resetItemQuests();
  const tierParam = Number(params.get('tier') ?? 0);
  const s = newRun(Number.isInteger(tierParam) && tierParam >= 0 && tierParam <= 7 ? tierParam : 0, 42);
  if (value === 'draft') {
    setRun(s);
    screen.value = 'run';
    return true;
  }
  const eventId = value.startsWith('event:') ? value.slice(6) : null;
  const SCENES = new Set(['boss', 'battle', 'single', 'result', 'defeat', 'shop', 'rankup', 'insight', 'reward', 'challenge', 'cleared', 'end']);
  const ids = value && !SCENES.has(value) && !eventId ? value.split(',').filter((id) => HEROES.some((h) => h.id === id)) : ['li_jian', 'shan_tie', 'hong_lian', 'mei_yao', 'ying_wu'];
  draftPick(s, ids[0] ?? 'li_jian', 'wealth');
  s.currentEvent = null;
  s.pendingRankUps = [];
  s.rankUpChoices = null;
  for (const id of ids.slice(1)) addHero(s, id, 1);
  for (const h of s.roster) if (h.rank >= 1 && !h.daoPathId) h.daoPathId = HEROES.find((d) => d.id === h.defId)!.daoPaths[0].id;
  s.stones = 120;
  addItemToInventory(s, 'azure_sword_talisman');
  addItemToInventory(s, 'jade_vitality_pendant');
  equipItem(s, 'azure_sword_talisman', s.roster[0].uid);
  addRelic(s, RELICS[0].id);
  // the realm is set before the node is entered, so its foes (and the guardian) come from that realm
  const realm = Number(params.get('realm'));
  if (realm === 1 || realm === 2 || realm === 3) s.realm = realm;
  if (value === 'boss') s.nodeIndex = 11;
  if (eventId) {
    s.nodeIndex = 2;
    s.currentEvent = { eventId, outcome: null, chosen: null };
    s.phase = 'event';
  } else if (value === 'challenge') {
    s.nodeIndex = 3;
    s.timeline[s.nodeIndex].kind = 'challenge';
    enterNode(s);
  } else {
    enterNode(s);
    applyScene(s, value);
  }
  setRun(s);
  screen.value = 'run';
  return true;
}

function applyScene(s: RunState, scene: string): void {
  switch (scene) {
    case 'battle':
      startBattle(s);
      break;
    case 'single':
      s.fightReward = { actions: [], desc: 'An epic Treasure of your choice', single: true };
      break;
    case 'result':
    case 'defeat': {
      const cfg = battleConfig(s);
      if (!cfg) break;
      const r = new Battle(cfg).run();
      if (scene === 'defeat') {
        r.winner = 'enemy';
        r.survivors = 0;
      }
      finishBattle(s, r);
      break;
    }
    case 'shop':
      openShop(s);
      break;
    case 'rankup': {
      const h = s.roster[0];
      h.rank = 1;
      h.daoPathId = undefined;
      queueRankUp(s, h.uid);
      beginRankUps(s, 'board');
      break;
    }
    case 'insight': {
      const h = s.roster[0];
      h.rank = 2;
      h.daoPathId = HEROES.find((def) => def.id === h.defId)!.daoPaths[0].id;
      queueRankUp(s, h.uid);
      beginRankUps(s, 'board');
      break;
    }
    case 'reward':
      s.pendingReward = RELICS.slice(1, 4);
      s.phase = 'reward';
      break;
    case 'cleared':
      s.stats.wins = 12;
      s.stats.stonesEarned = 340;
      s.stats.damage = 48210;
      s.stats.bestHit = 1260;
      s.phase = 'realmCleared';
      break;
    case 'end':
      s.victory = true;
      s.realm = 2;
      s.stats.wins = 24;
      s.stats.fights = 26;
      s.stats.stonesEarned = 780;
      s.stats.damage = 180400;
      s.stats.bestHit = 3120;
      for (const h of s.roster) s.heroTotals[h.uid] = { dealt: 20000 + Math.random() * 30000, taken: 8000 + Math.random() * 9000, healed: Math.random() * 6000, kills: Math.floor(Math.random() * 20), crits: Math.floor(Math.random() * 60), bestHit: 800 + Math.random() * 2000, fights: 26 };
      // a sample run for the timeline: two realms of fights, one lost and reversed, ending on each guardian
      s.history = [];
      for (const realm of [1, 2]) {
        const kinds = ['fight', 'fight', 'event', 'elite', 'fight', 'challenge', 'fight', 'trial', 'fight', 'elite', 'fight', 'boss'];
        kinds.forEach((kind, node) => {
          if (kind === 'event') return;
          const foe = kind === 'boss' ? (realm === 1 ? 'flood_dragon' : 'blood_moon_sovereign') : kind === 'elite' ? (realm === 1 ? 'moss_golem' : 'demon_general') : realm === 1 ? 'bamboo_demon' : 'demon_soldier';
          const dealt = Math.round((1500 + node * 700) * realm * (kind === 'boss' ? 1.8 : 1));
          if (realm === 2 && node === 9) s.history!.push({ realm, floor: 0, node, kind, won: false, dealt: Math.round(dealt * 0.6), stones: 0, foe });
          s.history!.push({ realm, floor: 0, node, kind, won: true, dealt, stones: 8 + node, foe });
        });
      }
      s.phase = 'runEnd';
      break;
    default:
      break;
  }
}
