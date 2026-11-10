# Meta-progression: Sect, Renown and Achievements

Proposal, written 2026-11-10 from the brainstorm on account levels, a sect-building mode and achievements.
Every number below is a starting value to tune in playtests. Today the only progress between runs is the contract
unlock, the Ladder leaderboard, run counters and the Compendium's discovery lists (`MetaSave` in `src/app/store.ts`).

**Status (2026-11-10): phase 1 is built** (section 13, step 1):
- Sect Renown with the curve and payout of sections 4–5 (`src/meta/renown.ts`).
- A phase-1 reward track of cosmetics only (`src/meta/cosmetics.ts`): 24 seal avatars, 16 disciple avatars (clear
  both realms with that disciple), 2 foe avatars, 20 titles, 7 card frames, 8 banners.
- 41 achievements (`src/meta/achievementDefs.ts`). "Mountain-Splitting Strike" asks for 2,000 damage in one hit,
  not 5,000: simulated runs top out near 2,150.
- Save version 2 with migration (`src/meta/migrate.ts`).
- The Sect Rewards step at the end of every run, the sect plate on the menu, and the Sect Renown screen (track,
  achievements, profile and records).
- Ladder records shown as real floors.

**Phase 2 is built too** (section 13, step 2):
- Every run pays Sect Funds and three materials (`computeRunPurse` in `src/meta/sect.ts`).
- The Sect screen (`src/ui/screens/Sect.tsx`) has the Main Hall, the Scripture Pavilion, the Artifact Forge and the
  Bounty Board.
  - Pavilion: 3 studies of 3 new Dao Insights, and seals.
  - Forge: 4 heirloom recipes with 3 levels each, carried from the New Run screen.
  - Bounty Board: 12 bounties, checked when a run ends.
- Phase 2 reuses existing art for the sect (the old key art) and for the new Insights (existing painted icons).
  Dedicated art can come later. The four heirlooms have their own icons and sect-wide effects (section 6.4).

**The first slice of phase 4 is built** (2026-11-10, pulled ahead of phase 3):
- The **Recruitment Hall** (`recruit` in `src/meta/sect.ts`) opens at Renown 8, at the foot of the sect's stairs.
  - Materials: Beast Cores, levels I to V like the Pavilion and the Forge.
  - Level III: one free draft reroll each run. Level V: the draft shows 4 disciples.
- **Ling Shuang** (凌霜, "Nine Frost Swords") is the first exclusive disciple (`exclusive: true` in
  `src/content/heroes.ts`).
  - She answers the sect's call at Renown 10. Recruiting her costs 150 Funds and 4 Heavenly Jade.
  - From then on she can appear in every run's draft and shop (`heroPool` in `src/core/run.ts`).
  - Kit: a Sword Cultivator and Array Master. Her technique sends three waves of frost swords onto the target and
    the enemies beside it. Her Crits apply Frost. Her Dao Paths are Myriad Frost Blades (four waves, Crit), Glacial
    Lattice (more Frost, +30% damage to Frozen enemies) and Formation Ward (shields and Attack Speed for the allies
    beside her).
  - Art: a ChatGPT portrait, an AutoSprite pack (idle, walk, attack, cast, hurt, death) and painted icons for her
    three paths and for the hall. Her technique also has its own flipbook (`fx_frost_swords`, the
    `frost_sword_rain` effect key): an ice sword plunges onto each foe a wave strikes and shatters into frost.
    The 16 launch disciples got signature flipbooks the same way (`fx_sig_<id>`, effect key `sig_<id>`; each
    keeps the sparks and sounds of the shared effect it replaced, `SIGNATURE_BASE` in `BattleView.ts`).
  - Balance: in fights against the same foes she sits with the other carries. At Rank II she wins 12–13 of 40,
    against 6–13 for Li Jian, Xuan Bing, Feng Huang and Lei Zhen. Her damage is a little lower than theirs, and her
    Frost makes up for it.
- The achievements that ask for "every disciple" still count the 16 launch disciples (`BASE_HEROES`).

Phase 3 and phase 5 are not started; the rest of phase 4 (more exclusive disciples, sect events, the Hall of
Ancestors) is not either.

---

## 1. Summary

**Your sect is your account.** Ideas 1 and 2 merge into one system:

- **Sect Renown** is the account level (1 to 50). Every run earns Renown XP, win or lose. Levels pay out a reward
  track and raise the sect's rank: Humble Sect, Rising Sect, Established Sect, Great Sect, Holy Land, Immortal Sect.
