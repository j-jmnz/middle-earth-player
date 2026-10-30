# Settings tab, UI scale, and Dark/Light theme

User request, 2026-10-28. Status: built; phone checks open. Progress is recorded in `docs/phases/STATUS.md`.

## Order of work

Each step leaves the app working, with tests green.

1. Settings model.
2. Theme engine.
3. UI scale engine.
4. Behaviour settings.
5. Settings tab and screen, and the table panel rows.
6. Docs and STATUS.
7. Web screenshots.
8. Reviewer, then the ux agent.
9. Commit and push.

## Context

The user asked for a Settings section. It should hold the settings the app needs, apply game UX conventions, and add a **UI scale** setting with Small, Medium and Large options that scales the whole UI to fit different screen sizes.

Today the only settings are the table's (`src/play/table-settings.ts`): animation speed, combat spotlight, strong outlines, the first-game guide, stops, and the Responses always used. They are stored in user.db `settings` under the key `"table"` (`src/screens/settings-store.ts`). They can only be reached from the table menu's paper panel (`SettingsPanel`, `src/play/reading-panels.tsx:181`). The app has no setting for haptics, no override for reduced motion, no keep-awake and no About page. No scale factor runs through any size.

The research the plan draws on:
- **Game Accessibility Guidelines, basic tier:** an option to adjust game speed, a toggle for any haptics, a readable default text size, interactive elements that are large and well spaced on touch screens, and settings that are saved and remembered.
- **Xbox Accessibility Guidelines 112:** text size among the minimum settings, choices persisted across launches, visual distractions off by default, and scaling that never forces two-way scrolling.
- **Halo Infinite:** a per-section "Restore defaults".
- **General settings UX:** group settings by topic, keep them on one page rather than nested sub-menus, use the same switch style everywhere, and give immediate feedback.

These are the user's choices from the questions:
- A **6th "Settings" tab** opens the screen.
- UI scale **defaults to Medium**.
- Four additions are included: **Haptics**, **Reduce motion** (Follow system / Always), **Keep screen awake**, and **About & Restore defaults**.

## Settings model

**`src/play/table-settings.ts`**
- Extend `TableSettings` in this file and keep its one store. Persistence stays on the same `"table"` row, so existing rows parse and the new keys take their defaults.
- Update the header comment: these are now the app's settings.
- New fields and defaults:
  - `uiScale: "small" | "medium" | "large"`, default `"medium"`
  - `haptics: boolean`, default `true`
  - `reduceMotion: "system" | "always"`, default `"system"`
  - `keepAwake: boolean`, default `true` (at the table only)
- `parseSettings` validates each new field the same way the existing ones are validated.
- Add a `restoreDefaults()` helper. It returns `DEFAULT_SETTINGS` with `guideSeen` kept, so the guide does not replay.

**Tests**
- Extend `src/screens/settings-store.test.ts`: an old row that lacks the new keys loads with their defaults, and the new keys round-trip.
- Add a parse test for wrong types.

## UI scale engine

The scale factors are Small 0.875, Medium 1 and Large 1.15. Each size is multiplied by the factor, so text stays crisp and layout reflows. There is no root `transform`: it would blur text on iOS, misbehave with Skia's Android view and RN `Modal`, and it would mean faking the window size.

1. **New `src/play/ui-scale.ts`** (pure and tested):
   - `UI_SCALES` maps each option to its factor.
   - `uiFactor(option)`.
   - `useUiScale()` reads the store and returns the factor `s`.
   - `scaled(s, n) = n * s`.
   - A hit-target floor: `touch(s, n) = Math.max(44, n * s)`. Small never shrinks a hit target below 44 pt.
2. **NativeWind classes scale through dynamic rem.**
   - In `metro.config.js`, call `withNativeWind(config, { input, inlineRem: false })`.
   - In the root `_layout.tsx`, call `rem.set(14 * s)` (from `nativewind`) whenever `uiScale` changes. It also runs before the databases open, with the default.
   - That covers the roughly 660 spacing and size classes, which Tailwind already writes in rem.
   - On web, `rem.set` sets the root font-size to `14·s`. This aligns web with the phone: web was 16, phone 14.
