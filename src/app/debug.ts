import { screen, setRun } from './store';
import { addHero, draftPick, enterNode, newRun, resetItemQuests, equipItem, addItemToInventory } from '@/core/run';
import { HEROES } from '@/content/heroes';

/**
 * Developer shortcuts via URL query:
 *   ?demo            → a ready-made party of 5 on the board at node 1
 *   ?demo=boss       → same party, placed before the Realm I boss
 *   ?demo=<heroIds>  → comma-separated hero ids for the party
 */
export function applyDebugQuery(): boolean {
  const params = new URLSearchParams(location.search);
  if (!params.has('demo')) return false;
  const value = params.get('demo') ?? '';
  resetItemQuests();
  const s = newRun(0, 42);
  const ids = value && value !== 'boss' ? value.split(',').filter((id) => HEROES.some((h) => h.id === id)) : ['li_jian', 'shan_tie', 'hong_lian', 'mei_yao', 'ying_wu'];
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
  if (value === 'boss') s.nodeIndex = 11;
  enterNode(s);
  setRun(s);
  screen.value = 'run';
  return true;
}
