# Development

Start with the Local setup section of [CONTRIBUTING.md](../CONTRIBUTING.md), which gets `pnpm test` passing. This page covers what comes after: running the app in a browser or on a phone, and every `pnpm` command. CONTRIBUTING.md also explains how a change lands.

## In a browser

```bash
pnpm web
```

This builds the catalog and opens the app through Metro. Narrow the window to phone width. The browser build draws the table on CanvasKit, reads the booklets with pdf.js and runs SQLite on browser storage; its card pictures come from the network unless `pnpm assets scans` has packed them (`pnpm assets booklets` does the same for the books), and Settings can back up and restore the saves. Until CanvasKit has loaded, and with Table as a list on Always, the table is the list.

There's also a Codespaces devcontainer (`.devcontainer/devcontainer.json`) that installs the dependencies and builds the catalog. Run `pnpm web` there and open port 8081.

## Checking a screen in a browser

`pnpm browser` lets an agent, or you, see a screen without a phone: it opens the web build in headless Chromium, writes PNGs and prints what each page logged. Read the PNGs to see the screen and the printed list to see what broke.

```bash
pnpm browser shot /settings /decks --dark            # two screens, dark theme
pnpm browser shot --fixture duo /table/{save} --landscape --ids
pnpm browser shot /settings --tap app-settings-theme-dark --tap text=About
pnpm browser run <scratchpad>/flow.ts                # a flow shot cannot express
```

- **What it opens.** The static web export with the e2e seed, so `--fixture <name>` writes a fixture save (names in `src/campaign/fixtures/registry.ts`) and `{save}` in a route is its save id. `--at <n>` keeps the fixture's first n intents, so the table opens on the moment `pnpm game show <name> --at <n>` prints. With no route it shoots where the fixture landed, or `/`. The export is made again only when its inputs changed (`scripts/browser/web-export.ts`): about 10 s on a warm Metro cache, a minute and a half cold. `--fresh` forces it, `--reuse` keeps the last one, and `--base http://localhost:8081` opens a running `pnpm web` instead.
- **Taps.** `--tap` takes a testID (react-native-web writes it as `data-testid`), a Playwright selector (`text=Theme`, `[role=button]`) or `x,y` in CSS pixels for the table's canvas, which has no elements for its cards. Each tap is followed by a shot. A target that is not there fails after 5 s and lists the testIDs that are; `--ids` lists them on every shot, and `--text` prints the page's text.
- **What it reports.** Console errors and warnings, uncaught errors, and requests that failed or answered 400 and over. Requests off localhost are blocked (card pictures come from the network unless `pnpm assets scans` ran), and `--net` lets them through. An uncaught error, a wait that times out or a missing tap target fails the run.
- **Options.** `--dark` or `--both` themes, `--landscape` or `--size <w>x<h>` (phone portrait by default), `--full-page`, `--settle <ms>` after each load and tap (1000), `--wait <testID>` before the first shot, `--out <dir>`.
- **Scripts.** `pnpm browser run <file>` imports a file that default-exports `async (app) => {}`, where `app` is the `App` of `scripts/browser/app.ts`: `open`, `seed`, `tap`, `shot`, `testIds`, `problems`, and Playwright's `context`. Keep the file in the scratchpad, not the repository. `app.open` closes the page it opened before, since a second tab waits forever on the app's database.
- **Chromium.** `scripts/browser/chromium.ts` launches Playwright's own browser (`pnpm exec playwright install chromium`), else a cloud container's Chromium at `/opt/pw-browsers/chromium`; `CHROMIUM_PATH=<binary>` wins over both.

## Reading a game as text

`pnpm game` replays a save fixture or a scenario's golden through the reducer and prints it as text, for debugging the engine without a screen. A source is a fixture name (`duo`, `mirkwood-lost`), `<scenario-id>/<golden number or name>` (`pnpm game list` lists both), or a smoke run: `encounter:<scenario-id>:<game>` is one numbered game of `pnpm test encounter`, replayed in full, and `smoke:<code>[:<seed>[:<deal>]]` one card's run of `pnpm test smoke`, opened on the table its failing intent was sent on (that run deals copies of the card outside the reducer, so it has no replay from the start). A smoke failure prints the source that opens it.

