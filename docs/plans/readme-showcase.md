# README showcase

Screenshots and GIFs of the app's main screens and the game table at the top of the README, every one taken from a real game of real decks with every card's picture drawn, in both themes: Ringwraiths (Dark) and Rivendell (Light) (user decisions, 2026-11-11).

## Goal

- A hero GIF of the table under the README's title, and a Screens section: the table on the iPad, the other screens on the iPhone and the iPad.
- Every capture is a real save the engine replays (a seeded game of saved decklists). Every card on screen draws its bundled picture.
- The captures are taken by a workflow, not by hand, so they can be taken again when the design changes.

## Why the native build

The web build cannot take these: it has no Skia canvas (the table is a list of zones, `src/play/canvas/table-canvas.tsx`), bundles no pictures and has no combat spotlight. The captures run a Release simulator build with every picture packed (`pnpm assets`), `EXPO_PUBLIC_E2E_SEED=1` (the fixture route writes saves) and `EXPO_PUBLIC_SHOWCASE=1` (the pictures-ready marker), on the newest iPhone Pro and iPad Pro 13-inch simulators of the runner's Xcode, with the status bar set to 9:41 and full bars.

## Shot list

`scripts/showcase/shots.ts` holds the shots, their devices, captions and alt text; each is a flow in `.maestro/showcase/`. The table shots are iPad only; the screens are iPhone and iPad. Every shot is taken in both themes.

- GIFs: the quest phase (A Shadow of the Past, round 3: commit, then the encounter cards revealed into staging) and combat (an attack defended, played by the spotlight).
- Table stills: A Shadow of the Past, Voyage Across Belegaer and Helm's Deep, each a full table in round 3.
- Screens: Campaigns, Campaign path, Scenarios, Deck builder (Stealth and Steadfastness), Card pool, Card (Aragorn), Rules, Settings.

## Saves and decks

The table shots open fixtures registered in `src/campaign/fixtures/registry.ts` like the Maestro ones: `past-showcase-board`, `past-showcase-quest` and `past-showcase-combat` (A Shadow of the Past, The One Deck and Stealth and Steadfastness, written by `scripts/e2e/showcase-past.ts`), `sea-showcase` and `deep-showcase` (written by their scenarios' seed finders). Each is the first seed whose game reaches a full table (`boardOf`, `boardHolds` in `scripts/e2e/seed-kit.ts`). The quest and combat saves carry what their flow taps (`showcase` in `scenario-1.json`); `src/campaign/showcase-fixtures.test.ts` replays each save to its moment and checks those taps against the flows.

## Every picture drawn

- `src/campaign/showcase-fixtures.test.ts` fails on a face-up card on a showcase table with no picture pin (the few cards no picture source carries show their Hall of Beorn scan, which each must have).
- In the showcase build every picture holds a count until it has drawn: list rows, the card screen, scene art and the table canvas's decodes (`src/ui/showcase/`). The root layout shows `pictures-ready` once nothing has been held for 800 ms, and every capture waits for it.
- The post-process writes a contact sheet of every capture, to look at before publishing.

## Capture flows

`.maestro/showcase/<shot>.yaml`, tagged `showcase`, outside the globs of `.maestro/config.yaml`. The subflows `showcase-start` (fresh app, Theme set in Settings, the shot's link), `showcase-table` (a fixture opened on the table) and `showcase-shot` (wait, then the screenshot) are in `.maestro/subflows/`. `pnpm assets capture --app <App.app>` (`scripts/showcase/capture.ts`) runs each flow per device and theme with THEME and DEVICE, retries a failure once, and collects `<device>-<theme>-<shot>.png` or `.mp4` with `capture.json`.

## Post-process

`pnpm assets showcase` (`scripts/showcase/build.ts`): stills as WebP with the device's rounded corners (iPhone 540 px wide, iPad 1200 px), recordings as looping GIFs at the widest of 960 to 560 px under 6 MB, table captures turned landscape, a contact sheet and `manifest.json` (files, sizes, the commit and simulators they came from).

## Workflow and where the images live

`.github/workflows/showcase.yml` runs on `workflow_dispatch` (`publish`, `only`): it builds, captures, post-processes and uploads the artifact. With `publish`, when every capture was taken, the images replace the one orphan commit of the `showcase` branch, so they never pile up in `main`'s history; the README links them there by URL.

## Steps

Not done:

1. A first full run of the workflow, its contact sheet looked at, and the flows fixed where a capture failed or looks wrong. While this branch is open, a push that changes the capture runs the workflow and publishes; that `push` trigger is removed before the branch lands.
2. The README section: the hero GIF under the badges and a Screens section, each image a `<picture>` with the Rivendell capture for GitHub's light theme and the Ringwraiths one otherwise, with the captions and alt text of `shots.ts`.
3. Delete this plan once both are done; the workflow's header and `scripts/showcase/` say how to take the captures again.
