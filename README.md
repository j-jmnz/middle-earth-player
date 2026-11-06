# Middle Earth LCG

An offline, single-device app for playing The Lord of the Rings: The Card Game solo. It runs on iOS and Android, built with Expo and React Native, and it also runs in a desktop browser for development.

This is an unofficial fan project. It has no affiliation with Fantasy Flight Games, Asmodee or Middle-earth Enterprises. The card text, card art and rules belong to their owners.

## Features

- Plays the official campaigns: The Fellowship of the Ring saga (MEC109), Mirkwood Paths, The Dark of Mirkwood, Dream-chaser and Ered Mithrin. Each scenario can also be played on its own, and some have Nightmare mode.
- The engine applies the rules, keywords, phases and card effects, and works out every number. The player picks from the moves the engine lists as legal. You never type in damage, resources, threat or progress yourself.
- Supports true solo (one seat) or two-handed solo (two seats on one device). No accounts, no server, no multiplayer.
- Includes a deck builder with the full official player-card pool, the pre-built decks, a campaign log, run history and a rules reference.

`src/campaign/playable.ts` lists the scenarios you can play now. [docs/phases/STATUS.md](docs/phases/STATUS.md) lists the work still open.

## Architecture

- `data/` holds the card, scenario and rules data. It is committed and built offline from source snapshots in `data/raw/`. Every source (RingsDB, Hall of Beorn, the DragnCards plugin data, FFG's rules PDFs, card scans) is listed and pinned in `data/sources.json`.
- Card text comes from `data/printed/`, a ledger of the lines printed on each card, read from its scan.
- Each printed line is implemented by an effect record: generated ones live in `src/effects/generated/` and hand-written ones in `src/effects/authored/`. A scenario becomes playable once every line of every card it deals has a record. Lines that no record covers yet are listed in `src/effects/open-lines.ts`.
- The rules engine (`src/rules/`) is a pure reducer that runs in Node. It is split by mechanic family. Code and tests cite the rule ids they implement (`data/rules/entries.json`).
- When sources disagree, the order of precedence is set in [.cursor/rules/authority.mdc](.cursor/rules/authority.mdc).

The stack is Expo SDK 58, Expo Router, Skia for the game table, Reanimated, NativeWind, SQLite through Drizzle, Zustand and Zod. [docs/architecture.md](docs/architecture.md) covers the module layout, state, the engine and the test layers.

## Local setup

### Requirements

- Node 22
- pnpm 10.34.1 (`corepack enable` installs the version pinned in `package.json`)
- Optional: `poppler` (`pdftoppm`), which renders campaign, boon and burden cards from FFG's PDFs. If it's missing, those cards use their scans and the build prints a warning.

```bash
git clone https://github.com/j-jmnz/middle-earth-lcg.git
cd middle-earth-lcg
pnpm install
pnpm test
```

The tests need no network access and no prebuilt database. The message "Ignored build scripts: sharp" is harmless.

### In a browser

```bash
pnpm web
```

This builds the catalog and opens the app in a browser through Metro. Narrow the window to phone width. The browser build is fine for screen work: the campaign list, the campaign path, the briefing, the log and the deck builder. It does not bundle card pictures or the booklet reader, and SQLite runs on browser storage.

The repo also includes a devcontainer for GitHub Codespaces (`.devcontainer/devcontainer.json`). It installs dependencies and builds the catalog. Run `pnpm web` and open the forwarded port 8081.

### On a phone

iOS builds need macOS and Xcode. Android builds need Android Studio with SDK Platform 36 and `ANDROID_HOME` set. The app id is `com.middleearth.lcg`, and it uses `expo-dev-client`, so it can't run in Expo Go.

```bash
pnpm catalog:build
pnpm scans:pack
```

On its first run, `scans:pack` downloads every pinned card picture into `.cache/` (about 5 GB) and checks each one's sha256. It then writes a copy of each picture, scaled to 1200 px, into `assets/scans/`. Later runs pack only pictures that have changed. `pnpm start`, `pnpm ios` and `pnpm android` run both steps on their own. `scans:pack` rewrites `src/screens/images/scan-map.ts`; don't commit that change.

Release build, which works offline and includes the catalog, booklets and pictures:

```bash
pnpm ios --device --configuration Release
pnpm android --device --variant release
```

For day-to-day development, leave off `--configuration Release` and `--variant release`. The development build loads JavaScript and pictures from Metro, so the phone needs to reach your machine. If the phone can't reach Metro over the network (a VPN or an isolated Wi-Fi), run `pnpm android:usb --device` instead. Keep about 10 GB free for `.cache/` and the native builds. `ios/` and `android/` are generated and gitignored.

With a free Apple ID, an installed iOS build stops opening after 7 days. Run the same command again to reinstall it; saves are kept. `eas.json` defines cloud build profiles for EAS.

### Maestro

The end-to-end flows are in `.maestro/scenarios/<scenario-id>/` and `.maestro/features/`. They run against an installed build, not Expo Go, with `maestro test .maestro`. Flows that open a save fixture need a build with `EXPO_PUBLIC_E2E_SEED` set, such as the `e2e-test` profile in `eas.json`. The screen-reader flow (`.maestro/features/screen-reader.yaml`, tag `reader`) needs a development build started with `EXPO_PUBLIC_E2E_SEED=1 EXPO_PUBLIC_FORCE_READER=1`. Run it with `maestro test --include-tags=reader .maestro`. `.eas/workflows/e2e.yml` runs the same flows as an EAS job.

## Commands

| Command | Description |
| --- | --- |
| `pnpm test` | Runs all Vitest tests. |
| `pnpm test:fast` | Skips the slow files (`slowFiles` in `vitest.config.mts`). |
| `pnpm test:changed` | Runs only the tests that import a file changed since the last commit. |
| `pnpm test:scenario <scenario-id>` | Runs one scenario's tests: its golden games, the effect coverage, file-size, rule-id and wording checks, and the card smoke test on its player cards. If pool, family or manifest files changed since the merge base with `origin/main`, it also runs the family and manifest tests. `--list` prints the selection. |
| `pnpm lint` | Runs Oxlint (`.oxlintrc.json`). |
| `pnpm typecheck` | Type-checks with tsrs. |
| `pnpm data:sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes `data/raw/` and `.cache/` from the sources. This is the only command that uses the network. `scans` and `pictures` only run when you name them, after `data:build`. |
| `pnpm data:build` | Builds `data/`, `src/effects/generated/` and the game icons from `data/raw/`. Offline and deterministic. |
| `pnpm data:check` | Rebuilds into a temporary directory and fails if the output differs from what's committed. |
| `pnpm data:query "<sql>"` | Queries the `cards`, `scenario_cards` and `rules` tables in memory. |
| `pnpm effects:draft <scenario \| deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line that has no effect record. |
| `pnpm effects:open` | Regenerates `src/effects/open-lines.ts`. |
| `pnpm scenario:new <scenario-id>` | Writes the skeleton files for a new scenario and registers it. `--dry-run` lists the files first. |
| `pnpm catalog:build` | Writes `assets/catalog.db` (never committed) and `src/catalog/version.ts` (committed). |
| `pnpm scans:pack` / `pnpm booklets:pack` | Packs card pictures and the booklet PDFs into `assets/` for the native bundle. |
| `pnpm move <old> <new>` | Moves files and rewrites every import and path that refers to them. `--dry-run` first. |
| `pnpm docs:index` / `pnpm docs:section <file> "<heading>"` | Regenerates `docs/INDEX.md` / prints one doc section. |
| `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` | Plays a seeded game with the given player cards and reports any throw, refusal or stall. `--all` runs every card. |
| `node --experimental-strip-types scripts/e2e/fixtures.ts [scenario-id]` | Regenerates the Maestro save fixtures in `src/campaign/fixtures/`. |

Scripts log to stderr. Use `--verbose`, `--quiet` or `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`) to change how much they print.