- **The Sect** is a hub screen between runs. Its buildings are bought with **Sect Funds** and three **materials**.
  They unlock content, start-of-run choices and a few capped sidegrades.
- **Achievements** are goals that pay Renown XP, Funds and materials. Some pay a title, an avatar or a disciple.
  They are mirrored to Steam.

One story (you are the Sect Master), one hub, one level, and a small set of currencies.

## 2. Principles: fun, not a chore

1. **Every run pays.** A defeat keeps everything earned up to the fall. No run is wasted.
2. **Time is measured in runs, never in real time.** No timers, energy, daily logins or streaks.
3. **Options before power.** Most unlocks widen the pool or add start-of-run choices. Raw power is small and capped.
4. **Choices, not checklists.** Upgrades branch or trade something away. The Spirit Vein can be refunded for free.
5. **Show the next reward.** The menu and the run-end screen always show the next two or three unlocks.
6. **A finished sect exists.** About 60–80 runs complete Renown 50 and every building. After that, only cosmetics
   and records remain.
7. **Systems reveal themselves.** The hub opens gradually over the first Renown levels, so a new player is never
   handed eight buildings at once.

## 3. Decisions and the recommended defaults

| Decision | Recommended default | Why |
| --- | --- | --- |
| Do sect upgrades make runs easier? | **Decided (2026-11-10):** options first, plus a small helping hand capped at about one contract tier. The help is economic (Spirit Stones, rerolls, Time Reversal, one heirloom), not raw stats, and it is front-loaded. A **Pure run** toggle switches all sect bonuses off. | Contracts stay the difficulty dial. Struggling players get a little help. Veterans can still prove themselves. |
| Steam only, or cross-save with Android? | Steam only for launch. Keep the save as one JSON file so a cloud service can be added for Android later. | Steam Cloud covers PC with no server. |
| How long is the meta? | 60–80 runs, about 50 hours, to finish. | Long enough to matter, short enough to finish. |

## 4. What a run pays

### 4.1 Renown XP

| Source | XP |
| --- | --- |
| Regular fight won | 10 |
| Challenge or Heavenly Trial fight won | 20 |
| Elite fight won | 30 |
| Realm guardian or Ladder warden defeated | 60 |
| Realm I cleared | 60 |
| Realm II cleared (the run is won) | 100 |
| Each Heavenly Ladder floor cleared | 40 |
| **Contract multiplier** on everything above | × (1 + 0.15 × tier): Mortal ×1, Golden Core ×1.45, Heavenly Tribulation ×2.05 |
| Each new Compendium entry (first sighting) | 5, not multiplied |
| Achievements | their listed value, not multiplied |

### 4.2 Sect Funds and materials

| Currency | Earned from | Spent on |
| --- | --- | --- |
| **Sect Funds** | 25% of the Spirit Stones earned in the run, × the contract multiplier | every building level, crafting, research |
| **Spirit Herbs** | 2 per event node, 3 at the Sect Rest | Scripture Pavilion research, Spirit Vein |
| **Beast Cores** | 2 per elite won, 1 per challenge or trial won | Artifact Forge, Recruitment Hall |
| **Heavenly Jade** | 3 per realm guardian, 2 per Ladder floor; +1 per guardian on Nascent Soul and above | high building levels, doctrines, exclusive disciples |

All materials are multiplied by the contract multiplier and rounded down. Harder contracts pay more, which pulls
players up the ladder. The Bounty Board and achievements are the other sources.

### 4.3 Example payouts

| Run | Renown XP | Funds | Herbs | Cores | Jade |
| --- | --- | --- | --- | --- | --- |
| Early defeat in Realm I (3 fights won) | ~40 + discoveries | ~20 | 2 | 0–1 | 0 |
| Mortal victory (both realms) | ~520 | ~125 | 14 | 8 | 6 |
| Golden Core victory | ~750 | ~155 | 20 | 11 | 8 |
| Heavenly Tribulation victory + 3 Ladder floors | ~1,070 + ~1,230 | ~640 | 71 | 28 | 28 |

How these were counted: a realm has 5 regular fights, a challenge, a trial, an elite and a guardian (180 XP), plus
two events and a rest. A Ladder floor has 7 regular fights, an elite and a warden (200 XP with the floor bonus). Battles
pay 20 / 25 / 30 Spirit Stones in Realm I / Realm II / the Ladder, plus 1 per survivor below Golden Core.