```bash
pnpm game show mirkwood-lost --until round=3 --legal
pnpm game show duo --at 5 --send '{"type":"Pass"}'
pnpm game log passage-through-mirkwood/1 --from 40 --to 60 --steps
pnpm game diff passage-through-mirkwood/1
pnpm game show encounter:the-oath:7 --at 120 --legal
pnpm game scene passage-through-mirkwood '{"phase":"Combat","engaged":["01096"],"hand":["01034"],"heroResources":3}' --legal
```

- **`show`** replays to a moment and prints the table: the round, the phase and the open window, the quest, the staging area and its threat, each seat's heroes, cards in play, engaged enemies and hand, and the stack. A stat a modifier moved shows its printed number beside it. `--at <n>` stops after n intents and `--until` at the first state a condition holds for (`lost`, `won`, `round=N`, `phase=X`, `mode=X`, `window=X`, `seat=N`, `code=X`). `--legal` lists the intents the engine offers, with the cards each may take and the JSON to send. `--send '<intent>'` (repeatable) sends one more intent and prints its engine steps, or the reducer's reason for refusing it. `--full` adds the modifiers, delayed effects and the decks' order; `--json` prints the raw state.
- **`log`** prints one line per intent with its round, phase and seat. `--steps` adds the engine steps under each, with the rule or effect that caused every number. `--from`, `--to`, `--until` and `--grep <text>` narrow it.
- **`diff`** plays a golden now and compares it with its `golden.json`. It names the first intent where they part and prints the table both reached, or the fields where the final states differ. A failing golden test names the goldens that moved and points here.
- **`scene <scenario-id> '<layout>'`** builds the table a card's test would (`tableFromLayout`, `test/harness/layout.ts`) and reads it as `show` does, so `--legal` and `--send` try a card before its test is written. The layout is the kit's `Layout` as JSON, inline or `@<file>`; the heroes are the kit's stand-ins, and a player card it names that the scenario does not deal is loaded from `data/cards`.
- A replay that the reducer refuses, or that throws, stops there, and `show` says which intent and why. The fixture tests point here when a fixture no longer replays.
- Cards are named as `Title (code) #id`; an intent names cards by the id. Hidden cards are named too: this is for debugging, not the player's view.

## On a desktop

```bash
pnpm desktop dev
```

This builds the catalog, CanvasKit and the pdf.js files, bundles the Electron shell (`desktop/`), starts Metro on port 8081 and opens the desktop window on it. The window may reach `http://localhost:8081` in this mode only. `pnpm desktop build` makes the production pieces in `desktop/build` (the packs, the web export with `EXPO_PUBLIC_DESKTOP=1`, the shell) and `pnpm desktop pack` an installer for the OS it runs on into `desktop/out` (an AppImage and a `.deb` on Linux); set `APP_VERSION=<major>.<minor>.<patch>` to stamp the version. `pnpm desktop smoke` launches the app on a seeded export and checks it; on Linux without a display it runs itself under `xvfb-run`. The shell, its folders and the policy it enforces are in [architecture.md](architecture.md) (Desktop).

## On a phone

For iOS you need macOS and Xcode. For Android you need Android Studio, SDK Platform 36 and `ANDROID_HOME` set. The app id is `com.middleearth.player`. The app uses `expo-dev-client`, so Expo Go can't run it.

```bash
pnpm assets
```

`pnpm assets` runs `assets catalog`, `assets canvaskit`, `assets pdfjs`, `assets booklets`, `assets scans` and `assets sounds`. The first time `assets scans` runs, it downloads every pinned card picture into `.cache/` (about 5 GB), checks each one's sha256, and writes 1200 px copies to `assets/scans/`. Later runs only pack the pictures that changed. `pnpm start`, `pnpm android` and `pnpm ios` run it for you first. It rewrites `src/screens/images/scan-map.ts`; don't commit that change.

For a release build, which works offline with all its data bundled:

```bash
pnpm ios --device --configuration Release
pnpm android --device --variant release
```

Leave off `--configuration Release` or `--variant release` to get a development build, which loads its JavaScript and pictures from Metro. If the phone can't reach Metro, for example over a VPN or on isolated Wi-Fi, use `pnpm android:usb --device`. Keep about 10 GB free. The `ios/` and `android/` folders are generated and gitignored.

A build signed with a free Apple ID stops opening after 7 days. Run the command again to reinstall it; your saves are kept. The EAS cloud build profiles are in `eas.json`.

