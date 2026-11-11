import type { Purse } from '@/meta/sect';

/**
 * Sect events (docs/META_PROGRESSION.md 6.8): about one return in three something happens at the sect, a short choice
 * with a line or two of story. A choice pays or costs at once, or sends an omen into the next run. The rules (when an
 * event comes, what a choice does to the save) are in src/meta/sectEvents.ts.
 */

/** Something an event sends into the next run started. */
export type OmenId = 'rival' | 'heart_demon' | 'vitality_pill' | 'qi_pill' | 'storm' | 'seclusion';

export interface SectOmen {
  id: OmenId;
  /** The disciple in seclusion. */
  hero?: string;
  /** What the sect is paid when the omen is fulfilled (the Crimson Cloud challenge won). */
  reward?: Partial<Purse>;
}

export interface OmenDef {
  id: OmenId;
  name: string;
  icon: string;
  /** What it does in the run; {hero} is the disciple, {reward} the prize. */
  desc: string;
  /** More power for the run: it waits for a run that is not Pure. */
  boon?: boolean;
}

export const OMENS: OmenDef[] = [
  { id: 'rival', name: 'Crimson Cloud Challenge', icon: 'node_elite', desc: 'Three Crimson Cloud disciples wait in Realm I in place of the elite. Beat them for [{reward}].' },
  { id: 'heart_demon', name: 'Heart Demon', icon: 'node_trial', desc: "Realm I's Heavenly Trial is a duel with the Heart Demon. Beat it alone for [+20% Attack, Spirit and Max HP] and [2 Heavenly Jade]." },
  { id: 'vitality_pill', name: 'Vitality Pill', icon: 'stat_hp', desc: 'Disciples have [+12% Max HP].', boon: true },
  { id: 'qi_pill', name: 'Qi-Gathering Pill', icon: 'stat_qi', desc: 'Disciples start every fight with [20 Qi].', boon: true },
  { id: 'storm', name: 'Tempered in the Storm', icon: 'challenge_storm', desc: 'Tribulation lightning comes [10 s] later in every fight.', boon: true },
  { id: 'seclusion', name: 'Seclusion', icon: 'choice_cultivate', desc: '{hero} sits out this run and comes back [one mastery level] higher.' },
];
export const OMEN_BY_ID = Object.fromEntries(OMENS.map((o) => [o.id, o])) as Record<OmenId, OmenDef>;

export interface SectChoiceDef {
  id: string;
  label: string;
  /** What it does; {gain} is what it pays (grown with the sect's rank), {hero} the disciple, {reward} an omen's prize. */
  desc: string;
  /** Paid at once. */
  cost?: Partial<Purse>;
  /** Gained at once. Funds, Herbs and Cores grow with the sect's rank; Heavenly Jade does not. */
  gain?: Partial<Purse>;
  /** Sent into the next run. */
  omen?: OmenId;
  /** The prize an omen pays when fulfilled (grown with the rank like a gain). */
  reward?: Partial<Purse>;
  /** What happens, shown once chosen. */
  outcome: string;
}

export interface SectEventDef {
  id: string;
  title: string;
  hanzi: string;
  /** public/assets/art/events/<art>.jpg */
  art: string;
  /** One or two lines of story; {hero} is the disciple the event is about. */
  text: string;
  /** Renown level from which it can happen. */
  renown: number;
  weight?: number;
  /** About one disciple (seclusion): picked when the event comes. */
  needsHero?: boolean;
  choices: SectChoiceDef[];
}

const NOTHING = 'Nothing happens.';

