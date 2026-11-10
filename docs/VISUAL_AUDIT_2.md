# Visual audit 2: what still keeps Nine Heavens from looking like a premium modern game

Written 2026-11-10. Every screen and state was opened in the dev build at a native 1920×1080 (regions inspected at 1:1), plus wide, tall and 1024-wide windows. Text sizes and contrast were measured on each screen with a DOM scan. The first audit (docs/VISUAL_AUDIT.md) is fully done; nothing below repeats it unless it still shows.

**Summary.** The art direction is now strong: the key art, logo, painted arenas, character portraits, painted plaques and frames all read as a real game. What still reads as cheap is mostly *around* the art. Text is small and often sits on bright paintings without a plate. Key information hides behind hover (abilities, stat meanings, what the next node holds). Three icon languages are mixed: painted icons, tinted glyphs and Unicode symbols. Big moments such as victory, breakthrough, realm clear and boss fights are presented as plain panels. The battle itself loses readability once the melee starts: fighters collapse into one knot and their bars are flat strips. Standard desktop-game features are also missing: a Quit button, fullscreen, hotkeys, text size and accessibility options.

How to read it:
- **Priority.** P1 is seen in every run or blocks understanding. P2 is clearly below the standard of modern games. P3 is polish.
- **Effort.** S is under half a day, M is one to two days, L is several days or needs new art.

---

## A. Global: typography, contrast, iconography

**A1. Small type on nearly every screen** (P1, M)
- **Where:** the scan found text under 14 px on almost every screen.
  - 12 px: the realm subtitle, rail titles, counts, encounter kicker, damage-meter title, New Run tier names, result-table headers and legend, challenge and Dao Path "kind" labels, Rift Sealed stat labels, and the SALE tag.
  - Keyword tags are 12 px: 29 on Compendium Disciples, 41 on Enemies, 7 on the draft and 6 in the shop.
  - 12–13 px: hero-card stat numbers and "Qi to cast".
  - 13 px: the Classes tab has 140 text runs and 56 insight names at this size.
  - 12–13 px: hero tooltip labels.
- **Problem:** the UI scales with window height. On a 1366×768 laptop, 12 px renders at about 8.5 px.
- **Modern standard:** TFT, Hades and Slay the Spire keep body text at 16–20 px at 1080p and never go under about 14 px.
- **Fix:** add type tokens: a 14 px minimum for caps labels, 16 px body and 18 px for emphasis. Apply them through polish.css and pair them with a text-size setting (I3).

**A2. Text on bright paintings without a plate** (P1, S)
- **Where:**
  - The realm subtitle "Azure Bamboo Province" is grey on the sunlit arena.
  - The Dao Path and Insight subtitles ("Li Jian has reached Foundation…") are almost invisible over the golden mandala.
  - The boss name "Flood Dragon of the Jade River" is dark red on the red abyss.
  - The draft and challenge subtitles sit on busy paintings.
- **Modern standard:** text sits on a scrim, plate or strong shadow, with at least 4.5:1 contrast.
- **Fix:** add a soft dark plate or gradient scrim behind every heading or subtitle that sits on art. Give overhead labels a heavy outline and drop shadow. Draw the boss name in light gold.

**A3. Three icon languages mixed** (P2, M)
- **Where:** painted icons for Treasures and Insights sit next to tinted mono glyphs for stats (the ≤ 20 px rule). Unicode symbols appear too:
  - "‹ Back"
  - "◆" section bullets
  - "▲ Rank Up"
  - "■" legend squares
  - "★★★" run-end ratings
- **Problem:** the painted art looks premium. The glyphs look like web fonts next to it.
- **Fix:**
  - Paint a small set of icons (HP, Qi, Attack, Spirit, Defense, Attack Speed, Crit, Range, shield, back arrow, bullet ornament, star pip, rank-up arrow) at 32–48 px, readable down to 18 px.
  - Replace every Unicode symbol with them.

**A4. Cultivation ranks shown as the letters C, B and A** (P2, S)
- **Where:** circles on hero cards and party slots. The tooltip says "Qi Condensation · Rank C".
- **Problem:** the letters read as a school grade or a rarity tier, not as a cultivation realm.
- **Modern standard:** TFT shows star pips. Xianxia games use realm seals.
- **Fix:** paint a rank seal per realm (realm hanzi plus 1–3 pips, colour-stepped), with the realm name on hover.

