# Development

Start with the Local setup section of the [README](../README.md), which gets `pnpm test` passing. This page covers what comes after: running the app in a browser or on a phone, the Maestro flows, and every `pnpm` command. [CONTRIBUTING.md](../CONTRIBUTING.md) explains how a change lands.

## In a browser

```bash
pnpm web
```

This builds the catalog and opens the app through Metro. Narrow the window to phone width. The browser build suits work on the screens (campaigns, briefing, log, deck builder), but it has no card pictures and no booklet reader, and SQLite runs on browser storage.

There's also a Codespaces devcontainer (`.devcontainer/devcontainer.json`) that installs the dependencies and builds the catalog. Run `pnpm web` there and open port 8081.

## On a phone

For iOS you need macOS and Xcode. For Android you need Android Studio, SDK Platform 36 and `ANDROID_HOME` set. The app id is `com.middleearth.player`. The app uses `expo-dev-client`, so Expo Go can't run it.

```bash
pnpm assets
```

`pnpm assets` runs `assets catalog`, `assets booklets` and `assets scans`. The first time `assets scans` runs, it downloads every pinned card picture into `.cache/` (about 5 GB), checks each one's sha256, and writes 1200 px copies to `assets/scans/`. Later runs only pack the pictures that changed. `pnpm start`, `pnpm android` and `pnpm ios` run it for you first. It rewrites `src/screens/images/scan-map.ts`; don't commit that change.

For a release build, which works offline with all its data bundled:

```bash
pnpm ios --device --configuration Release
pnpm android --device --variant release
```

Leave off `--configuration Release` or `--variant release` to get a development build, which loads its JavaScript and pictures from Metro. If the phone can't reach Metro, for example over a VPN or on isolated Wi-Fi, use `pnpm android:usb --device`. Keep about 10 GB free. The `ios/` and `android/` folders are generated and gitignored.

A build signed with a free Apple ID stops opening after 7 days. Run the command again to reinstall it; your saves are kept. The EAS cloud build profiles are in `eas.json`.

## Maestro

The Maestro flows live in `.maestro/scenarios/<scenario-id>/` and `.maestro/features/`. Run `maestro test .maestro` against an installed build. Flows that open a save fixture need `EXPO_PUBLIC_E2E_SEED` set, which the `e2e-test` profile in `eas.json` does.

The screen-reader flow (`.maestro/features/screen-reader.yaml`, tagged `reader`) needs a development build made with `EXPO_PUBLIC_E2E_SEED=1 EXPO_PUBLIC_FORCE_READER=1`. Run it with `maestro test --include-tags=reader .maestro`.

`.eas/workflows/e2e.yml` runs the flows on EAS. Nothing starts it automatically, not a push and not a pull request: someone signed in to the Expo account that owns the project starts it by hand with `eas workflow:run .eas/workflows/e2e.yml`.

## Commands

Scripts are grouped as `pnpm <group> <command> [args]`, and running `pnpm <group>` on its own lists that group's commands (`scripts/cli.ts`). The exceptions are `pnpm test` and `pnpm assets`, which run everything in their group. The groups are `test`, `data`, `effects`, `scenario`, `assets`, `doc` and `release`, while `lint`, `typecheck`, `move` and `commit:check` stand alone. If the first argument to `pnpm test` isn't one of its commands, it goes to Vitest as a filter.

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs every Vitest test. |
| `pnpm test fast` | Runs everything except the slow files (`slowFiles` in `vitest.config.mts`). |
| `pnpm test changed` | Runs the tests that import a file changed since the last commit. |
| `pnpm test scenario <scenario-id>` | Runs one scenario's tests within their time budget, along with its goldens, the effect coverage, file-size, test-cost, rule-id and wording checks, the card smoke on its player cards and the encounter smoke. It adds the family and manifest tests if pool, family or manifest files changed since the merge base with `origin/main`. `--list` prints what it would run, and `--quick` skips the goldens and the reader check. |
| `pnpm test smoke <codes>` | Plays a seeded game with those cards and reports errors and stalls. `--all` covers every card. |
| `pnpm test encounter <scenario-id>...` | Plays every encounter-side card of a scenario (reveal, Shadow, travel, quest Setup) plus seeded games with random legal intents, and reports errors, stalls and replay differences. `--all` covers every playable scenario. |
| `pnpm test a11y` | Audits the main web screens with axe-core in Chromium and fails on serious or critical findings. It needs `pnpm exec playwright install chromium` once, or `A11Y_CHROMIUM=<path>`. |
| `pnpm lint` | Runs Oxlint (`.oxlintrc.json`). |
| `pnpm typecheck` | Type-checks with tsrs. |
| `pnpm data sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes `data/raw/` and `.cache/`. It is the only command that uses the network. `scans` and `pictures` run only when you name them, after `data build`. |
| `pnpm data build` | Builds `data/`, `src/effects/generated/` and the game icons from `data/raw/`, offline and deterministically. |
| `pnpm data check` | Rebuilds into a temporary directory and fails on any difference. |
| `pnpm data ledger-seed <scenario-id>` | Writes the scenario's missing printed-text ledger entries from the source text, `readBy` empty and the pinned scan named. Each is read against its scan before the scenario is playable. |
| `pnpm data query "<sql>"` | Queries the `cards`, `scenario_cards` and `rules` tables in memory. |
| `pnpm effects draft <scenario \| deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line no record covers yet. |
| `pnpm effects open` | Regenerates `src/effects/open-lines.ts`. |
| `pnpm scenario new <scenario-id>` | Writes and registers the skeleton files for a new scenario. Try `--dry-run` first. |
| `pnpm scenario pack <scenario-id>` | Writes `.agent/pack/<id>.md`, the context a scenario author reads: vocabulary, schema entries, cookbook sections and drafts. |
| `pnpm scenario fixtures [scenario-id]` | Regenerates the Maestro save fixtures in `src/campaign/fixtures/`. |
| `pnpm assets` | Runs `catalog`, `booklets` and `scans` in that order. `start`, `android`, `ios` and the native release builds run it for you (`start` with `--optional`). |
| `pnpm assets catalog` | Writes `assets/catalog.db`, which is never committed, and `src/catalog/version.ts`, which is. |
| `pnpm assets scans` / `pnpm assets booklets` | Packs the card pictures or the booklet PDFs into `assets/`. |
| `pnpm assets capture --build` | Takes the README's screenshots on the iOS simulators. It needs macOS, Xcode and Maestro. |
| `pnpm assets showcase [--publish]` | Turns the captures into the README's images and a contact sheet. `--publish` replaces the `showcase` branch with them. |
| `pnpm doc index` / `pnpm doc section <file> "<heading>"` | Regenerates `docs/INDEX.md`, or prints one section of a doc. |
| `pnpm release plan --dry-run` | Prints the next tag and its release notes without changing anything. Run `git fetch --tags` first. |
| `pnpm release source --tag <tag> --ipa <file> --notes <file> --out <file>` | Writes a release's SideStore and AltStore source. The release workflow runs it. |
| `pnpm commit:check "<subject>"` | Checks commit subjects against `.claude/rules/commit-standards.md`, or a whole range with `--range <base>..<head>`. It is installed as the `commit-msg` hook. |
| `pnpm move <old> <new>` | Moves files and rewrites every reference to them. Try `--dry-run` first. |

Scripts log to stderr. Pass `--verbose` or `--quiet`, or set `LOG_LEVEL` to `debug`, `info`, `warn`, `error` or `silent`.