3. **Tokens move to rem** (`tailwind.config.js`).
   - Add a helper `const rem = (px) => \`${px / 14}rem\``.
   - The `fontSize` tokens use it: display, title, heading, body, label, eyebrow and micro, with their line height and letter spacing.
   - The `borderRadius` tokens use it too, except `pill`.
   - Medium therefore renders exactly as today.
   - Add a fixed `touch: "44px"` minHeight/minWidth token. Use it for the 25 `min-h-11` / `min-w-11` hit floors, so they stay 44 at Small.
4. **JS numeric sizes** (about 300 literals and about 60 constants in `src/screens` and `src/play`; listed by the sizing survey):
   - Components multiply through `useUiScale()`. Examples: `tab-bar.tsx` `DOCK_ICON`, `chrome-marks.tsx` sizes, `size={n}` props, inline `width`/`padding`/`borderRadius`/`fontSize`.
   - Module constants stay as the Medium value and are multiplied where they are used.
   - Pure layout and budget modules take `scale` as a last parameter, defaulting to 1 so existing tests are unchanged. The common form is to compute in logical points (`screen / s`) and return points × `s`. The modules are:
     - `src/play/top-bar-layout.ts`
     - `dock-budget.ts` (including the `DENSE_BELOW` comparison)
     - `armed-room.ts`
     - `tray-logic.ts`
     - `preview-size.ts`
     - `carousel.ts`
     - `spotlight-stage.ts`
     - `screens/pool-grid.ts`
     - `table-view.tsx` `commandWidth`
5. **Table canvas**
   - `src/play/layout.ts`: add `scale` to `LayoutOptions`. `GUTTER`, `GAP`, `PEEK`, `HAND_MIN`, `MARK`, the card cap of 96 and the card floor of 34 all scale. `MIN_TARGET` stays a floor through `touch()`.
   - Pass the scale into the drag worklets with the layout object, not module constants.
   - `table-fonts.native.ts` `useTableFonts(scale)`: the Skia font sizes × `s`.
   - The drawing constants scale: `canvas-pieces.native.tsx` (`RADIUS`, `LINE`, `BADGE_H`), `token-spots.ts` (`TOKEN`), `token-fx.native.tsx` (`FLOAT_SIZE`), and the zone word offsets in `table-canvas.native.tsx`.
   - Cards still fit the measured canvas at every scale.
   - The web twin `table-canvas.tsx` is class-based and scales through rem.

## Theme engine (Dark / Light / System)

The user asked for this partway through planning: add a dark and a light theme, with the choice in Settings. Their answers:
- **Dark is the default**, so nothing changes for existing players.
- **System** is also offered.
- The **table follows the theme** too.

1. **Setting.** Add `theme: "dark" | "light" | "system"` to the store, default `"dark"`, validated in `parseSettings`.
   - `src/play/theme.ts` (pure, tested) provides:
     - `resolveTheme(setting, osScheme)`, which returns `"dark"` or `"light"`.
     - A `useTheme()` hook (store plus RN `useColorScheme()`) that returns the resolved name.
   - In `app.json`, `userInterfaceStyle` changes from `"dark"` to `"automatic"`, so the phone reports its scheme.
     - This changes the native config.
     - The Android and iOS builds need a prebuild.
     - It stays open in STATUS as a phone check.
2. **Two palettes, same token names.**
   - `src/screens/palette.js` exports `palettes = { dark, light }`, plus `palette` (= dark) so build-time callers keep working.
   - The token names stay as roles: `night` is "the page" and `bone` is "the main text" in either theme. Renaming them would touch about 400 call sites for no gain. The design system says this in one line.
   - Light ("Daylight") values:
     - Warm parchment surfaces for night, dusk, raised, raisedTop, pressed and hairline.
     - Dark ink text for bone, muted and faint.
     - A deepened gold, so gold text and gold-on-surface keep 4.5:1. `onGold` stays dark.
     - Darker moon, ok and danger.
     - A light linen `felt` / `feltLight` for the table.
   - Paper/ink tokens stay as they are: a sheet is paper in both themes, set apart by its shadow and `paperEdge`.
   - Encounter, sphere and threat colors are unchanged.
   - `palette.d.ts` is updated to match.