## Commands

Scripts are grouped as `pnpm <group> <command> [args]`, and running `pnpm <group>` on its own lists that group's commands (`scripts/cli.ts`). The exceptions are `pnpm test` and `pnpm assets`, which run everything in their group. The groups are `test`, `data`, `effects`, `scenario`, `assets`, `browser`, `game`, `desktop`, `doc` and `release`, while `lint`, `typecheck`, `move` and `commit:check` stand alone. If the first argument to `pnpm test` isn't one of its commands, it goes to Vitest as a filter.

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs every Vitest test. |
| `pnpm test fast` | Runs everything except the slow files (`slowFiles` in `vitest.config.mts`). |
| `pnpm test changed` | Runs the tests that import a file changed since the last commit. |
| `pnpm test scenario <scenario-id>` | Runs one scenario's tests within their time budget, along with its goldens, the effect coverage, file-size, test-cost, rule-id and wording checks, the card smoke on its player cards and the encounter smoke. It adds the family and manifest tests if pool, family or manifest files changed since the merge base with `origin/main`. `--list` prints what it would run, and `--quick` skips the goldens and the reader check. |
| `pnpm test smoke <codes>` | Plays a seeded game with those cards and reports errors and stalls. `--all` covers every card. |
| `pnpm test encounter <scenario-id>...` | Plays every encounter-side card of a scenario (reveal, Shadow, travel, quest Setup) plus seeded games with random legal intents, and reports errors, refused offers, stalls, replay differences and a table that is not sound (a card in two lists, a broken attachment link, a negative counter, lethal damage or an elimination level left standing while nothing resolves: `scripts/card-smoke/invariants.ts`). `--all` covers every playable scenario; the full test run plays each scenario's cards and a few of its games (`scripts/card-smoke/encounter-sweep.ts`). |
| `pnpm test phone-bundle` | Exports the Android and the iOS bundle (`--no-bytecode`; iOS needs no Xcode) in a temporary worktree at the merge base with `origin/main` and in this tree, and fails, naming the first modules that differ, unless each platform's two are byte-identical (it reports IDENTICAL per platform): the web and desktop work leaves the phone's bundle as it is (`docs/architecture.md`, Screens). It takes about four minutes, needs `pnpm assets catalog` first and the history of `origin/main`, and skips with a message without them. `--base <ref>` compares another commit; `--keep` keeps the exports; `--if-desktop-work` does nothing unless the diff touches desktop work, which is how the pull request job (`phone-bundle` in `.github/workflows/test.yml`) runs it. |
| `pnpm test a11y` | Audits the main web screens with axe-core in Chromium and fails on serious or critical findings. It finds Chromium as `pnpm browser` does. `--skip-export` reuses the last export even when its inputs changed. |
| `pnpm game show <source>` | Replays a fixture or golden to a moment and prints the table as text (Reading a game as text). `pnpm game log` prints its intents and engine steps, `pnpm game diff` where a golden leaves `golden.json`, `pnpm game list` the sources. |
| `pnpm browser shot [route...]` | Opens routes of the web build in Chromium, writes a PNG of each to `.agent/shots` and prints each page's errors (Checking a screen in a browser). |
| `pnpm browser run <script.ts>` | Runs a scratch Playwright script against the web build. |
| `pnpm browser serve` | Serves the web export on `127.0.0.1` until stopped and prints its address. |
| `pnpm lint` | Runs Oxlint (`.oxlintrc.json`). |
| `pnpm typecheck` | Type-checks with tsrs. |
| `pnpm data sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes `data/raw/` and `.cache/` from the sources. It is the only command that reads the sources for new data. `scans` and `pictures` run only when you name them, after `data build`. |
| `pnpm data mirror push\|pull [source...]` | `push` uploads every pinned file in `.cache/` that the asset mirror does not hold (`--fetch` downloads the ones `.cache/` lacks from their URLs first); `pull` fills `.cache/` from it (Asset mirror). |
| `pnpm data build` | Builds `data/`, `src/effects/generated/` and the game icons from `data/raw/`, offline and deterministically. |
| `pnpm data check` | Rebuilds into a temporary directory and fails on any difference. |
| `pnpm data ledger-seed <scenario-id> [--nightmare]` | Writes the scenario's missing printed-text ledger entries from the source text, `readBy` empty and the pinned scan named. Each is read against its scan before the scenario is playable. `--nightmare` seeds its Nightmare deck into `data/printed/nightmare.json` (the proxy pictures `pnpm data sync nightmare` pins). |
| `pnpm data query "<sql>"` | Queries the `cards`, `scenario_cards` and `rules` tables in memory. |
| `pnpm effects draft <scenario \| deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line no record covers yet. |
| `pnpm effects open` | Regenerates `src/effects/open-lines.ts`. |
| `pnpm scenario new <scenario-id>` | Writes and registers the skeleton files for a new scenario. Try `--dry-run` first. |
| `pnpm scenario pack <scenario-id>` | Writes `.agent/pack/<id>.md`, the context a scenario author reads: vocabulary, schema entries, cookbook sections and drafts. |
| `pnpm scenario fixtures [scenario-id] [--search ...]` | Regenerates the save fixtures in `src/campaign/fixtures/`. `--won` (scenario 1's won game) and `--search` run only when the user asks: no agent searches for a won fixture (`docs/architecture.md`, Tests). `FIXTURE_TRY_WON=1` plays the plain seeds once for every finder's won game, for the user who changes the fixture decks, and `FIXTURE_SEEDS=<n>` sets the seed count of every finder for that run. With `--search`, a `-won` game that the fixed policy of the seed scan never reaches is searched for: a beam over end-of-round states built on the engine's legal moves (`scripts/e2e/search/`), printing one line per pass and seed (the round reached, the best score, what ended the other lines) and keeping a win only after it replays from the dealt state. Flags: `--seeds=1-4` (the seeds dealt), `--budget=600` (seconds for one won game, shared by three passes that widen), `--plain=0` (seeds of the plain scan first; 0 skips it), `--width` and `--branches` (one pass of that size), `--rounds=40`, `--out=<folder>` (writes the file there, not to `src/campaign/fixtures/`). A search costs about two to four milliseconds an intent and 400 to 650 MB of memory; a run needs `LOG_LEVEL=debug` to print each round. |
| `pnpm assets` | Runs `catalog`, `canvaskit`, `pdfjs`, `booklets` and `scans` in that order. `start`, `android`, `ios` and the native release builds run it for you (`start` with `--optional`). |
| `pnpm assets catalog canvaskit pdfjs` | Any several packs, each run in the order named (`scripts/cli.ts`); the arguments after the last name go to every pack. |
| `pnpm assets catalog` | Writes `assets/catalog.db`, which is never committed, and `src/catalog/version.ts`, which is. |
| `pnpm assets canvaskit` | Copies CanvasKit's wasm to `public/canvaskit.wasm` (gitignored), which the web build loads to draw the table. `pnpm web` and `pnpm test a11y` run it with `catalog`. |
| `pnpm assets pdfjs` | Copies pdf.js's worker and data (CMaps, standard fonts, ICC profiles, wasm decoders) to `public/pdfjs` (gitignored), which the web booklet reader loads. `pnpm web` runs it. |
| `pnpm assets scans` / `pnpm assets booklets` | Packs the card pictures or the booklet PDFs into `assets/`. |
| `pnpm assets sounds [--from <folder> --hearthstone <folder>]` | Packs the sound effects that `data/sources.json` pins into `assets/sounds`, from `.cache/audio/sfx` or the asset mirror; `--from` first cuts them from a folder of unpacked Darkest Dungeon II banks, and `--hearthstone` the card landing from a folder of Hearthstone's sounds (needs ffmpeg) and writes their pins: commit `data/sources.json`, then `pnpm data mirror push sounds`. Restart Metro with `--clear` after. `--check` packs nothing: it reads each packed file, lists how long after its start the sound is heard, and fails on one that starts with silence (a cut does the same before it pins). |
| `pnpm assets music [--from <folder>]` | The same for the music loops (`assets/music`, `.cache/audio/music`): `--from` cuts each loop of `scripts/build/music-picks.ts` from a folder of the score's tracks, an album a folder under it (needs ffmpeg), and writes their pins; then `pnpm data mirror push music`. `--longer <factor>` with `--from` first looks in each track for a loop that many times as long around its pick that repeats with no seam (`scripts/build/music-seam.ts`), writes the new starts and ends into `music-picks.ts` and cuts those; its report names each loop to listen to (a weak seam, another level, a track too short). |
| `pnpm assets capture --build` | Takes the README's screenshots on the iOS simulators. It needs macOS, Xcode and Maestro. |
| `pnpm assets showcase [--publish]` | Turns the captures into the README's images and a contact sheet. `--publish` replaces the `showcase` branch with them. |
| `pnpm assets banner` | Draws the README's banner in both themes (`.github/readme/banner-*.webp`) from the tablet stills, the icon and the app's fonts. |
| `pnpm desktop dev` | Opens the Electron shell on the Metro web server (`localhost:8081`, allowed in this mode only). |
| `pnpm desktop build` | Writes the web export (`EXPO_PUBLIC_DESKTOP=1`) and the shell's bundle to `desktop/build`, after `pnpm assets`. `--skip-assets` leaves the packs, `--optional` lets one fail. |
| `pnpm desktop pack` | Runs electron-builder for this OS into `desktop/out`; `APP_VERSION` sets the version, `--skip-build` packs the last build and `--dir` makes the unpacked app only. |
| `pnpm desktop smoke` | Exports with the e2e seed, launches the app through Playwright and checks isolation, the table, a booklet and a picture when packed, that nothing left `app://` and that a relaunch finds the save. `--skip-build` reuses the export, `--app <path>` launches a packed app. |
| `pnpm doc index` / `pnpm doc section <file> "<heading>"` / `pnpm doc find "<words>"` | Regenerates `docs/INDEX.md`, which is not committed (it fails when one doc has two headings with the same text), prints one section of a doc, or lists the headings that hold the words. |
| `pnpm release plan --dry-run` | Prints the next tag and its release notes without changing anything. Run `git fetch --tags` first. |
| `pnpm release source --tag <tag> --ipa <file> --notes <file> --out <file>` | Writes a release's SideStore and AltStore source. The release workflow runs it. |
| `pnpm release installs --releases <file> --out <file>` | Writes the README's installs badge from a `gh api --paginate --slurp` dump of the releases. The release workflow runs it. |
| `pnpm commit:check "<subject>"` | Checks commit subjects against `.claude/rules/commit-standards.md`, or a whole range with `--range <base>..<head>`. It is installed as the `commit-msg` hook. |
| `pnpm move <old> <new>` | Moves files and rewrites every reference to them. Try `--dry-run` first. |

Scripts log to stderr. Pass `--verbose` or `--quiet`, or set `LOG_LEVEL` to `debug`, `info`, `warn`, `error` or `silent`.

## Asset mirror

The asset mirror is a private Cloudflare R2 bucket that holds every file `data/sources.json` pins in `.cache/` (the card scans, the pictures, the PDFs, the sound effects and the music loops), each at `sha256/<hash>` (`scripts/data/mirror/client.ts`). It is a cache in front of the sources, not a source: the pins keep the original URLs, and `data sync` still reads the sources. The sound effects and the music loops are the exception (user decision, 2026-11-21): cut from the player's own files, they have no URL, so the mirror is their only copy online, and `pnpm assets sounds` and `pnpm assets music` read them only from `.cache/audio` and the mirror.

- `pnpm assets scans` and `pnpm assets booklets` read a file that `.cache/` misses from the mirror first, then from its URL. Every body is checked against its pin either way. After the first error (no network, a refused key) the run reads the sources and warns once.
- `pnpm data mirror pull [source...]` fills `.cache/` from the mirror, so a fresh clone has the scans and PDFs without a sync. `pnpm data mirror push [source...]` uploads what the mirror lacks, with the write key. A pack reads only the files it bundles, so a scan that a picture stands in for reaches `.cache/` only through `data sync scans`; `push --fetch` downloads such files from their URLs first. A page rendered from a PDF is pushed only when a local render matches its pin.
- The release and showcase workflows' pack (`.github/actions/pack-assets`) reads the mirror and pushes what it had to fetch (`docs/releasing.md`, Asset mirror secrets).
- Each pack ends with one summary line, kept under `--quiet`: how many files came from the last pack, `.cache/`, the mirror and their sources, how many pages it rendered from a PDF, and the worker time spent loading and on the images.

It needs four variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. Set them in your shell profile, never in a file in the repository. A read-only token is enough for builds and `pull`; `push` needs a token with Object Read & Write. Without all four, or with `ASSET_MIRROR=off`, every command reads the sources as before. The app never reads the mirror: its pictures and books are bundled.
