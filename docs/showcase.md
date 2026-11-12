# README showcase

The README's screenshots and GIFs: the game table and the main screens, taken from real games of real decks with every card's picture drawn, in both themes, Ringwraiths (Dark) and Rivendell (Light). The iPad (the iPad Pro 13-inch (M4) when Xcode has it) takes every shot in landscape at UI scale Large; the iPhone takes the table in landscape and the other screens in portrait, at UI scale Small (user decisions, 2026-11-11). They are taken on the iOS simulators of a Mac, by `pnpm assets capture`, and published to the `showcase` branch, which the README links.

## Take the captures on a Mac

What you need, once:

- macOS with Xcode from the App Store, opened once so it installs its components, and an iOS simulator runtime (Xcode, Settings, Components). The capture uses the newest iPhone Pro and iPad Pro 13-inch simulators that runtime offers.
- Node 22.18 or later and pnpm (`corepack enable`), as for any local setup (README.md, Requirements).
- Java 17 or later and Maestro 1.40 or later: `brew install openjdk@17`, then `curl -fsSL "https://get.maestro.mobile.dev" | bash` and open a new terminal (`maestro --version` answers).
- ffmpeg and poppler: `brew install ffmpeg poppler`.
- About 15 GB free: the card pictures (5 GB in `.cache/`, their packed copies in `assets/scans/`) and the build.

Then, from the repository:

```bash
git fetch origin && git switch <branch with the showcase>   # main once it has landed
pnpm install
pnpm assets                       # catalog, booklets and every card picture; the first run downloads about 5 GB
pnpm assets capture --build       # builds the showcase app, then takes every capture (about an hour)
pnpm assets showcase              # turns them into the README's images
open .cache/showcase/out/contact.png
```

`--build` runs `expo prebuild` and a Release simulator build with `EXPO_PUBLIC_E2E_SEED=1` and `EXPO_PUBLIC_SHOWCASE=1` into `.cache/showcase/build` (`ios/` is regenerated; it is gitignored). Later runs can skip the build with `--app .cache/showcase/build/Build/Products/Release-iphonesimulator/<App>.app`. Leave the Mac awake while it runs: the simulators open and the flows tap through them on their own. The terminal says where it is: the three build steps, each simulator as it boots and installs the app, each capture as `[n/total]` with its time, and every 30 seconds a long step (the Xcode build, a flow) says it is still running with its latest output line. A step that fails prints the end of its output; `--verbose` streams every tool's whole output instead.

A capture already in `.cache/showcase/raw/` is kept, not taken again, while nothing it depends on has changed since it was taken: the app's JavaScript and the files bundled with it, the simulator, its flow, the showcase subflows and the save it opens (each capture's fingerprint is its `key` in `capture.json`). So a run after fixing one flow retakes only that flow's captures, and a run stopped halfway goes on where it stopped. A capture that failed is always taken again; `--force` takes every capture again.

The raw captures land in `.cache/showcase/raw/` with `capture.json`; the images in `.cache/showcase/out/` with `contact.png` and `manifest.json`. None of `.cache/` is committed.

Look at the contact sheet: every card should show its picture, the table should lie landscape, and the GIFs' first frames should be the table before the move. When the images are right, publish them (Publish).

Narrower runs, while fixing one shot: `--only table-quest,deck`, `--device iphone` or `ipad`, `--theme dark` or `light`, `--force` (on `capture`), and `--verbose` to see Maestro's and Xcode's output. A capture that came out turned the wrong way is fixed with `pnpm assets showcase --turn ccw`.

If something goes wrong:

- "No card picture is packed": run `pnpm assets` first.
- "No available iphone simulator": install an iOS runtime in Xcode, Settings, Components.
- A flow fails: the log says what was on screen after the failure (its ids and words). Nothing readable means the app crashed, is still on its splash screen, or Maestro cannot read that iOS version: try an older runtime with `--ios 18` (install it in Xcode, Settings, Components). Run one capture alone with `--only <shot> --verbose`; Maestro's log, the screen at the failure and its UI hierarchy are kept in `.cache/showcase/raw/failures/<capture>-attempt-<n>/`. A run whose first two captures both fail stops there, since every capture would fail the same way. `maestro studio` shows the screen's testIDs.
- `xcodebuild failed`: run again with `--verbose`; `rm -rf ios .cache/showcase/build` and run again clears a stale native project.

## Publish

`pnpm assets showcase --publish` does the post-process, then replaces the `showcase` branch on `origin` with one orphan commit of the images and `manifest.json` (no history piles up). It pushes with this checkout's git credentials, and refuses while any capture is missing. The README's links then show the new images.

The workflow `.github/workflows/showcase.yml` does the same on GitHub's macOS runners: start it from the Actions tab with `publish` on.

## Shot list

`scripts/showcase/shots.ts` holds the shots, their captions and alt text; each is a flow in `.maestro/showcase/`, taken on both devices in both themes.

- GIFs: the quest phase (A Shadow of the Past, round 3: commit, then the encounter cards revealed into staging) and combat (an attack defended, played by the spotlight).
- Table stills: A Shadow of the Past, Voyage Across Belegaer and Helm's Deep, each a full table in round 3.
- Screens: Campaigns, Campaign path, Scenarios, Deck builder (Stealth and Steadfastness), Card pool, Card (Aragorn), Rules, Settings.

## Saves and decks

The table shots open fixtures registered in `src/campaign/fixtures/registry.ts`: `past-showcase-board`, `past-showcase-quest` and `past-showcase-combat` (A Shadow of the Past, The One Deck and Stealth and Steadfastness, written by `scripts/e2e/showcase-past.ts`), `sea-showcase` and `deep-showcase` (written by their scenarios' seed finders), all by `pnpm scenario fixtures <scenario-id>`. Each is the first seed whose game reaches a full table with both players still in it (`boardOf`, `boardHolds` and `seatsStanding` in `scripts/e2e/seed-kit.ts`). The GIFs tap only the tray's first three rows, which the iPhone's landscape table shows without scrolling. The quest and combat saves carry what their flow taps (`showcase` in `scenario-1.json`); `src/campaign/showcase-fixtures.test.ts` replays each save to its moment and checks those taps against the flows.

## Every picture drawn

- `src/campaign/showcase-fixtures.test.ts` fails on a face-up card on a showcase table with no picture pin (the few cards no picture source carries show their Hall of Beorn scan, which each must have).
- In the showcase build every picture holds a count until it has drawn: list rows, the card screen, scene art and the table canvas's decodes (`src/ui/showcase/`). The root layout shows `pictures-ready` once nothing has been held for 800 ms, and every capture waits for it.
- The post-process writes a contact sheet of every capture, to look at before publishing.

## Capture flows

`.maestro/showcase/<shot>.yaml`, tagged `showcase`, outside the globs of `.maestro/config.yaml`. The subflows `showcase-start` (fresh app, the device's orientation, the Theme set in Settings, the shot's link), `showcase-table` (a fixture opened on the table) and `showcase-shot` (wait, then the screenshot) are in `.maestro/subflows/`. `scripts/showcase/capture.ts` runs each flow per device and theme with THEME and DEVICE, with the status bar at 9:41 and full bars, retries a failure once, and collects `<device>-<theme>-<shot>.png` or `.mp4`.

## Post-process

`scripts/showcase/build.ts`: stills as WebP with the device's rounded corners (1170 px on the iPhone's long side, 1200 px on the iPad's), recordings as looping GIFs at the widest of 960 to 560 px under 6 MB, each turned to stand as `orientationOf` says, a contact sheet and `manifest.json` (files, sizes, the commit and simulators they came from).