3. **Classes switch through CSS variables** (NativeWind v4 `vars`).
   - Each color in `tailwind.config.js` becomes `rgb(var(--<token>) / <alpha-value>)`, built by a helper from the palette keys. The ~264 color classes then need no edit.
   - In the root `_layout.tsx`, wrap the tree in a `View` with `style={vars(themeVars(resolved))}`. Variables pass through React context, so `Modal` content inherits them.
   - Also call `colorScheme.set(resolved)`, replacing the forced `"dark"` in `applyColorScheme`.
   - `global.css` gets `:root` defaults with the dark values, so the static web export paints before hydration. A test checks they match `palettes.dark`.
4. **JS colors become theme-aware.**
   - About 137 `palette.x` uses in 34 files move to `usePalette()` (from `src/screens/palette-hook.ts`).
   - `src/play/tokens.ts` holds `tableTokensByTheme = { dark, light }` and `useTableTokens()`.
   - `play-tokens.test.ts` checks both copies for drift.
   - `surfaces.ts` functions (`panelSurface`, `goldSurface`, `slateSurface`, `nightFade`, `topShade`, …) take the tokens as a parameter instead of reading a module constant.
   - Skia components take the tokens through props or the hook: `table-canvas.native.tsx`, `canvas-pieces`, `card-marks`, `spotlight*`, `token-fx`, `hand-scrub`.
   - Stack `contentStyle` and the tabs' `sceneStyle` read the hook.
5. **Backdrops.** `backdrop-scenes.ts` gets a light variant of each scene: dusk, ember, vale, plain, victory and felt. These are dawn and daylight versions of the same art, with a lighter vignette. `backdrop*.tsx` picks scenes by theme.
6. **Status bar.** RN `StatusBar` uses `barStyle` light-content on dark and dark-content on light. The table keeps it hidden.
7. **Contrast.** New `src/screens/contrast.test.ts` computes WCAG ratios for the listed pairs in both palettes and requires at least 4.5:1 for body text. The pairs are: bone/muted/faint on night, raised and raisedTop; gold text on night; onGold on gold; danger on night; and ink/inkMuted on paper. The light palette's values are tuned until it passes.

## Behaviour settings

- **Haptics:** in `src/play/haptics.ts`, `quietly()` returns early when `tableSettings.getState().settings.haptics` is false.
- **Reduce motion:**
  - Add `useReduceMotion()` to `src/play/motion-run.ts`. It returns `useReducedMotion() || reduceMotion === "always"`.
  - Use it everywhere the OS value is read today:
    - `motion-run.ts:53` (`useMotionScale`)
    - `phase-carousel.tsx:125`
    - `table-dock.tsx:221`
    - `use-spotlight.ts`, which already plays nothing when motion is reduced
    - `screens/pool-filter-sheet.tsx:45-55`, which switches from `AccessibilityInfo` to the hook
  - Where `ReduceMotion.System` is passed to Reanimated builders or timing configs, pass `ReduceMotion.Always` while the override is on.
- **Keep screen awake:**
  - Add `expo-keep-awake` as a direct dependency (`pnpm add expo-keep-awake@~58`). It already ships inside `expo`, so autolinking normally needs no new native build. Confirm on the phone.
  - In `src/screens/table-view.tsx`, use `activateKeepAwakeAsync` / `deactivateKeepAwake` with a table-scoped tag while `keepAwake` is on. Releasing it when the table unmounts covers standalone games as well.

## Settings tab and screen

- **Tab**
  - In `src/screens/routes/(tabs)/_layout.tsx`, add a 6th `Tabs.Screen name="settings"` with title "Settings" and `tabBarButtonTestID: "settings-tab"`.
  - The game icon font has no gear, so draw one in `chrome-marks.tsx` (`GearMark`: views only, like `Chevron`). In `tab-bar.tsx`, add a `drawnIcon` sibling of `dockIcon` that tints it goldHigh or faint.
  - Tab labels get `adjustsFontSizeToFit` with `minimumFontScale`, so "Campaigns" fits six-across at Large on a 360 pt phone.
- **Screen**
  - The route is `src/screens/routes/(tabs)/settings.tsx` and the view is the new `src/screens/settings-view.tsx`.
  - It uses `Screen scene="plain"`, `ScreenScroll`, `ScreenTitle` "Settings", and `Section` eyebrows.
  - There is one page with no sub-menus.
  - It reads and writes `tableSettings` with `useStore`. Every change applies at once and is saved by the existing `bindTableSettings`.
