# Middle Earth Player

[![Accessibility: WCAG 2.2 AA](https://img.shields.io/badge/accessibility-WCAG%202.2%20AA-3E5A48)](ACCESSIBILITY.md)
[![Screen readers: VoiceOver and TalkBack](https://img.shields.io/badge/screen%20readers-VoiceOver%20%7C%20TalkBack-3E5A48)](ACCESSIBILITY.md#what-the-app-supports)
[![Switch and voice control: Table as a list](https://img.shields.io/badge/switch%20%26%20voice%20control-Table%20as%20a%20list-3E5A48)](ACCESSIBILITY.md#what-the-app-supports)

Middle Earth Player lets you play The Lord of the Rings: The Card Game solo on an iPhone, iPad or Android phone, with no connection needed. It is built with Expo and React Native, and it also runs in a desktop browser, which is handy during development.

> [!IMPORTANT]
> This is a fan-made, community-supported project. It is not an official app or client for The Lord of the Rings: The Card Game. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games (FFG), Asmodee or Middle-earth Enterprises in any way. All game content belongs to its owners.

SHOWCASE


https://github.com/user-attachments/assets/6e01b9a1-ac99-44ea-ae78-fe406d3f8d35



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
- [Documentation](#documentation)
- [Attribution](#attribution)
- [License](#license)

## Privacy and security

There are no accounts, and the app does no tracking, shows no ads, and sends no analytics or crash reports. Cards, rules, booklets and card pictures all ship inside the app, so you can play anywhere. The only time it goes online is when you import a deck from RingsDB. Your saves live in the app's private storage and disappear when you delete the app. On Android the app asks for two permissions, `INTERNET` and `VIBRATE`; on iOS it asks for none.

[PRIVACY.md](PRIVACY.md) has the details. [SECURITY.md](SECURITY.md) points to the code behind each of these promises, describes the supply chain, and explains how to report a vulnerability.

## How the code is written

Claude (Anthropic) writes most of the code, tests and docs in Claude Code. The maintainer directs that work: they set the product and its rules and decide what lands on `main`. Commits written this way name Claude as the author or in a `Co-Authored-By` line. The instructions the agents follow are in `CLAUDE.md`, `.claude/rules/` and `.claude/agents/`.

Nothing lands until CI passes the tests, lint, the type check and the data check. Engine code cites the id of the rule it implements, from `data/rules/entries.json`.

## Features

- You can play the official campaigns from the revised, repackaged products (RCO). They are listed in release order, with each saga box's scenarios kept together: Mirkwood Paths (Revised Core Set and The Dark of Mirkwood), The Dark of Mirkwood, The Fellowship of the Ring (The Fellowship of the Ring Saga Expansion, MEC109), The Two Towers (The Two Towers Saga Expansion, MEC112), Dream-chaser (Dream-chaser Campaign Expansion) and Ered Mithrin (Ered Mithrin Campaign Expansion). Every scenario can also be played on its own, and some have a Nightmare mode.
- The engine applies every rule and card effect and works out every number for you. You choose from the legal moves it offers.
- You can play true solo with one seat, or two-handed with two seats on one device. There is no online multiplayer.
- A deck builder gives you the full player-card pool and the pre-built decks. The app also keeps a campaign log and your run history, and has a rules reference built in.

`src/campaign/playable.ts` lists the scenarios you can play today, and [docs/phases/STATUS.md](docs/phases/STATUS.md) tracks the work still open.

## Roadmap

The goal is every official campaign and scenario, followed by the fan-made content from [A Long-extended Party](https://alongextendedparty.com) (ALeP).

Coming next:

- The Two Towers campaign (The Two Towers Saga Expansion): Shelob's Lair.
- The Return of the King campaign (The Return of the King Saga Expansion): The Passing of the Grey Company, The Siege of Gondor, The Battle of the Pelennor Fields, The Tower of Cirith Ungol, The Black Gate Opens, Mount Doom.

After that come the remaining official campaign and the cycles. A cycle is a group of scenarios that belongs to no campaign, so its scenarios are played standalone only. Each one stays under Coming later in the app until at least one of its scenarios is playable (`data/overrides.json`, campaigns). They are listed here in release order, going by the US release of the product that starts each one, which is also how the app lists them:

- The Shadows of Mirkwood cycle: The Hunt for Gollum, Conflict at the Carrock, A Journey to Rhosgobel, The Hills of Emyn Muil, The Dead Marshes, Return to Mirkwood.
- The Standalone scenarios cycle: The Massing at Osgiliath, The Battle of Lake-town, The Stone of Erech, The Old Forest, Fog on the Barrow-downs, The Ruins of Belegost, Murder at the Prancing Pony, The Siege of Annúminas, Attack on Dol Guldur, The Wizard's Quest, The Woodland Realm, The Mines of Moria, Escape from Khazad-dûm, The Hunt for the Dreadnaught.
- The Dwarrowdelf cycle: Into the Pit, The Seventh Level, Flight from Moria, The Redhorn Gate, Road to Rivendell, The Watcher in the Water, The Long Dark, Foundations of Stone, Shadow and Flame.
- The Hobbit cycle (the two Hobbit saga boxes): "We Must Away, Ere Break of Day", Over the Misty Mountains Grim, Dungeons Deep and Caverns Dim, Flies and Spiders, The Lonely Mountain, The Battle of Five Armies.
- The Against the Shadow cycle: Peril in Pelargir, Into Ithilien, The Siege of Cair Andros, The Steward's Fear, The Drúadan Forest, Encounter at Amon Dîn, Assault on Osgiliath, The Blood of Gondor, The Morgul Vale.
- The Ring-maker cycle: The Fords of Isen, To Catch an Orc, Into Fangorn, The Dunland Trap, The Three Trials, Trouble in Tharbad, The Nîn-in-Eilph, Celebrimbor's Secret, The Antlered Crown.
- The Haradrim cycle: Escape from Umbar, Desert Crossing, The Long Arm of Mordor, The Mûmakil, Race Across Harad, Beneath the Sands, The Black Serpent, The Dungeons of Cirith Gurat, The Crossings of Poros.
- The Vengeance of Mordor cycle: The River Running, Danger in Dorwinion, The Temple of Doom, Wrath and Ruin, The City of Ulfast, Challenge of the Wainriders, Under the Ash Mountains, The Land of Sorrow, The Fortress of Nurn.
- The Angmar Awakened campaign (Angmar Awakened Campaign Expansion): Intruders in Chetwood, The Weather Hills, Deadmen's Dike, The Wastes of Eriador, Escape from Mount Gram, Across the Ettenmoors, The Treachery of Rhudaur, The Battle of Carn Dûm, The Dread Realm.

ALeP's content comes after all of these.

## Accessibility

You can play a full game with VoiceOver or TalkBack: with a screen reader on, the table turns into a list of zones and cards. Settings let you use that list table without a reader, and adjust text size, contrast, motion, how long banners and confirmations wait, and whether titles use a plain typeface. The app aims for WCAG 2.2 AA and the Game Accessibility Guidelines, though it has not been audited. [ACCESSIBILITY.md](ACCESSIBILITY.md) describes what is supported and the gaps that remain.

## Architecture

- `data/` holds the card, scenario and rules data. It is committed, and it is built offline from snapshots in `data/raw/`. `data/sources.json` pins every source.
- `data/printed/` records the lines printed on each card, read from its scan. This is the card text the build uses.
- Each printed line is implemented by an effect record. Generated records live in `src/effects/generated/` and hand-written ones in `src/effects/authored/`. A scenario becomes playable once every line it deals has a record, and `src/effects/open-lines.ts` lists the lines still waiting for one.
- `src/rules/` is the rules engine: a pure reducer, split by mechanic family.
- When sources disagree, [.claude/rules/authority.md](./.claude/rules/authority.md) says which one wins.

The stack is Expo SDK 58, Expo Router, Skia, Reanimated, NativeWind, SQLite with Drizzle, Zustand and Zod. [docs/architecture.md](docs/architecture.md) goes into detail.

## Install

The app isn't on the Play Store or the App Store. On Android you install the APK from the [Releases page](https://github.com/j-jmnz/middle-earth-player/releases). On an iPhone or iPad you install the IPA through SideStore or AltStore, which sign it with your own Apple ID. It's free, and once it's installed it never needs a network connection.

### What you need

- An Android phone running Android 7.0 or later, on a 64-bit processor.
- Or an iPhone or iPad running iOS or iPadOS 15.1 or later, a free Apple ID, and SideStore or AltStore Classic. You need a computer once, for the setup. AltStore also needs AltServer running on that computer to refresh the app each week.
- Wi-Fi, and free space of at least twice the download size.

### Android

1. On your phone, open the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest), and under Assets tap `middle-earth-player-v<version>.apk`. You can ignore the `.sha256` file.
2. Open the download from your browser or your Files app.
3. If the phone asks, allow that app to install unknown apps (Settings, Allow from this source), then go back.
4. Tap Install. If Play Protect warns you, tap More details, then Install anyway.
5. Open Middle Earth Player.

To update, install the newer `.apk` the same way and your saves carry over. Don't uninstall the old version first, because that deletes your saves.

### iPhone and iPad

1. Set up [SideStore](https://sidestore.io), which refreshes the app on the phone itself, or [AltStore Classic](https://altstore.io), which refreshes it through AltServer on a computer on the same Wi-Fi. AltStore PAL won't work, because it only installs apps from its own marketplace.
2. On iOS 16 and later, turn on Developer Mode (Settings, Privacy & Security) and restart.
3. In SideStore or AltStore, open Sources, tap +, and add `https://github.com/j-jmnz/middle-earth-player/releases/latest/download/source.json`.
4. Open the Middle Earth Player source and tap Free or Get.

You can also download the `.ipa` from the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest) in Safari and add it under My Apps, +.

An app signed with a free Apple ID stays valid for 7 days. SideStore and AltStore refresh it in the background, or you can tap Refresh All in My Apps. A free Apple ID allows 3 sideloaded apps at once, and SideStore or AltStore counts as one of them. Updates show up in the source and keep your saves, but deleting the app deletes them.

If a release's notes include a TestFlight link, you can use that instead: install [TestFlight](https://apps.apple.com/app/testflight/id899247664), open the link, tap Accept, then Install. TestFlight builds never need refreshing, but they expire 90 days after they are published.

### Check a download (optional)

Each release's notes give the APK's SHA-256 and the fingerprint of its signing certificate. You can check the file with `sha256sum` on Linux, `shasum -a 256` on macOS or `certutil -hashfile <file> SHA256` on Windows.

### If something goes wrong

- Android says "App not installed": the phone is 32-bit or older than Android 7.0, it is short of space, or a copy you built yourself is already installed. In the last case, uninstall that copy first, knowing its saves go with it.
- The download stops or won't open: download it again over Wi-Fi.
- On iOS, the app stops opening after a few days: its signature has expired. Refresh it in SideStore or AltStore, with AltServer running on the same Wi-Fi if you use AltStore.
- You've hit the app limit: remove a sideloaded app you no longer use.
- The TestFlight beta is full: use SideStore or AltStore instead.
- For anything else, [open an issue](https://github.com/j-jmnz/middle-earth-player/issues) and include your device, its OS version and the app version shown in Settings.

### Privacy

The app collects no personal data, and your saves stay on your device. [PRIVACY.md](PRIVACY.md) has the full policy, and Settings, About links to it too.

## Local setup

### Requirements

- Node 22.18 or later, which runs the `.ts` scripts without a build step.
- pnpm 10.34.1. Running `corepack enable` installs the version pinned in `package.json`.
- Optionally, `poppler` (`pdftoppm`), which renders the campaign, boon and burden cards from FFG's PDFs. Without it those cards fall back to their scans and the build prints a warning.

```bash
git clone https://github.com/j-jmnz/middle-earth-player.git
cd middle-earth-player
pnpm install
pnpm test
```

The tests need no network and no prebuilt database. You may see "Ignored build scripts: sharp"; it's harmless.

### In a browser

```bash
pnpm web
```

This builds the catalog and opens the app through Metro. Narrow the window to phone width. The browser build suits work on the screens (campaigns, briefing, log, deck builder), but it has no card pictures and no booklet reader, and SQLite runs on browser storage.

There's also a Codespaces devcontainer (`.devcontainer/devcontainer.json`) that installs the dependencies and builds the catalog. Run `pnpm web` there and open port 8081.

### On a phone

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

### Maestro

The Maestro flows live in `.maestro/scenarios/<scenario-id>/` and `.maestro/features/`. Run `maestro test .maestro` against an installed build. Flows that open a save fixture need `EXPO_PUBLIC_E2E_SEED` set, which the `e2e-test` profile in `eas.json` does.

The screen-reader flow (`.maestro/features/screen-reader.yaml`, tagged `reader`) needs a development build made with `EXPO_PUBLIC_E2E_SEED=1 EXPO_PUBLIC_FORCE_READER=1`. Run it with `maestro test --include-tags=reader .maestro`.

`.eas/workflows/e2e.yml` runs the flows on EAS. Nothing starts it automatically, not a push and not a pull request: someone signed in to the Expo account that owns the project starts it by hand with `eas workflow:run .eas/workflows/e2e.yml`.

## Commands

Scripts are grouped as `pnpm <group> <command> [args]`, and running `pnpm <group>` on its own lists that group's commands (`scripts/cli.ts`). The exceptions are `pnpm test` and `pnpm assets`, which run everything in their group. The groups are `test`, `data`, `effects`, `scenario`, `assets`, `docs` and `release`, while `lint`, `typecheck`, `move` and `commit:check` stand alone. If the first argument to `pnpm test` isn't one of its commands, it goes to Vitest as a filter.

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
| `pnpm data query "<sql>"` | Queries the `cards`, `scenario_cards` and `rules` tables in memory. |
| `pnpm effects draft <scenario \| deck \| pack \| codes>` | Writes `.agent/drafts/<code>.md` for each card with a printed line no record covers yet. |
| `pnpm effects open` | Regenerates `src/effects/open-lines.ts`. |
| `pnpm scenario new <scenario-id>` | Writes and registers the skeleton files for a new scenario. Try `--dry-run` first. |
| `pnpm scenario pack <scenario-id>` | Writes `.agent/pack/<id>.md`, the context a scenario author reads: vocabulary, schema entries, cookbook sections and drafts. |
| `pnpm scenario fixtures [scenario-id]` | Regenerates the Maestro save fixtures in `src/campaign/fixtures/`. |
| `pnpm assets` | Runs `catalog`, `booklets` and `scans` in that order. `start`, `android`, `ios` and the native release builds run it for you (`start` with `--optional`). |
| `pnpm assets catalog` | Writes `assets/catalog.db`, which is never committed, and `src/catalog/version.ts`, which is. |
| `pnpm assets scans` / `pnpm assets booklets` | Packs the card pictures or the booklet PDFs into `assets/`. |
| `pnpm assets capture --build` | Takes the README's screenshots on the iOS simulators. It needs macOS, Xcode and Maestro ([docs/showcase.md](docs/showcase.md)). |
| `pnpm assets showcase [--publish]` | Turns the captures into the README's images and a contact sheet. `--publish` replaces the `showcase` branch with them. |
| `pnpm doc index` / `pnpm doc section <file> "<heading>"` | Regenerates `docs/INDEX.md`, or prints one section of a doc. |
| `pnpm release plan --dry-run` | Prints the next tag and its release notes without changing anything. Run `git fetch --tags` first. |
| `pnpm release source --tag <tag> --ipa <file> --notes <file> --out <file>` | Writes a release's SideStore and AltStore source. The release workflow runs it. |
| `pnpm commit:check "<subject>"` | Checks commit subjects against `.claude/rules/commit-standards.md`, or a whole range with `--range <base>..<head>`. It is installed as the `commit-msg` hook. |
| `pnpm move <old> <new>` | Moves files and rewrites every reference to them. Try `--dry-run` first. |

Scripts log to stderr. Pass `--verbose` or `--quiet`, or set `LOG_LEVEL` to `debug`, `info`, `warn`, `error` or `silent`.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Please report security problems privately, as [SECURITY.md](SECURITY.md) describes. If your change adds a network request, a permission or an SDK that sends data, update [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) in the same pull request.

## Documentation

- [docs/brief.md](docs/brief.md) records the product decisions and the rules as implemented.
- [docs/architecture.md](docs/architecture.md) covers the code layout, state, the engine and the tests.
- [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md) describe the screens and the game table.
- [docs/showcase.md](docs/showcase.md) explains the README's screenshots and how to take them again on a Mac.
- [docs/releasing.md](docs/releasing.md) walks through the release pipeline; its rules are in [.claude/rules/release-standards.md](./.claude/rules/release-standards.md).
- [docs/phases/STATUS.md](docs/phases/STATUS.md) tracks the open work.
- [ACCESSIBILITY.md](ACCESSIBILITY.md) covers what is supported, the known gaps, and how to report a barrier.
- [docs/INDEX.md](docs/INDEX.md) is a generated index of every doc, section by section.

## Attribution

The Lord of the Rings: The Card Game and all of its content are © Fantasy Flight Games. The Lord of the Rings and its characters and places are trademarks of Middle-earth Enterprises. The repository commits card text, rules text, source snapshots (`data/raw/`) and game icons (`assets/icons/`). Card images and PDFs are fetched at build time and never committed. Every source is pinned by URL and sha256 in `data/sources.json`.

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

The order in which picture sources are tried is set in `scripts/data/sources/pictures.ts`.

## License

The code and documentation are under the [MIT License](LICENSE). Game content, `data/raw/` and the fonts stay under their owners' terms; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) has the details.
