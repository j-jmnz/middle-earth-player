# Middle Earth LCG

An offline, single-device app for playing The Lord of the Rings: The Card Game solo. It runs on iOS and Android, built with Expo and React Native, and it also runs in a desktop browser for development.

> [!IMPORTANT]
> This is a fan-made, community-supported project. It is not an official app or client for The Lord of the Rings: The Card Game. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games (FFG), Asmodee or Middle-earth Enterprises in any way. All game content belongs to its owners.

## Privacy and security

> [!NOTE]
> **No accounts, no tracking, no ads, no analytics, no crash reporting.** The app collects no personal data, and your games stay on your device.

- **Plays offline.** The catalog, the rules and the card pictures are inside the app. You can play a whole campaign in airplane mode.
- **Two kinds of network request.** Importing a deck from a RingsDB link fetches that deck from `ringsdb.com`. A card whose picture the build did not bundle is downloaded once from RingsDB or the Hall of Beorn and DragnCards image storage. Nothing else connects, and only over HTTPS to those fixed hosts.
- **Two Android permissions:** `INTERNET` and `VIBRATE` (haptics). None on iOS. No camera, microphone, location, contacts or photos.
- **Your data stays local.** Saves, decks, the campaign log and settings live in the app's private storage. Uninstalling the app removes them.
- **Supply chain.** Locked dependencies, CI with a read-only token, actions pinned by commit, weekly Dependabot updates.

[PRIVACY.md](PRIVACY.md) lists exactly what is stored and sent. [SECURITY.md](SECURITY.md) names the code behind each request and explains how to report a vulnerability privately.

## How the code is written

Most of the code, tests and docs are written by Claude, Anthropic's AI model, working in Claude Code under the maintainer's direction. The git history shows it: those commits name Claude as their author or in a `Co-Authored-By` line. The maintainer sets the product and the rules, and decides what lands on `main`. The instructions the agents follow are public: `CLAUDE.md`, `.claude/rules/` and `.claude/agents/`.

Nothing lands unless the tests, lint, type check and data check pass in CI. The rules engine cites the rule id it implements from the official rulebooks (`data/rules/entries.json`), so every rule can be traced to its source.

## Features

- Plays the official campaigns: The Fellowship of the Ring saga (MEC109), Mirkwood Paths, The Dark of Mirkwood, Dream-chaser and Ered Mithrin. Each scenario can also be played on its own, and some have Nightmare mode.
- The engine applies the rules, keywords, phases and card effects, and works out every number. The player picks from the moves the engine lists as legal. You never type in damage, resources, threat or progress yourself.
- Supports true solo (one seat) or two-handed solo (two seats on one device). There are no accounts and no online multiplayer.
- Includes a deck builder with the full official player-card pool, the pre-built decks, a campaign log, run history and a rules reference.

`src/campaign/playable.ts` lists the scenarios you can play now. [docs/phases/STATUS.md](docs/phases/STATUS.md) lists the work still open.

## Roadmap

