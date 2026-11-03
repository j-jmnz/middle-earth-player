# Tablet landscape, fanned hand scrub, no preview Close, table settings panel

User request, 2026-10-28. Status: implemented, 2026-10-28. Progress is recorded in `docs/phases/STATUS.md`.

## Context
The user asked for five changes:
1. Every screen gets a real tablet (iPad / large-screen) landscape layout, following tablet UX practice. Today only the table turns, and every other route is locked to portrait (`src/screens/routes/_layout.tsx:161-179`).
2. A shorter hold before the hand's scrub preview opens. The risen hand fans out like a held hand instead of lying in a flat row.
3. The card preview loses its Close button.
4. The table settings panel (paper side panel from the table menu, `SettingsPanel` in `src/play/chrome/reading-panels.tsx:212`) looks bad and uses its own cramped controls.
5. The panel's UI scale and Theme rows get reworked.

User decisions:
- **Rotation is tablets only.** A tablet is a device whose shortest screen side is at least 600 pt. Phones stay portrait everywhere but the table, which stays landscape-only on every device.
- **The table panel matches the Settings tab:** a night surface, the same grouped sections, and the shared controls. UI scale and Theme are reworked, not removed.
- **The hold is 150 ms.**

The research behind the tablet design:
- **Apple HIG:** design for regular vs compact width, not for iPad vs iPhone. A sidebar or rail replaces the bottom tab bar in regular width. Don't stretch the phone layout. Split View and Stage Manager widths must work.
- **Material 3 window size classes:** compact under 600, medium 600–839, expanded 840 and up.
- **Material 3 canonical layouts:** list-detail (a fixed list beside a flexible detail), supporting pane (about 30–40% of the width), and a feed grid.
- **Reading width:** about 50–75 characters, so a reading column of about 640 pt.
- **Reach:** in landscape, controls go toward the sides.

Repo rules: `src/play` cannot import `src/screens` (`pnpm lint`). Tests are Vitest on pure modules. Docs change in the same commit: `docs/design-system.md`, `docs/architecture.md`, `docs/brief.md` and `docs/phases/STATUS.md`. Phone checks stay Open, because a cloud session has no device. This plan is `docs/plans/done/tablets-and-hand-fan.md`.

---

## Part 1: Hand scrub, 150 ms hold and a fanned risen hand
- **`src/play/canvas/hand-scrub.ts:12`:** set `SCRUB_HOLD_MS = 150`. Update `hand-scrub.test.ts:209`.
- **Comments and docs that say 250:**
  - Code: `hand-scrub.ts:6`, `hand-gestures.native.ts:2-3,195,205`, `src/ui/motion-tokens.ts:127`.
  - `docs/design-system.md:345`.
  - The phase-25 note in STATUS.
  - The table-card preview `LongPress.minDuration(350)` (`hand-gestures.native.ts:196`) stays as it is.
- **The fan, in `spreadLayout` (`hand-scrub.ts:43`).**
  - Each spread slot becomes `Rect & { tilt: number }`.
  - The cards sit on an arc around a pivot below the hand. The angle per card is `min(FAN_STEP ≈ 0.07 rad, FAN_MAX ≈ 0.45 rad / (count-1))`, so the whole fan spans at most about 26°.
  - Each card's y drops by `R(1 − cos θ)`, with R ≈ 3 card heights.
  - The x spacing stays as today, so every card keeps its 44 pt slice.
  - The middle row is raised by the largest drop, and the edges grow by each rotated corner (`h/2·sin θmax`), so every card stays inside the canvas.
  - `top` becomes the highest slot y.
  - New constants `FAN_STEP`, `FAN_MAX` and `FAN_RADIUS` go in `SHAPE` (`src/ui/motion-tokens.ts`).
- **Hit-testing stays x-ordered.** `cardAt`, `pick`, `cancelled` and `startCard` keep working, because the centers are still ascending in x.
- **`src/play/canvas/scrub-pose.ts`.** Change `rot` to `(target.tilt * (1 − lift) − slot.tilt) * clock.rise`. Risen cards take the fan angle, and the lifted card under the finger straightens so it can be read. Update the header comment ("flattens the fan" becomes "turns the fan").
- **`src/play/canvas/hand-scrub.native.tsx`:** pass the tilted target through. The duplicate lifted card on top uses the same pose.
- **Tests:**
  - `hand-scrub.test.ts`:
    - The tilts are symmetric and sum to 0.
    - The middle card is highest.
    - The rotated bounds stay inside the canvas.
    - Every card keeps its 44 pt slice.
    - The total angle is at most `FAN_MAX`.
  - `scrub-pose.test.ts:16-22`: risen means the final angle equals the target tilt, and lifted means 0.
