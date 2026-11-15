# Middle Earth Player

[![Accessibility: WCAG 2.2 AA](https://img.shields.io/badge/accessibility-WCAG%202.2%20AA-3E5A48)](ACCESSIBILITY.md)
[![Screen readers: VoiceOver and TalkBack](https://img.shields.io/badge/screen%20readers-VoiceOver%20%7C%20TalkBack-3E5A48)](ACCESSIBILITY.md#what-the-app-supports)
[![Switch and voice control: Table as a list](https://img.shields.io/badge/switch%20%26%20voice%20control-Table%20as%20a%20list-3E5A48)](ACCESSIBILITY.md#what-the-app-supports)

An offline app for playing The Lord of the Rings: The Card Game solo, on iOS and Android. Built with Expo and React Native; it also runs in a desktop browser for development.

> [!IMPORTANT]
> This is a fan-made, community-supported project. It is not an official app or client for The Lord of the Rings: The Card Game. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games (FFG), Asmodee or Middle-earth Enterprises in any way. All game content belongs to its owners.

## Contents

- [Privacy and security](#privacy-and-security)
- [How the code is written](#how-the-code-is-written)
- [Features](#features)
- [Roadmap](#roadmap)
- [Accessibility](#accessibility)
- [Architecture](#architecture)
- [Install](#install): [What you need](#what-you-need), [Android](#android), [iPhone and iPad](#iphone-and-ipad), [Check a download](#check-a-download-optional), [If something goes wrong](#if-something-goes-wrong), [Privacy](#privacy)
- [Local setup](#local-setup): [Requirements](#requirements), [In a browser](#in-a-browser), [On a phone](#on-a-phone), [Maestro](#maestro)
- [Commands](#commands)
- [Contributing](#contributing)
- [Support](#support)
- [Documentation](#documentation)
- [Attribution](#attribution)
- [License](#license)

## Privacy and security

The app has no accounts, tracking, ads, analytics or crash reporting. Cards, rules, booklets and card pictures are bundled, so it plays offline. It goes online only to import a RingsDB deck. Saves stay in the app's private storage and are deleted with the app. Android permissions: `INTERNET` and `VIBRATE`. iOS: none.

Details: [PRIVACY.md](PRIVACY.md). Code behind each point, the supply chain and vulnerability reports: [SECURITY.md](SECURITY.md).

## How the code is written

Most code, tests and docs are written by Claude (Anthropic) in Claude Code, directed by the maintainer, who sets the product and the rules and decides what lands on `main`. Those commits name Claude as author or in `Co-Authored-By`. The agent instructions are `CLAUDE.md`, `.claude/rules/` and `.claude/agents/`.

CI must pass tests, lint, type check and data check before anything lands. Engine code cites the rule id it implements (`data/rules/entries.json`).

## Features

- Official campaigns, from the revised, repackaged products (RCO), in release order with the saga boxes together: Mirkwood Paths (Revised Core Set and The Dark of Mirkwood), The Dark of Mirkwood, The Fellowship of the Ring (The Fellowship of the Ring Saga Expansion, MEC109), The Two Towers (The Two Towers Saga Expansion, MEC112), Dream-chaser (Dream-chaser Campaign Expansion) and Ered Mithrin (Ered Mithrin Campaign Expansion). Each scenario also plays standalone; some have Nightmare mode.
- The engine applies all rules and card effects and computes every number. You pick from the legal moves it lists.
- True solo (one seat) or two-handed (two seats, one device). No online multiplayer.
- Deck builder with the full player-card pool and the pre-built decks; campaign log, run history and rules reference.

Playable scenarios: `src/campaign/playable.ts`. Open work: [docs/phases/STATUS.md](docs/phases/STATUS.md).

## Roadmap

Every official campaign and scenario, then the fan-made content from [A Long-extended Party](https://alongextendedparty.com) (ALeP).

Next:

- The Two Towers campaign (The Two Towers Saga Expansion): Shelob's Lair.
- The Return of the King campaign (The Return of the King Saga Expansion): The Passing of the Grey Company, The Siege of Gondor, The Battle of the Pelennor Fields, The Tower of Cirith Ungol, The Black Gate Opens, Mount Doom.

Then the other official campaign, and the cycles: the groupings of scenarios that are part of no campaign, which play standalone only. Each waits under Coming later until one of its scenarios is playable (`data/overrides.json`, campaigns). In release order (the US release of the product that starts each), as the app lists them:

- The Shadows of Mirkwood cycle: The Hunt for Gollum, Conflict at the Carrock, A Journey to Rhosgobel, The Hills of Emyn Muil, The Dead Marshes, Return to Mirkwood.
- The Standalone scenarios cycle: The Massing at Osgiliath, The Battle of Lake-town, The Stone of Erech, The Old Forest, Fog on the Barrow-downs, The Ruins of Belegost, Murder at the Prancing Pony, The Siege of Annúminas, Attack on Dol Guldur, The Wizard's Quest, The Woodland Realm, The Mines of Moria, Escape from Khazad-dûm, The Hunt for the Dreadnaught.
- The Dwarrowdelf cycle: Into the Pit, The Seventh Level, Flight from Moria, The Redhorn Gate, Road to Rivendell, The Watcher in the Water, The Long Dark, Foundations of Stone, Shadow and Flame.
- The Hobbit cycle (the two Hobbit saga boxes): "We Must Away, Ere Break of Day", Over the Misty Mountains Grim, Dungeons Deep and Caverns Dim, Flies and Spiders, The Lonely Mountain, The Battle of Five Armies.
- The Against the Shadow cycle: Peril in Pelargir, Into Ithilien, The Siege of Cair Andros, The Steward's Fear, The Drúadan Forest, Encounter at Amon Dîn, Assault on Osgiliath, The Blood of Gondor, The Morgul Vale.
- The Ring-maker cycle: The Fords of Isen, To Catch an Orc, Into Fangorn, The Dunland Trap, The Three Trials, Trouble in Tharbad, The Nîn-in-Eilph, Celebrimbor's Secret, The Antlered Crown.
- The Haradrim cycle: Escape from Umbar, Desert Crossing, The Long Arm of Mordor, The Mûmakil, Race Across Harad, Beneath the Sands, The Black Serpent, The Dungeons of Cirith Gurat, The Crossings of Poros.
- The Vengeance of Mordor cycle: The River Running, Danger in Dorwinion, The Temple of Doom, Wrath and Ruin, The City of Ulfast, Challenge of the Wainriders, Under the Ash Mountains, The Land of Sorrow, The Fortress of Nurn.
- The Angmar Awakened campaign (Angmar Awakened Campaign Expansion): Intruders in Chetwood, The Weather Hills, Deadmen's Dike, The Wastes of Eriador, Escape from Mount Gram, Across the Ettenmoors, The Treachery of Rhudaur, The Battle of Carn Dûm, The Dread Realm.

Then ALeP.

## Accessibility

VoiceOver and TalkBack can play a full game; the table becomes a list of zones and cards. Settings cover the list table without a reader, text size, contrast, motion, banner and confirm timing, and a plain title face. Target: WCAG 2.2 AA and the Game Accessibility Guidelines, not audited. Details and known gaps: [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Architecture

- `data/`: card, scenario and rules data, committed, built offline from snapshots in `data/raw/`. Sources are pinned in `data/sources.json`.
- `data/printed/`: the lines printed on each card, read from its scan. This is the card text the build uses.
- Effect records implement each printed line: generated in `src/effects/generated/`, hand-written in `src/effects/authored/`. A scenario is playable once every line it deals has a record. Uncovered lines: `src/effects/open-lines.ts`.
- `src/rules/`: the rules engine, a pure reducer split by mechanic family.
- Source precedence: [.claude/rules/authority.md](./.claude/rules/authority.md).

Stack: Expo SDK 58, Expo Router, Skia, Reanimated, NativeWind, SQLite with Drizzle, Zustand, Zod. Details: [docs/architecture.md](docs/architecture.md).

## Install

Not on the Play Store or App Store. Android installs the APK from the [Releases page](https://github.com/j-jmnz/middle-earth-player/releases); iPhone and iPad install the IPA with SideStore or AltStore, signed with your own Apple ID. Free, and no network needed once installed.

### What you need

- Android 7.0 or later, 64-bit.
- iOS or iPadOS 15.1 or later, a free Apple ID, and SideStore or AltStore Classic. Setup needs a computer once; AltStore also needs AltServer running to refresh the app weekly.
- Wi-Fi and free space of at least twice the download size.

### Android

1. Open the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest) on your phone and, under Assets, tap `middle-earth-player-v<version>.apk`. Ignore the `.sha256` file.
2. Open the download from the browser or your Files app.
3. If asked, allow that app to install unknown apps (Settings, Allow from this source), then go back.
4. Tap Install. If Play Protect warns, tap More details, then Install anyway.
5. Open Middle Earth Player.

To update, install the newer `.apk` the same way; saves are kept. Don't uninstall first: that deletes your saves.

### iPhone and iPad

1. Set up [SideStore](https://sidestore.io) (refreshes on the phone) or [AltStore Classic](https://altstore.io) (refreshes through AltServer on a computer on the same Wi-Fi). Not AltStore PAL, which installs only from its own marketplace.
2. On iOS 16 and later, turn on Developer Mode (Settings, Privacy & Security) and restart.
3. In SideStore or AltStore, open Sources, tap +, and add `https://github.com/j-jmnz/middle-earth-player/releases/latest/download/source.json`.
4. Open the Middle Earth Player source and tap Free or Get.

Or download the `.ipa` from the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest) in Safari and add it under My Apps, +.

A free Apple ID signature lasts 7 days. SideStore and AltStore refresh it in the background, or tap Refresh All in My Apps. A free Apple ID allows 3 sideloaded apps, SideStore or AltStore included. Updates appear in the source and keep your saves. Deleting the app deletes them.

If a release's notes give a TestFlight link, you can use that instead: install [TestFlight](https://apps.apple.com/app/testflight/id899247664), open the link, tap Accept, then Install. TestFlight builds need no refresh but expire 90 days after publishing.

### Check a download (optional)

The release notes give the APK's SHA-256 and its signing certificate fingerprint. Compare with `sha256sum` (Linux), `shasum -a 256` (macOS) or `certutil -hashfile <file> SHA256` (Windows).

### If something goes wrong

- "App not installed" on Android: the phone is 32-bit or below Android 7.0, space is short, or a self-built copy is installed. Uninstall that copy first (its saves go with it).
- Download stops or won't open: download again over Wi-Fi.
- App won't open on iOS after a few days: the signature expired. Refresh it in SideStore or AltStore (AltServer running, same Wi-Fi).
- App limit reached: remove a sideloaded app you don't use.
- TestFlight beta full: use SideStore or AltStore.
- Anything else: [open an issue](https://github.com/j-jmnz/middle-earth-player/issues) with your device, OS version and the app version from Settings.

### Privacy

No personal data collected; saves stay on your device. See [PRIVACY.md](PRIVACY.md), also linked from Settings, About.

## Local setup

### Requirements

- Node 22.18 or later (runs the `.ts` scripts without a build step)
- pnpm 10.34.1 (`corepack enable` installs the version pinned in `package.json`)
- Optional: `poppler` (`pdftoppm`) to render campaign, boon and burden cards from FFG's PDFs. Without it those cards use their scans and the build warns.

```bash
git clone https://github.com/j-jmnz/middle-earth-player.git
cd middle-earth-player
pnpm install
pnpm test
```

Tests need no network and no prebuilt database. "Ignored build scripts: sharp" is harmless.

### In a browser

```bash
pnpm web
```

Builds the catalog and opens the app through Metro; narrow the window to phone width. Good for screen work (campaigns, briefing, log, deck builder). No card pictures or booklet reader; SQLite uses browser storage.

A Codespaces devcontainer (`.devcontainer/devcontainer.json`) installs dependencies and builds the catalog. Run `pnpm web` and open port 8081.

### On a phone

iOS needs macOS and Xcode. Android needs Android Studio, SDK Platform 36 and `ANDROID_HOME`. App id `com.middleearth.player`; uses `expo-dev-client`, so not Expo Go.

```bash
pnpm assets
```

`pnpm assets` runs `assets catalog`, `assets booklets` and `assets scans`. The first `assets scans` downloads every pinned card picture into `.cache/` (about 5 GB), checks each sha256, and writes 1200 px copies to `assets/scans/`. Later runs pack only changed pictures. `pnpm start`, `pnpm android` and `pnpm ios` run it first. Don't commit the rewritten `src/screens/images/scan-map.ts`.

Release build (offline, all data bundled):

```bash
pnpm ios --device --configuration Release
pnpm android --device --variant release
```

Drop `--configuration Release` / `--variant release` for a development build, which loads JavaScript and pictures from Metro. If the phone can't reach Metro (VPN, isolated Wi-Fi), use `pnpm android:usb --device`. Keep about 10 GB free. `ios/` and `android/` are generated and gitignored.

A free Apple ID build stops opening after 7 days; rerun the command to reinstall (saves are kept). `eas.json` has the EAS cloud build profiles.

### Maestro

Flows are in `.maestro/scenarios/<scenario-id>/` and `.maestro/features/`. Run `maestro test .maestro` against an installed build. Flows that open a save fixture need `EXPO_PUBLIC_E2E_SEED` set (the `e2e-test` profile in `eas.json`). The screen-reader flow (`.maestro/features/screen-reader.yaml`, tag `reader`) needs a development build with `EXPO_PUBLIC_E2E_SEED=1 EXPO_PUBLIC_FORCE_READER=1`; run `maestro test --include-tags=reader .maestro`. `.eas/workflows/e2e.yml` runs the flows on EAS. It is started by hand only (`eas workflow:run .eas/workflows/e2e.yml`), by someone signed in to the Expo account that owns the project; no push or pull request runs it.

## Commands

Scripts are grouped: `pnpm <group> <command> [args]`, and `pnpm <group>` alone lists its commands (`scripts/cli.ts`), except `pnpm test` and `pnpm assets`, which run everything. The groups are `test`, `data`, `effects`, `scenario`, `assets`, `docs` and `release`; `lint`, `typecheck`, `move` and `commit:check` stand alone. A first argument to `pnpm test` that is not one of its commands goes to Vitest as a filter.

| Command | Does |
| --- | --- |
| `pnpm test` | All Vitest tests. |
| `pnpm test fast` | All but the slow files (`slowFiles` in `vitest.config.mts`). |
| `pnpm test changed` | Tests that import a file changed since the last commit. |
| `pnpm test scenario <scenario-id>` | One scenario's tests held to their time budget, its goldens, effect coverage, file-size, test-cost, rule-id and wording checks, the card smoke on its player cards and the encounter smoke; also the family and manifest tests if pool, family or manifest files changed since the merge base with `origin/main`. `--list` prints the selection; `--quick` skips the goldens and the reader check. |
| `pnpm test smoke <codes>` | Plays a seeded game with those cards; reports errors and stalls. `--all` for every card. |
| `pnpm test encounter <scenario-id>...` | Plays every encounter-side card of a scenario (reveal, Shadow, travel, quest Setup) and seeded games with random legal intents; reports errors, stalls and replay differences. `--all` for every playable scenario. |
| `pnpm test a11y` | Audits the main web screens with axe-core in Chromium; fails on serious or critical findings. Needs `pnpm exec playwright install chromium` once, or `A11Y_CHROMIUM=<path>`. |
| `pnpm lint` | Oxlint (`.oxlintrc.json`). |
| `pnpm typecheck` | tsrs type check. |
| `pnpm data sync [ringsdb\|hallofbeorn\|dragncards\|rules\|scans\|pictures\|icons]` | Refreshes `data/raw/` and `.cache/`. The only networked command. `scans` and `pictures` run only when named, after `data build`. |
| `pnpm data build` | Builds `data/`, `src/effects/generated/` and the game icons from `data/raw/`. Offline, deterministic. |
| `pnpm data check` | Rebuilds into a temp directory; fails on any difference. |
| `pnpm data query "<sql>"` | Queries `cards`, `scenario_cards` and `rules` in memory. |
| `pnpm effects draft <scenario \| deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` per card with an uncovered printed line. |
| `pnpm effects open` | Regenerates `src/effects/open-lines.ts`. |
| `pnpm scenario new <scenario-id>` | Writes and registers a new scenario's skeleton files. `--dry-run` first. |
| `pnpm scenario pack <scenario-id>` | Writes `.agent/pack/<id>.md`, the scenario author's context: vocabulary, schema entries, cookbook sections and drafts. |
| `pnpm scenario fixtures [scenario-id]` | Regenerates the Maestro save fixtures in `src/campaign/fixtures/`. |
| `pnpm assets` | `catalog`, `booklets` and `scans` in order; `start`, `android`, `ios` and the native release builds run it (`start` with `--optional`). |
| `pnpm assets catalog` | Writes `assets/catalog.db` (never committed) and `src/catalog/version.ts` (committed). |
| `pnpm assets scans` / `pnpm assets booklets` | Packs card pictures / booklet PDFs into `assets/`. |
| `pnpm assets capture --build` | Takes the README's screenshots on the iOS simulators (macOS, Xcode and Maestro; [docs/showcase.md](docs/showcase.md)). |
| `pnpm assets showcase [--publish]` | Turns the captures into the README's images and a contact sheet; `--publish` replaces the `showcase` branch with them. |
| `pnpm doc index` / `pnpm doc section <file> "<heading>"` | Regenerates `docs/INDEX.md` / prints one doc section. |
| `pnpm release plan --dry-run` | Prints the next tag and its notes (`git fetch --tags` first). Changes nothing. |
| `pnpm release source --tag <tag> --ipa <file> --notes <file> --out <file>` | Writes a release's SideStore and AltStore source; run by the release workflow. |
| `pnpm commit:check "<subject>"` | Checks commit subjects against `.claude/rules/commit-standards.md`; `--range <base>..<head>` for a range. Installed as the `commit-msg` hook. |
| `pnpm move <old> <new>` | Moves files and rewrites every reference. `--dry-run` first. |

Scripts log to stderr. `--verbose`, `--quiet`, or `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately ([SECURITY.md](SECURITY.md)). A change that adds a network request, permission or data-sending SDK updates [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) in the same pull request.

## Support

If you enjoy the app, you can support its development through [GitHub Sponsors](https://github.com/sponsors/j-jmnz) or [Ko-fi](https://ko-fi.com/jjmnz). Donations pay for development time and build costs, never for game content. Nothing is paywalled and supporters get no rewards: every build is the same, free for everyone. The app itself never asks for money.

## Documentation

- [docs/brief.md](docs/brief.md): product decisions and implemented rules.
- [docs/architecture.md](docs/architecture.md): code layout, state, engine, tests.
- [docs/design-system.md](docs/design-system.md), [docs/design-system-table.md](docs/design-system-table.md): screens and game table.
- [docs/showcase.md](docs/showcase.md): the README's screenshots, and how to take them again on a Mac.
- [docs/releasing.md](docs/releasing.md): the release pipeline; rules in [.claude/rules/release-standards.md](./.claude/rules/release-standards.md).
- [docs/phases/STATUS.md](docs/phases/STATUS.md): open work.
- [ACCESSIBILITY.md](ACCESSIBILITY.md): support, gaps, reporting a barrier.
- [docs/INDEX.md](docs/INDEX.md): generated index of every doc by section.

## Attribution

The Lord of the Rings: The Card Game and all of its content are © Fantasy Flight Games. The Lord of the Rings and its characters and places are trademarks of Middle-earth Enterprises. Card text, rules text, source snapshots (`data/raw/`) and game icons (`assets/icons/`) are committed. Card images and PDFs are fetched at build time, never committed. All sources are pinned by URL and sha256 in `data/sources.json`.

| Resource | Source |
| --- | --- |
| Rules, rulebooks, FAQ, Easy Mode, campaign log, community decklists | [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) PDFs |
| Campaign, boon and burden card pictures | FFG's print-and-play PDFs |
| Player cards and packs | [RingsDB](https://ringsdb.com) |
| Card data (encounter and quest cards, scenarios), card scans | [Hall of Beorn](https://hallofbeorn.com) |
| Card database, scenario lists, pre-built decks, game steps | [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan |
| Card pictures | JvZijp's enhanced proxies ([Google Drive](https://drive.google.com/drive/folders/1jEy_yvRaPXGylPfilxhweQjffo9AZQsQ)), then u/LepcisMagna's 600 DPI scans on [lotr.cardgame.tools](https://lotr.cardgame.tools), then the card data sites above |
| Nightmare deck pictures and card lists | A community [Google Drive folder](https://drive.google.com/drive/folders/10pz9RF2e1QrJXqsmmLWPkO1Hu1auQuxB) |
| Game icons | RingsDB's icon font and DragnCards' token and card-back images; Dream-chaser symbols from the font in FFG's MEC111 rulebook |
| Fonts | [Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow+Semi+Condensed) and [Marcellus SC](https://fonts.google.com/specimen/Marcellus+SC), SIL Open Font License (`assets/fonts/`) |

Picture source order: `scripts/data/sources/pictures.ts`.

## License

Code and documentation: [MIT License](LICENSE). Game content, `data/raw/` and the fonts keep their owners' terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
