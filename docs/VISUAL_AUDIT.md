# Visual audit — what made Nine Heavens look cheap, and what was done about it

Written 2026-11-09 during the polish pass. "Status" says whether the item is fixed in the current build.

## Art and presentation

| # | Issue | Why it reads as cheap | Status |
| --- | --- | --- | --- |
| 1 | Flat teal radial-gradient backgrounds on New Run, Settings, Draft, Rank-up, Compendium, Run End | Looks like a default CSS gradient, no sense of place; the painted arena made the contrast worse | Replaced with painted backgrounds: sect hall (New Run, Settings, Compendium), draft gate, breakthrough sky, victory dawn and defeat blood-moon scenes, each under a dark gradient so the panels stay readable |
| 2 | Panels drawn with 1 px CSS borders and two tiny corner brackets | Generic web-app look; no material or craftsmanship | Painted gold-and-jade 9-slice frame on every panel, rail, tooltip and the party bar |
| 3 | Buttons were CSS gradients with a rounded border | Reads as a website button, not a game button | Painted jade / gold / crimson plaques (9-slice) with the gold trim; the hero buttons keep the full ornament |
| 4 | Monochrome mask icons (game-icons.net) tinted a single colour | Clip-art feel, inconsistent with the painted characters | Painted icons for all 40 Treasures, all 38 Dao Insights, all 56 class Insights, the 6 blessings and the Spirit Stone; the Icon component uses them from 20 px up and keeps the crisp tinted glyphs for the small stat and keyword marks |
| 5 | Dark translucent ellipses under the hex board | Looked like a shadow blob pasted over the painting | Removed on painted arenas |
| 6 | Units floating above their hex, different anchor per animation | Breaks the illusion that fighters stand in the world | Feet anchored from pixel data, soft contact shadow, flyers hover intentionally |
| 7 | Fighters small relative to the arena, enemy waves huddled at the front of their zone | Battle lacks presence and the arena looks lopsided | Unit height 150 → 180, hex grid enlarged, both formations centred in their halves of the arena circle, board height tuned per arena painting; clips that AutoSprite rendered at a different zoom are normalised to the idle size |
| 8 | Procedural VFX were a few dots and rings | Hits felt weightless | Slash arcs, sparks, shockwaves, beams, shards, fire columns, smoke, motes, domes, wisps, glyphs, hit-stop, screen flashes |
| 9 | Party bar: 64 px portraits, dim slot boxes, 11 px labels | Hard to read, looked like placeholder UI | Full-width plaque, wide horizontal hero blocks (portrait beside name and sockets, up to 104 px portraits that only shrink when Sect Expansions crowd the bar) |
| 10 | Hero card stats overlapping the name and rank glyph | Visible layout bug | Rank badge moved to the card corner; stats slide the nameplate up |
| 11 | Two panels placed so close their frames touched (result, rewards, rank-up options) | Cramped composition | Gaps widened to 44–48 px |
| 12 | Default HTML range sliders in Settings and the pause menu | Browser-default controls | Partially styled (accent colour); custom slider art still to do |

## Typography and layout

| # | Issue | Status |
| --- | --- | --- |
| 13 | Many 11–12 px labels with wide tracking (rail titles, slot names, tier names) | Slot names raised to 12–13 px; others still small — raise the HUD type scale by ~10 % |
| 14 | Long single-column lists in the shop with empty space below | Stock rows rebuilt as cards: rarity stripe, 58 px painted icons, display-font names, gold price plaques; expansion tiles enlarged |
| 15 | Event panel is text-heavy with the choices as plain boxes | Accent bar on choices; choice icons and keyword chips would help. Insight choice cards now carry painted medallions and hug their content |
| 16 | Compendium rows are plain lists | Acceptable, but item and relic cards would benefit from painted icons (in progress) |

## Motion and feedback

| # | Issue | Status |
| --- | --- | --- |
| 17 | Screens cut hard from one phase to the next | Cross-fade added |
| 18 | No feedback when Spirit Stones change | Counter pops |
| 19 | No hover sounds, no card flip or purchase flourish | Still to do (needs a short UI sound set and a GSAP flourish on purchase) |
| 20 | Damage numbers all the same weight apart from crits | Still to do: colour by damage type is in, scale by amount is not |

## Content presentation

| # | Issue | Status |
| --- | --- | --- |
| 21 | Enemies in the Compendium use the static sprite on a dark square | Acceptable; painted backplates would be nicer |
| 22 | Main menu has no motion besides embers | Add slow parallax on the key art and a soft light sweep on the title |
| 23 | Loading is instantaneous but assets pop in (portraits, sprites) | Add a short loading veil with the sect seal while the sprite packs and paintings preload |