- **Docs:** design-system-table.md, Gestures (the scrub paragraph). Note that this reverses phase 25's "the fan flattens" (`docs/phases/phase-25-hand-scrub.md:29`), as a user request dated 2026-10-28.

## Part 2: Card preview without Close
- **`src/play/cards/card-preview.tsx:153`:** remove the `card-preview-close` ChromeButton. Details stays, alone, in both layouts (`:231`, `:235`).
- **How it still closes:** a tap on the dimmed scrim or on the card, Android Back, and the table's Back step.
- **Accessibility:**
  - Add `onAccessibilityEscape={close}` to the root `View` (the iOS VoiceOver scrub).
  - The scrim already has the label "Close the preview" and stays reachable.
- **The landscape side column stays non-closing.** It holds tappable attachments. The scrim stays visible around it, because the column is capped at 360 pt.
- **Update** the header comment (`:2-3`) and `docs/design-system.md:223-224`. No test or Maestro flow references the button.

## Part 3: The table settings panel matches the Settings tab
- **Shared rows.**
  - New `src/play/chrome/setting-rows.tsx` holds `SettingChoice` (title and detail over a stretched control, moved from `settings/view.tsx:23` `Choice`) and `SettingGroup` (moved from `Group`, `:36`).
  - Move `Segmented` from `src/screens/kit/chrome-buttons.tsx:270` to `src/ui/segmented.tsx`. Use `useTableTokens()` in place of `usePalette()`: `night`, `hairline` and `goldLine` exist in both token sets. Re-export it from `chrome-buttons.tsx`, as `SettingSwitch` is.
- **Shared contents.**
  - New `SettingsRows({ settings, onChange, always, testPrefix, groups })`, also in `setting-rows.tsx`, renders the Display, Motion and feel, and At the table groups.
  - The Settings tab uses all of them, plus About, with prefix `app-settings`.
  - The table panel uses the following, with prefix `settings`:
    - **Display:** Theme, UI scale, Strong outlines.
    - **Motion and feel:** Animation speed, Reduce motion, Combat spotlight, Haptics.
    - **At the table:** First-game guide, Keep screen awake, Responses used every time ("None yet" when empty).
  - Stops stay on the rail's carousel.
  - Every row has a detail line from `settings-words.ts`, so UI scale and Theme get `SCALE_LINE` and `THEME_LINE`.
- **`SettingsPanel` (`reading-panels.tsx:212`).**
  - Delete `PaperSwitch` and `PaperChoice`.
  - The panel renders `SettingsRows` with an Eyebrow/`font-display` title "Table settings" aligned left.
  - At its foot, an **All settings** text button (gold) opens the Settings tab. Add an `onAllSettings` callback through `table-layers.tsx`. It routes like the menu's other rows (`table-menu-items.ts`). The Settings tab is portrait on a phone, so this leaves the table, the same as Rules does today; the game is saved.
  - The close button stays as a night-tone ChromeButton (`settings-close`, as used by `.maestro/table-menu.yaml:98`).
- **`table-layers.tsx:131`.**
  - While `held.kind === "settings"`, the `TrayFrame` uses `surface="night"`. The other reading panels stay paper.
  - Settings width is `clamp(360·s, 40% of the canvas, 460·s)`, so a three-word Segmented fits at Large.
  - The "Choice waiting" line takes the night text color while it is on night.
- **testIDs** stay `settings-speed-*`, `settings-spotlight`, `settings-contrast`, `settings-guide`, `settings-haptics`, `settings-scale-*`, `settings-theme-*`, `settings-close`. Check `.maestro/table-menu.yaml:91-98` (`settings-speed` was the PaperChoice group id; keep it on the `SettingChoice` row).
- **Docs:** rewrite `docs/design-system.md:361`, the SettingsPanel paragraph, which is stale and contradicts itself. Update the Components rows.

## Part 4: Tablet landscape for every other screen

