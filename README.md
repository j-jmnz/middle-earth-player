# Middle Earth LCG

A personal, offline app for The Lord of the Rings: The Card Game. Official campaigns are the product: The Fellowship of the Ring saga (MEC109), Mirkwood Paths and The Dark of Mirkwood, Dream-chaser and Ered Mithrin, each also playable scenario by scenario, with Nightmare decks for some. The full official player-card pool is available for decks from the first install.

The app applies the rules, keywords, phases, card effects, and every number they produce. The player only chooses among the options the engine lists as legal. There is no control that types damage, resources, threat, or progress. Do not reopen the product shape.

## Where it stands

- The playable scenarios are listed in `src/campaign/playable.ts` (`PLAYABLE_SCENARIOS`, and `NIGHTMARE_PLAYABLE` for Nightmare). Every printed line of the cards they deal has an effect record.
- Every deck-legal player card has effect records too, apart from the Messenger of the King cards (out of scope, `data/overrides.json`). The printed lines no record owns yet are in `src/effects/open-lines.ts`. The rules engine is split by mechanic family (`src/catalog/families`, `src/rules/families`, `src/effects/authored/families`).
- The deck builder, the campaign path, the briefing, the table, the resolution screen, the campaign log and run history exist. The Scenarios tab plays any playable scenario as a standalone adventure: no campaign card, log, boons or burdens, and a scored win.
- Everything is checked offline in Node. No Maestro flow has run yet, and most scenarios' won save fixtures are missing (no auto-played win with real decks was found).

[docs/phases/STATUS.md](docs/phases/STATUS.md) is the authority on what is done.

## Rules come from the printed sources

`data/` holds the cards, scenarios, and rules text, and every test and agent reads it. On a rule, the MEC109 booklet, the quest cards, and the campaign cards win. The core-set Learn to Play wins on the ordinary round. The Rules Reference wins on definitions. The FAQ settles what those leave open. Card text is the scan-read ledger in `data/printed/`. The full order is in [.cursor/rules/authority.mdc](.cursor/rules/authority.mdc).

Code and tests name the rule ids they implement (`data/rules/entries.json`). A rule change updates [docs/brief.md](docs/brief.md) in the same change.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. A Claude Code cloud session runs it from `.claude/hooks/session-start.sh`. |
| `pnpm test` | Runs Vitest. No network, no prebuilt database. |
| `pnpm test:fast` | Runs Vitest without the slow whole-game and compiler files (`slowFiles` in `vitest.config.mts`). |
| `pnpm test:changed` | Runs only the tests that import a file changed since the last commit. |
| `pnpm lint` | Runs Oxlint (`.oxlintrc.json`): import boundaries and the React and Expo rules. |
| `pnpm typecheck` | Type-checks with tsrs. |
| `pnpm data:check` | Rebuilds `data/` into a temporary directory and fails on any difference. |
| `pnpm data:sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes the raw sources. It is the only command that uses the network. `scans` and `pictures` run only when named, after `data:build`. |
| `pnpm data:build` | Builds cards, scenarios, rules, generated effect records and the game icons from `data/raw`, offline and deterministic. |
| `pnpm data:query "<sql>"` | Queries `cards`, `scenario_cards`, and `rules` in memory. |
| `pnpm effects:draft <scenario \| starter deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line no effect record owns, after clearing the earlier drafts; groups batch twins; codes take commas or spaces. |
| `pnpm effects:open` | Rewrites `src/effects/open-lines.ts`, the printed lines no record owns. |
| `pnpm test:scenario <scenario-id>` | Runs the tests that belong to one scenario (by path or by importing its scene), its goldens, the effect coverage and record-route checks, the file-size and rule-id checks, every choice-words test (`src/play/words`; `--words` runs only that test), the reader parity test on the scenario's seeded games (`src/play/reader-play.test.ts`, run with `READER_PLAY_SCENARIO=<scenario-id>`: it fails on an intent the engine offers that no labelled element of the reader table, the tray or the dock sends; the first scenario and each scenario with a line in `test/harness/golden-registry.ts` have games) and the card smoke on its player cards, and the family and manifest tests when pool, family or manifest files changed since the merge base with origin/main (committed or not). `--list` prints the selection. |
| `pnpm scenario:new <scenario-id>` | Writes a new scenario's skeletons (scene, game, golden and campaign tests, seed finder, Maestro flows, authored effects file) on the shared test kit and adds its registry lines. `--dry-run` lists them first; it refuses a scenario that has files. The procedure around it is in [the Scenario procedure](docs/handover/agent-brief.md). |
| `pnpm docs:index` | Rewrites `docs/INDEX.md`, the index of the docs agents read. A test fails while it is stale. |
| `pnpm docs:section <file> "<heading>"` | Prints one doc section with its subsections. |
| `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` | Plays a seeded game with the cards' records and reports any throw, refusal or stall. |
| `pnpm booklets:pack` | Copies the pinned booklet PDFs into `assets/booklets/` (gitignored) for Metro. |
| `pnpm scans:pack` | Writes every card's pinned picture, scaled to 1200 px on the long side, into `assets/scans/` and fills `src/screens/images/scan-map.ts` (do not commit it filled). Fetches a picture missing from `.cache/pictures/` or `.cache/scans/`. A picture whose pin has not moved since the last pack is kept (`assets/scans/.packed.json`), so a run after a pull packs only the new pins. `--optional` (`pnpm start`) warns instead of failing, keeping the last pack. |
| `pnpm catalog:build` | Writes `assets/catalog.db` (never committed) and `src/catalog/version.ts` (committed). |
| `node --experimental-strip-types scripts/e2e/fixtures.ts` | Rewrites the Maestro save fixtures. `--won` also searches for scenario 1's won game. `<scenario-id>` writes only that scenario's file. |