## Contributing

1. Fork the repo and branch from `main`.
2. Before you push, run `pnpm data:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test`. CI (`.github/workflows/test.yml`) runs the same checks on every push and pull request. While you work, `pnpm test:changed` or `pnpm test:scenario <id>` give quicker feedback.
3. Open a pull request that says what changed and why.

Conventions:

- Code follows [.cursor/rules/code-standards.mdc](.cursor/rules/code-standards.mdc). Docs follow [.cursor/rules/docs-standards.mdc](.cursor/rules/docs-standards.mdc): they describe the current state, and history stays in git.
- Rules come from the printed sources, not memory. Cite the rule id from `data/rules/entries.json` in the code that implements it. A rule change also updates [docs/brief.md](docs/brief.md).
- Don't edit `data/` by hand except for the hand-checked inputs (`data/printed/`, `data/rules/index.json`, `data/rules/columns.json`, `data/overrides.json`, `data/prebuilt-decks.json`, `data/starter-decks.json`). Change the build in `scripts/data/` and run `pnpm data:build`.
- After adding or changing effect records, run `pnpm effects:open`. After changing doc headings or doc citations in code, run `pnpm docs:index`. Tests fail when either output is stale.
- Use `pnpm move` to move files.
- Never commit `assets/catalog.db`, card scans, card pictures, PDFs or a filled `src/screens/images/scan-map.ts`.
- Out of scope: playtest and fan-made (ALeP) cards, accounts or a backend, online multiplayer, and support for other card games. [docs/brief.md](docs/brief.md) has the full list of non-goals.