## 5. Sect Renown

### 5.1 Level curve

| Levels | XP per level | Cumulative XP at the end |
| --- | --- | --- |
| 1–10 | 480 flat | 4,320 (Renown 10 after about 5–7 runs) |
| 10–30 | 480 + 120 × (level − 10), so 480 → 2,760 | 36,720 |
| 30–50 | 2,880 + 80 × (level − 30), so 2,880 → 4,400 | 109,520 |

The curve was quadrupled on 2026-11-10. With the first one, a first victory (its discoveries and achievements
included, 1,685 XP) went from Renown 1 to 13 in a single run; it now reaches Renown 4. Later runs pay less, about 520
XP for a Mortal victory and more on harder contracts, so Renown 50 takes on the order of 100–150 runs. Saves keep their
XP and are levelled on the new curve.

### 5.2 Sect ranks

| Rank | Renown | What it opens |
| --- | --- | --- |
| Humble Sect | 1 | Main Hall, Bounty Board |
| Rising Sect | 10 | buildings up to level 2, a sect banner colour |
| Established Sect | 20 | buildings up to level 3, the sect map's second art tier |
| Great Sect | 30 | buildings up to level 4 |
| Holy Land | 40 | buildings up to level 5, the third art tier |
| Immortal Sect | 50 | prestige cosmetics, the gilded sect map |

### 5.3 Reward track (first 20 levels, then milestones)

| Level | Reward |
| --- | --- |
| 2 | The **Sect** opens (hub screen with the Main Hall and Bounty Board), first avatar |
| 3 | **Scripture Pavilion** (research and seals) |
| 4 | Title "Outer Disciple", 2 new blessings in the draft pool |
| 5 | **Artifact Forge** and the first heirloom recipe |
| 6 | Avatar, 3 new Dao Insights |
| 7 | **Doctrine Hall** with two doctrines |
| 8 | **Recruitment Hall** |
| 9 | Card frame "Jade" |
| 10 | Rising Sect, **exclusive disciple #1** |
| 11 | **Spirit Vein** (talent web) |
| 12 | 3 new Treasures |
| 13 | **Training Grounds** (more blessings) |
| 14 | Avatar, heirloom recipe |
| 15 | Doctrine, title "Inner Disciple" |
| 16 | 3 new Dao Insights |
| 17 | **Hall of Ancestors** |
| 18 | Card frame "Gold" |
| 19 | Heirloom recipe |
| 20 | Established Sect, **exclusive disciple #2** |
| 25, 35, 45 | Exclusive disciples #3, #4, #5 |
| 30, 40, 50 | Sect rank, a doctrine, a title, the sect map's next art tier |
| Every other level | An avatar, a title, a card frame, a heirloom recipe, or a bundle of Treasures or Dao Insights |

## 6. The Sect hub

### 6.1 Screen

A painted sect panorama, a mountain sect above the clouds in the menu's art style. Each building is a medallion
on the painting. It opens a side panel with the same drawer pattern as the Compendium's detail page.

- **Visible growth:** each sect rank swaps to the next art tier, at three tiers.
- **A living place:** unlocked disciples idle around the courtyard, using the Compendium's `SpriteClip`, and clicking
  one shows their mastery.
- **Atmosphere:** the battle `Ambient` layer adds petals and clouds.
- **Pull to play:** a **Begin a Run** plaque sits on the hub.

### 6.2 Buildings

| Building | What it does | Levels |
| --- | --- | --- |
| **Main Hall** | The sect's rank, set by Renown and not bought. It caps the other buildings' levels. Shows the sect name, banner and avatar. | 6 ranks |
| **Scripture Pavilion** (藏经阁) | **Research** adds new Dao Insights to the pool, three per study. **Seals** ban Treasures or Insights you never want offered: 1 seal at L1, 3 at L3, 5 at L5. | 5 |
| **Artifact Forge** (炼器阁) | Crafts **heirloom Treasures** from recipes. You bring one into a run. L4: heirlooms start at level 2. | 5 |
| **Doctrine Hall** | Unlocks **doctrines**, one start-of-run choice per run (6.3). Each level unlocks one or two. | 5 |
| **Recruitment Hall** | Unlocks exclusive disciples into the draft and shop. L3: +1 free draft reroll. L5: the draft shows 4 disciples. | 5 |
| **Training Grounds** | Unlocks new blessings, 6 in total. L5: the draft shows 4 blessings. | 5 |
| **Spirit Vein** | A talent web of capped sidegrades (6.5), 2 points per level, refundable at any time. | 5 |
| **Hall of Ancestors** | Trophies: an MVP statue for each victory, the best Ladder runs, the achievement wall and disciple mastery. Free, no levels. | - |
| **Bounty Board** | Three standing objectives (6.7). Free. | - |