export const SECT_EVENTS: SectEventDef[] = [
  {
    id: 'patron',
    title: 'A Generous Patron',
    hanzi: '善信',
    art: 'sect_patron',
    text: "A carriage heavy with gifts stops at the gate. The Lu merchant clan would like your sect to remember their name when it rises.",
    renown: 2,
    weight: 3,
    choices: [
      { id: 'silver', label: 'Accept the silver', desc: 'Gain [{gain}].', gain: { funds: 60 }, outcome: "The silver goes to the treasury, and the Lu clan's steward bows very low." },
      { id: 'herbs', label: 'Ask for spirit herbs', desc: 'Gain [{gain}].', gain: { herbs: 8 }, outcome: "Crates of spirit herbs fill the Pavilion's drying racks." },
      { id: 'cores', label: 'Ask for beast cores', desc: 'Gain [{gain}].', gain: { cores: 5 }, outcome: "The clan's hunters bring beast cores still warm from the mountain." },
    ],
  },
  {
    id: 'storm',
    title: 'Storm over the Peak',
    hanzi: '雷云',
    art: 'sect_storm',
    text: 'A tribulation cloud gathers over the peak, and the Spirit Vein trembles beneath it. Where the bolts strike the cliffs, jade glitters.',
    renown: 3,
    weight: 2,
    choices: [
      { id: 'temper', label: 'Temper in the storm', desc: 'In your next run, [Tribulation] lightning comes [10 s] later in every fight.', omen: 'storm', outcome: 'Your disciples meditate on the cliffs until dawn. The lightning will have to wait for them.' },
      { id: 'jade', label: 'Gather the fallen jade', desc: 'Gain [{gain}].', gain: { jade: 2 }, outcome: 'By morning the cliffs are bare, and the treasury holds two shards of heavenly jade.' },
    ],
  },
  {
    id: 'alchemist',
    title: 'The Wandering Alchemist',
    hanzi: '丹师',
    art: 'sect_alchemist',
    text: 'A wandering alchemist with singed eyebrows offers his pills for spirit herbs. He swears none of them has ever exploded. Recently.',
    renown: 4,
    weight: 2,
    choices: [
      { id: 'vitality', label: 'Vitality Pill', desc: 'In your next run that is not Pure, disciples have [+12% Max HP].', cost: { herbs: 10 }, omen: 'vitality_pill', outcome: 'The pills taste of iron and peach. Your disciples feel twice as hard to kill.' },
      { id: 'qi', label: 'Qi-Gathering Pill', desc: 'In your next run that is not Pure, disciples start every fight with [20 Qi].', cost: { herbs: 10 }, omen: 'qi_pill', outcome: 'The pills hum in their jar. Qi gathers to whoever holds one.' },
      { id: 'leave', label: 'Send him on his way', desc: NOTHING, outcome: 'He leaves, and a while later something explodes on the road down the mountain.' },
    ],
  },
  {
    id: 'seclusion',
    title: 'A Disciple Seeks Seclusion',
    hanzi: '闭关',
    art: 'sect_seclusion',
    text: '{hero} kneels before the Main Hall and asks to enter seclusion. The cave behind the falls is free, and the season is right.',
    renown: 4,
    weight: 2,
    needsHero: true,
    choices: [
      { id: 'grant', label: 'Grant it', desc: '{hero} sits out your next run (not in its draft or shop), then comes back [one mastery level] higher.', omen: 'seclusion', outcome: 'The stone door closes behind {hero}. Only the sound of the falls comes out.' },
      { id: 'refuse', label: 'Not now', desc: NOTHING, outcome: '{hero} bows and goes back to training. There will be other seasons.' },
    ],
  },
  {
    id: 'rival',
    title: 'The Crimson Cloud Challenge',
    hanzi: '挑战',
    art: 'sect_rival',
    text: 'An envoy of the Crimson Cloud Sect lays a red letter at your gate. Their disciples will meet yours on the road, and the losers will bow.',
    renown: 5,
    weight: 2,
    choices: [
      {
        id: 'accept',
        label: 'Accept the challenge',
        desc: 'In your next run, three [Crimson Cloud] disciples wait in Realm I in place of the elite. Beat them for [{reward}].',
        omen: 'rival',
        reward: { jade: 5, funds: 60 },
        outcome: 'You write your answer on the back of their letter. The envoy leaves smiling, which is never a good sign.',
      },
      { id: 'decline', label: 'Decline', desc: NOTHING, outcome: 'The envoy shrugs. Word will spread that your sect is cautious, or wise.' },
    ],
  },
  {
    id: 'heart_demon',
    title: 'A Heart Demon Stirs',
    hanzi: '心魔',
    art: 'sect_heart_demon',
    text: "At night a shadow walks the halls wearing a disciple's face. The elders call it a heart demon: a cultivator's doubts given a body. Left alone, it grows.",
    renown: 6,
    weight: 2,
    choices: [
      {
        id: 'hunt',
        label: 'Hunt it down',
        desc: "In your next run, Realm I's [Heavenly Trial] is a duel with the [Heart Demon]. The champion who beats it gains [+20% Attack, Spirit and Max HP] for the run, and the sect [2 Heavenly Jade].",
        omen: 'heart_demon',
        outcome: 'The elders burn incense and draw the binding seal. The demon will wait where the heavens test the worthy.',
      },
      { id: 'ignore', label: 'Let it be', desc: NOTHING, outcome: 'The shadow fades at dawn. Some nights the lamps still flicker.' },
    ],
  },
];
export const SECT_EVENT_BY_ID = Object.fromEntries(SECT_EVENTS.map((e) => [e.id, e])) as Record<string, SectEventDef>;

/** The Heart Demon duel's Heavenly Trial, and what beating it gives the run's champion and the sect. */
export const HEART_DEMON_TRIAL = 'heart_demon_trial';
export const HEART_DEMON_BOON = { attack: 20, spirit: 20, hp: 20 } as const;
export const HEART_DEMON_JADE = 2;
