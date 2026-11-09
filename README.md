# Nine Heavens (九重天)

A xianxia roguelike auto-battler in the spirit of *Guildrun*: recruit wandering cultivators, place them on a hex arena,
watch the fight resolve on its own, then make every real decision between fights — the shop, events, cultivation
breakthroughs (rank-ups), Treasures (items) and Dao Insights (team relics) — while you climb the Heavenly Ladder.

- **Platforms:** Windows desktop (Electron) first, Android (Capacitor) second. Also runs in any modern browser.
- **Design spec:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — pillars, glossary, run structure, economy, all content tables.

## Play / develop

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # headless battle + run-state tests (vitest)
npm run sim            # balance bot: plays 30 runs through the real state machine (--runs N --tier T)
npm run build          # type-check + production bundle in dist/
npm run electron:dev   # desktop shell against the dev server
npm run electron:build # Windows installer + portable exe in release/
```

Developer shortcuts (dev server): `?demo` puts a ready 5-disciple party on the board; `?demo=boss|draft|battle|single|result|defeat|shop|rankup|reward|challenge|cleared|end` opens that scene; `?demo=li_jian,shan_tie` picks the party; `?demo=event:spirit_spring` opens an event; `?screen=compendium|settings|credits|newRun` jumps to a menu screen. Add `&noanim` to freeze entrance animations (deterministic screenshots) and `&notut` to suppress the tutorial. `&realm=1|2|3` shows that realm's arena painting.

### Android

The Capacitor config is in `capacitor.config.ts` (app id `com.elie55.nineheavens`, web dir `dist`). With Android Studio
and a JDK installed:

```bash
npm run build
npm run android:add    # once
npm run android:sync
npm run android:open   # build / run from Android Studio
```

The UI is laid out in a 1920×1080 design space and scaled to the window, so phones and tablets get the same layout
letter-boxed; touch drag-and-drop uses pointer events.

## Architecture

| Layer | Where | Notes |
| --- | --- | --- |
| Deterministic battle simulation | `src/battle/sim` | 20 Hz tick, seeded RNG, data-driven effect interpreter (triggers / conditions / actions / scales), hex board 11×5 |
| Run state machine | `src/core` | draft → events → board → battle → result → shop; rank-ups, rewinds, quests, 2 realms + endless ladder, 8 tiers |
| Content | `src/content` | 16 disciples, 7 classes × 8 Dao Insights, 15 enemies, 40 Treasures, ~45 relics, 12 events, blessings, difficulties |
| Rendering | `src/battle/view` (PixiJS 8) + `src/ui` (Preact + signals) | canvas battle under a DOM HUD; GSAP for VFX / transitions; Howler audio |
| Shells | `electron/`, `capacitor.config.ts` | custom `app://` protocol for the packaged build |

## Art pipeline

All character art was generated with ChatGPT image generation and animated with [AutoSprite](https://www.autosprite.io).
Every disciple and enemy has a sprite pack in `public/assets/art/sprites/<id>/pack.json` (idle, attack, walk, hurt;
256 px frames with per-animation pivots so the character keeps its on-screen size).

- `scripts/convert-autosprite.mjs` — converts AutoSprite sheet + atlas exports into a pack.
- `scripts/import-autosprite-combined.mjs` / `import-autosprite-zips.mjs` / `import-autosprite-inbox.mjs` — batch importers
  for the different ways AutoSprite exports can land on disk.
- `scripts/dev-asset-inbox.ts` — dev-only Vite endpoint that accepts sheet uploads (`POST /__inbox`).
- `scripts/ground-anchors.mjs` — measures feet and pivots from pixel alpha so every clip stands on its hex.
- `scripts/fix-anim-scale.mjs` — normalises each clip's zoom to the idle clip (AutoSprite renders clips at different zooms).
- `scripts/split-icon-sheet.mjs` — splits a generated 4×4 icon sheet into painted icons under `public/assets/icons/painted` and registers them.
- `scripts/import-fx-sheet.mjs` — imports a generated 4×4 VFX flipbook (frames on black, played additively) as `public/assets/art/fx/<name>.jpg`.

## Credits

- Music: “Shenxian”, “Wuxia”, “Wuxia2” — PeriTune (CC BY 4.0); “Shenyang”, “Ishikari Lore” — Kevin MacLeod (CC BY 4.0);
  “10 Fanfares” — Spring Spring (CC0).
- SFX: Kenney.nl (CC0), artisticdude, StarNinjas, rubberduck and other OpenGameArt contributors (CC0).
- Icons: game-icons.net — Lorc, Delapouite and contributors (CC BY 3.0).
- Fonts: Cinzel, Noto Sans, Ma Shan Zheng, ZCOOL XiaoWei (SIL Open Font License).
- Character, background and event art: generated for this project (ChatGPT + AutoSprite).

The full list is also on the in-game Credits screen.
