import type { JSX } from 'preact';
import { PAINTED_ICONS } from './paintedIcons';

/** Below this size a painted icon turns to mush; the crisp tinted glyph is used instead. */
const PAINTED_MIN = 20;

export interface IconProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'size'> {
  name: string;
  size?: number | string;
  color?: string;
}

/**
 * Icon: a painted PNG from /assets/icons/painted/<name>.png when one exists (generated art),
 * otherwise a mask-tinted SVG from /assets/icons/<name>.svg (game-icons.net, CC BY 3.0).
 */
export function Icon({ name, size, color, style, class: cls, ...rest }: IconProps) {
  const s = typeof size === 'number' ? `${size}px` : size;
  if (PAINTED_ICONS.has(name) && (typeof size !== 'number' || size >= PAINTED_MIN)) {
    return (
      <span
        class={`icon painted ${cls ?? ''}`}
        style={{ backgroundImage: `url(./assets/icons/painted/${name}.png)`, width: s, height: s, ...(typeof style === 'object' && style ? (style as Record<string, string>) : {}) }}
        {...rest}
      />
    );
  }
  return (
    <span
      class={`icon ${cls ?? ''}`}
      style={{
        ['--icon' as string]: `url(./assets/icons/${name}.svg)`,
        width: s,
        height: s,
        color,
        ...(typeof style === 'object' && style ? (style as Record<string, string>) : {}),
      }}
      {...rest}
    />
  );
}

export const STAT_ICON: Record<string, string> = {
  hp: 'stat_hp',
  qi: 'stat_qi',
  attack: 'stat_attack',
  attackSpeed: 'stat_attackSpeed',
  spirit: 'stat_spirit',
  crit: 'stat_crit',
  defense: 'stat_defense',
  range: 'stat_range',
  qiRegen: 'stat_qiRegen',
  omnivamp: 'stat_omnivamp',
  moveSpeed: 'stat_moveSpeed',
};

export const STAT_LABEL: Record<string, string> = {
  hp: 'Max HP',
  qi: 'Starting Qi',
  attack: 'Attack',
  attackSpeed: 'Attack Speed',
  spirit: 'Spirit',
  crit: 'Crit',
  defense: 'Defense',
  range: 'Range',
  qiRegen: 'Qi Regen',
  omnivamp: 'Omnivamp',
  moveSpeed: 'Move Speed',
};

export const STAT_COLOR: Record<string, string> = {
  hp: '#7ef29a',
  qi: '#8fd5ff',
  attack: '#ffb347',
  attackSpeed: '#ffe66d',
  spirit: '#c9a7ff',
  crit: '#ff6b6b',
  defense: '#9fd5ff',
  range: '#d8d8c8',
  qiRegen: '#6fe3c4',
  omnivamp: '#ff7a9a',
  moveSpeed: '#d8d8c8',
};

export const KEYWORD_ICON: Record<string, string> = {
  Burn: 'kw_burn',
  Poison: 'kw_poison',
  Frost: 'kw_frost',
  Lightning: 'kw_lightning',
  Crit: 'kw_crit',
  Shield: 'kw_shield',
  Surge: 'kw_surge',
  Enlightenment: 'kw_enlightenment',
  Meditation: 'kw_meditation',
  Companion: 'kw_companion',
  Heal: 'kw_heal',
  Taunt: 'kw_taunt',
  Omnivamp: 'kw_omnivamp',
  Execute: 'kw_execute',
  Qi: 'kw_qi',
};
