# NINE HEAVENS — Game Design Document

*A xianxia roguelike auto-battler. PC first (Windows), Android second.*
*Reference: Guildrun (Leyline, 2026). This document is the build spec.*

---

## 1. Fantasy & Pitch

The Heavenly Dao has fractured. **Tribulation Rifts** (天劫裂隙) tear open across the mortal realm and pour demonic qi
into the world. You are the Elder of a small, nearly forgotten sect. Recruit wandering cultivators, forge them into a
team, and send them up the **Heavenly Ladder** — sealing rifts realm by realm until you face the Tribulation itself.

**One run ≈ 20–25 minutes.** Place disciples on a hex arena, watch combat resolve automatically, then make every real
decision between fights: the shop, events, **rank-ups** (cultivation breakthroughs), **Treasures** (items) and
**Dao Insights** (team-wide relics). Class roles are suggestions, not rules — a healer can become a tank, a tank a carry.

## 2. Pillars

1. **Decisions between fights, spectacle during fights.** Combat is hands-off and gorgeous; the strategy is in the draft.
2. **Bend the cultivator.** Every hero has 3 Dao Paths at Foundation rank that can add a second class; items reshape roles.
3. **Readable premium presentation.** Modern flat UI, ink-and-jade palette, gold accents, calligraphy motifs; big juicy
   damage numbers, qi auras, flying swords, talisman bursts.
4. **Short, replayable, climbable.** 2 Realms + Endless Ladder; 8 stacking difficulty tiers named after cultivation realms.

## 3. Glossary (Guildrun → Nine Heavens)

| Guildrun | Nine Heavens | Notes |
|---|---|---|
| Shards | **Spirit Stones** (灵石) | currency |
| Heroes | **Disciples / Cultivators** | |
| Rank C / B / A / S | **Qi Condensation / Foundation / Golden Core / Nascent Soul** | shown as 炼 / 筑 / 丹 / 婴 glyph + rank letter |
| Specialization (Rank B) | **Dao Path** | 3 fixed choices per hero |
| Class upgrade (Rank A/S) | **Insight** | random from class pools |
| Items | **Treasures** (法宝) | equipped per hero, 3 slots |
| Relics | **Dao Insights** (道悟) | team-wide passives, some with quests |
| Mana | **Qi** | |
| Shields | **Qi Shield** (护体罡气) | |
| Rush | **Surge** | start of fight, timed |
| Stall | **Enlightenment** | after N seconds, permanent |
| Backup | **Meditation** | works from the reserve |
| Lovers | **Dao Companions** (道侣) | pair bonus |
| The Storm | **Heavenly Tribulation** | lightning after 50 s |
| Emergency Rewind | **Time Reversal Talisman** | pay stones to retry a lost fight |
| Rift / Act | **Realm** | |
| Red Rift | **Heavenly Tribulation** difficulty | top tier |

## 4. Run Structure

- **Realm I — Azure Bamboo Province** (mortal world: bamboo forest, mountain sect ruins, jade river). Boss: **Flood Dragon of the Jade River** (蛟龙).
- **Realm II — Blood Moon Abyss** (demon wastes: crimson wasteland, ruined demon palace). Boss: **Blood Moon Demon Sovereign**.
- **Endless — Heavenly Ladder**: floors with scaling enemies until defeat; local leaderboard (floor reached).

Each Realm has 12 nodes, shown on the HUD timeline:

| # | Node | Notes |
|---|---|---|
| 1 | Fight | regular |
| 2 | Event | random |
| 3 | Fight | regular |
| 4 | Challenge Fight | pick a modifier for a bonus reward (or decline) |
| 5 | Event | random |
| 6 | Fight | regular |
| 7 | Trial Event | 1v1 single combat for a chosen reward |
| 8 | Elite Fight | elite enemy; reward: choose 1 of 3 Dao Insights |
| 9 | Fight | regular |
| 10 | Event | Sect Rest (campfire) |
| 11 | Fight | regular |
| 12 | Boss | Realm boss → "RIFT SEALED" |

After **every** fight: Battle Result screen → Shop → next node. The very first node is preceded by the **Starter Kit** event.

**Defeat**: if all disciples fall, the run ends — unless you spend Spirit Stones on a **Time Reversal Talisman**
(cost 30, +20 per use) to return to the pre-fight shop.

**Difficulty tiers** (each stacks all lower modifiers; unlocked sequentially by clearing the previous):

