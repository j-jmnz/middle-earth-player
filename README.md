# Solo LOTR LCG

A personal, offline app for The Lord of the Rings: The Card Game. Official campaigns are the product. The proof of concept is the 2022 Fellowship of the Ring Saga Expansion (MEC109), with the full official player-card pool available for decks from the first install.

The app applies the rules, keywords, phases, card effects, and every number they produce. The player only chooses among the options the engine lists as legal. There is no control that types damage, resources, threat, or progress. Do not reopen the product shape.

## Where it stands

- A Shadow of the Past and A Knife in the Dark are playable: every printed line of the cards they deal has an effect record. Flight to the Ford through Breaking of the Fellowship are phases 13 to 16.
- The deck builder, the campaign path, the briefing, the table, the resolution screen, and the campaign log exist.
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
| `pnpm data:sync` | Refreshes the raw sources. It is the only command that uses the network. |
| `pnpm data:build` | Builds cards, scenarios, rules, and generated effect records from `data/raw`, offline and deterministic. |
| `pnpm data:query "<sql>"` | Queries `cards`, `scenario_cards`, and `rules` in memory. |
| `pnpm catalog:build` | Writes `assets/catalog.db` (never committed) and `src/catalog/version.ts` (committed). |
| `node --experimental-strip-types scripts/e2e-fixtures.ts` | Rewrites the Maestro save fixtures. `--won` also searches for scenario 1's won game. |

The scripts log to stderr through `scripts/log.ts`: each line has the time since the start, the script and source (`data:sync › ringsdb`), and progress through long fetches. A failure prints its causes (a dropped connection's `ECONNRESET`, the URL and status of a bad response). Add `--verbose` for every request, file and stack (`pnpm data:sync ringsdb -- --verbose`), `--quiet` for warnings and errors only, or set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`). Data stays on stdout: `data:query` prints only rows there.

CI (`.github/workflows/test.yml`) runs `data:check`, `lint`, `tsc`, and `test` on every push and pull request. [CLAUDE.md](CLAUDE.md) has the data commands in more detail.

Do not commit `catalog.db`, card scans, or PDFs. The catalog is generated from `data/` and shipped inside the binary.

## Documents

- [docs/brief.md](docs/brief.md): decisions, the stack, the rules the engine implements, the data rules, and the build order.
- [docs/architecture.md](docs/architecture.md): how the code is split, and the test layers.
- [docs/design-system.md](docs/design-system.md): the screens' look.
- [docs/phases/](docs/phases/): one file per phase, and [STATUS.md](docs/phases/STATUS.md).

## Agents

`/implementer` builds a phase, `/reviewer` reviews the diff, and `/ux` reviews the screens. `effect-author` turns a `pnpm effects:draft` bundle into effect records. Their instructions are in `.cursor/agents` (`effect-author` is in `.claude/agents` only).

## Run it locally

The phone is the product. The Mac browser is the fast loop for screens.

### Mac browser

`pnpm catalog:build` once, then `pnpm web` opens the app in Chrome through Metro. Narrow the window to a phone width. Use it for the campaign list, the path, the briefing, the log, and the deck builder.

These checks stay on a physical phone: pool fling, table drag, kill-and-relaunch, and airplane mode. SQLite in the browser is browser storage. Image files and the booklet reader stay on the phone. The Skia table has no drag sign-off in Chrome.

### Codespaces

From an iPad or any browser, open the repo on GitHub, then Code → Codespaces → Create codespace. `.devcontainer/devcontainer.json` installs Node 22 and pnpm, runs `pnpm install`, and builds the catalog. Wait for that to finish in the terminal before the first run.

`pnpm web` serves the app on port 8081. Open the forwarded address from the Ports tab in Safari. The same browser limits apply as on the Mac.

### Android phone

The app uses `expo-dev-client`, so it runs as a development build of `com.middleearth.lcg`:

1. Install Android Studio with Android SDK Platform 36. On the phone, enable USB debugging.
2. `pnpm catalog:build`
3. `pnpm android -- --device`

That compiles the app, installs it over USB, and serves JavaScript from Metro. Later edits reload in the installed app. Rebuild when a native module changes. `android/` and `ios/` stay gitignored.

When Android Studio is unwelcome, the `development` profile in `eas.json` builds the same app as a cloud APK. The daily loop is the local install above.

### Maestro

Maestro launches the installed `com.middleearth.lcg`; it does not attach to Expo Go. The flows in `.maestro/` that open a save fixture need a build with `EXPO_PUBLIC_E2E_SEED` set, such as the `e2e-test` profile in `eas.json`; without it the fixture route writes nothing. `maestro test .maestro` runs once, after the last phase; it is not an earlier phase's exit. `.eas/workflows/e2e.yml` runs the same flows as an EAS job on the `e2e-test` build.
