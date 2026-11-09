# Visual audit — what made Nine Heavens look cheap, and what was done about it

Written 2026-11-09 during the polish pass. "Status" says whether the item is fixed in the current build.

## Art and presentation

| # | Issue | Why it reads as cheap | Status |
| --- | --- | --- | --- |
| 1 | Flat teal radial-gradient backgrounds on New Run, Settings, Draft, Rank-up, Compendium, Run End | Looks like a default CSS gradient, no sense of place; the painted arena made the contrast worse | Replaced with painted backgrounds: sect hall (New Run, Settings, Compendium), draft gate, breakthrough sky, victory dawn and defeat blood-moon scenes, each under a dark gradient so the panels stay readable |
| 2 | Panels drawn with 1 px CSS borders and two tiny corner brackets | Generic web-app look; no material or craftsmanship | Painted gold-and-jade 9-slice frame on every panel, rail, tooltip and the party bar |
| 3 | Buttons were CSS gradients with a rounded border | Reads as a website button, not a game button | Every control is a painted plaque from one family: jade (primary or selected), gold (special), crimson (danger) and a dark lacquer plaque derived from the jade one for everything else, all with the same gold trim; tabs and toggles switch from dark to jade when selected; clickable cards and tiles carry a slim ornate frame; toasts are plaques too. An automated scan of every screen (menu, settings, new run, Compendium, draft, board, pause menu, shop, events, rewards, challenges, results, realm cleared, run end) finds no unpainted button left |
| 4 | Monochrome mask icons (game-icons.net) tinted a single colour | Clip-art feel, inconsistent with the painted characters | Painted icons for all 40 Treasures, all 38 Dao Insights, all 56 class Insights, the 6 blessings and the Spirit Stone; painted emblems for the seven classes and for event choices; the Icon component uses painted art from 20 px up and keeps the crisp tinted glyphs for the small stat and keyword marks |
| 5 | Dark translucent ellipses under the hex board | Looked like a shadow blob pasted over the painting | Removed on painted arenas |
| 6 | Units floating above their hex, different anchor per animation | Breaks the illusion that fighters stand in the world | Feet anchored from pixel data, soft contact shadow, flyers hover intentionally |
| 7 | Fighters small relative to the arena, enemy waves huddled at the front of their zone | Battle lacks presence and the arena looks lopsided | Unit height 150 → 180, hex grid enlarged, both formations centred in their halves of the arena circle, board height tuned per arena painting; clips that AutoSprite rendered at a different zoom are normalised to the idle size |
| 8 | Procedural VFX were a few dots and rings; skills had no moment of their own | Hits felt weightless, casts went unnoticed | Procedural library plus additive flipbook sheets (fire, frost, lightning, heal, shadow, qi pillar, slash arc) generated as 4×4 frames on black; every cast gets a freeze-frame, tinted flash, qi pillar, glyph and a sweeping skill banner |
| 9 | Party bar: 64 px portraits, dim slot boxes, 11 px labels | Hard to read, looked like placeholder UI | Full-width plaque, wide horizontal hero blocks (portrait beside name and sockets, up to 104 px portraits that only shrink when Sect Expansions crowd the bar) |
| 10 | Hero card stats overlapping the name and rank glyph | Visible layout bug | Rank badge moved to the card corner; stats slide the nameplate up |
| 11 | Two panels placed so close their frames touched (result, rewards, rank-up options) | Cramped composition | Gaps widened to 44–48 px |
| 12 | Default HTML range sliders in Settings and the pause menu | Browser-default controls | Custom sliders: jade groove that fills with the value, gold diamond thumb that glows on hover |

## Typography and layout

| # | Issue | Status |
| --- | --- | --- |
| 13 | Many 11–12 px labels with wide tracking (rail titles, slot names, tier names) | Every size of 16 px and below raised by 1 px, and nothing in the UI is smaller than 12 px |
| 14 | Long single-column lists in the shop with empty space below | Stock rows rebuilt as cards: rarity stripe, 58 px painted icons, display-font names, gold price plaques; expansion tiles enlarged |
| 15 | Event panel is text-heavy with the choices as plain boxes | Each choice has a painted medallion (Treasure, Insight, fight, breakthrough, cultivation, gamble, leave, Spirit Stones) read from what it offers, and its keywords sit in coloured chips; Insight choice cards carry painted medallions |
| 16 | Compendium rows are plain lists | Treasures and Dao Insights are a four-column grid of cards with painted medallions, rarity-coloured names and stat chips |

## Motion and feedback

| # | Issue | Status |
| --- | --- | --- |
| 17 | Screens cut hard from one phase to the next | Cross-fade added |
| 18 | No feedback when Spirit Stones change | Counter pops |
| 19 | No hover sounds, no card flip or purchase flourish | Soft hover tick on every button, card and choice; shop, draft and reward cards flip in with a paper whoosh; a bought disciple, Treasure or Insight arcs to its party slot or rail with a gold burst |
| 20 | Damage numbers all the same weight apart from crits | Numbers are coloured by damage type and sized by amount (about 26 px for chip damage up to 40 px for big hits, crits larger), big hits rise higher and linger |

## Content presentation

| # | Issue | Status |
| --- | --- | --- |
| 21 | Enemies in the Compendium use the static sprite on a dark square | Each enemy stands on a crop of its realm's arena painting |
| 22 | Main menu has no motion besides embers | Welcome screen rebuilt: new key art (a jade stairway rising through nine celestial gates under nine golden rings), a painted Nine Heavens logo with a light sweep and a slow float, a breathing glow on the great gate, drifting mist, falling cherry petals and rising motes, pointer parallax, centred hero plaques; the logo also opens the loading screen and became the app icon |
| 23 | Loading is instantaneous but assets pop in (portraits, sprites) | Loading veil with the sect seal and a progress bar while paintings, portraits, flipbooks and all sprite packs preload (lifts after ~1 s when cached, 9 s at most) |
