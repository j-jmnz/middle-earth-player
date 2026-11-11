# README showcase

Screenshots and short GIFs of the app's main screens and the game table at the top of the README, every one taken from a real game of real decks with every card's picture drawn. Not built.

## Goal

- A hero GIF under the README's title: the table in play, landscape.
- A gallery of the main screens, phone portrait, and two or three table stills, landscape.
- Every capture is a real save the engine replays (a seeded game of saved decklists), not a mock-up. Every card on screen draws its bundled picture; none falls back to its text or to its small scan.
- The captures are made by a command and a workflow, not by hand, so they can be taken again when the design changes.

## Why the native build

The web build cannot take these. It has no Skia canvas, so the table is a list of zones (`src/play/canvas/table-canvas.tsx`); it bundles no pictures and shows each card's remote file (`src/screens/images/remote.ts`); it has no combat spotlight and no booklet reader. A release build with `pnpm assets scans` bundles every picture (`src/screens/images/scan-map.ts`), and with `EXPO_PUBLIC_E2E_SEED=1` its fixture route (`src/screens/routes/e2e/[fixture].tsx`) opens a committed save on its moment. Maestro drives it and takes the screenshots (`takeScreenshot`) and the recordings (`startRecording`, `stopRecording`).

The captures run on the iOS simulator on a `macos-latest` runner, as the release workflow's iOS job already builds there:

- `xcrun simctl status_bar override` gives a clean status bar (9:41, full battery, full signal).
- The simulator renders through Metal, so the canvas and the spotlight record smoothly; an Android emulator on a Linux runner renders with SwiftShader and drops frames in a recording.
- `simctl io recordVideo` records the simulator's own frames, smoother than a recording made through the test driver. A wrapper script starts and stops the recorder around each GIF flow.

An Android emulator run (`reactivecircus/android-emulator-runner`, API 35, Pixel 8) stays possible for an Android-looking set; it is not the default.

## Shot list

Stills are phone portrait (iPhone 16 Pro, 1206 × 2622 px) except the table, which is landscape. Each takes the Dark theme (Ringwraiths) and the Light theme (Rivendell), so the README can serve the one that matches the reader's GitHub theme.

| # | Screen | Moment | Save or route |
| --- | --- | --- | --- |
| 1 | Table, hero GIF | Passage Through Mirkwood, two-handed, round 3: the quest phase reveals the encounter cards into staging, then combat plays one spotlight (an enemy against a defender) | New fixture `showcase-mirkwood-combat` |
| 2 | Table still | A full board: heroes with attachments, allies, two enemies engaged, an active location, progress on the stage | New fixture `showcase-mirkwood-board` |
| 3 | Table still | Voyage Across Belegaer: the Heading dial, the ships and the sea piles | Fixture `sea-duo`, moved on to a later round in a new `sea-showcase` |
| 4 | Table still | Helm's Deep: a staging row and a busy engagement area | New fixture `showcase-helms-deep` |
| 5 | Campaigns | The campaign list with its scene art, one campaign under way | Fixture `mirkwood-won` written first, so a campaign shows progress |
| 6 | Campaign path | Mirkwood Paths, the first part won, the second open | Fixture `mirkwood-won` |
| 7 | Briefing | A Shadow of the Past's briefing with its scene | Fixture `duo`, its briefing route |
| 8 | Deck builder | The Elves of Lórien pre-built deck: heroes, the cost curve, the card rows | `/deck/<id>` of a pre-built deck (`data/decks/prebuilt.json`) |
| 9 | Card pool | The Cards tab filtered to one sphere, pictures in the grid | `/cards` with a filter tapped |
| 10 | Card | A hero's card screen: the large picture and its text | `/card/<code>` (Aragorn, core set) |
| 11 | Card preview GIF | A long press on a table card opening it large, then the carousel | Fixture `showcase-mirkwood-board` |
| 12 | Rules | The rules reader on a rule, and the booklet reader on a page | `/rule/<id>`, `/booklet/<id>` |
| 13 | Resolution | A won scenario's Resolution with its log | Fixture `mirkwood-won` |

Optional: one iPad landscape still of the table (`docs/design-system.md`, Tablets), if it reads well at README width.

## Saves and decks