- **Section: Display**
  - **Theme:** a stretched `Segmented` with Dark, Light and System (`app-settings-theme-*`). It applies live.
  - **UI scale:** a stretched `Segmented` with Small, Medium and Large (`app-settings-scale-*`). Under it, a one-line `Label` says the whole app, the table included, resizes. The page itself reflows as live feedback.
  - **Strong outlines**
- **Section: Motion and feel**
  - Animation speed: Normal or Quick
  - Reduce motion: Follow system or Always, with a detail line saying the phone's setting always applies
  - Combat spotlight
  - Haptics
- **Section: At the table**
  - First-game guide. Turning it on resets `guideSeen`, as the panel does.
  - Stops on. The detail says which steps are picked on the rail's phase carousel.
  - Keep screen awake.
  - Responses used every time: a tap on a row returns it to asking. When the list is empty, "None yet".
- **Section: About**
  - App version (`expo-constants`)
  - Catalog version (`src/catalog/version.ts`)
  - A data and credits paragraph: RingsDB, Hall of Beorn, DragnCards, Cinzel under the OFL, and the fan-made / unofficial disclaimer
  - **Restore defaults:** a muted button with an in-place confirm, following the pattern in `keep-or-delete.tsx`
- **Shared row:** `SettingSwitch`, a night switch row with label, detail and an RN `Switch` in gold/hairline.
  - It goes in `chrome-buttons.tsx`, generalized from `NightSwitch` in `src/play/carousel-cards.tsx:14`.
  - `carousel-cards` reuses it, so the two do not drift apart.
- **testIDs:** the screen root is `app-settings`. Its rows include `app-settings-theme-dark|light|system`, `app-settings-scale-small|medium|large`, `app-settings-haptics`, `app-settings-reduce-motion-*`, `app-settings-awake`, `app-settings-restore` and `app-settings-restore-confirm`.
  - The table panel already uses `settings-speed`, `settings-spotlight`, `settings-contrast` and `settings-guide`. The new screen prefixes its rows with `app-settings-*` so the two do not collide in Maestro.
- **The table's panel**
  - `SpeedChoice` in `reading-panels.tsx` is generalized to `PaperChoice<T>`.
  - The panel gains a **UI scale** row and a **Theme** row, so a player can fix the size or the light mid-game in landscape. It also gains a **Haptics** switch.
  - Everything else stays as is.

## Docs and status

- **`docs/brief.md`:** Screens table gets a Settings row. The user.db `settings` line now lists the app's settings under `"table"`.
- **`docs/architecture.md:130`:** the settings row gains the new fields and `ui-scale.ts`.
- **`docs/design-system.md`:**
  - AppTabBar: six tabs and the drawn gear.
  - New `### Settings` screen.
  - Type and Spacing: sizes are rem at 14 × the UI scale, with the 44 pt `touch` floor. This also corrects the "px-6 (24)" line: it is 21 at Medium.
  - Motion: the Reduce motion override. Haptics: the toggle.
  - Color: a Daylight column in the token table with the light values, plus the light contrast pairs. The token names are roles, not hues.
  - Backdrops: the light scenes.
  - The "One theme" line in `_layout.tsx` and the docs is replaced.
- **`docs/phases/STATUS.md`:** add a dated section, "## Settings and UI scale, 2026-10-28 (user request)", with **Checked** and **Open** entries. Open: no phone check (cloud session) at three scales and both themes on Android and iOS, `userInterfaceStyle: automatic` after a prebuild, FlashList scroll performance with dynamic rem, keep-awake on the device, and Maestro not run.
- **New `.maestro/settings.yaml` flow:** open the tab, switch to Large, relaunch, and check the choice is kept. It is not run in the cloud.

## Notes for the implementing agents

**Read first**
- `CLAUDE.md`, then `.cursor/rules/authority.mdc`, then `docs/architecture.md` and `docs/design-system.md`. They win over this plan where they speak.

**Import boundary**
- `src/play` must not import `src/screens`. `pnpm lint` enforces this.
- So the settings store, `ui-scale.ts`, `theme.ts` and the table's tokens live in `src/play`.
- Screens may import from `src/play`.
- `palette.js` stays in `src/screens`, and `tokens.ts` keeps its tested copy.