### 4a. Foundation
- **New pure module `src/ui/size-class.ts`** and `size-class.test.ts`.
  - Constants: `TABLET_MIN_SIDE 600`, `MEDIUM_MIN 600`, `EXPANDED_MIN 840`, `READABLE 640`, `WIDE 1040`, `RAIL 88`, `ACTION_GROUP 420`, `SHORT_WINDOW 480`.
  - Functions:
    - `isTabletScreen(w, h)`
    - `sizeClass(windowW, s)`, using logical width `windowW / s`
    - `isShortWindow(h, s)`
    - `showsRail`
    - `capWidth`
    - `gutter`
    - `paneWidths("list-detail" | "supporting", W, s)` (list 320–400; supporting 320–480)
    - `columnsFor(width, target, gap, s, min)`
  - Tests cover the device sizes (390×844, 744×1133, 834×1194, 600×960), the thresholds, and the scale cases (834/1.15 is medium; 1194/1.15 is expanded).
- **`src/ui/use-size-class.ts`:**
  - `useSizeClass()` returns `{ size, width, height, s, rail, short }` from `useWindowDimensions` and `useUiScale`.
  - `useIsTablet()` reads `Dimensions.get("screen")` and stays live on change, for foldables.
- **Root orientation, `routes/_layout.tsx:163`.** Use `orientation: useIsTablet() ? "all" : "portrait"`. The table routes stay `"landscape"`, and card, booklet, glossary and rule stay `"all"`.
- **New `src/screens/kit/chrome-panes.tsx`**, re-exported from `chrome.tsx`:
  - `Column({ max })`: centered, with `maxWidth` of `READABLE` or `WIDE` times s.
  - `TwoPane({ kind, start, end })`: measured, uses `paneWidths`, 24·s gap, panes `position: relative` so a NavBar and its shade can be scoped to a pane.
- **`chrome-frame.tsx`:**
  - `ScreenScroll` gains `max?`, which caps `contentContainerStyle`.
  - In `ActionBar`, the band stays full width and its children sit in a group:
    - compact: stretched, as today
    - medium: 480·s, centered
    - expanded: 420·s, at the trailing edge
  - `align="fill"` is for a bar inside a pane.
- **New `src/screens/kit/sheet-modal.tsx`:** one wrapper for both RN Modals (`pool/filter-sheet.tsx:64`, `deck/[id].tsx:364`).
  - `supportedOrientations` set to all four orientations. iOS Modals default to portrait only.
  - In medium and expanded the sheet is centered with `maxWidth` 560·s. This needs a `corners: "top" | "all"` prop on `SheetFrame` (`src/play/choice/sheet-paper.tsx`).
- **Navigation rail.** expo-router 58 bundles React Navigation 7, so `tabBarPosition: "left"` is supported.
  - In `(tabs)/_layout.tsx`, while expanded, use `tabBarPosition: rail ? "left" : "bottom"`. Add a `screenLayout` that provides `SafeAreaInsetsContext` with `left: 0`, so `Screen` doesn't pad twice.
  - In `tab-bar.tsx`, `AppTabBar` gets a `rail` variant:
    - Width 88·s plus the left inset; night fill with a hairline right edge.
    - Items `min-h-16`, icon over the word.
    - Settings sits at the foot (`mt-auto`).
    - The current item has a 2 pt gold glowing bar on its leading edge.
    - The same testIDs and the `tablist` role.
  - Medium portrait keeps the bottom dock.
- **Fix `start-panel.tsx:78-82`.** Its `landscape = width > height` test becomes `isShortWindow(height, s)`, so an iPad in landscape doesn't get the cramped phone-landscape panel.

### 4b. Per screen
Compact (every phone) is unchanged. The other classes:
- **Medium** gives the reading column (`ScreenScroll max="readable"` or a FlashList `gutter`).
- **Expanded** gives the layouts below.
- **Campaigns** (`(tabs)/index.tsx`, `save-panels.tsx`).
  - Two columns in one scroll inside `Column max="wide"`:
    - Left: Current playthrough and Other journeys.
    - Right (360–440): New playthrough / Start panel, Archived, Coming later.
  - With no saves, the start panel takes a readable column.
- **Scenarios:** two columns the same way. Boxes go left; Games and Archived go right.
- **Decks** (`(tabs)/decks.tsx`, `hero-tile.tsx`).
  - The Cards view becomes a grid of covers with `columnsFor(listW, 300, 12, s, 1)` columns.
  - Full-width rows use `overrideItemLayout` with a span.
  - The list has `key={view:columns}`.
  - The List view uses a readable gutter.