- Every table capture is a fixture: a real loadout, a seed and the intents that reach the moment, written by `scripts/e2e/<scenario>.ts` and registered in `src/campaign/fixtures/registry.ts`, as the Maestro fixtures are (`pnpm scenario fixtures <scenario-id>`). The showcase names start `showcase-`.
- The decks are saved decklists from `data/decks/prebuilt.json` (the Learn to Play's core decks and the starter decks), so a reader recognises them. For example, Passage Through Mirkwood with the Elves of Lórien and Riders of Rohan lists, Helm's Deep with Riders of Rohan and Defenders of Gondor.
- A seed is chosen for the board it reaches (enemies with art that reads small, a location, attachments on the heroes), not the first that works. The fixture writer searches seeds with the existing seed kit (`scripts/e2e/seed-kit.ts`) for a board that meets a short spec: at least N cards in play, at least one enemy engaged, an active location, the moment open.
- The fixtures follow the test-cost rules (`.claude/rules/code-standards.md`, Test cost): `fixtures.test.ts` checks each reaches its moment, and a showcase fixture stops at round 3 or 4, so its intents stay few.

## Every picture drawn

Three gates, so no capture ships a card drawn as text or blurred:

1. **Before the build.** `pnpm assets showcase check` replays each showcase fixture to its moment and lists the picture keys the table draws (`pictureKey`, `prefetchCodes` in `src/play/canvas/`), plus the cards the deck, card and pool shots show. Each key must have a picture pin (`scripts/data/sources/pictures.ts`), not only a small scan, and must be in the packed `scan-map.ts` after `pnpm assets scans`. It fails and names the card otherwise; the fix is `pnpm data sync pictures` on it, or another seed.
2. **On the device.** An e2e-only marker, `table-pictures-ready`, shows when every picture the table's scene needs is decoded (`src/play/canvas/table-images.native.ts`). Each flow waits for it, then for `waitForAnimationToEnd`, before a screenshot or a recording starts. The screens' `expo-image` rows get the same: the flow waits on an e2e marker that counts pending loads to zero.
3. **After the capture.** The post-process writes a contact sheet of every still and every GIF's first frame, for a look before the commit.

## Capture flows

- `.maestro/showcase/<shot>.yaml`, tagged `showcase` and excluded in `.maestro/config.yaml`, so `maestro test .maestro` does not run them.
- Each flow: `launchApp` with `clearState`, set the theme through Settings (or a launch argument the e2e build reads), `openLink` the fixture, wait on the markers, then `takeScreenshot: <shot>-<theme>`.
- The GIF flows play a fixed sequence of taps from the fixture's moment (Quest, then Resolve combat for shot 1), so every run records the same game. The engine is deterministic from the seed and the intents; the spotlight's timing follows the animation clock.
- `scripts/showcase/capture.ts` (run by `pnpm assets showcase capture`) boots the simulator, sets the status bar, installs the build, runs each flow and records the GIF flows with `simctl io recordVideo`, and writes the raw files to `.cache/showcase/raw/` (not committed).

## Post-process

`pnpm assets showcase build` reads `.cache/showcase/raw/` and writes `docs/showcase/`, with `sharp` (already a dev dependency) and `ffmpeg`:

- Stills: rounded device corners, a 1 px hairline, resized to 600 px wide for portrait and 1200 px for landscape, WebP with a PNG fallback where GitHub needs it, about 150 KB each.
- GIFs: trimmed to the marked range, 12 to 15 fps, 720 px wide for the table and 360 px for the preview, `palettegen` and `paletteuse` with Bayer dithering, at most 4 MB each and looping. An MP4 of the hero is kept beside it for a release page, where GitHub plays video.
- A `manifest.json` names each file, its shot, theme, fixture and the commit it was taken from, so a stale shot can be found.

## Workflow

`.github/workflows/showcase.yml`, `workflow_dispatch` only:

1. `macos-latest`, the `pack-assets` action (catalog, booklets, every picture; the `assets/scans` cache saves the downloads).
2. Build the iOS simulator app in Release with `EXPO_PUBLIC_E2E_SEED=1` (the `e2e-test` profile's settings), install Maestro.
3. `pnpm assets showcase check`, then `capture`, then `build`.
4. Upload `docs/showcase/` and the contact sheet as an artifact. A maintainer looks at the sheet and commits the files from it; the workflow does not push to the repository.

It is not part of `test.yml` or `release.yml`: captures are taken when the design changes, not on every pull request.

## README

- Under the title and the badges, before the fan-made notice: the hero GIF, full width, in a `<picture>` with a `prefers-color-scheme: light` source, so the Light capture shows on GitHub's light theme and the Dark one otherwise.
- A new `## Screens` section after Features: the table stills full width, then the portrait screens in an HTML table three across, each with a one-line caption (Campaigns, Campaign path, Briefing, Deck builder, Card pool, Card, Rules, Resolution), and the preview GIF.
- Each image has `alt` text that says what it shows ("The game table in Passage Through Mirkwood: two players' heroes, two enemies engaged, the Old Forest Road as the active location").
- The Contents list gets the new section.

## Open decisions

- **Where the media lives.** `.claude/rules/authority.md` forbids committing card scans; a screenshot shows card art too. Either commit the processed files to `docs/showcase/` (about 10 MB, with a line in THIRD_PARTY_NOTICES.md and an exception in the authority rule), or keep them on an orphan branch `showcase-media` that the README links by raw URL, so `main` holds none. The user decides.
- **iOS or Android look.** The plan takes the iOS simulator for its status bar and smooth recording. An Android set is the same flows on an emulator.
- **Which scenarios.** Passage Through Mirkwood, Voyage Across Belegaer and Helm's Deep are proposed for their art and their distinct tables; the user may prefer others.

## Steps

1. The e2e picture markers (`table-pictures-ready`, the screens' load count), behind `EXPO_PUBLIC_E2E_SEED`. Tests for the counting.
2. The showcase fixtures and their seed search; `fixtures.test.ts` covers them.
3. `pnpm assets showcase check`, with its test on a fixture that names a card with no pin.
4. The Maestro showcase flows and `capture.ts`.
5. The post-process (`build`) and the contact sheet.
6. `showcase.yml`; one dry run, look at the contact sheet.
7. The README section, once the media's home is decided; then delete this plan.
