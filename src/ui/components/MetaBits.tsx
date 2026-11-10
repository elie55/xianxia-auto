import type { ComponentChildren } from 'preact';
import { meta } from '@/app/store';
import { BANNERS, DEFAULT_COSMETICS, FRAMES, KIND_LABEL, cosmetic, type CosmeticKind } from '@/meta/cosmetics';
import type { AchievementDef } from '@/meta/achievementDefs';
import { levelOf, rankOf } from '@/meta/renown';
import { defaultProfile } from '@/meta/migrate';
import { Icon } from '@/ui/components/Icon';

/** A sect avatar: a brush seal, a disciple's portrait or a foe's likeness, in a gold ring. */
export function Avatar({ id, size = 64, class: cls }: { id: string; size?: number; class?: string }) {
  const c = cosmetic('avatar', id) ?? cosmetic('avatar', DEFAULT_COSMETICS.avatar)!;
  const style = { width: size, height: size, ['--seal' as string]: c.color ?? '#6fe3c4' };
  if (c.hero)
    return (
      <span class={`avatar portrait-av ${cls ?? ''}`} style={style}>
        <img src={`./assets/art/heroes/${c.hero}/portrait.png`} alt="" draggable={false} />
      </span>
    );
  if (c.sprite)
    return (
      <span class={`avatar sprite-av ${cls ?? ''}`} style={style}>
        <img src={`./assets/art/sprites/${c.sprite}.png`} alt="" draggable={false} />
      </span>
    );
  return (
    <span class={`avatar seal-av ${cls ?? ''}`} style={style}>
      <span class="brush" style={{ fontSize: Math.round(size * 0.56) }}>
        {c.hanzi}
      </span>
    </span>
  );
}

/** An achievement's medal: its icon or hanzi in a round seal; dim while locked. */
export function AchievementMedal({ a, size = 56, locked, secret }: { a: AchievementDef; size?: number; locked?: boolean; secret?: boolean }) {
  return (
    <span class={`ach-medal cat-${a.category} ${locked ? 'locked' : ''}`} style={{ width: size, height: size }}>
      {secret ? (
        <span class="brush" style={{ fontSize: Math.round(size * 0.5) }}>
          ?
        </span>
      ) : a.hanzi ? (
        <span class="brush" style={{ fontSize: Math.round(size * 0.52) }}>
          {a.hanzi}
        </span>
      ) : (
        <Icon name={a.icon ?? 'ui_star'} size={Math.round(size * 0.58)} />
      )}
    </span>
  );
}

/** A small picture of any cosmetic: the avatar itself, a title plaque, a frame swatch or a banner swatch. */
export function CosmeticPreview({ kind, id, size = 56, compact }: { kind: CosmeticKind; id: string; size?: number; compact?: boolean }) {
  const c = cosmetic(kind, id);
  if (!c) return null;
  if (kind === 'avatar') return <Avatar id={id} size={size} />;
  if (kind === 'title' && compact)
    return (
      <span class="title-medal" style={{ width: size, height: size }}>
        <span class="brush" style={{ fontSize: Math.round(size * 0.5) }}>
          号
        </span>
      </span>
    );
  if (kind === 'title')
    return (
      <span class="title-plaque" style={{ minHeight: size * 0.5 }}>
        <Icon name="ui_bullet" size={16} /> {c.name}
      </span>
    );
  if (kind === 'frame')
    return (
      <span class={`frame-swatch frame-${id}`} style={{ width: size * 0.72, height: size }}>
        <i />
      </span>
    );
  return <span class="banner-swatch" style={{ width: size * 0.8, height: size, ['--banner' as string]: c.color }} />;
}

export function cosmeticLine(kind: CosmeticKind, id: string): string {
  return `${KIND_LABEL[kind]} · ${cosmetic(kind, id)?.name ?? id}`;
}

export const bannerColor = (id: string) => BANNERS.find((b) => b.id === id)?.color ?? BANNERS[0].color;
export const frameIds = FRAMES.map((f) => f.id);

/** Renown progress bar: the level's fill, with optional label. */
export function RenownBar({ frac, children, class: cls }: { frac: number; children?: ComponentChildren; class?: string }) {
  return (
    <div class={`renown-bar ${cls ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
      {children && <span class="renown-bar-label">{children}</span>}
    </div>
  );
}

/** The sect plate: avatar, sect name, title, rank and Renown bar (main menu, Renown screen). */
export function SectPlate({ onClick, compact, class: cls }: { onClick?: () => void; compact?: boolean; class?: string }) {
  const m = meta.value;
  const p = { ...defaultProfile(), ...(m.profile ?? {}) };
  const lv = levelOf(m.renown?.xp ?? 0);
  const rank = rankOf(lv.level);
  const titleName = cosmetic('title', p.title)?.name ?? '';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag class={`sect-plate ${compact ? 'compact' : ''} ${onClick ? 'clickable' : ''} ${cls ?? ''}`} style={{ ['--banner' as string]: bannerColor(p.banner) }} onClick={onClick}>
      <Avatar id={p.avatar} size={compact ? 64 : 84} />
      <span class="sect-plate-text">
        <span class="display sect-plate-name">{p.sectName}</span>
        <span class="sect-plate-title">{titleName}</span>
        <span class="sect-plate-rank">
          <span class="brush">{rank.hanzi}</span> {rank.name} · Renown <b>{lv.level}</b>
        </span>
        <RenownBar frac={lv.frac} class="sect-plate-bar" />
      </span>
    </Tag>
  );
}