The scripts log to stderr through `scripts/log.ts`: each line has the time since the start, the script and source (`data:sync › ringsdb`), and progress through long fetches. A failure prints its causes (a dropped connection's `ECONNRESET`, the URL and status of a bad response). Add `--verbose` for every request, file and stack (`pnpm data:sync ringsdb -- --verbose`), `--quiet` for warnings and errors only, or set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`). Data stays on stdout: `data:query` prints only rows there.

CI (`.github/workflows/test.yml`) runs `data:check`, `lint`, `typecheck`, and `test` on every push and pull request. [CLAUDE.md](CLAUDE.md) has the data commands in more detail.

Do not commit `catalog.db`, card scans, card pictures, or PDFs. The catalog is generated from `data/` and shipped inside the binary. The two booklet PDFs and every card's picture ship in the binary too (`pnpm scans:pack`, run by `pnpm start`, `pnpm ios`, `pnpm android` and `eas-build-post-install`, so every local bundle and release takes the pictures `data/sources.json` pins; the same Metro rule below applies to it). `pnpm booklets:pack` copies the pinned PDFs and a map that requires them into `assets/booklets/` (gitignored), and Metro bundles that map in place of the empty stub `src/screens/booklets/bundled-map.ts`. `pnpm data:sync rules`, `pnpm android` and the EAS `eas-build-post-install` hook run it. A development-client APK takes its JavaScript and assets from your local Metro, so pack on the machine that runs `pnpm start`; the books show after a Metro restart (`--clear` if it cached the stub).

## Documents

- [docs/brief.md](docs/brief.md): decisions, the stack, the rules the engine implements, and the data rules.
- [docs/architecture.md](docs/architecture.md): how the code is split, and the test layers.
- [docs/INDEX.md](docs/INDEX.md): generated index of every doc agents read, with section line ranges and the sections each code area cites (`pnpm docs:index`; `pnpm docs:section <file> "<heading>"` prints one section).
- [docs/design-system.md](docs/design-system.md): the screens' look; the table's is in [docs/design-system-table.md](docs/design-system-table.md).
- [docs/phases/](docs/phases/): one file per phase, and [STATUS.md](docs/phases/STATUS.md).
- [docs/plans/](docs/plans/): plans, among them [effect-authoring.md](docs/plans/effect-authoring.md), the cookbook for effect records and mechanic families.
- [docs/handover/](docs/handover/): [agent-brief.md](docs/handover/agent-brief.md), the brief a family agent follows, and handovers for work left open.

## Agents

`/orchestrator` runs a plan with several sections, `/implementer` builds a phase, `/reviewer` reviews the diff, and `/ux` reviews the screens. Every agent follows `.cursor/rules/code-standards.mdc` for code and `.cursor/rules/docs-standards.mdc` for docs. `effect-author` turns a `pnpm effects:draft` bundle into effect records. The instructions of the first four are in `.cursor/agents`, with thin wrappers in `.claude/agents`; `effect-author` is in `.claude/agents` only. In Claude Code the orchestrator runs as the main session (`claude --agent orchestrator`, or ask the main session to follow its file): a subagent cannot start the implementers and reviewers it hands work to.

## Run it locally

The phone is the product. The Mac browser is the fast loop for screens.

### Mac browser

`pnpm catalog:build` once, then `pnpm web` opens the app in Chrome through Metro. Narrow the window to a phone width. Use it for the campaign list, the path, the briefing, the log, and the deck builder.

These checks stay on a physical phone: pool fling, table drag, kill-and-relaunch, and airplane mode. SQLite in the browser is browser storage. The bundled card pictures and the booklet reader are on the phone only. The Skia table has no drag sign-off in Chrome.

### Codespaces

From an iPad or any browser, open the repo on GitHub, then Code → Codespaces → Create codespace. `.devcontainer/devcontainer.json` installs Node 22 and pnpm, runs `pnpm install`, and builds the catalog. Wait for that to finish in the terminal before the first run.

`pnpm web` serves the app on port 8081. Open the forwarded address from the Ports tab in Safari. The same browser limits apply as on the Mac.

### Phone builds from scratch (Mac)

iOS needs macOS; Android builds on the same Mac. The app is `com.middleearth.lcg` and uses `expo-dev-client`.

A development build loads its JavaScript and its card pictures from Metro on the Mac, so it works only while the phone can reach the Mac. A release build carries the code, the catalog, the booklets and every card's picture, and needs no network. Install a release build to play; use a development build to work on screens.

#### 1. Tools, once

```bash
brew install node@22 poppler watchman cocoapods
corepack enable    # pnpm 10.34.1, pinned in package.json
```

`poppler` provides `pdftoppm`, which renders the campaign, boon and burden cards from FFG's PDFs. Without it those card sides fall back to their scans, with a warning.

- iOS: install Xcode from the App Store and open it once to accept the licence. In Xcode → Settings → Accounts, add your Apple ID.
- Android: install Android Studio and, in its SDK Manager, Android SDK Platform 36. Add to `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

#### 2. The repo

```bash
git clone https://github.com/j-jmnz/middle-earth-lcg.git
cd middle-earth-lcg
pnpm install
```

"Ignored build scripts: sharp" is harmless: sharp uses its prebuilt binary.

#### 3. Catalog and pictures

```bash
pnpm catalog:build
pnpm scans:pack
```

The first `scans:pack` downloads every pinned card picture at full size (about 5 GB, into `.cache/`; JvZijp's Drive files are about 4 MB each), checks each sha256, and writes every picture scaled to 1200 px into `assets/scans`. Later runs keep each picture whose pin has not moved and pack only the new ones, in seconds. `pnpm start`, `pnpm ios` and `pnpm android` run both steps themselves, so a pull that brings new pictures (a new campaign's) is packed on the next start; running them first only gets the download out of the way. No `pnpm data:sync` is needed: `data/sources.json` pins every picture. `scans:pack` rewrites `src/screens/images/scan-map.ts`; leave that change out of commits (`git checkout src/screens/images/scan-map.ts`).

#### 4. iPhone or iPad

1. Connect the device by cable and trust the Mac. Turn on Settings → Privacy & Security → Developer Mode (the device restarts).
2. Release build:

```bash
pnpm ios --device --configuration Release
```

Pick the device when asked, and your Apple ID as the signing team. The first build generates `ios/` and runs CocoaPods. With a free Apple ID the installed app stops opening after 7 days; run the same command again to reinstall it (saves stay). A paid developer account avoids that.

`plugins/with-script-sandboxing-off.js` turns off Xcode's User Script Sandboxing in the generated project: React Native's bundle phase writes `ip.txt` into the app undeclared, and the sandbox fails the build with "Operation not permitted". An `ios/` generated before the plugin keeps the old setting until `npx expo prebuild --clean --platform ios`.

#### 5. Android phone

1. On the phone, tap Settings → About phone → Build number seven times, then turn on Developer options → USB debugging.
2. Connect it by cable and allow the Mac. `adb devices` lists it.
3. Release build (signed with the debug key):

```bash
pnpm android --device --variant release
```

When Android Studio is unwelcome, the `development` profile in `eas.json` builds a development APK in the cloud.

#### Afterwards

- Check the offline build: airplane mode, close the app, reopen it. Every card's picture shows.
- Rebuild with the same command after a change. The pictures come from the cache.
- For the daily loop, drop `--configuration Release` and `--variant release`: the development build reloads edits from Metro, and rebuilds only when a native module changes. A phone that cannot reach Metro over the network (a VPN, an isolated Wi-Fi) runs `pnpm android:usb --device` instead. pnpm passes a `--` on to Expo, which then ignores the flags after it, so write the flags without one.
- `android/` and `ios/` stay gitignored. Keep about 10 GB free for `.cache/` and the native builds.

### Maestro

Maestro launches the installed `com.middleearth.lcg`; it does not attach to Expo Go. The flows sit in `.maestro/scenarios/<scenario-id>/` and `.maestro/features/`; `.maestro/config.yaml` lists both, so `maestro test .maestro` (and the EAS `e2e` workflow, `flow_path: .maestro`) runs every flow but the ones tagged `reader`. The flows in `.maestro/` that open a save fixture need a build with `EXPO_PUBLIC_E2E_SEED` set, such as the `e2e-test` profile in `eas.json`; without it the fixture route writes nothing. `maestro test .maestro` runs once, after the last phase; it is not an earlier phase's exit. `.eas/workflows/e2e.yml` runs the same flows as an EAS job on the `e2e-test` build. `.maestro/features/screen-reader.yaml` plays the first half of a round from the reader table. Maestro cannot turn VoiceOver or TalkBack on, so it needs a development build whose bundle was started with `EXPO_PUBLIC_E2E_SEED=1 EXPO_PUBLIC_FORCE_READER=1` (`useReaderMode` in `src/ui/screen-reader.ts` answers yes for it on a phone, in a development build only); the `e2e-test` release build ignores the variable and draws the canvas, so the flow carries the `reader` tag that `config.yaml` excludes, and runs only on that development build with `maestro test --include-tags=reader .maestro`.