- **Cards and the pool** (`card-pool.tsx`, `pool/grid.ts`).
  - `poolColumns(width, adding, s)` is `columnsFor(width, adding ? 166 : 107, GRID_GAP, s, adding ? 2 : 3)`. A phone still gets exactly 3 and 2. This replaces `card-pool.tsx:109`.
  - `recyclePool(columns, listH, cellH)` replaces `RECYCLE_POOL = 24`.
  - The FlashList gets `key={view:columns}`.
  - The filter sheet is a centered `SheetModal`.
- **Rules and Glossary.** This is list-detail.
  - Extract `RuleBody` from `rule/[id].tsx:30-77` into `src/screens/rules/detail.tsx`.
  - Left (`paneWidths` list-detail): search and the glossary.
  - Right: the selected rule. See also stays in the pane, and Open in book pushes the booklet.
  - Empty right pane: the Books on the Rules tab, and "Choose a rule to read it here." on the glossary.
  - `ListRow` gains `selected` (pressed fill, a 2 pt gold leading bar, `accessibilityState.selected`).
  - The book cover breakpoint (`rules/view.tsx:28`) uses `size !== "compact"`.
- **Rule:** a readable column.
- **Settings:** two columns of groups. Left: Display and Motion. Right: At the table and About.
- **Card** (`card/[code].tsx`).
  - Two panes: the picture on the left, sized by height through a new `inspectSize(paneW, paneH, s)` in `preview-size.ts` (with a test, capped at 420); the text on the right, in its own scroll capped at 560.
  - In medium, a readable column with the picture cap raised to 360·s.
- **Deck editor** (`deck/[id].tsx`). This is list-detail.
  - Split `CardPool` into `CardPoolBody` (no Screen, ActionBar, toast or overlay) and the existing `CardPool` wrapper.
  - Left (360–440): the banner, the hero tiles, the section list, and the NavBar scoped to the pane.
  - Right: `CardPoolBody adding`, sharing the draft store, so a + shows on the left at once.
  - Add cards and the empty hero slots set a `typeRequest` instead of pushing `/pool`.
  - One toast and one preview overlay, at Screen level.
  - The unsaved-changes sheet is a centered `SheetModal`.
- **Deck import, History, Packs, Pack, Log:** a readable column. FlashList screens use `gutter`, and the sticky headers keep their full-width band.
- **Path** (`path/[saveId].tsx`). This is a supporting pane.
  - Left (capped 640): the trail.
  - Right (320–380): the journey bar, Pool, Log, and the next move with BEGIN/RESUME at its foot.
- **Briefing**, campaign and standalone (`briefing/parts.tsx`). This is a supporting pane.
  - `BriefingScreen` gains `aside`.
  - Left (360–480): the scene with `ScenarioBanner`, and the floating Back and Booklet buttons scoped to the pane, then `aside` (Before the deal, penalty waived, `EncounterDetails`) in its own scroll.
  - Right: Players, Difficulty and the seats, with the DealBar as `ActionBar align="fill"` at the pane's foot.
  - The seat picker shows two covers a row when the pane is 600 pt or wider.
  - Compact keeps today's order (children, then aside).
- **Resolution and Standalone outcome.** A supporting pane:
  - Left: the title, then the choice tiles or the stat tiles.
  - Right: `GameReportView`.
  - Once settled, a readable column.
- **Booklet:** the PDF stays full bleed. The empty and installing states sit in a 480 pt column.
- **The long-press `CardPreview`** already switches by `width > height`. No change.

### 4c. Risks to note in the docs
- **FlashList remounts when its column count changes**, so scroll resets on rotation. That is acceptable. Optionally restore the first visible index.
- **Pane-scoped overlays.** `FloatingBarShade`, the `ActionBar` overhang, the toast and the preview overlay must each render exactly once and be scoped correctly.
- **The table's landscape lock may not hold.**
  - Android 16 at targetSdk 36 ignores orientation locks on screens 600 dp and wider.
  - iPadOS 26 deprecates `requireFullScreen`.
  - Either way, the table's existing portrait guard (`table/view.tsx:240-250`) covers it. I note this and leave it; no `appCategory` plugin.
- **The width-driven two-pane Card screen also triggers on an iPhone in landscape (844×390).** The card and glossary routes already turn. Check that size.

---