**Level costs for any building except the Main Hall:**

| Level | Funds | Main material | Heavenly Jade |
| --- | --- | --- | --- |
| 2 | 100 | 10 | 0 |
| 3 | 250 | 25 | 0 |
| 4 | 450 | 45 | 5 |
| 5 | 700 | 70 | 12 |

A level costs from under one run of income (L2) to about five (L5). All six bought buildings cost 9,000 Funds,
about 70 runs at ~130 Funds a run, which matches the 60–80 run target.

### 6.3 Doctrines (start-of-run choice)

Doctrines give the most replay value for the least art. Each one has an upside and a cost. Picking one is optional.

| Doctrine | Upside | Cost |
| --- | --- | --- |
| Sword Peak | Sword Cultivators start at Foundation rank | the shop shows 1 fewer Dao Insight |
| Iron Mountain | Body Refiners +15% Max HP | all disciples −10 Attack Speed |
| Talisman Court | Talisman Masters start each fight with 20 Qi | Treasures cost +2 Spirit Stones |
| Hundred Herbs Valley | Healing +20% | start with 10 fewer Spirit Stones |
| Shadow Pavilion | Shadow Walkers' first hit always crits | enemies +5% HP |
| Thousand Fists | Martial Artists +15 Attack Speed | rerolls cost +1 |
| Frost Lattice | Array Masters apply 5 extra Frost per hit | −1 reserve slot |
| Wandering Cultivator | no bonus | +20% Renown XP and Funds for the run |
| Merchant's Way | shops show 1 extra Treasure | 1 fewer Spirit Stone per fight |

### 6.4 Heirloom Treasures

- **Recipes and crafting:** recipes come from the Renown track, achievements and the Bounty Board. Crafting costs
  Funds and Beast Cores, and a crafted heirloom is kept forever.
- **Bringing one into a run:** on the New Run screen you pick one, and it starts in the inventory.
- **Growth:** each victory while it is carried raises it a level (max 3) and improves its effect. This builds
  attachment across runs.
- **The four heirlooms (built, `src/content/heirlooms.ts`):** each has its own painted icon and an effect no shop
  Treasure has. Shop Treasures only ever help their bearer or hurt foes; heirlooms act for the whole sect.
  - *Sect Founder's Sword*: Attack and Crit. When an ally falls, the bearer gains +6/8/10% Attack and
    +6/8/10 Attack Speed for the rest of the fight, up to 3 times. At level 3 each fall also gives 15 Qi.
  - *Ancestral Jade Seal*: Max HP. At the start of each fight every ally gains a Qi Shield worth 5/7/9% of the
    bearer's Max HP for 10 s.
  - *Wandering Elder's Gourd*: Max HP and Spirit. Every 8/7/6 s the most wounded ally (the bearer included) is
    healed for 4/5/6% of the bearer's Max HP plus 40/50/60% Spirit and gains 6/8/10 Qi. At level 3 it also
    cleanses them.
  - *Storm-Calling Banner*: Spirit (and Attack Speed at level 3). Each time the bearer casts their technique,
    every ally gains +12/16/20 Attack Speed for 4/4/5 s and lightning strikes the bearer's target for
    50/65/80% Spirit.
- **Balance (decided 2026-11-10):** measured with the run simulator (scripts/sim.ts, with the heirloom carried),
  on Mortal, 60 runs, every heirloom at level 3. The table gives victories / runs reaching Realm II.

  | Carried | New | Old (stat heirlooms) |
  |---|---|---|
  | nothing | 13 / 45 | 13 / 45 |
  | Founder's Sword | 20 / 51 | 16 / 50 |
  | Jade Seal | 16 / 51 | 14 / 51 |
  | Elder's Gourd | 20 / 50 | 16 / 51 |
  | Storm Banner | 15 / 48 | 15 / 49 |

  In Realm I they help as much as the old ones. The Sword and the Gourd are a little stronger in the long Realm II
  fights. The Sword first gave +15% per fall and 25 Qi, and won 23 runs. It was lowered to stay a small helping
  hand.

