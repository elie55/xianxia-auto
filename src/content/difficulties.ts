import type { BlessingDef, DifficultyDef } from '@/core/types';

export const DIFFICULTIES: DifficultyDef[] = [
  { tier: 0, name: 'Mortal', short: '凡', hanzi: '凡', desc: 'The mortal realm. No modifiers.', mod: {} },
  { tier: 1, name: 'Qi Condensation', short: 'C', hanzi: '炼', desc: 'Disciples take 10% Max HP damage at the start of each combat.', mod: { startCombatHpLossPct: 10 } },
  { tier: 2, name: 'Foundation', short: 'B', hanzi: '筑', desc: 'Enemies have 20% more HP.', mod: { enemyHpPct: 20 } },
  { tier: 3, name: 'Golden Core', short: 'A', hanzi: '丹', desc: 'Earn 1 fewer Spirit Stone per surviving disciple.', mod: { stonesPerSurvivorDelta: -1 } },
  { tier: 4, name: 'Nascent Soul', short: 'S', hanzi: '婴', desc: 'Disciples can only equip 1 Treasure per rank.', mod: { itemSlotsPerRank: true } },
  { tier: 5, name: 'Soul Formation', short: 'SS', hanzi: '化', desc: 'Enemies deal 15% more damage.', mod: { enemyDamagePct: 15 } },
  { tier: 6, name: 'Void Refinement', short: 'SSS', hanzi: '虚', desc: 'Shop prices are 20% higher.', mod: { shopPricePct: 20 } },
  { tier: 7, name: 'Heavenly Tribulation', short: '劫', hanzi: '劫', desc: 'Tribulation lightning begins at 40 s. Bosses are empowered.', mod: { tribulationAt: 40, bossExtraAbility: true } },
];

export const BLESSINGS: BlessingDef[] = [
  { id: 'quality', name: 'Quality over Quantity', desc: 'Disciples can equip [2] additional Treasures (max 5). Max party size is decreased by 1.', icon: 'blessing_quality', apply: 'quality' },
  { id: 'stability', name: 'Stability System', desc: 'Time Reversal costs [25 fewer] Spirit Stones.', icon: 'blessing_stability', apply: 'stability' },
  { id: 'bazaar', name: 'Treasure Bazaar', desc: 'The shop shows an additional Dao Insight.', icon: 'blessing_bazaar', apply: 'bazaar' },
  { id: 'wealth', name: 'Hidden Fortune', desc: 'Start with [+20 Spirit Stones].', icon: 'blessing_wealth', apply: 'wealth' },
  { id: 'scholar', name: 'Sect Scholar', desc: 'Your first disciple starts at [Foundation] rank.', icon: 'blessing_scholar', apply: 'scholar' },
  { id: 'warrior', name: 'Battle Hardened', desc: 'All disciples gain [+5% Attack] and [+5% Spirit] permanently.', icon: 'blessing_warrior', apply: 'warrior' },
];