## Order of work (each step leaves `pnpm test`, `pnpm lint` and `npx tsc --noEmit` green; one commit per step)
0. **Baseline.** Playwright web shots at 390×844 of every reachable screen, to compare phone regressions against.
1. **Part 1:** the hold, the fan, and their tests.
2. **Part 2:** the preview Close.
3. **Part 3:** the shared `Segmented` and setting rows, the Settings tab refactor, and the table panel.
4. **Part 4a pure modules:** `size-class.ts`, `poolColumns`, `recyclePool`, `inspectSize`, and their tests.
5. **Part 4a primitives:** the hooks, `chrome-panes`, `ScreenScroll max`, the `ActionBar` group, `SheetModal` with both Modals moved onto it, and the start-panel fix.
6. **The rail.**
7. **Reading-column screens and the two-column ones:** History, Packs, Pack, Log, Deck import, Rule, Booklet, Settings, Campaigns, Scenarios.
8. **Grids:** the pool, the filter sheet, the Decks covers.
9. **The Card screen.**
10. **The Rules list-detail.**
11. **The Briefing.**
12. **Path, Resolution and Outcome.**
13. **The Deck editor list-detail.**
14. **The orientation switch** in the root Stack. This goes last, once every Modal allows rotation.
15. **Docs.**
    - **`docs/design-system.md`:**
      - Standard 8, "Size classes, not devices".
      - A new `## Tablets` section with the thresholds, the rail, the sheets and the orientation rule.
      - The Components table.
      - An "On a tablet:" sentence in each screen section.
      - The pool grid performance line.
      - The scrub, preview and settings panel paragraphs.
    - **`docs/architecture.md`:** l.267 (the dock includes Settings and the rail) and l.293 (orientation, plus the Android 16 and iPadOS 26 notes).
    - **`docs/brief.md`:** l.109 and the Screens table.
    - **`docs/phases/STATUS.md`:** a new row with the phone and tablet checks Open.
16. **Review, then push.** Run the `reviewer` agent on the diff, then the `ux` agent, since `src/screens` and `src/play` change. Fix their findings, then push `claude/ipad-landscape-ui-improvements-a7tjk9`.

## Notes for the orchestrator
- **Every agent you spawn runs on Sonnet.** Pass `model: "sonnet"` on every Agent call: `implementer`, `reviewer`, `ux`, `Explore` and `general-purpose`. The `.claude/agents/*.md` frontmatter may name another model, and the explicit `model` overrides it. Never spawn a `fork`, because it can't take a model override.
- **You own the plan, the order and the commits.** Agents write code and report. You read their diff, run the gate yourself (`pnpm test`, `pnpm lint`, `npx tsc --noEmit`), commit one step at a time on `claude/ipad-landscape-ui-improvements-a7tjk9`, and push at the end with `git push -u origin <branch>` (retry with backoff only on network errors). Open no PR unless the user asks.
- **Split the work into these implementer agents.** Each brief names the plan's part and section, the files it owns, and the done gate. Run them in parallel only where their files don't overlap:
  - **A: Parts 1 and 2.** Owns `hand-scrub.ts`, `scrub-pose.ts`, `hand-scrub.native.tsx`, `hand-gestures.native.ts`, `src/ui/motion-tokens.ts`, `card-preview.tsx` and their tests. Can run alongside B.
  - **B: Part 3.** Owns `setting-rows.tsx`, `segmented.tsx`, `chrome-buttons.tsx`, `settings/view.tsx`, `reading-panels.tsx` and `table-layers.tsx`.
  - **C: Part 4a.** The pure modules, hooks, primitives, `SheetModal`, the rail and the start-panel fix. Starts after B merges, because both touch `chrome-buttons.tsx`/chrome. Every later agent builds on it.
  - **D, E and F: Part 4b, in parallel after C**, with disjoint files:
    - **D:** the reading-column screens, Settings, Campaigns and Scenarios.
    - **E:** the grids (pool, Decks) and the Card screen.
    - **F:** Rules list-detail, Briefing, Path, Resolution and Outcome.
  - **G: the Deck editor list-detail.** Runs after E, because it splits `card-pool.tsx`.
  - **H: the orientation switch and the docs.** Runs last.
  - Use `isolation: "worktree"` for agents running in parallel, then merge their branches into the working branch yourself.
- **What every brief carries:**
  - The rules in `CLAUDE.md` and `.cursor/rules/authority.mdc`, and the import boundary: `src/play` never imports `src/screens`.
  - "Phones (compact width) must render exactly as before."
  - "Read the design-system section for each screen you touch before you change it, and update it in the same change."
  - "Hand-written sizes multiply by `useUiScale()`, and colors come from tokens: no new hex."
  - The step's gate.
  - "Do not commit, push or open a PR. Report the files changed, the gate output, and anything left undone."