**A5. Classes shown only as a hanzi in a diamond** (P3, S)
- **Where:** 符, 影 and 体 on hero cards.
- **Problem:** this is decorative, but players who don't read Chinese can't decode it without hovering.
- **Fix:** use the painted class emblems the game already has, with the class name on the card or in the tag row.

**A6. Keyword chips drawn over the portraits** (P1, S)
- **Where:** the draft, shop disciple cards, Compendium Disciples and the rank-up hero card.
  - TAUNT, ENLIGHTENMENT, COMPANION, CRIT and POISON cover hands, faces and weapons.
  - Long chips run past the card edge.
- **Modern standard:** card art stays clean, and traits sit in a dedicated strip (TFT shop, Backpack Battles).
- **Fix:** move the chips into a trait strip under the portrait or nameplate. Show them as icon plus word at 14 px or more, at most three, with "+N" for the rest.

**A7. Key information hidden behind hover** (P1, M)
- **Where:**
  - A disciple's ability is only in the tooltip of the small diamond at the bottom of the card.
  - Card stats are unlabelled glyph numbers (50, 0, 10, 1, 45…).
  - The node timeline only says "Encounter · Node 1 of 12".
  - The top-right "0" is the Tribulation Level, with no label.
- **Modern standard:** the essentials are on the surface, and hover adds depth. TFT shows traits and cost on the card and the full ability when you hover the whole card.
- **Fix:**
  - Hovering anywhere on a card opens the full ability tooltip.
  - Cards show role, class and two key stats permanently.
  - Counters get a word label.
  - Nodes get preview cards (C2).

**A8. Default OS cursor** (P3, S)
- **Modern standard:** premium 2D games ship a themed cursor.
- **Fix:** a jade-and-gold brush-tip cursor with a pressed state, plus a grab hand while dragging.

**A9. Redundant labels** (P3, S)
- **Where:**
  - The encounter banner shows "REGULAR ENCOUNTER" as both kicker and title.
  - Run End shows each disciple's name twice: card and plaque.
- **Fix:** drop the duplicate, or use the kicker for useful information such as the enemy count or the reward.

---

## B. Main menu and out-of-run screens

**B1. No Quit button on the main menu** (P1, S)
- **Where:** the main menu has Continue, New Run, Compendium, Settings and Credits.
- **Problem:** this is a desktop app, and every PC game offers Quit.
- **Fix:** add a "Leave the Sect" plaque that closes the window through Electron.

**B2. The menu stats line looks like debug text** (P3, S)
- **Where:** "Runs · Victories · Best Ladder floor" is small and bottom-left. "v0.1.0 · pre-alpha" is 13 px and low contrast.
- **Fix:** add a small profile plaque (sect name, runs, best floor) or move the records to the Compendium. Style the version tag.

