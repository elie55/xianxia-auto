import type { DamageKind, Hex, Side, StatKey, StatusKind } from '@/core/types';

export interface UnitSnapshot {
  id: number;
  side: Side;
  defId: string;
  name: string;
  hanzi?: string;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  shield: number;
  pos: Hex | null;
  sprite: string;
  scale: number;
  accent?: string;
  boss: boolean;
  elite: boolean;
  portrait?: string;
  heroUid?: string;
  rank: number;
  isRanged: boolean;
}

export type BattleEvent =
  | { t: number; type: 'spawn'; unit: UnitSnapshot }
  | { t: number; type: 'move'; id: number; from: Hex; to: Hex; duration: number }
  | { t: number; type: 'blink'; id: number; from: Hex | null; to: Hex }
  | { t: number; type: 'attack'; id: number; targetId: number; projectile?: string; hitDelay: number; ranged: boolean }
  | { t: number; type: 'cast'; id: number; name: string; castTime: number; vfx?: string; animation: 'attack' | 'cast' }
  | {
      t: number;
      type: 'damage';
      id: number;
      sourceId: number;
      amount: number;
      absorbed: number;
      crit: boolean;
      kind: DamageKind;
      dot?: StatusKind | 'tribulation';
      hp: number;
      shield: number;
    }
  | { t: number; type: 'heal'; id: number; sourceId: number; amount: number; hp: number }
  | { t: number; type: 'shield'; id: number; amount: number; shield: number; lasting: boolean }
  | { t: number; type: 'status'; id: number; status: StatusKind; stacks: number; duration: number }
  | { t: number; type: 'cleanse'; id: number }
  /** `vanish`: the unit left without a death of its own (a Reflection shattering or fading). */
  | { t: number; type: 'death'; id: number; vanish?: boolean }
  | { t: number; type: 'revive'; id: number; hp: number }
  | { t: number; type: 'qi'; id: number; qi: number; maxQi: number }
  | { t: number; type: 'buff'; id: number; stat: StatKey; flat: number; pct: number; label?: string }
  | { t: number; type: 'vfx'; key: string; id?: number; targetId?: number; pos?: Hex }
  | { t: number; type: 'surge'; id: number; start: boolean; name: string }
  | { t: number; type: 'enlightenment'; id: number; name: string }
  | { t: number; type: 'companion'; ids: number[] }
  | { t: number; type: 'tribulation'; start: boolean }
  | { t: number; type: 'stones'; amount: number; sourceId: number }
  | { t: number; type: 'end'; winner: Side };