### 6.5 Spirit Vein (capped sidegrades)

A web of about 12 nodes in three rings, with 10 points at L5. The whole web is worth about one contract tier.

**Example nodes:**
- +5 starting Spirit Stones (up to 3 times)
- the first reroll of each shop is free
- Time Reversal costs 5 fewer Stones
- the first disciple drafted starts with one Treasure socket filled by a random common Treasure
- +1 draft reroll
- the Sect Rest heals the whole party

**Pure runs** switch the Spirit Vein, doctrines and heirlooms off (11).

### 6.6 Disciple mastery

Each disciple earns mastery from fights won with them on the board. This is how all 16 existing disciples gain
exclusive content without new animations.

| Mastery | Wins | Reward |
| --- | --- | --- |
| 1 | 3 | a second lore page in the Compendium |
| 2 | 10 | an alternate aura colour in the arena |
| 3 | 20 | an **exclusive fourth Dao Path**, offered at Foundation |
| 4 | 35 | the title "Master of …" |
| 5 | 50 | a gilded card frame and a statue in the Hall of Ancestors |

### 6.7 Bounty Board

- **The board:** three standing bounties. A finished bounty is replaced by a new one when you return to the sect.
  Nothing expires on a clock.
- **Rewards:** each pays Funds and a material. Some pay a heirloom recipe.
- **Examples:**
  - win a fight with three Frost users on the board
  - clear Realm I with at least two Talisman Masters
  - finish a run having sold no disciple
  - reach the Golden Core contract's Realm II

### 6.8 Sect events between runs

Sometimes, about one return in three, something happens at the sect: a short choice with one or two lines of story.

**Examples:**
- *A rival sect's envoy issues a challenge.* Accept, and the next run's enemies deal +15% damage. Win it for a cache
  of Heavenly Jade.
- *A wandering alchemist offers a pill recipe.* Pay Herbs to add it to the Forge.
- *A disciple asks to go into seclusion.* That disciple skips the next run's draft and returns with a mastery level.

New foes can debut here (rival sect cultivators, a Heart Demon), as well as on the Ladder and in a future Daily
Tribulation.

## 7. Exclusive content and how it is unlocked

AutoSprite credits are being topped up, so exclusive disciples and enemies can be a main reward pillar.

| Content | Count | Unlocked by |
| --- | --- | --- |
| **Exclusive disciples** | 8 | Renown 10, 20, 25, 35, 45; Recruitment Hall L2 and L4; the achievement "Tribulation Survivor" |
| Exclusive fourth Dao Paths | 16 (one per current disciple) + 3 per new disciple | disciple mastery 3 |
| Dao Insights | 24 | Scripture Pavilion research, the Renown track |
| Treasures | 12 + 10 heirlooms | the Renown track, Artifact Forge recipes |
| Blessings | 6 | Training Grounds |
| Doctrines | 9 | Doctrine Hall, the Renown track |
| New foes | 6–10 | sect events, the Ladder, a Daily Tribulation |
| Cosmetics | ~24 avatars, ~20 titles, 7 class banners, card frames | Renown, achievements, mastery |

This content also moves the game toward its v1.0 targets in GAME_DESIGN.md: 25 disciples, 100 Treasures,
120 Dao Insights and 30 enemies.

**Working concepts for the exclusive disciples (names are placeholders):**
- a Sword–Array hybrid who lays frozen sword formations
- a Body Refiner who stores damage taken and releases it as a shockwave
- a Talisman Master whose talismans explode after a delay
- an Alchemist who turns Spirit Stones into healing
- a Shadow Walker who leaves mirror clones
- a Martial Artist who builds rage with every hit taken
- an Array Master with a spirit-beast companion
- a mythic Tribulation disciple who rides the lightning, for the final contract

**Assets per disciple:**
- a ChatGPT portrait
- an AutoSprite pack: idle, walk, attack, cast, hurt and death
- three Dao Path icons
- VFX entries

## 8. Achievements

Around 50 achievements, mirrored one-to-one to Steam. None requires a grind such as "win 1,000 runs". Together they
pay about 5,000 Renown XP, roughly a sixth of the track. Hidden ones show as "? ? ?" until earned. Each one should
teach something: try Frost, try Poison, take the Single Combat trial, field a Dao Companion pair.