**B3. No characters on the title screen** (P3, M)
- **Modern standard:** Hades, TFT and Backpack Battles put characters on the title.
- **Fix:** stand a featured disciple (rotating, or the last run's MVP) on the stairway with idle breathing and an aura.

**B4. New Run is sparse and partly default** (P2, M)
- **Where:**
  - The Contract Modifiers and Heavenly Ladder panels are mostly empty ("No ascensions recorded yet").
  - Tier names are 12 px, and locked tiers are faint.
  - The seed field is a browser-default text input (native border and appearance).
- **Fix:**
  - Make tier cards with art and a difficulty indicator.
  - Show modifiers as icon chips.
  - Put the seed field behind an "Advanced" toggle, styled as a lacquer field.
  - Fill the Ladder panel with personal bests and the next unlock.

**B5. Settings is minimal** (P1 for release, M)
- **Where:** one small, top-aligned panel with seven rows: music, sound, speed, auto-start, screen shake, tutorial and damage numbers. About 60% of the screen is empty.
- **Missing:**
  - Display: fullscreen or window mode (Electron already has a toggle-fullscreen handler with no UI), UI and text size, frame cap.
  - Audio: master volume, mute when unfocused.
  - Gameplay: tooltip delay, sell confirmation.
  - Accessibility: colour-blind palettes, reduced flashes and motion.
  - Controls: a hotkey list.
- **Fix:** a tabbed, full-height settings screen with Audio, Display, Gameplay, Accessibility and Controls tabs.

**B6. Credits is a wall of 12–13 px text** (P3, S)
- **Problem:** it still credits game-icons.net as the icon source, although most icons are now painted.
- **Fix:** typeset sections with headings and an ornament, update the attributions, and use a slow scroll over the key art.

**B7. Compendium Classes is a wall of text** (P2, M)
- **Where:** each class panel lists every insight as a 13 px sentence (140 runs on one screen).
- **Fix:** one class page at a time:
  - large emblem, role and a three-line summary;
  - insights as icon cards with name only, details on hover;
  - growth per rank as a small table.

**B8. Compendium has no discovery, filters, search or detail view** (P2, M)
- **Problem:** everything is shown from the first launch. Nothing says what you have found, and you can't filter by class, rarity or stat. Clicking a disciple opens no full page (kit, Dao Paths, lore, idle animation).
- **Modern standard:** collection progress and filters (StS, TFT).
- **Fix:** add "seen/unseen" states with a counter (34/40), filter chips, and a detail drawer per entry.

**B9. Treasure and Insight cards are half empty** (P3, S)
- **Where:** a large card holds an icon, a name, a rarity line and one stat line.
- **Fix:** shorter cards or a bigger medallion, a rarity-coloured frame glow, suited-class icons and a lore line.

**B10. Loading veil is plain** (P3, S)
- **Where:** the logo, a 2 px bar and a tiny tip ("Gathering qi… 30%").
- **Fix:** a thicker painted progress bar, and gameplay tips at 16 px with a small illustration.

---

## C. Run board and HUD

**C1. Placement hexes are invisible on painted arenas** (P1, S)
- **Where:** the board in placement mode. Ally hexes are drawn with fill alpha 0.1 and a 1.2 px stroke at alpha 0.5, which disappears on all three paintings. The hint says "drag onto the jade hexes".
- **Modern standard:** the deploy zone is unmistakable (TFT's lit hexes).
- **Fix:**
  - During placement, draw glowing jade tiles: fill around 0.22, a 2–3 px rim and a slow pulse.
  - Show the enemy half in faint crimson.
  - Highlight the hovered tile and show a ghost of the unit while dragging.

**C2. The node timeline is cryptic** (P1, M)
- **Where:** 12 tiny glyphs in a pill at the top. The tooltip is only "Encounter · Node 1 of 12".
- **Modern standard:** Slay the Spire's map shows node types and lets you plan; TFT's stage tracker uses distinct icons.
- **Fix:**
  - Larger painted node medallions for fight, elite, boss, event, rest, challenge and trial, with a progress line.
  - A preview card on hover: enemy portraits, Tribulation level, reward.
  - The boss portrait at the end.

**C3. Top bar labels** (P2, S)
- **Where:**
  - The realm subtitle is 12 px grey on the painting.
  - The Tribulation Level is a bare "0" with an icon.
  - The speed and AUTO plaques are small.
- **Fix:**
  - A title plate behind the realm name.
  - A "Tribulation 0" label with a coloured threat level.
  - Speed buttons 10–15% larger.

**C4. The encounter banner is generic** (P2, S)
- **Where:** "REGULAR ENCOUNTER / REGULAR ENCOUNTER" with nothing about the enemies.
- **Fix:** show the encounter name, the enemy count with mini portraits, and the reward line, with distinct styling for elites and bosses.

**C5. The left rail takes arena space and overlaps other panels** (P2, M)
- **Where:**
  - The Dao Insights and Treasures inventory is a tall panel, mostly empty dark sockets, covering the left of the painting.
  - In the shop and in events, its frame shows under the left edge of the big panel.
- **Modern standard:** Slay the Spire puts relics in a top bar, and inventories open as drawers.
- **Fix:** show Insights as a row of medallions under the top bar, make the Treasure inventory a collapsible drawer, and hide the rail behind full panels.

**C6. Party bar during combat** (P2, S)
- **Where:** the portraits show no live HP or Qi, only the fallen seal when a disciple dies. Empty sockets are flat dark squares.
- **Fix:**
  - Thin HP and Qi bars under each portrait while a fight runs.
  - A cast flash when a disciple's ability fires.
  - Sockets with an engraved rim and a faint treasure silhouette.

**C7. Champion picker** (P2, S)
- **Where:** the picker's frame cuts through the encounter banner's reward line, and the five candidates are bare portraits.
- **Fix:** place it below the banner, and show HP, Attack and the ability name per candidate.

**C8. Static arena paintings** (P3, M)
- **Where:** apart from floor motes, the arenas don't move.
- **Modern standard:** 2D games layer subtle life into backgrounds.
- **Fix:** add per-realm ambient layers:
  - lantern glow pulse, drifting leaves and petals in realm 1;
  - embers and heat haze in realm 2;
  - cloud drift and light shafts in realm 3.

**C9. Damage meter tabs are icon-only** (P3, S)
- **Where:** dealt, taken and healing are identified only by tooltip.
- **Fix:** add a short label under or beside each icon, or a header that names the active tab.

**C10. Toasts cover controls** (P3, S)
- **Where:** "Not enough Spirit Stones" appears at the top centre over the shop's sell zone, far from the price clicked.
- **Fix:** feedback in context (the price shakes and flashes red, with a sound), and the toast moves below the top controls.

---

## D. Battle presentation

**D1. The melee collapses into one knot** (P1, L)
- **Where:** a few seconds into a fight, all seven units stand in about a quarter of the arena width. Bodies, bars and numbers overlap, and you can't tell who is fighting whom.
- **Modern standard:** TFT units move hex to hex and never share a cell. Readable lanes are the norm in auto-battlers.
- **Fix:**
  - Keep the view on hex occupancy: one unit per hex, moving cell to cell.
  - Add separation steering and attack from range bands.
  - Spread the enemy formation over more rows.

**D2. Health and Qi bars are flat strips** (P1, M)
- **Where:** green or red rectangles with a thin dark border and a hairline blue Qi bar. The shield isn't readable, and statuses show as a tiny green "1" square.
- **Modern standard:** TFT bars have HP ticks, a mana bar, star level and items.
- **Fix:**
  - A dark lacquer plate with a gold rim.
  - Tick marks every 250 HP.
  - A white shield overlay segment.
  - A 4 px Qi bar that glows when full.
  - A row of painted status icons with stack counts.
  - The rank seal at the left of the bar.

**D3. Boss fights have no boss presentation** (P1, M)
- **Where:**
  - The boss gets a segmented overhead bar but no screen-top boss bar.
  - Its name floats over the art in dark red.
  - There is no intro beyond the "Realm Guardian" banner.
- **Modern standard:** a big titled boss bar (Hades) and an intro splash.
- **Fix:**
  - A full-width boss bar under the top bar, with name, epithet and phase notches.
  - A 1.5 s intro: portrait slides in with the name in brush calligraphy and a roar.

**D4. Hit and heal flashes recolour the whole sprite** (P2, S)
- **Where:** UnitView.tintFlash multiplies the sprite tint (green for 0.35 s), so a disciple briefly becomes a green figure.
- **Modern standard:** an additive white hit flash, plus a coloured rim or outline glow for heals and buffs.
- **Fix:** a brightness ColorMatrix pulse for hits, and an outline or glow filter, or particles, for heals, poison and buffs.

**D5. DoT numbers spam** (P2, S)
- **Where:** small green "1"s pop constantly for poison and regeneration ticks.
- **Fix:** group ticks into one number per second per unit, and show ticks smaller and dimmer.

**D6. The fight is small in the frame** (P2, M)
- **Where:** fighters fill about a quarter of the arena width at 1080p, with large empty floor, and the camera never moves.
- **Fix:** tighten the board scale, or add a subtle dynamic camera: a slow zoom toward the action and a punch-in on ability casts and kills.

**D7. Floor motes look like noise** (P3, S)
- **Where:** soft white dots scatter over the floor and read as specks in stills.
- **Fix:** fewer, larger, depth-sorted motes, only in the air, tinted per realm.

---

## E. Shop

**E1. Disciple cards hide what the disciple does** (P1, M)
- **Where:**
  - The lower third of each card is an empty panel until hover. Hover then shows unlabelled stat glyphs.
  - The ability is only in the small diamond's tooltip.
  - The meaning of the rank letter needs a tooltip.
- **Modern standard:** TFT shop cards show cost, traits and name, and the ability appears when you hover the card.
- **Fix:**
  - Permanently show class and role and "Ability: Shadow Step, 55 Qi".
  - Show 2–3 labelled key stats.
  - Hovering the card opens the full ability tooltip.

**E2. The Rank Up ribbon is a flat CSS pill** (P2, S)
- **Where:** a mint gradient pill with a Unicode "▲" above an owned disciple's card.
- **Fix:** a painted jade ribbon or seal with a gold rim, an upward-arrow icon and a soft glow pulse.

**E3. The sell zone is hard to discover** (P2, S)
- **Where:** a faint dashed text pill ("Drop here to sell") in the top bar, only obvious while dragging.
- **Fix:** a painted sell brazier or scale icon that lights up while dragging and shows the refund value.

**E4. Stat chips and the SALE badge** (P3, S)
- **Where:** tiny tinted glyphs next to painted item icons, and a plain red SALE box.
- **Fix:** painted stat icons (A3) and a painted red price tag.

**E5. Item tooltips repeat the row** (P3, S)
- **Where:** name, rarity and the same stats.
- **Fix:** add a lore line, the classes it suits and a comparison with what is equipped.

**E6. Layout balance** (P3, S)
- **Where:** the left column (stock, insights, expansions) is dense, while the three disciple cards float with empty bands above and below.
- **Fix:** slightly larger disciple cards, or room for a fourth offer, with expansions moved under the cards.

---

## F. Events, rewards, rank-up

**F1. The event text column is half empty** (P2, S)
- **Where:**
  - The illustration on the left is excellent.
  - The right column has a 12 px kicker, one line of flavour and 2–3 choices at the top, then about half the column is empty.
- **Modern standard:** Slay the Spire and Hades events have a short paragraph of narrative and choices anchored at the bottom.
- **Fix:**
  - Write 2–4 lines of flavour at 17–18 px.
  - Anchor the choices to the bottom.
  - Show an outcome panel with a result illustration or icon.

**F2. Challenge cards are small, with red body text** (P2, S)
- **Where:** three cards about a sixth of the screen wide. Descriptions use red or pink text on dark, and the subtitle is small.
- **Fix:** larger cards, light text with red only for keywords, and clear risk and reward icons.

**F3. Reward choice is underwhelming** (P2, S)
- **Where:** three small cards with a one-line effect, no rarity glow and no fanfare.
- **Modern standard:** reward picks are celebratory moments: big cards, rarity frames, sparkle, hover lift.
- **Fix:** bigger cards with rarity frames and glow, a particle burst on reveal, and a Skip option.

**F4. The breakthrough splash shows no disciple** (P2, M)
- **Where:** a big hanzi and "FOUNDATION ESTABLISHED" with a tiny "Li Jian · Foundation" line.
- **Fix:** the disciple's portrait rising in a qi aura, the new rank seal stamping in, and the stat gains counting up.

**F5. Dao Path and Insight choice** (P2, S)
- **Where:** the subtitle is unreadable over the bright painting (A2). The hero panel on the left is small with unlabelled stats.
- **Fix:** a scrim under the title block, and a larger hero panel with labelled stats.

---

## G. Results and run end

**G1. Battle Won is a plain panel** (P2, M)
- **Where:** "BATTLE WON 胜" as text, a static results list and a Proceed button.
- **Modern standard:** a victory banner moment, an MVP highlight and rewards counting up.
- **Fix:**
  - A brush-stroke banner sweeping in with VFX.
  - An MVP portrait with title.
  - Spirit Stones counting up and flying to the counter.

**G2. The stats tracker looks like a spreadsheet** (P2, S)
- **Where:**
  - Damage bars are pink, which is outside the palette.
  - Each row stacks three numbers.
  - The legend uses tiny "■" squares.
  - "Hero stats" is a bare table with a Casts column of zeros.
- **Fix:**
  - Palette colours: gold for dealt, crimson for taken, jade for healing.
  - One number per bar, with the rest on hover.
  - An MVP crown.
  - Hide empty columns.

**G3. "REVERSE TIME" wraps onto two lines** (P1, S)
- **Where:** the gold plaque on the defeat screen. The icon plus the large text overflow the plaque's content width, so the label breaks into "REVERSE / TIME".
- **Problem:** it looks broken on a key screen.
- **Fix:** no-wrap with a smaller size, or a wider plaque. Consider a separate cost line inside the button.

**G4. Defeat has no drama** (P3, S)
- **Where:** the same layout as victory, with a red title.
- **Fix:** desaturate and slow the last frame, add a crimson vignette and a cracked seal before the panel appears.

**G5. Rift Sealed undersells a milestone** (P2, M)
- **Where:**
  - A dark screen where the realm art is almost invisible.
  - Six stats with 12 px labels.
  - No image of the defeated boss and no rewards.
- **Fix:**
  - Show the realm painting brighter.
  - Show the defeated guardian's portrait sealed by a talisman.
  - Show the reward and stats as medallions, and tease the next realm.

**G6. Run End victory** (P2, M)
- **Where:**
  - The "Victorious" headline is a faint watermark.
  - Disciple names appear twice (card and plaque).
  - Ratings are Unicode "★★★".
  - The cards show the same unlabelled stat glyphs.
- **Fix:**
  - A big painted "Ascended" headline.
  - Painted star pips.
  - One name per hero.
  - A run timeline (nodes won, best moments) or a damage graph.

---

## H. Feedback and motion

**H1. Screen changes are plain cross-fades** (P3, M)
- **Fix:** themed transitions, such as an ink-wash wipe or a talisman burn, between the major screens (board, shop, event, result).

**H2. The tutorial spotlight is a hard rectangle** (P3, S)
- **Where:** a gold-outlined box with the rest dimmed, and a pulsing hanzi.
- **Fix:** a soft-edged spotlight shaped to the target, plus an animated pointer.

---

## I. UX and accessibility

**I1. No keyboard shortcuts** (P1, S)
- **Where:** the only key listener in the code unlocks audio. There are no gameplay hotkeys.
- **Modern standard:** TFT uses D, F and E. Every PC game uses Esc for pause.
- **Fix:**
  - Space: Fight. Esc: pause and close.
  - 1, 2, 3: speed.
  - R: reroll. F: freeze. E or Delete over an item: sell.
  - Tab: toggle the damage meter.
  - Show the hotkeys in tooltips.

**I2. No fullscreen or window option in the UI** (P1, S)
- **Where:** Electron exposes a fullscreen toggle (app:toggle-fullscreen), but no button or F11 binding uses it.
- **Fix:** a Display option and the F11 key.

**I3. No UI or text size option** (P1, M)
- **Problem:** the scale is fixed to window height, so laptop players get tiny text (A1).
- **Fix:** a text-size slider (100–130%) that bumps the type tokens, and a UI-scale option.

**I4. The pause menu is minimal** (P2, S)
- **Where:** Music and Sound sliders with no values, Resume, and Save & return.
- **Missing:** full Settings, Compendium, Abandon run, Quit to desktop.

**I5. No colour-blind support** (P2, M)
- **Where:** teams are green versus red. Damage types and rarities rely on hue alone.
- **Fix:** a colour-blind palette option, and shape or icon redundancy (team rim shapes, rarity gems).

**I6. No reduced-motion or flash option** (P2, S)
- **Where:** prefers-reduced-motion is not honoured. Casts flash and freeze-frame.
- **Fix:** a "Reduce flashes and motion" setting that also follows the OS preference.

**I7. Drag-only placement and equipping** (P2, M)
- **Where:** board placement and equipping Treasures need a drag.
- **Problem:** this is awkward on trackpads, and there is no alternative.
- **Fix:** click to pick up, click to place. Right-click a Treasure to equip it on the selected disciple.

**I8. No keyboard focus or gamepad support** (P3, M)
- **Where:** there is no focus-visible styling (one focus rule across all CSS).
- **Fix:** a gold focus ring on plaques and cards, and arrow and Enter navigation for menus.

---

## Counts

| Priority | Findings |
| --- | --- |
| P1 | 16 |
| P2 | 28 |
| P3 | 19 |
| Total | 63 |

## Top 10 to do first

**Status (2026-11-10):** all ten are done in the current build. B1 was a false alarm: the Quit plaque already existed in the desktop build (the audit ran in a browser, where it is hidden); it now goes through the Electron bridge. D1 is improved in the view (overlapping fighters ease apart, shorter lunge); spreading rows further apart would need deeper painted floors. Since then, C2 (painted node timeline with preview cards), D3 (guardian bar and arrival splash) and the Tribulation counter label from A7 are done too.

1. **C1:** make the placement hexes clearly visible during deployment (S).
2. **G3:** stop "Reverse Time" from wrapping onto two lines (S).
3. **A6:** move the keyword chips off the portraits into a trait strip (S).
4. **A2:** put readability plates or scrims behind every heading on a painting, and redraw the boss name label (S).
5. **I1:** add hotkeys: Space fight, Esc pause, 1–3 speed, R reroll, F freeze, E sell (S).
6. **B1 + I2:** add a Quit button and a Fullscreen option with F11 (S).
7. **A1 + I3:** set a 14 px floor and 16 px body type, and add a text-size setting (M).
8. **D2:** framed HP, Qi and shield bars with painted status icons (M).
9. **E1 + A7:** show role, ability and labelled key stats on disciple cards, with a full ability tooltip on card hover (M).
10. **D1:** keep fighters apart in melee, one unit per hex, so battles stay readable (L).
