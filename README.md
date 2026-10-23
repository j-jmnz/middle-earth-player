# Solo LOTR LCG

A personal, offline app for The Lord of the Rings: The Card Game. Official campaigns are the product. The proof of concept is the 2022 Fellowship of the Ring Saga Expansion (MEC109), with the full official player-card pool available for decks from the first install.

`pnpm test` runs Vitest, `pnpm lint` checks import boundaries, and `maestro test .maestro` runs against a debug build. How to open the app on this Mac and on an Android phone is in [Run it locally](#run-it-locally). Decisions, the stack, the data rules, and the build order are in [docs/brief.md](docs/brief.md). Structure is in [docs/architecture.md](docs/architecture.md). What is in progress is in [docs/phases/STATUS.md](docs/phases/STATUS.md). `/implementer` builds a phase, `/reviewer` reviews the diff, and `/ux` reviews the screens. The app applies the rules, keywords, phases, effects, and the resulting numbers. The player only chooses among legal options. Do not reopen the product shape, and do not port DragnCards.

Do not commit `catalog.db`, RingsDB dumps, or card text. The catalog is generated in the release job and shipped inside the binary.

## Run it locally

The phone is the product. The Mac browser is the fast loop for screens.

### Mac browser

`pnpm web` opens the app in Chrome through Metro. Narrow the window to a phone width. Use it for the campaign list, the path, the briefing, the log, and the deck builder.

These checks stay on a physical phone: pool fling, table drag, kill-and-relaunch, and airplane mode. SQLite in the browser is browser storage. Image files and the booklet reader stay on the phone. The Skia table has no drag sign-off in Chrome.

### Android phone

`package.json` does not depend on `expo-dev-client` until the booklet reader. Open the screen in Expo Go:

```sh
pnpm start
```

Keep the phone and the Mac on the same Wi-Fi, then open the project in the Play Store Expo Go for SDK 58. If the phone cannot reach the Mac, use `pnpm start -- --tunnel`.

`.maestro/campaign-list.yaml` launches `com.middleearth.lcg`. Maestro does not attach to Expo Go, so `maestro test .maestro` needs the debug build from `pnpm android` or `pnpm ios`.

After phase 1 is completed, install this app on the phone and add `expo-dev-client` then, ahead of the booklet reader in phase 10:

1. Install Android Studio with Android SDK Platform 36. On the phone, enable USB debugging.
2. `pnpm expo install expo-dev-client`
3. `pnpm android -- --device`

That compiles `com.middleearth.lcg`, installs it over USB, and serves JavaScript from Metro. Later edits reload in the installed app. Rebuild when a native module changes. `android/` and `ios/` stay gitignored.

A cloud APK is the fallback when Android Studio is unwelcome. The daily loop is the local install above.