| ID | Name | Condition | Reward |
| --- | --- | --- | --- |
| **Progress** | | | |
| ACH_FIRST_STEP | First Step on the Path | Win your first fight | 25 XP |
| ACH_RIFT_SEALED_1 | The Jade River Calmed | Defeat the Flood Dragon | 75 XP, 2 Jade |
| ACH_ASCENDED | Ascension | Clear both realms | 150 XP, 3 Jade |
| ACH_LADDER_5 | Five Rungs | Reach Heavenly Ladder floor 5 | 100 XP |
| ACH_LADDER_10 | Above the Clouds | Reach floor 10 | 150 XP |
| ACH_LADDER_20 | Touching Heaven | Reach floor 20 | 250 XP, title |
| **Contracts** | | | |
| ACH_CONTRACT_0 … _7 | Mortal Path, Qi Condensed, Foundation Laid, Golden Core Formed, Nascent Soul Born, Soul Formed, Void Refined, Tribulation Survivor | Clear both realms on that contract | 50 → 300 XP, rising Jade; the last one unlocks an exclusive disciple and a title |
| **Mastery** | | | |
| ACH_CLASS_SWORD … _ARRAY (7) | Way of the Sword, Way of the Body, … | Win a run with 3+ disciples of that class in the final fight | 75 XP, a class banner |
| ACH_HUNDRED_SCHOOLS | Hundred Schools | Win a run with each of the 16 disciples (over many runs) | 300 XP, avatar |
| ACH_NASCENT | Nascent Soul | Raise a disciple to Nascent Soul | 50 XP |
| ACH_FULL_HALL | Full Hall | Field 6 disciples on the board | 50 XP |
| ACH_COMPANIONS | Dao Companions | Win a fight with a Dao Companion pair on the board | 50 XP |
| ACH_MASTERY_5 | Master and Disciple | Raise a disciple to mastery 5 | title, Funds |
| **Builds** | | | |
| ACH_EMPTY_HANDS | Empty Hands | Win a run without equipping a Treasure | 150 XP, title |
| ACH_NO_REVERSAL | No Turning Back | Win a run without using Time Reversal | 100 XP |
| ACH_ETERNAL_WINTER | Eternal Winter | Freeze 5 enemies in one fight | 75 XP |
| ACH_HUNDRED_POISONS | Hundred Poisons | Stack 100 Poison on one enemy | 75 XP |
| ACH_NINE_SUNS | Nine Suns | Deal 5,000 Burn damage in one fight | 75 XP |
| ACH_SEEKER | Seeker of Hardship | Win each of the four Challenges at least once | 100 XP |
| ACH_DUEL | Duel of Fates | Win the Heavenly Trial with a Qi Condensation disciple | 75 XP |
| **Feats** | | | |
| ACH_MOUNTAIN_SPLITTER | Mountain-Splitting Strike | Deal 5,000 damage with a single hit | 75 XP |
| ACH_SWIFT_JUDGEMENT | Swift Judgement | Defeat the Flood Dragon within 25 seconds | 100 XP |
| ACH_LAST_STANDING | Last One Standing | Win a fight with one disciple left | 50 XP |
| ACH_UNTOUCHED | Untouched | Clear a realm without losing a disciple in any fight | 150 XP |
| ACH_TREASURY | Merchant of the Sect | Hold 150 Spirit Stones at once | 50 XP |
| ACH_OATH | Bound by Oath | Complete a Treasure or Dao Insight quest | 50 XP |
| **Discovery** | | | |
| ACH_CODEX_DISCIPLES | Roll of Disciples | Discover every disciple | 100 XP |
| ACH_CODEX_TREASURES | Treasure Vault | Discover every Treasure | 150 XP |
| ACH_CODEX_INSIGHTS | Library of the Dao | Discover every Dao Insight | 150 XP |
| ACH_CODEX_FOES | Demon Hunter's Almanac | Discover every foe | 100 XP |
| ACH_CODEX_ALL | Archivist | Discover everything | 300 XP, title |
| **Sect** (after phase 2) | | | |
| ACH_RISING_SECT | A Rising Sect | Reach Renown 10 | Funds, banner |
| ACH_HEIRLOOM | Heirloom | Craft a heirloom and win a run with it | Beast Cores |
| ACH_HOLY_LAND | Holy Land | Reach Renown 40 | Jade, title |
| **Secrets** (hidden) | | | |
| ACH_HUMBLING | A Humbling Start | Lose the very first fight of a run | 25 XP |
| ACH_FICKLE_FATE | Fickle Fate | Reroll 10 times in one shop | 25 XP |
| ACH_UNGRATEFUL | Ungrateful Master | Sell a Nascent Soul disciple | 25 XP |
| ACH_KARMA | Karmic Debt Repaid | A specific outcome of the Karmic Debt event | 50 XP |