The goal is every official campaign and scenario, followed by the fan-made scenarios and cards from [A Long-extended Party](https://alongextendedparty.com) (ALeP).

Coming soon:

- **The Two Towers** saga: The Uruk-hai, Helm's Deep, The Road to Isengard, The Passage of the Marshes, Journey to the Cross-roads, Shelob's Lair.
- **The Return of the King** saga: The Passing of the Grey Company, The Siege of Gondor, The Battle of the Pelennor Fields, The Tower of Cirith Ungol, The Black Gate Opens, Mount Doom.

After those come the remaining official cycles, saga boxes and standalone scenarios, then ALeP.

## Accessibility

- **Screen readers.** VoiceOver and TalkBack can play a full game. When a reader is on, the game table is replaced by a scrolling list of zones and cards. Each card's label gives its whole state (damage, resources, progress, attachments, effect modifiers), and its hint says what a double tap does. Each long press is also offered as a reader action. Each new moment and each refused move is announced in order through one queue, so one line never cuts off another. This mode is only on the phone; the web build has none.
- **Touch targets.** Every control has a 44 pt target at every text size.
- **Display.** Settings offer a dark and a light theme, three interface sizes (the table included), and a "Strong outlines" option that thickens effect marks and token counts.
- **Motion.** Reduce motion follows the phone's setting or can be forced on. It snaps animations and stops the fog and the combat replay. Animation speed and the combat replay can also be set on their own, and haptics can be turned off.

`scripts/checks/a11y.test.ts` fails on a control with no role or name, a long press with no matching action, an unlabelled text field, or an image that is neither labelled nor hidden. The rules are in [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md), Screen reader.

## Architecture

- `data/` holds the card, scenario and rules data. It is committed and built offline from source snapshots in `data/raw/`. Every source (RingsDB, Hall of Beorn, the DragnCards plugin data, FFG's rules PDFs, card scans) is listed and pinned in `data/sources.json`.
- Card text comes from `data/printed/`, a ledger of the lines printed on each card, read from its scan.
- Each printed line is implemented by an effect record: generated ones live in `src/effects/generated/` and hand-written ones in `src/effects/authored/`. A scenario becomes playable once every line of every card it deals has a record. Lines that no record covers yet are listed in `src/effects/open-lines.ts`.
- The rules engine (`src/rules/`) is a pure reducer that runs in Node. It is split by mechanic family. Code and tests cite the rule ids they implement (`data/rules/entries.json`).
- When sources disagree, the order of precedence is set in [.claude/rules/authority.md](./.claude/rules/authority.md).

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

On its first run, `scans:pack` downloads every pinned card picture into `.cache/` (about 5 GB) and checks each one's sha256. It then writes a copy of each picture, scaled to 1200 px, into `assets/scans/`. Later runs pack only pictures that have changed. Every start and build script runs both steps on its own. `scans:pack` rewrites `src/screens/images/scan-map.ts`; don't commit that change.

Release build, which carries all its data and works offline:

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
| `pnpm commit:check "<subject>"` | Checks commit subjects against `.claude/rules/commit-standards.md`. `--range <base>..<head>` checks a range of commits. `pnpm install` installs it as the `commit-msg` hook (`.githooks/`). |
| `pnpm move <old> <new>` | Moves files and rewrites every import and path that refers to them. `--dry-run` first. |
| `pnpm docs:index` / `pnpm docs:section <file> "<heading>"` | Regenerates `docs/INDEX.md` / prints one doc section. |
| `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` | Plays a seeded game with the given player cards and reports any engine error or stall. `--all` runs every card. |
| `node --experimental-strip-types scripts/e2e/fixtures.ts [scenario-id]` | Regenerates the Maestro save fixtures in `src/campaign/fixtures/`. |

Scripts log to stderr. `--verbose` and `--quiet` change how much they print; `LOG_LEVEL` sets the level directly (`debug`, `info`, `warn`, `error`, `silent`).

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the checks to run, the conventions and what is out of scope, and everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report a security problem privately, as [SECURITY.md](SECURITY.md) says. A change that adds a network request, a permission or an SDK that sends data updates [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) in the same pull request.

## Documentation

- [docs/brief.md](docs/brief.md): product decisions and the rules the engine implements.
- [docs/architecture.md](docs/architecture.md): code layout, state, the engine and tests.
- [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md): the look of the screens and the game table.
- [docs/phases/STATUS.md](docs/phases/STATUS.md): progress and open work.
- [docs/INDEX.md](docs/INDEX.md): a generated index of every doc, by section.

## Attribution

The Lord of the Rings: The Card Game and all of its content are © Fantasy Flight Games. The Lord of the Rings and its characters and places are trademarks of Middle-earth Enterprises. The repo commits card text, rules text, raw source snapshots (`data/raw/`) and the game icons (`assets/icons/`). Card images and PDFs are fetched at build time and never committed. Every source below is pinned by URL and sha256 in `data/sources.json`.

| Resource | Source |
| --- | --- |
| Rules, rulebooks, FAQ, Easy Mode, campaign log, community decklists | [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) PDFs |
| Campaign, boon and burden card pictures | FFG's print-and-play PDFs |
| Player cards and packs | [RingsDB](https://ringsdb.com) |
| Card data (encounter and quest cards, scenarios), card scans | [Hall of Beorn](https://hallofbeorn.com) |
| Card database, scenario lists, pre-built decks, game steps | [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan |
| Card pictures | JvZijp's enhanced proxies ([Google Drive](https://drive.google.com/drive/folders/1jEy_yvRaPXGylPfilxhweQjffo9AZQsQ)), then u/LepcisMagna's 600 DPI scans hosted on [lotr.cardgame.tools](https://lotr.cardgame.tools), then the card data sites above |
| Nightmare deck pictures and card lists | A community [Google Drive folder](https://drive.google.com/drive/folders/10pz9RF2e1QrJXqsmmLWPkO1Hu1auQuxB) |
| Game icons | RingsDB's icon font and DragnCards' token and card-back images; the Dream-chaser symbols come from the font embedded in FFG's MEC111 rulebook |
| Fonts | [Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow+Semi+Condensed) and [Marcellus SC](https://fonts.google.com/specimen/Marcellus+SC), SIL Open Font License (`assets/fonts/`) |

Picture sources are tried in the order listed in `scripts/data/sources/pictures.ts`.

## License

The code and documentation are under the [MIT License](LICENSE). Game content (card text, art, rules text and icons), the source data in `data/raw/`, the fonts and the Expo template images keep their owners' terms; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists each one and where it sits in the repo.
