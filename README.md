# Middle Earth LCG

A personal, offline app for The Lord of the Rings: The Card Game. Official campaigns are the product. The proof of concept is the 2022 Fellowship of the Ring Saga Expansion (MEC109), with the full official player-card pool available for decks from the first install.

The app applies the rules, keywords, phases, card effects, and every number they produce. The player only chooses among the options the engine lists as legal. There is no control that types damage, resources, threat, or progress. Do not reopen the product shape.

## Where it stands

- Four Fellowship scenarios are playable (`src/campaign/playable.ts`): A Shadow of the Past, A Knife in the Dark, Flight to the Ford and The Ring Goes South. Every printed line of the cards they deal has an effect record. Journey in the Dark and Breaking of the Fellowship (phases 15 and 16) are not: their lines are still open (`pnpm effects:open` lists them). Flight to the Ford and The Ring Goes South have their engine half done; their phone halves are open.
- Every deck-legal player card has effect records too, apart from the Messenger of the King cards (out of scope, `data/overrides.json`) and the Gollum side of Smeagol (21072). The rules engine is split by mechanic family (`src/catalog/families`, `src/rules/families`, `src/effects/authored/families`).
- The deck builder, the campaign path, the briefing, the table, the resolution screen, and the campaign log exist.
- The Scenarios tab plays a scenario as a standalone adventure: no campaign card, log, boons or burdens, a scored win, and each game can be resumed, archived, restored or deleted. Only the playable Fellowship scenarios are dealt.
- Everything is checked offline in Node. No phone check and no Maestro flow has run yet. Phone checks stay open in [docs/phases/STATUS.md](docs/phases/STATUS.md).
- Scenario 1's won save fixture is open: no legal win of the two starter decks has been found. Its Maestro flows wait for it. STATUS lists this and the other open items.

[docs/phases/STATUS.md](docs/phases/STATUS.md) is the authority on what is done.

## Rules come from the printed sources

`data/` holds the cards, scenarios, and rules text, and every test and agent reads it. On a rule, the MEC109 booklet, the quest cards, and the campaign cards win. The core-set Learn to Play wins on the ordinary round. The Rules Reference wins on definitions. The FAQ settles what those leave open. Card text is the scan-read ledger in `data/printed/`. The full order is in [.cursor/rules/authority.mdc](.cursor/rules/authority.mdc).

Code and tests name the rule ids they implement (`data/rules/entries.json`). A rule change updates [docs/brief.md](docs/brief.md) in the same change.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. A Claude Code cloud session runs it from `.claude/hooks/session-start.sh`. |
| `pnpm test` | Runs Vitest. No network, no prebuilt database. |
| `pnpm lint` | Checks import boundaries. |
| `pnpm exec tsc --noEmit` | Type-checks. |
| `pnpm data:check` | Rebuilds `data/` into a temporary directory and fails on any difference. |
| `pnpm data:sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes the raw sources. It is the only command that uses the network. `scans` and `pictures` run only when named, after `data:build`. |
| `pnpm data:build` | Builds cards, scenarios, rules, generated effect records and the game icons from `data/raw`, offline and deterministic. |
| `pnpm data:query "<sql>"` | Queries `cards`, `scenario_cards`, and `rules` in memory. |
| `pnpm effects:draft <scenario \| starter deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line no effect record owns. |
| `pnpm effects:open` | Rewrites `src/effects/open-lines.ts`, the printed lines no record owns. |
| `node --experimental-strip-types scripts/card-smoke.ts <codes>` | Plays a seeded game with the cards' records and reports any throw, refusal or stall. |
| `pnpm booklets:pack` | Copies the pinned booklet PDFs into `.cache/booklets/` for Metro. |
| `pnpm scans:pack` | Writes every card's pinned picture, scaled to 1200 px on the long side, into `assets/scans/` and fills `src/screens/images/scan-map.ts` (do not commit it filled). Fetches a picture missing from `.cache/pictures/` or `.cache/scans/`. |
| `pnpm catalog:build` | Writes `assets/catalog.db` (never committed) and `src/catalog/version.ts` (committed). |
| `node --experimental-strip-types scripts/e2e-fixtures.ts` | Rewrites the Maestro save fixtures. `--won` also searches for scenario 1's won game. |