**Tracking:** most conditions use counters the game already keeps:
- `RunStats`, `heroTotals` and `FightRecord` history
- quest counters for crits, kills, Frost, Burn, Poison, shields, healing and damage
- the Compendium's `meta.seen` lists

New hooks are needed for:
- the frozen-enemy count per fight
- the highest Poison stack
- shop rerolls per shop
- the party composition in the final fight

## 9. Screens and flow

- **Main menu:**
  - a profile plate: avatar, sect name, sect rank, Renown bar, title
  - a painted **sect banner** hanging at the right (`src/ui/components/SectBanner.tsx`), built 2026-11-10 because
    a small button was easy to miss. It invites the player in:
    - what the sect offers: heirloom Treasures, new Dao Insights, bounties and rewards, and new disciples (the
      Recruitment Hall, shown as coming soon). A part still locked shows the Renown that opens it.
    - one status line (`sectInvite` in `src/meta/sect.ts`): the first thing that can be crafted, studied or raised,
      else the next building to open, else the bounties
    - it glows when something can be done
    - before Renown 2 it is faded, shows the way to founding the sect and opens the Renown track
- **New Run:**
  - a **Doctrine** picker and a **Heirloom** picker, once those are unlocked
  - a **Pure run** toggle under "Advanced"
- **Sect Rewards (after every run):**
  - follows the run-end screen
  - Renown XP counts up line by line (fights, guardians, realms, contract multiplier, discoveries, achievements)
  - each level-up flips a reward card; Funds and materials fly into their counters (the existing CountUp and
    flyStones flourishes)
  - ends on **Return to the Sect**
- **Sect hub:** the painted panorama and its building panels (6.1).
- **Achievements:** a Hall of Merit tab in the Hall of Ancestors, also reachable from the menu, with categories,
  progress bars and hidden entries.
- **In-run toast:** a small stamped seal when an achievement unlocks mid-run. Steam's overlay shows its own as well.

## 10. Balance