**No visible change by default**
- At **Dark + Medium** the app must look exactly as it does today. Take the Playwright screenshots before you start, then compare.
- Every new `scale` parameter defaults to `1` and every theme parameter defaults to the dark tokens, so existing tests pass unchanged.
- Never edit an existing test's expected numbers to make it pass.

**Keep testIDs and words**
- Do not rename any testID or any word a `.maestro/*.yaml` flow asserts.
- New testIDs on the Settings screen use the `app-settings-*` prefix. The table panel's `settings-*` IDs stay as they are.

**Performance is binding** (`docs/brief.md`, Performance and feel)
- Read the scale and the theme once per component, through the hook.
- Do not subscribe inside FlashList rows to the whole store. Use a selector (`useStore(tableSettings, s => s.settings.uiScale)`).
- Skia drawing gets tokens and scale through props from the canvas root, not one hook per piece.
- Worklets get the scale inside the layout object.

**Code style**
- Match the comment density and voice of the file you touch. Comments are plain prose sentences that say what the player sees.
- Cite the request as "(user request, 2026-10-28)" where the docs record a decision.
- No new hex values outside `palette.js`, `tokens.ts` and `backdrop-scenes.ts`.

**Data is out of scope**
- Nothing in `data/`, the effects or the rules engine changes.
- Do not run `pnpm data:sync`.
- Do not commit `assets/catalog.db`, scans or PDFs.

**Dependencies**
- Only `expo-keep-awake` is added (`pnpm add expo-keep-awake@~58`). No SVG or theming library.

**Cloud limits**
- There is no phone, simulator or Maestro. Do not mark phone checks done; list them under **Open** in `docs/phases/STATUS.md`.
- The web build (`pnpm web` / `npx expo export -p web`) with the preinstalled Playwright is the visual check. Use `chromium.launch()` and do not install browsers.

**Every step ends green**
- `pnpm test`, `pnpm lint`, `npx tsc --noEmit`.
- One commit per step, with a clear message and the session's attribution lines.
- Push to `ccr-64f7a831-lkkbkp`.

**Ownership, so parallel agents do not collide**
- Steps 1 (model), 2 (theme) and 3 (scale) are sequential: theme and scale both rewrite the same inline styles.
- Within step 2 or step 3, at most two agents may work in parallel. One owns `src/screens/**` and the other owns `src/play/**`.
- The shared files belong to the step's lead agent alone: `tailwind.config.js`, `metro.config.js`, `global.css`, `palette.js`, `routes/_layout.tsx` and `table-settings.ts`.
- Steps 4 and 5 may run in parallel after step 3: behaviour settings in `src/play` plus `table-view.tsx`, and the Settings screen in `src/screens` plus `reading-panels.tsx`.

**Review**
- After each step's green exit, run `reviewer` on that step's diff. After steps 2, 3 and 5, also run `ux`.
- Fix the findings before starting the next step.

## Verification

1. `pnpm test`, `pnpm lint`, `npx tsc --noEmit`, `pnpm data:check` (unaffected).
2. New tests:
   - `ui-scale.test.ts`: factors and the `touch` floor.
   - Settings parse and round-trip.
   - `layout.test.ts` at scale 0.875 and 1.15: cards stay inside the canvas, and hit targets are at least 44.
   - `dock-budget` and `top-bar-layout` at scale 1 are unchanged; at 1.15 they are proportional.
   - A test that every `fontSize` and `borderRadius` token in `tailwind.config.js` except `pill` is rem.
3. Web export, with screenshots from the preinstalled Playwright:
   - Campaigns, Settings and the card pool at 390×844, at each scale.
   - The table, through the e2e fixture route, at 844×390, at each scale.
   - Repeat each in Dark and Light. Dark must match the screenshots taken before the change; Light gets a contrast eyeball pass.
   - Check that Medium matches the screenshots taken before the change, that the app reflows with no horizontal scroll, and that the tab labels fit.
4. Run the `reviewer` agent on the diff, then `ux` (screens and play changed). Work through their findings.
5. Commit and push to `ccr-64f7a831-lkkbkp`.
