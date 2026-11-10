import { meta } from '@/app/store';
import { Icon } from '@/ui/components/Icon';
import { BUILDING_BY_ID, isOpen, sectInvite, type BuildingId } from '@/meta/sect';
import { levelOf, rankOf } from '@/meta/renown';
import { defaultProfile } from '@/meta/migrate';

/** What the sect offers, as the banner lists it; `building` is where it comes from (none for what is still to come). */
const PERKS: { icon: string; name: string; detail: string; building?: BuildingId }[] = [
  { icon: 'item_founder_sword', name: 'Heirloom Treasures', detail: 'Forged to grow with every victory', building: 'forge' },
  { icon: 'choice_insight', name: 'New Dao Insights', detail: 'Studied in the Scripture Pavilion', building: 'pavilion' },
  { icon: 'relic_ledger', name: 'Bounties and rewards', detail: 'Sect Funds and rare materials', building: 'bounty' },
  { icon: 'choice_disciple', name: 'New disciples', detail: 'The Recruitment Hall, coming soon' },
];

/**
 * The main menu's sect banner: a painted silk banner hanging at the right that invites the player into the Sect. It
 * lists what the sect offers (a part still locked shows the Renown that opens it) and the first thing to do there,
 * and glows when something can be crafted, studied or raised. Before the sect is founded (Renown 2) it shows the way
 * there and opens the Renown track instead.
 */
export function SectBanner({ onOpen, onRenown }: { onOpen: () => void; onRenown: () => void }) {
  const m = meta.value;
  const xp = m.renown?.xp ?? 0;
  const inv = sectInvite(m);
  const rank = rankOf(levelOf(xp).level);
  const name = { ...defaultProfile(), ...(m.profile ?? {}) }.sectName;
  return (
    <button
      type="button"
      class={`sect-banner${inv.open ? '' : ' closed'}${inv.ready ? ' ready' : ''}`}
      onClick={inv.open ? onOpen : onRenown}
      aria-label={`${inv.open ? 'Manage your sect' : 'Found your sect'}. ${inv.headline}`}
    >
      <span class="sect-banner-sway">
        <span class="sect-banner-art" aria-hidden="true" />
        <span class="sect-banner-emblem" aria-hidden="true">
          {rank.hanzi}
        </span>
        <span class="sect-banner-body">
          <span class="sect-banner-kicker">{inv.open ? name : 'Your sect awaits'}</span>
          <span class="sect-banner-title">{inv.open ? 'Manage your Sect' : 'Found your Sect'}</span>
          <span class="sect-banner-rule" aria-hidden="true" />
          <span class="sect-banner-perks">
            {PERKS.map((p) => {
              const lockedAt = p.building && !isOpen(p.building, xp) ? BUILDING_BY_ID[p.building].unlock : 0;
              return (
                <span key={p.name} class={`sect-perk${lockedAt ? ' locked' : ''}${p.building ? '' : ' soon'}`}>
                  <Icon name={p.icon} size={36} />
                  <span class="sect-perk-text">
                    <b>{p.name}</b>
                    <small>
                      {lockedAt ? (
                        <>
                          <Icon name="ui_lock" size={11} /> Opens at Renown {lockedAt}
                        </>
                      ) : (
                        p.detail
                      )}
                    </small>
                  </span>
                </span>
              );
            })}
          </span>
          <span class="sect-banner-status">
            {inv.headline}
            {inv.progress !== undefined && (
              <i class="sect-banner-progress" aria-hidden="true">
                <i style={{ width: `${Math.round(inv.progress * 100)}%` }} />
              </i>
            )}
          </span>
          <span class="btn primary small sect-banner-cta">
            <span class="btn-glyph">宗</span> {inv.open ? 'Enter the Sect' : 'View Renown'}
          </span>
        </span>
      </span>
    </button>
  );
}