The scripts log to stderr through `scripts/log.ts`: each line has the time since the start, the script and source (`data:sync › ringsdb`), and progress through long fetches. A failure prints its causes (a dropped connection's `ECONNRESET`, the URL and status of a bad response). Add `--verbose` for every request, file and stack (`pnpm data:sync ringsdb -- --verbose`), `--quiet` for warnings and errors only, or set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`). Data stays on stdout: `data:query` prints only rows there.

CI (`.github/workflows/test.yml`) runs `data:check`, `lint`, `tsc`, and `test` on every push and pull request. [CLAUDE.md](CLAUDE.md) has the data commands in more detail.

Do not commit `catalog.db`, card scans, card pictures, or PDFs. The catalog is generated from `data/` and shipped inside the binary. The two booklet PDFs and every card's picture ship in the binary too (`pnpm scans:pack`, run by `pnpm ios`, `pnpm android` and `eas-build-post-install`; the same Metro rule below applies to it). `pnpm booklets:pack` copies the pinned PDFs and a map that requires them into `.cache/booklets/`, and Metro bundles that map in place of the empty stub `src/screens/booklets/bundled-map.ts`. `pnpm data:sync rules`, `pnpm android` and the EAS `eas-build-post-install` hook run it. A development-client APK takes its JavaScript and assets from your local Metro, so pack on the machine that runs `pnpm start`; the books show after a Metro restart (`--clear` if it cached the stub).

## Documents

- [docs/brief.md](docs/brief.md): decisions, the stack, the rules the engine implements, and the data rules.
- [docs/architecture.md](docs/architecture.md): how the code is split, and the test layers.
- [docs/design-system.md](docs/design-system.md): the screens' look.
- [docs/phases/](docs/phases/): one file per phase, and [STATUS.md](docs/phases/STATUS.md).
- [docs/plans/](docs/plans/): plans, among them [effect-authoring.md](docs/plans/effect-authoring.md), the cookbook for effect records and mechanic families. Plans already carried out are in `docs/plans/done/`.
- [docs/handover/](docs/handover/): [agent-brief.md](docs/handover/agent-brief.md), the brief a family agent follows, and handovers for work left open.

## Agents

`/implementer` builds a phase, `/reviewer` reviews the diff, and `/ux` reviews the screens. `effect-author` turns a `pnpm effects:draft` bundle into effect records. The instructions of the first three are in `.cursor/agents`, with thin wrappers in `.claude/agents`; `effect-author` is in `.claude/agents` only.

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

`poppler` provides `pdftoppm`, which renders the campaign, boon and burden cards from FFG's PDFs. Without it those 26 card sides fall back to their scans, with a warning.

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

The first `scans:pack` downloads every pinned card picture at full size (about 5 GB, into `.cache/`; JvZijp's Drive files are about 4 MB each), checks each sha256, and writes the 1,300 pictures scaled to 1200 px (272 MB) into `assets/scans`. Later runs read the cache and take about two minutes. `pnpm ios` and `pnpm android` run both steps themselves; running them first only gets the download out of the way. No `pnpm data:sync` is needed: `data/sources.json` pins every picture. `scans:pack` rewrites `src/screens/images/scan-map.ts`; leave that change out of commits (`git checkout src/screens/images/scan-map.ts`).

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

Maestro launches the installed `com.middleearth.lcg`; it does not attach to Expo Go. The flows in `.maestro/` that open a save fixture need a build with `EXPO_PUBLIC_E2E_SEED` set, such as the `e2e-test` profile in `eas.json`; without it the fixture route writes nothing. `maestro test .maestro` runs once, after the last phase; it is not an earlier phase's exit. `.eas/workflows/e2e.yml` runs the same flows as an EAS job on the `e2e-test` build.