| Tier | Name | Modifier |
|---|---|---|
| 0 | Mortal | none |
| 1 | Qi Condensation (C) | Disciples take 10% max HP damage at start of each combat |
| 2 | Foundation (B) | Enemies have +20% HP |
| 3 | Golden Core (A) | Earn 1 fewer Stone per surviving disciple |
| 4 | Nascent Soul (S) | Disciples can only equip 1 Treasure per rank |
| 5 | Soul Formation (SS) | Enemies deal +15% damage |
| 6 | Void Refinement (SSS) | Shop prices +20% |
| 7 | Heavenly Tribulation | Tribulation lightning starts at 40 s; bosses have +1 ability |

## 5. Economy (Spirit Stones)

- Start: **30**. Starter Kit may change it.
- Battle won: **20** (Realm I) / **25** (Realm II) / **30** (Endless), **+1 per surviving disciple**. Quests and Insights add more.
- Shop (after each fight): **3 disciples, 2 Treasures, 1 Dao Insight**; occasionally a *SALE* tag (−40%).
  - Disciple prices by rank: C **15**, B **25**, A **35**, S **50**.
  - Treasures: common **5**, rare **12**, epic **20**, unique **15**.
  - Dao Insights: common **8**, rare **15**, epic **30**; team-size Insights **40** (party +1) / **25** (reserve +1).
  - **Reroll**: cost = 1 + rerolls this shop (Realm II: 2 + …). Resets each shop.
  - **Freeze**: keep current offers for the next shop (free, toggle).
  - **Sell**: drag a disciple or Treasure onto the sell zone → 50 % of base value (disciples add +5 per rank).
- Buying a disciple you already own **ranks them up** (C→B→A→S); shops may offer higher-rank copies directly. Buying a
  higher-rank copy of an owned disciple sets rank = max(current + 1, offered).
- Team: **party 5** on the board, **roster 6** (1 reserve). Team-size Insights extend both (max party 6, reserve 3).

## 6. Disciples

### 6.1 Stats

| Stat | Icon | Meaning |
|---|---|---|
| HP | heart | pool; resets every fight |
| Qi | drop | mana; active ability casts when full, then resets to 0 |
| Attack | fist | auto-attack damage; physical abilities scale with it |
| Attack Speed | wind | attacks/s = base × (1 + AS/100); cap 5/s |
| Spirit | lotus | magic power; spells and most effects scale with it |
| Crit | flame-eye | % chance; crit = ×2; above 100 adds to the multiplier |
| Defense | shell | damage × 100 / (100 + Def); ignored by Burn/Poison/True damage |
| Range | arrow | hex range; melee 1, ranged 3–5 |

Qi gain: +5 per auto-attack dealt, +3 per hit taken, +Qi Regen/s from items/classes.

### 6.2 Classes (7)

| Class | 字 | Role | Growth per rank | Affinities |
|---|---|---|---|---|
| Sword Cultivator | 剑 | damage | +15% Attack, +5 Crit | Crit, Surge, flying swords |
| Body Refiner | 体 | tank | +20% HP, +10 Def | Qi Shield, Taunt |
| Talisman Master | 符 | mage | +20% Spirit, +2 Qi regen | Burn, Lightning |
| Alchemist | 丹 | support | +12% Spirit, +10% HP | Heal, Poison, Qi |
| Shadow Walker | 影 | assassin | +8 Crit, +10% Attack; targets lowest-HP enemy | Poison, Execute |
| Martial Artist | 武 | duelist | +15 AS, +10% Attack | Omnivamp, Enlightenment |
| Array Master | 阵 | mystic | +15% Spirit, +5 Qi | Frost, debuffs, Meditation |

Class tags are shared: an upgrade that reads "Sword Cultivators gain…" applies to every disciple with that tag, including
second classes gained from Dao Paths.

### 6.3 Ranks

- **炼 Qi Condensation (C)**: base stats, basic active ability.
- **筑 Foundation (B)**: choose **1 of 3 Dao Paths** (fixed per hero). Some grant a 2nd class.
- **丹 Golden Core (A)** and **婴 Nascent Soul (S)**: class stat growth + choose **1 of 3 Insights** drawn from the pools of all the hero's classes.

Rank-up plays a full-screen splash ("FOUNDATION ESTABLISHED") then the choice panel.

### 6.4 Roster (16 at launch)