- **Power budget (decided 2026-11-10):**
  - Spirit Vein, doctrines and heirlooms together are worth about one contract tier, about +12% team strength
    (roughly Foundation's "+20% enemy HP" in reverse).
  - The help is economic, not stats: a few extra starting Spirit Stones, a free first reroll per shop, a cheaper
    Time Reversal, one heirloom Treasure. It smooths bad luck without changing fight maths.
  - It is front-loaded: the first Spirit Vein points are the help, later ones are sidegrades (pick one of two).
  - Contracts stay the difficulty dial.
  - Renown levels never add raw stats.
- **Pure runs:**
  - the toggle switches off the Spirit Vein, doctrines and heirlooms
  - unlocked pool content stays, because it adds options, not power
  - a Pure run pays +20% Renown, so purists are not penalised
  - the Ladder records the flag, and Steam gets two Ladder leaderboards: Pure and Sect
- **Pool dilution:** every new Treasure or Insight makes a specific build harder to find. Seals in the Scripture
  Pavilion are the answer, and a reason to visit it.
- **Onboarding:** the first Renown levels open one building at a time (5.3).

## 11. Data and save

`MetaSave` gains these fields, all optional with defaults so older saves load:

```ts
version: 2;
profile: { sectName: string; avatar: string; title: string | null; banner: string };
renown: { xp: number };                      // level is derived from xp
funds: number;
materials: { herbs: number; cores: number; jade: number };
buildings: Record<BuildingId, number>;       // levels
research: string[];                          // studied bundles
seals: string[];                             // banned Treasure / Insight ids
recipes: string[]; heirlooms: { id: string; level: number }[];
doctrines: string[]; vein: string[];         // unlocked doctrines, spent Spirit Vein nodes
mastery: Record<string, number>;             // fights won per disciple
achievements: Record<string, number>;        // id -> unlock time (ms)
lifetime: { runs: number; wins: number; fights: number; kills: number; crits: number; bestHit: number; ... };
bounties: { id: string; progress: number }[];
```

- **Migration:** veterans get a one-time Renown credit from what the save already holds: `runsWon × 300 +
  runsPlayed × 80`, capped at Renown 15. Contract achievements up to `bestTierCleared` unlock retroactively.
- **Events:** a small run-event bus (`src/meta/events.ts`) emits fight won, guardian defeated, realm cleared,
  discovery, reroll, sell, rank up and quest done. Achievements, bounties and mastery listen to it, so the core
  rules in `run.ts` only emit and never decide rewards.
- **Payout:** `src/meta/rewards.ts` computes it from the finished `RunState`, so it can be unit tested. Tests cover
  the XP formula, the level curve, achievement triggers and migration.

## 12. Steam

- **Identity:** the Steam user is the account; no separate login. The sect name defaults to "<persona>'s Sect" and
  can be renamed.
- **Library:** [`steamworks.js`](https://github.com/ceifa/steamworks.js) in the Electron main process, exposed to
  the game through the preload bridge (`window.nineHeavens.steam`). It needs the Steamworks App ID (Steam Direct).
- **Achievements:**
  - API names equal our IDs, with 64×64 icons (painted plus a grey locked copy).
  - Achievements are stored locally first and mirrored to Steam at launch and on unlock, so offline play never
    loses one.
- **Steam Cloud:** use Auto-Cloud on the save folder, which needs no code. The meta save and the run save move from
  `localStorage` to JSON files in the app's user-data folder through the bridge; the web build keeps
  `localStorage`.
- **Leaderboards:** Heavenly Ladder (Pure and Sect), plus the Daily Tribulation later. Check that the library
  supports leaderboards before committing to it; Greenworks is the fallback.
- **Rich presence (optional):** "Climbing floor 7 on Golden Core".
- **Android:** a later port needs its own identity and cloud (for example Google Play Games saved games). Keeping
  the save as one JSON file keeps that door open.

## 13. Build order

1. **Renown and achievements.**
   - Scope:
     - Renown XP and levels, with the reward track (avatars, titles, frames)
     - the Sect Rewards screen after each run
     - the profile plate on the menu
     - lifetime stats
     - about 25 achievements with local tracking and an achievements screen
     - save version 2 and migration
   - Done when: every run pays and shows its payout, and tests cover the XP formula, achievements and migration.
2. **Sect hub, first buildings.**
   - Scope:
     - the hub screen with the Main Hall
     - the Scripture Pavilion (research and seals)
     - the Artifact Forge (heirlooms and the New Run picker)
     - the Bounty Board
     - Funds and materials from runs
     - the first 3 Insight bundles and 4 heirloom recipes
3. **Choices.**
   - Scope:
     - Doctrine Hall and the New Run picker
     - Spirit Vein and the Pure run toggle
     - Training Grounds and 6 blessings
     - disciple mastery and the first exclusive Dao Paths
4. **Exclusive disciples and foes.**
   - Scope:
     - the first 3 exclusive disciples (art, AutoSprite packs, Dao Paths, VFX)
     - the Recruitment Hall
     - sect events with the first new foes
     - the Hall of Ancestors
5. **Steam.**
   - Scope:
     - Steamworks bridge, achievements mirror
     - save files for Auto-Cloud
     - Ladder leaderboards and rich presence
6. **Later.** Daily Tribulation (seeded, with a leaderboard), the remaining exclusive disciples, the art tiers of the
   sect map, and prestige cosmetics.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| The meta feels like a grind | Payouts on defeat, no timers, a visible next reward, a finite sect |
| Power creep breaks contract balance | The power budget (10), the Pure toggle, contracts stay the dial |
| Pool dilution hides builds | Seals; unlocks arrive in themed bundles |
| Too many screens and currencies | Ideas 1 and 2 merged; one common currency plus three materials; buildings revealed gradually |
| Save migration bugs | Optional fields with defaults, a `version` field, migration tests |
| Art scope (hub tiers, avatars, icons, disciples) | Ship the hub with one art tier first; reuse painted icons in frames for achievements |

## Appendix: a related issue found while writing this

The Heavenly Ladder score counts nodes climbed, `(floor − 1) × 12 + node` in `endlessScore()` (`src/core/run.ts`).
The New Run Ladder panel, the main menu ("Best Ladder floor") and the run-end subtitle call it a *floor*. A run that
falls partway up floor 2 can show "Floor 17". Either show the real floor, or label the number as Ladder steps.