- **After each implementer reports green:**
  1. Run `reviewer` (Sonnet) on that step's diff.
  2. Run `ux` (Sonnet) too, whenever `src/screens` or `src/play` changed (every step here).
  3. Send their blocks and changes back to the same implementer through SendMessage. Don't start a fresh agent for the fix.
  4. Re-run the gate.
  5. Then commit.
- **Screenshots** (Verification) are done by one `general-purpose` Sonnet agent, briefed with the viewports, screens and checks below. It saves shots to `.agent/` and reports what it found. You look at the shots before you sign off.
- **Phone and tablet checks** can't run in a cloud session. Record them as Open in `docs/phases/STATUS.md`; never mark them done.
- **Scope.** If an agent proposes something the plan doesn't cover, such as the Android `appCategory` plugin, moving pushed routes under the tabs, or a Packs list-detail, don't do it. Record it in STATUS as a follow-up and mention it to the user.

## Notes for implementing agents
- **Before you start,** read this plan's part for your step, `docs/design-system.md` (Standards, and the section of each screen you touch), and `docs/architecture.md`, since it decides how code is split.
- **Keep math pure and tested.** Breakpoint, column, fan and pane math goes in pure `.ts` modules with Vitest tests. Components only call them. The Vitest tests don't render React Native.
- **Don't break the phone.** Gate each new layout on `sizeClass(...) !== "compact"` or `=== "expanded"`, and leave the compact tree untouched.
- **Never break test ids.** Keep every existing testID. New testIDs follow the screen's prefix. Check `.maestro/*.yaml` before you rename anything.
- **Reuse before you add:**
  - `Screen`, `ScreenScroll`, `ActionBar`, `NavBar`, `ListRow`, `Panel`, `Segmented`, `SettingSwitch`
  - `gridCardWidth`/`gridOffset` (`pool/grid.ts`)
  - `previewSize`/`previewSideSize` (`preview-size.ts`)
  - `touch()`/`useUiScale()` (`ui-scale.ts`)
  - `useTableTokens()`
- **Match the code around you:** the comment density (a short "why" header per function), the naming, and the reference to the design-system section.
- **Your gate** is `pnpm test`, `pnpm lint` and `npx tsc --noEmit`, all green. If you touch the table settings panel or the fan, run `pnpm vitest run src/play` as well.
- **Report back:** the files changed, the gate output, open questions, and anything you could not verify without a device.

## Verification
- **Gate:** `pnpm test`, `pnpm lint`, `npx tsc --noEmit`, and `pnpm data:check` (which should be untouched).
- **Web:** run `npx expo export -p web` and serve `dist` with COOP `same-origin` and COEP `credentialless`. Check `crossOriginIsolated` is true, since expo-sqlite needs it. Then take shots with the preinstalled Playwright (`chromium.launch()`; install nothing).
  - Viewports:
    - 1194×834 and 1366×1024 (expanded, with the rail)
    - 834×1194 (medium, with the dock)
    - 1024×1366
    - 390×844 (must match the baseline)
    - 844×390 (Card and Glossary)
  - Small and Large at 1194×834. Dark and Light once each.
  - Screens:
    - Campaigns: with no saves, and after Start.
    - Scenarios and the standalone briefing.
    - Decks: Cards and List.
    - Cards: grid, list, and the open filter sheet.
    - The deck editor on a starter deck: a + on the right updates the left.
    - Rules: none selected, one selected, and See also.
    - Glossary, Settings, History, Packs, Pack, Card, Deck import, Path, Log.
  - Checks:
    - No horizontal scroll.
    - No text column wider than 640.
    - The primary sits at the trailing edge in expanded.
    - Rail items are 44 pt or more.
- **Harness:** Resolution, Outcome, the table settings panel, the fanned scrub and the preview need a temporary harness page, as phases 19–26 used. It is not committed, and its shots go to `.agent/`.
- **Open phone and tablet checks**, recorded in STATUS:
  - iPad rotation on the tabs, the deck editor and the briefing.
  - Modals in landscape.
  - The rail.
  - An Android tablet table (the portrait guard).
  - A foldable.
  - The booklet re-laying out on rotation.
  - A fling through the 9-column pool.
  - The 150 ms hold against a drag, and the fan's feel on a phone.
