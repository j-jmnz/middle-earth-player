# Phase 1 — Tooling shell

Depends on: phase 0
Blocks: phase 2

## Goal

An Expo app that opens on an empty campaign list, with the test and lint boundaries already enforced. No catalog, no rules, no images.

## Pin

Expo SDK 57, package version 57.0.17 or later. TypeScript. React Native new architecture on. Expo Router. SDK 58 is out of these phases.

Install Reanimated, `react-native-worklets`, Gesture Handler, Skia, FlashList, `expo-sqlite`, `expo-image`, and `expo-file-system` with `npx expo install`. Worklets is the Reanimated 4 peer. Stay on the Skia and FlashList versions that command selects. Expo Go ships those binaries. NativeWind 4.2.7 and Tailwind 3 for chrome screens. NativeWind 5 is out. Vitest. Maestro for end-to-end flows.

Lint uses a flat-config import rule. `eslint-plugin-import` v2 is the wrong tool for that config.

Do not add `expo-dev-client` in this phase. Do not add TanStack Query, Redux, a Phoenix client, a server, a monorepo, or a second styling system. Do not build the table, the deck builder, or scenario code in this phase. Do not call Skia's `makeImageFromView`.

## Layout to create

```
src/rules/
src/campaign/
src/effects/
src/catalog/
src/play/
src/screens/
scripts/
assets/
drizzle/
fixtures/
.maestro/
```

`src/rules` and `src/campaign` have zero imports from `react-native`, `expo-*`, `src/play`, or `src/screens`. `src/play` imports `src/rules` and `src/catalog` only. Production code in `src/rules`, `src/campaign`, `src/play`, and `src/screens` does not import `src/effects`. The build script and tests may. Add the rule before the first component imports the reducer.

Gitignore `assets/catalog.db`, RingsDB payloads, card images, booklet PDFs, and `agent-tools/`. Do not commit card text.

The root route is the campaign list. It can be an empty screen. Give it a testID. Deckbuilding is a separate root route with a placeholder, not a built editor.

`.maestro/campaign-list.yaml` launches the app and asserts that screen. Add `.eas/workflows/e2e.yml` with a Maestro job that runs `.maestro/`, and keep local `maestro test` as the loop you actually run. The EAS job is alpha. Do not assert drag frame rate. Do not build the Skia table in this phase.

## Exit

The app launches to the campaign list. The Maestro flow passes against a debug build. A deliberate `react-native` import under `src/rules` fails lint. An import of `src/effects` from `src/rules`, `src/campaign`, `src/play`, or `src/screens` fails lint. An import from `src/play` of anything other than `src/rules` or `src/catalog` fails lint. `vitest` runs, with no game tests yet. The installed NativeWind package is 4.2.7. `package.json` does not depend on `expo-dev-client`.
