import { meta } from '@/app/store';

/** Team colours for the battle view, per colour-vision setting (Settings › Accessibility). */
export interface TeamPalette {
  allyHp: number;
  enemyHp: number;
  allyAura: number;
  enemyAura: number;
  allyRim: number;
  enemyRim: number;
}

const PALETTES: Record<'default' | 'deutan' | 'tritan', TeamPalette> = {
  // jade allies, crimson foes
  default: { allyHp: 0x4fd36a, enemyHp: 0xe0412f, allyAura: 0x3fbf9f, enemyAura: 0xd2382c, allyRim: 0xd4b060, enemyRim: 0xc8805c },
  // red-green safe: blue allies, orange foes
  deutan: { allyHp: 0x3d9bff, enemyHp: 0xff9a1f, allyAura: 0x4aa8ff, enemyAura: 0xffa53a, allyRim: 0x9cc8ff, enemyRim: 0xffc27a },
  // blue-yellow safe: teal allies, rose foes
  tritan: { allyHp: 0x2fd0a8, enemyHp: 0xff4f7b, allyAura: 0x2fd0a8, enemyAura: 0xff5c86, allyRim: 0x9ae8d4, enemyRim: 0xff9fb8 },
};

export function teamPalette(): TeamPalette {
  return PALETTES[meta.value.settings.palette ?? 'default'] ?? PALETTES.default;
}
