import type { EventDef } from '@/core/types';
import { UNIQUE_ITEMS } from './items';

/**
 * Events between fights. `resolve` mutates the run through the EventContext and returns a narrative outcome.
 */
export const EVENTS: EventDef[] = [
  {
    id: 'starter_kit',
    title: 'The Sect Elder’s Parcel',
    hanzi: '启程',
    text: "An elder of your sect presses a worn parcel into your hands at the mountain gate. Prayer flags snap in the wind, and far below the bamboo sea whispers of rifts torn open by demons. \"Choose wisely. The Ladder does not forgive the unprepared.\"",
    art: 'event_starter',
    only: 'event',
    choices: [
      { id: 'stones', label: 'Spirit Stones', desc: 'Gain [30 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(30)), { text: 'The parcel is heavy with glittering stones.', stonesDelta: 30 }) },
      {
        id: 'items',
        label: 'Treasures',
        desc: 'Gain [2 Treasures] of your choice from a selection of 3.',
        resolve: (ctx) => ({ text: 'Inside: talismans, charms, and the faint scent of incense.', pickItem: ctx.rollItems(3, 'common') }),
      },
      {
        id: 'stats',
        label: 'Tempering',
        desc: 'Choose a disciple to permanently gain [+30 Attack Speed].',
        needsHero: true,
        resolve: (ctx, uid) => {
          if (uid) ctx.permanentHeroBuff(uid, 'attackSpeed', 30);
          return { text: 'A night of tempering under the elder’s eye. Muscles remember what the mind forgets.' };
        },
      },
    ],
  },
  {
    id: 'abandoned_cave',
    title: 'The Abandoned Cave Dwelling',
    hanzi: '洞府',
    text: "A cultivator’s cave dwelling, long abandoned. Dust lies thick on the meditation mat, yet the arrays carved into the walls still hum faintly, guarding whatever their master left behind. Something gleams on the altar.",
    art: 'event_cave',
    weight: 3,
    choices: [
      { id: 'take', label: 'Search the altar', desc: 'Choose [1 of 3 unique Treasures].', resolve: (ctx) => ({ text: 'The arrays accept your presence. One treasure may leave with you.', pickItem: ctx.rng.pickN(UNIQUE_ITEMS, 3) }) },
      { id: 'leave', label: 'Pay respects and leave', desc: 'Gain [10 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(10)), { text: 'You bow three times. A pouch of stones rolls from a crack in the wall.', stonesDelta: 10 }) },
    ],
  },
  {
    id: 'spirit_spring',
    title: 'The Spirit Spring',
    hanzi: '灵泉',
    text: "A spring of luminous water bubbles between mossy stones, and the air above it tastes of qi. Your disciples fall silent around it. The deeper you look, the brighter it shines, as if the earth itself were breathing.",
    art: 'event_spring',
    weight: 3,
    choices: [
      {
        id: 'drink',
        label: 'Drink',
        desc: '[66%]: a disciple gains [+15% Spirit and Attack]. [34%]: lose [10 Spirit Stones].',
        needsHero: true,
        resolve: (ctx, uid) => {
          if (ctx.rng.chance(66)) {
            if (uid) {
              ctx.permanentHeroBuff(uid, 'spirit', 0, 15);
              ctx.permanentHeroBuff(uid, 'attack', 0, 15);
            }
            return { text: 'Warmth floods their meridians. Their cultivation deepens.' };
          }
          ctx.addStones(-Math.min(10, ctx.stones));
          return { text: 'The water was bitter. Your purse is lighter — the spring demanded tribute.', stonesDelta: -10 };
        },
      },
      { id: 'leave', label: 'Walk away', desc: 'Nothing happens.', resolve: () => ({ text: 'Some springs are best left undisturbed.' }) },
    ],
  },
  {
    id: 'wandering_merchant',
    title: 'The Wandering Merchant',
    hanzi: '商旅',
    text: "A merchant with a cart drawn by a spirit ox hails you from the roadside, bells jangling on every crate. Half his wares are surely fakes; the other half might change your fate. \"Fine treasures, elder! Fine prices!\"",
    art: 'event_merchant',
    weight: 2,
    choices: [
      { id: 'buy_item', label: 'Browse treasures', desc: 'Pay [12 Spirit Stones] for a [rare Treasure] of your choice (1 of 3).', cost: 12, available: (ctx) => ctx.stones >= 12, resolve: (ctx) => ((ctx.addStones(-12)), { text: 'The merchant unrolls a silk bundle.', pickItem: ctx.rollItems(3, 'rare'), stonesDelta: -12 }) },
      { id: 'buy_relic', label: 'Ask about manuals', desc: 'Pay [15 Spirit Stones] for a [Dao Insight] of your choice (1 of 3).', cost: 15, available: (ctx) => ctx.stones >= 15, resolve: (ctx) => ((ctx.addStones(-15)), { text: '"Ah, a scholar!" He produces three dusty scrolls.', pickRelic: ctx.rollRelics(3), stonesDelta: -15 }) },
      { id: 'haggle', label: 'Haggle', desc: 'Gain [8 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(8)), { text: 'You talk the merchant into paying YOU for directions.', stonesDelta: 8 }) },
    ],
  },
  {
    id: 'sect_banner',
    title: 'The Sect Banner',
    hanzi: '旗',
    text: "Your disciples argue over the sect banner by lantern light. The swordsmen want a blade, the alchemists a cauldron, the talisman masters a seal. Each faction wants its own Dao honored, and none of them will yield.",
    art: 'event_banner',
    weight: 2,
    choices: [
      { id: 'sword', label: 'Sword & Shadow design', desc: 'Gain a random [Sword Cultivator] or [Shadow Walker] Dao Insight.', resolve: (ctx) => ({ text: 'A blade crosses a crescent moon on the banner.', pickRelic: ctx.rollRelics(1) }) },
      { id: 'body', label: 'Mountain design', desc: 'Gain a random Dao Insight and [+100 HP] for all disciples... represented as stones: [+12].', resolve: (ctx) => ((ctx.addStones(12)), { text: 'A mountain under a jade sky. Solid. Dependable.', stonesDelta: 12 }) },
      { id: 'spirit', label: 'Lotus design', desc: 'Choose [1 of 3 Dao Insights].', resolve: (ctx) => ({ text: 'A lotus unfurls in cinnabar thread.', pickRelic: ctx.rollRelics(3) }) },
    ],
  },
  {
    id: 'beast_nest',
    title: 'The Demon Beast Nest',
    hanzi: '兽巢',
    text: "A nest of bone and bamboo, wide as a courtyard, cradles a single enormous egg. Its shell is warm to the touch, and something glints deep inside it. Whatever laid it cannot be far away.",
    art: 'event_nest',
    weight: 2,
    choices: [
      { id: 'protect', label: 'Guard the egg', desc: 'Gain an [epic Treasure] of your choice (1 of 3).', resolve: (ctx) => ({ text: 'The mother returns. She regurgitates an artifact and leaves you, somehow, in her debt.', pickItem: ctx.rollItems(3, 'epic') }) },
      { id: 'crack', label: 'Crack it open', desc: 'Gain [25 Spirit Stones]. Lose [5% Max HP]... on your lowest-rank disciple (as −50 HP).', needsHero: true, resolve: (ctx, uid) => { ctx.addStones(25); if (uid) ctx.permanentHeroBuff(uid, 'hp', -50); return { text: 'Spirit stones spill from the yolk. The shell fights back.', stonesDelta: 25 }; } },
    ],
  },
  {
    id: 'bodhi_tree',
    title: 'Beneath the Bodhi Tree',
    hanzi: '菩提',
    text: "An ancient bodhi tree hums with enlightenment, its roots wrapped around stones older than the empire. Leaves drift down like falling sutras. A disciple could meditate here... for a price.",
    art: 'event_bodhi',
    weight: 2,
    choices: [
      { id: 'meditate', label: 'Meditate (20 Stones)', desc: 'A disciple [ranks up].', cost: 20, needsHero: true, available: (ctx) => ctx.stones >= 20 && ctx.heroes.some((h) => h.rank < 3), resolve: (ctx, uid) => { ctx.addStones(-20); if (uid) ctx.rankUpHero(uid); return { text: 'Leaves fall. When they rise again, the disciple has broken through.', stonesDelta: -20 }; } },
      { id: 'rest', label: 'Rest in the shade', desc: 'Gain [6 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(6)), { text: 'You find stones buried among the roots.', stonesDelta: 6 }) },
    ],
  },
  {
    id: 'heavenly_trial',
    title: 'Heavenly Trial: Single Combat',
    hanzi: '试炼',
    text: "Your sect crests a hill. In the valley below, a lone monster stands over a pile of treasure, daring any single challenger. The heavens are watching: this trial is fought alone, or not at all.",
    art: 'event_trial',
    only: 'trial',
    choices: [
      { id: 'stones', label: 'Fight for Stones', desc: 'Defeat the creature in [1v1] to gain [20 Spirit Stones].', resolve: () => ({ text: 'Choose your champion.', fight: { encounterId: 'single', reward: [{ do: 'stones', amount: 20 }], rewardDesc: '20 Spirit Stones', single: true } }) },
      { id: 'item', label: 'Fight for a Treasure', desc: 'Defeat the creature in [1v1] to gain a [rare Treasure].', resolve: () => ({ text: 'Choose your champion.', fight: { encounterId: 'single', rewardDesc: 'A rare Treasure', single: true } }) },
      { id: 'skip', label: 'Avoid the valley', desc: 'Gain [5 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(5)), { text: 'Discretion. The elders would approve.', stonesDelta: 5 }) },
    ],
  },
  {
    id: 'sect_rest',
    title: 'Sect Rest',
    hanzi: '歇',
    text: "Your disciples gather around a campfire beneath a blanket of stars, sharing rice wine and old tales of the masters. For one night the war against the rifts feels far away. Tomorrow, the realm’s guardian awaits.",
    art: 'event_campfire',
    only: 'rest',
    choices: [
      { id: 'train', label: 'Night training', desc: 'A disciple permanently gains [+10% Attack] and [+10% Spirit].', needsHero: true, resolve: (ctx, uid) => { if (uid) { ctx.permanentHeroBuff(uid, 'attack', 0, 10); ctx.permanentHeroBuff(uid, 'spirit', 0, 10); } return { text: 'Sparks fly from spirit and steel alike.' }; } },
      { id: 'fortify', label: 'Body tempering', desc: 'A disciple permanently gains [+200 HP] and [+15 Defense].', needsHero: true, resolve: (ctx, uid) => { if (uid) { ctx.permanentHeroBuff(uid, 'hp', 200); ctx.permanentHeroBuff(uid, 'defense', 15); } return { text: 'The disciple sits in the fire. The fire gives up first.' }; } },
      { id: 'gamble', label: 'Tell stories', desc: 'Gain [15 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(15)), { text: 'A disciple wins a bet about a dragon. Nobody checks the details.', stonesDelta: 15 }) },
    ],
  },
  {
    id: 'karmic_debt',
    title: 'The Gambler of Karma',
    hanzi: '因果',
    text: "A grinning old man sits cross-legged in the middle of the road, shaking a cup of dice that rattles like bones. His eyes seem to see straight through your sect’s fortune. \"Your karma against my stones, elder.\"",
    art: 'event_gambler',
    weight: 1,
    choices: [
      { id: 'gamble', label: 'Roll (10 Stones)', desc: '[50%]: gain [30 Spirit Stones]. [50%]: lose your wager.', cost: 10, available: (ctx) => ctx.stones >= 10, resolve: (ctx) => { if (ctx.rng.chance(50)) { ctx.addStones(20); return { text: 'Heaven smiles. The old man curses.', stonesDelta: 20 }; } ctx.addStones(-10); return { text: 'The dice land badly. Karma, apparently.', stonesDelta: -10 }; } },
      { id: 'decline', label: 'Decline', desc: 'Nothing happens.', resolve: () => ({ text: 'The old man shrugs and vanishes in a puff of incense.' }) },
    ],
  },
  {
    id: 'mysterious_elder',
    title: 'The Mysterious Elder',
    hanzi: '前辈',
    text: "A white-haired figure sits on a passing cloud, sipping tea as if the world below were a play. He never looks at you, yet you feel weighed and measured. \"I have watched your sect. It has... potential.\"",
    art: 'event_elder',
    weight: 2,
    choices: [
      { id: 'insight', label: 'Request guidance', desc: 'Choose [1 of 3 Dao Insights].', resolve: (ctx) => ({ text: 'The elder speaks for an hour. You remember one sentence. It is enough.', pickRelic: ctx.rollRelics(3) }) },
      { id: 'tea', label: 'Share tea', desc: 'Gain [12 Spirit Stones] and a [common Treasure].', resolve: (ctx) => ((ctx.addStones(12)), { text: 'The tea tastes of mountains and time.', pickItem: ctx.rollItems(1, 'common'), stonesDelta: 12 }) },
    ],
  },
  {
    id: 'alchemy_furnace',
    title: 'The Abandoned Furnace',
    hanzi: '丹炉',
    text: "A cold alchemy furnace stands in a ruined hall, its bronze skin cracked by some failed tribulation. Pill residue still glows faintly in its belly, and the air smells of cinnabar and lightning.",
    art: 'event_furnace',
    weight: 2,
    choices: [
      { id: 'pill', label: 'Scrape the residue', desc: 'A disciple permanently gains [+25 Spirit] and [+3 Qi Regen].', needsHero: true, resolve: (ctx, uid) => { if (uid) { ctx.permanentHeroBuff(uid, 'spirit', 25); ctx.permanentHeroBuff(uid, 'qiRegen', 3); } return { text: 'Bitter, then sweet, then a rush of Qi.' }; } },
      { id: 'sell', label: 'Sell the furnace parts', desc: 'Gain [18 Spirit Stones].', resolve: (ctx) => ((ctx.addStones(18)), { text: 'Spirit copper fetches a good price.', stonesDelta: 18 }) },
    ],
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const RANDOM_EVENTS = EVENTS.filter((e) => !e.only);