| Id | Name | Class | Active ability (casts at full Qi) | Dao Paths (B) |
|---|---|---|---|---|
| li_jian | Li Jian 李剑 | Sword | **Flying Sword**: sword strikes target for 180% Atk + 60% Spirit, returns. Range 2. | Sword Heart (crits +25% dmg) · Ten Thousand Swords (+Talisman class, Flying Sword hits 3) · Unyielding (+Body Refiner, shield on cast) |
| shan_tie | Shan Tie 山铁 | Body | **Unmoving Mountain**: Qi Shield 25% max HP, Taunt adjacent 3 s. | Iron Skin (+Def per shield) · Avalanche (shield → dmg on expiry) · Guardian (+Alchemist, shields lowest ally too) |
| hong_lian | Hong Lian 红莲 | Talisman | **Crimson Lotus**: burn 3 nearest enemies 15 + 40% Spirit per second for 4 s. | Inferno (burn spreads on death) · Lotus Heart (+Alchemist, burns heal allies 20%) · Phoenix Talisman (Surge 8: +60% Spirit) |
| mei_yao | Mei Yao 梅瑶 | Alchemist | **Nine-Turn Pill**: heal lowest ally 200 + 250% Spirit; cleanses. | Elixir of Life (overheal → shield) · Poison Pill (+Shadow, heals also poison nearest enemy) · Sect Physician (Meditation: heal party from reserve) |
| ying_wu | Ying Wu 影无 | Shadow | **Shadow Step**: blink to lowest-HP enemy, strike 250% Atk, apply 3 Poison. | Assassinate (execute <15%) · Venom Dao (poison ×2) · Phantom (+Martial, +40 AS after cast) |
| tie_quan | Tie Quan 铁拳 | Martial | **Hundred Fists**: 6 strikes × 55% Atk in 1 s, +10 AS per cast (stacks). | Iron Body (+Body Refiner, 15% omnivamp) · Tempo (Enlightenment 10: AS ×1.5) · Breaker (hits reduce Def 5) |
| xuan_bing | Xuan Bing 玄冰 | Array | **Frost Array**: all enemies gain 20 Frost (−AS, −move) for 5 s; 60% Spirit dmg. | Permafrost (frost never expires) · Glacier (+Body, shield allies 100% Spirit) · Shatter (frozen enemies take +30%) |
| lei_zhen | Lei Zhen 雷震 | Talisman | **Heavenly Thunder**: 3 bolts on random enemies 120% Spirit, stun 0.8 s. | Chain Lightning (bolts chain) · Storm Caller (Enlightenment 15: +1 bolt per cast permanently) · Thunder Body (+Martial, on hit 15% bolt) |
| long_mu | Long Mu 龙目 | Sword (ranged, range 5) | **Sun-Shooting Arrow**: pierce line 220% Atk. | Eagle Eye (+30 Crit, +1 range) · Rain of Arrows (+Array, 3 arrows) · Hunter (bonus dmg vs full HP) |
| bai_hu | Bai Hu 白虎 | Body / beast | **Tiger Form**: Enlightenment 12: +50% Attack, 25% omnivamp, taunt. | White Tiger (+Martial, +AS) · Thick Hide (+Def) · Apex (kills → +Max HP permanently) |
| qing_feng | Qing Feng 青风 | Martial (spear, range 2) | **Gale Thrust**: hit 3 in a line 160% Atk; Surge 6: +60 AS. | Whirlwind (hits all adjacent) · Swift Dao (+Shadow, Surge lasts +4 s) · Spear Saint (+Sword class, crit chance from AS) |
| yue_ling | Yue Ling 月灵 | Array / support | **Moonlit Qi**: give all allies 20 Qi + 10% Spirit as shield. | Qi Fountain (Qi regen aura) · Lunar Veil (+Alchemist, heals on cast) · Dao Companion (Li Jian pairing bonus doubled) |
| hei_yan | Hei Yan 黑岩 | Body / demonic | **Obsidian Shell**: convert 30% dmg dealt into Qi Shield for 6 s. | Juggernaut (permanent conversion 10%) · Demonic Core (+Shadow, shield → Attack) · Bulwark (adjacent allies share 20% of shield) |
| zhu_sha | Zhu Sha 朱砂 | Alchemist / poison | **Cinnabar Smoke**: 4 Poison to all enemies, allies +10 Spirit for 5 s. | Toxicologist (+Shadow, poison crits) · Antidote (poison heals party 15%) · Alchemy Furnace (item effects +25%) |
| gu_lao | Gu Lao 古老 | Talisman / Alchemist | **Sutra Chant**: heal party 120% Spirit; Meditation: 50% from reserve. | Bodhi Mind (+Qi regen) · Vajra Body (+Body, heals also shield) · Wandering Monk (cheaper shop rerolls) |
| feng_huang | Feng Huang 凤凰 | Sword / Talisman | **Nirvana Flame**: burn target 200% Spirit; on first death revive at 30% HP. | Rebirth (revive at 60%) · Fire Sword (+Talisman burn on hit) · Ashes (allies gain Attack when she dies) |