Adding a scenario follows the procedure in [docs/handover/agent-brief.md](docs/handover/agent-brief.md), and authoring effect records follows [docs/plans/effect-authoring.md](docs/plans/effect-authoring.md). The repo also contains agent definitions for Claude Code and Cursor (`.claude/`, `.cursor/`, [CLAUDE.md](CLAUDE.md)); you don't need them to contribute.

## Documentation

- [docs/brief.md](docs/brief.md): product decisions, the rules the engine implements and the data rules.
- [docs/architecture.md](docs/architecture.md): code layout, state, the engine and tests.
- [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md): the look of the screens and the game table.
- [docs/phases/STATUS.md](docs/phases/STATUS.md): progress and open work.
- [docs/INDEX.md](docs/INDEX.md): a generated index of every doc, by section.

## Attribution

The Lord of the Rings: The Card Game and its card text, card art and rules are © Fantasy Flight Games. The Lord of the Rings and its characters and places are trademarks of Middle-earth Enterprises. The repo commits card text, rules text, raw source snapshots (`data/raw/`) and the game icons (`assets/icons/`). Card scans, card pictures and PDFs are fetched at build time and never committed. Every source below is pinned by URL and sha256 in `data/sources.json`.

| Resource | Source |
| --- | --- |
| Rules, rulebooks, FAQ, Easy Mode, campaign log, community decklists | [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) PDFs |
| Campaign, boon and burden card pictures | FFG's print-and-play PDFs |
| Card data (player cards, packs, decks) | [RingsDB](https://ringsdb.com) |
| Card data (encounter and quest cards, scenarios), card scans | [Hall of Beorn](https://hallofbeorn.com) |
| Card database, scenario lists, pre-built decks, game steps | [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan |
| Card pictures | JvZijp's enhanced proxies ([Google Drive](https://drive.google.com/drive/folders/1jEy_yvRaPXGylPfilxhweQjffo9AZQsQ)), then u/LepcisMagna's 600 DPI scans hosted on [lotr.cardgame.tools](https://lotr.cardgame.tools), then RingsDB, Hall of Beorn and DragnCards |
| Nightmare deck pictures and card lists | A community [Google Drive folder](https://drive.google.com/drive/folders/10pz9RF2e1QrJXqsmmLWPkO1Hu1auQuxB) |
| Game icons | RingsDB's icon font, DragnCards' token and card-back images, and the icon font embedded in FFG's Dream-chaser rulebook (MEC111) |
| Fonts | [Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow+Semi+Condensed) and [Marcellus SC](https://fonts.google.com/specimen/Marcellus+SC), SIL Open Font License (`assets/fonts/`) |

Picture sources are tried in the order listed in `scripts/data/sources/pictures.ts`.

## License

The code and documentation are under the [MIT License](LICENSE). Game content (card text, art, rules text and icons), the source data in `data/raw/`, the fonts and the Expo template images keep their owners' terms; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists each one and where it sits in the repo.