Dao Companions: **Li Jian + Yue Ling**, **Bai Hu + Xuan Bing**, **Tie Quan + Zhu Sha** — when both fight, each gains
+2% Attack & Spirit per second of combat (stacking).

### 6.5 Insight pools (Golden Core / Nascent Soul picks)

Each class has ~8 Insights; examples: Sword "Keen Edge" (+20 Crit), "Sword Rain" (crits hit an extra adjacent enemy);
Body "Mountain Heart" (+400 HP), "Riposte" (shielded: reflect 20%); Talisman "Overflow" (casts refund 20 Qi);
Alchemist "Lingering Pill" (heals +15% over 3 s); Shadow "Bloodlust" (kills restore 15% HP); Martial "Flurry" (+35 AS);
Array "Chill Winds" (auto-attacks apply 1 Frost).

## 7. Board & Positioning

- Hex grid, **9 columns × 6 rows**, pointy-top hexes rendered with a slight perspective squash. Player placement zone =
  bottom 2 rows (+ middle row for melee in Endless); enemy zone = top rows.
- Drag disciples between hexes and party/reserve slots before pressing **FIGHT**. Positions persist between fights.
- During combat units path toward their target (A* on hexes), stopping at range. Melee heroes should be in the front row;
  ranged in the back. Enemies target nearest by default; assassins/Shadow Walkers target lowest HP.

## 8. Combat Rules

- Deterministic tick simulation at **20 ticks/s** with a seeded RNG; the renderer plays back at 1×/2×/3×. "AUTO" toggles auto-start of fights.
- Auto-attacks: damage = Attack × class multiplier (Sword 1.2, Martial 1.0, Body 0.8, Talisman 0.6 + 40% Spirit, …) → crit → Defense.
- Statuses: **Burn** (true dmg/s, duration), **Poison** (stacks; stacks × 2 true dmg/s, −1 stack/s), **Frost** (stacks; −1% AS & move per stack, max 60; at 60 → frozen 1.5 s), **Stun**, **Taunt**, **Qi Shield** (absorbs; "lasting" ignores the 6 s expiry), **Omnivamp** (heal % of all dmg dealt), **Bleed** (physical dot).
- **Heavenly Tribulation**: at 50 s (40 s on top tier) lightning strikes every unit each second for 4% max HP, +1%/s.
- Fight end: all enemies dead → WIN (surviving disciples counted); all disciples dead → LOSS → Time Reversal offer or run end.
- Results screen: damage dealt / taken / healed per disciple (tracker tabs), stones earned breakdown, completed quests.

## 9. Enemies

**Realm I**: Spirit Wolf (fast melee), Jade Serpent (ranged poison), Bamboo Demon (tank), Corrupted Disciple (melee sword),
Ghost Lantern (burn caster), Moss Golem (elite: shields), **Flood Dragon** (boss: tail sweep AoE, water breath line, dive).
**Realm II**: Blood Bat (lifesteal swarm), Demon Soldier (melee), Bone Mage (frost caster), Flesh Golem (tank, regen),
Shadow Stalker (assassin), Demon General (elite: taunt + cleave), **Blood Moon Sovereign** (boss: blood nova, summon bats, enrage at 50%).
Encounter power scales with node index and tier; the HUD shows **Tribulation Level**.

## 10. Treasures (items) — 3 slots per disciple

~40 at launch across common / rare / epic / unique. Examples: Azure Sword Talisman (+15 Atk), Jade Vitality Pendant (+200 HP, +25 Qi),
Spirit-Gathering Flag (+15 Qi, +12 Spirit), Thunder Bead (on hit 10 %: lightning 80 % Spirit), Blood Gourd (+15 % omnivamp),
Tortoise Shell (+30 Def), Phoenix Feather (revive once at 30 %), Cinnabar Brush (on hit: 1 Burn), Frost Jade Ring (on hit: 2 Frost),
Qi Pill Bottle (+3 Qi regen), Dragon Scale Armor (epic: +400 HP +40 Def), Seven-Star Sword (epic: +40 Atk +20 Crit),
Heavenly Scripture (epic: +60 Spirit, casts refund 15 Qi). Some carry **quests** ("Crit 10 times → gain 15 Stones").

## 11. Dao Insights (relics)

~45 at launch. Team-wide passives: "Sword Heart Sutra: Sword Cultivators gain 10 Crit", "Nine Suns Manual: at start of combat inflict 5 Burn on all enemies",
"Qi-Gathering Formation: front-row disciples gain 300 Max HP", "Spirit Stone Vein: +2 Stones per fight", "Outer Court: +1 reserve slot",
"Inner Court: +1 party slot", "Karmic Mirror: on Crit, the disciple heals 30 and gains 3 Qi", "Thousand-Li Boots: Surge effects last +2 s".
Quest Insights: "Win 3 combats → 25 Stones", "Inflict 200 Frost → disciples gain 30 Def".

## 12. Events

Starter Kit (Stones / Treasures / Stats) · Abandoned Cave Dwelling (choose 1 of 3 unique Treasures) · Spirit Spring (drink: 66 % boon / 33 % bane) ·
Wandering Merchant (discount shop) · Sect Banner (choose a class Insight) · Demon Beast Nest (protect egg → delayed epic Treasure) ·
Bodhi Tree (pay stones to rank up a disciple) · Alchemy Furnace (merge 2 Treasures into a better one) · Heavenly Trial (1v1 single combat for a chosen reward) ·
Sect Rest (campfire: +Stones, or permanent +stat for one disciple) · Karmic Debt (gamble) · Mysterious Elder (random Insight).

## 13. Screens & UX

Main Menu → New Run (tier select + modifiers list + local leaderboard) → Choose Disciple (3 cards, reroll 1 stone, pick 1 of 3 Blessings) →
Run (HUD: top bar = Stones · node timeline · Tribulation Level · battle speed/AUTO; left = Dao Insight icons; right = combat tracker;
bottom = PARTY | RESERVE slots with portraits and Treasure slots) → Battle board (FIGHT) → Battle Result → Shop → Event → Rank-up → Rift Sealed → Victorious / Fallen (3 MVP cards with titles, stars; Summary; New Run).

Tooltips on hover (desktop) / long-press (Android); **Hold Shift** shows exact scaling values. Hero cards are tall pennant-shaped banners with the
portrait, class glyphs on the sides, keyword tags, name, rank glyph and HP/Qi bars. Rank letters use gold (B) / crimson (A) / violet (S).

## 14. Art Direction

- **UI**: modern flat; deep ink-teal panels (#0d1a1b/#13262a) with 1-px gold (#d4a84b) hairlines, jade (#3fbf9f) primary actions,
  vermilion (#c8352b) for enemies/danger, violet (#8e6cf5) for Spirit, paper (#f0e9d8) text. Calligraphy glyph watermarks (道 剑 气 丹 阵 影 武 体 符).
  Auspicious-cloud (祥云) corner ornaments. Fonts: *Cinzel* (display), *Noto Sans* (body), *Ma Shan Zheng* (calligraphy accents).
- **Characters**: cel-shaded painterly full-body portraits (card art) with flowing robes, flying swords, talismans; side-view battle sprites animated via autosprite (idle · attack · hurt), flipped by facing.
- **Arenas**: Realm I bamboo-and-jade courtyard with spirit stones; Realm II crimson wasteland under a blood moon; Ladder: cloud sea with golden pillars.
- **VFX**: qi auras, sword trails, talisman glyph bursts, lightning, frost crystals, lotus-fire; screen shake, hit-stop, hit flash, large stylized damage numbers.

## 15. Tech

Vite + TypeScript; PixiJS 8 battle canvas; Preact + signals DOM UI scaled to a 1920×1080 design space; GSAP tweens; Howler audio.
Pure simulation module (`src/battle/sim`) is renderer-agnostic and unit-tested with Vitest. Electron for Windows; Capacitor for Android.
Save data: local JSON (localStorage web / userData file in Electron) with mid-run save & resume.

## 16. Content Targets (v0.1 → v1.0)

| | v0.1 (this build) | v1.0 |
|---|---|---|
| Disciples | 16 | 25 |
| Dao Paths | 48 | 75 |
| Treasures | 40 | 100 |
| Dao Insights | 45 | 120 |
| Enemies | 14 + 2 bosses | 30 + 4 bosses |
| Events | 12 | 25 |
| Realms | 2 + Endless | 3 + Endless |
