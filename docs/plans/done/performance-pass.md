# Performance pass: snappy taps, animations and screens (user request, 2026-10-29)

## Context
The user asked for a performance analysis and fixes: needless re-renders, memoization problems, memory leaks, and anything that
makes a tap or an animation feel slow. Three read-only audits and a React Compiler run (in memory, `target: "19"`) over `src`
found these:

- **The React Compiler is on (`app.json` `experiments.reactCompiler`) but skips the hottest code.** A skipped component gets no
  automatic memoization: `Table` (the canvas root), `useTableChoice`, `TableLayers`, `useCardMotion`, `useSpotlight`, `useGuide`
  and `useAutoAnswer`, `DockButtons`, `Outlined`, `ArcRing`, `Spotlight`/`ClashView`, `Neighbor` (phase-rail), `CampaignList`,
  the briefing, `deck-import`, `_layout`, `PopoverFrame`, `CountStepper` and `JourneyBar`. The causes are
  `eslint-disable react-hooks/exhaustive-deps`, memos whose dependency lists the compiler cannot keep, `try/catch` around
  conditionals, default parameters such as `color = t.bone`, and computed object keys. The compiler also skips any component
  whose effect depends on an object that is rebuilt every render, so the problem spreads from one bailout to the next.
- **Every tap does slow work before the screen updates.** The engine runs `reduce`, which calls `constantInstructions`
  (filter plus sort, no cache) many times inside `settle`; deep-copies the whole state at each phase boundary for `state.undo`;
  then writes the whole save row synchronously (log, pool, every intent, each through `JSON.parse(JSON.stringify)`, then
  drizzle stringifies again). The haptic fires only after all of that.
- **The Skia canvas re-records its whole scene on every React commit** (Skia 2.14). The canvas commits again on card pickup
  (`selected`), on each scrub step, on each banner beat, on each finished picture decode (one `setImages` per picture), and on
  every whole-`game` or whole-`settings` subscription in `TableView`.
- **Some screens do heavy work on open.** The table replays the whole game inside `useMemo` during its first render, and
  Resolution replays it again. The card pool re-queries and re-parses about 850 cards on every mount. Route modules zod-parse
  large JSON files at startup. No navigator sets `freezeOnBlur`, so screens underneath keep re-rendering.
- **No real memory leaks.** Every timer, listener and subscription is cleaned up. The caches are bounded or use `WeakMap`.
  Leftovers to tidy: the arm-bar and sweep animations are not cancelled on unmount, and about 20 separate AccessibilityInfo
  listeners are opened per table.

The user chose all three groups (React, engine, screens) and a **leaner synchronous save** (still written on every intent,
so a crash loses nothing).

Rules that hold throughout: `src/screens` imports nothing from `src/rules`. Code and comments follow the house style (dense
`//` comments that say what, sentence case, citing docs or rule ids). `docs/architecture.md` is updated wherever the change
touches what it says (Performance, State, Persistence).

---

## 1. Guard: no compiler bailouts (do first)
- New `src/play/compiler.test.ts`, or `scripts/compiler-coverage.test.ts` if that matches the existing pattern better. It
  runs `@babel/core` + `babel-plugin-react-compiler` with a `logger` over every non-test `.tsx` and `use-*.ts` file in
  `src/play` and `src/screens`, and fails on any `CompileError` event, listing file:line and the reason. This is the same
  check used for the audit.
- Add `@babel/core` and `babel-plugin-react-compiler` to `devDependencies` if they are not declared, pinned to the installed
  versions.

## 2. Make the compiler compile the hot code (src/play, src/screens)
- Replace each "run only when X changes" eslint-disable with `useEffectEvent` (React 19.3): the effect keeps an honest
  dependency list, and the values it reads but must not react to go through the effect event.
  - `table-canvas.native.tsx:100`: the handoff `setState`, where `images` is read through an effect event.
  - `card-motion.native.tsx:139`: `scaled`, `fxScaled` and `k` are read in an effect event.
  - `use-spotlight.ts:95`
  - `table-layers.tsx:108`
  - `table-hooks.ts:106` and `:161`
  - `routes/(tabs)/index.tsx:128`: first wrap the return value of `useFolds` (`fold-section.tsx:140-156`) in a stable value,
    then remove the disable.
  - `hand-gestures.native.ts:77`: pass `canvas` as a value made from its three numbers.
  - `arc-ring.native.tsx:24`: depend on the `shape` key and let the compiler handle the rest.
  - `table-images.native.ts:114`
  - `rules-view.tsx:93`
- **Before `Table` is compiled:** `info(slot.id)` reads `store.getState()` during render, and fresh numbers are forced today
  only by `void modifiers; void threat; void delayed` (`table-canvas.native.tsx:180-182`). Change `info`/`slotNumbers` to take
  the game, or a numbers map built in a memo from `game` and `seat` (see 4.1), so the compiler sees the real dependency.
  Check the other compiled pieces for the same pattern.
- `use-table-choice.ts:136-139`: remove the hand-written `dock` `useMemo`, or make its dependencies exact. Once the hook is
  compiled, `fold`, `extras`, `header` and the returned object stay stable, which stops the BackHandler re-subscribing in
  `table-view.tsx:202-226`, keeps `dockPills` stable, and stops `TableDock`, `DockButtons`, `TableLayers` and `ChoiceTray`
  re-rendering.
- Smaller fixes:
  - `canvas-pieces.native.tsx:60` `Outlined`: `color?: string`, then `color ?? t.bone` in the body.
  - `dock-buttons.tsx:133`: move the ternary in the `||` chain into a `const`.
  - `phase-rail.tsx:64`: replace the computed key with two plain style objects.
  - `spotlight.native.tsx:57/87/164`: memos the compiler cannot keep, and the method call that triggers the codegen error.
  - `popover-frame.tsx:103`, `routes/_layout.tsx:42`, `briefing/[saveId]/[scenarioId].tsx:123` (`onDeal`),
    `routes/deck-import.tsx:47/94`: move each `try/catch` (or `try/finally`) into a module-level helper.
  - `count-stepper.tsx:20` and `chrome-marks.tsx:149`: move default parameters into the body.

## 3. Table: fewer canvas commits per interaction (src/play, table-view)
1. **Card pickup**
   - `table-view.tsx:97`: drop the `selected` subscription. Prefetch the picture from a `store.subscribe` inside an effect.
   - `hand-gestures.native.ts:79-88`: sync the shared values in `useLayoutEffect`, so a fast flick already has drop targets.
   - Keep the lifted-card render as it is unless a UI-thread lift is simple to add. Measure first.
2. **Whole-object subscriptions** → narrow selectors that return primitives or stable values:
   - `phase-sweep.tsx:21`: only `phase` and `round`.
   - `use-peek.ts:36`
   - `use-quest-advance.ts:24`
   - `table-layers.tsx:96`
   - `settings` at `table-view.tsx:109` and `use-table-choice.ts:109`: select the fields each one uses.
   - `TableView` keeps `game`, but `widgets`, `tokens` and `held` (`:241-243`) become memoized derived values.
   - Build `phaseCarousel` (`:144`) only while the carousel is open; read `stopAhead` cheaply.
3. **Selectors that allocate on every `set`**
   - `selectors.ts:166-206`: return the previous result straight away when `game` (and `seat`) are the same objects.
   - `table-view.tsx:96` `threatSelector`: same check.
   - `table-view.tsx:234-239` `tickKey`: same check.
4. **Picture decodes** (`table-images.native.ts:44-110`)
   - Batch `publish` into one `setImages` per frame, using `requestAnimationFrame`.
   - Decode one picture per idle slot, nearest or visible cards first, so a draw does not stall the next frame.
   - Spotlight (`use-spotlight-images.native.ts`): start the stage-size decodes when `game.pendingAttack` appears, not when
     the spotlight starts.
5. **Banner beat and scrub**
   - `useBanner`'s `beatKey` (`table-hooks.ts:73`): move it into a small store that only `Table` reads, so a beat re-renders
     the canvas and not the whole `TableView`.
   - `hand-scrub.native.tsx:48`: only the pieces whose "under" state changed should re-render. Keep each piece's element
     stable with a memoized child keyed by slot id.
6. **Haptics**
   - `use-table-choice.ts:164-166`: call `tickSent()` before `store.dispatch`.
   - `card-motion.native.tsx:137`: replace the landing `setTimeout` with a `useAnimatedReaction` on `progress` crossing the
     landing fraction (the same pattern as `use-spotlight.ts:102-110`) plus `scheduleOnRN(tickLand)`.
7. **Smaller items**
   - `useImageSnapshot` (`table-view.tsx:92`): hand the revision only to the canvas and the preview, and fix the preview's
     missing `images.revision` dependency (`:257-264`).
   - Icon paths (`canvas-pieces.native.tsx:54`): parse each glyph once into a module `Map<IconName, SkPath>` instead of
     passing the SVG string on every re-record.
   - One module-level AccessibilityInfo store (reduce motion and screen reader) read through `useSyncExternalStore` by
     `useReduceMotion`, `useScreenReader` and `useMotionScale` (`motion-run.ts:53-71`, `screen-reader.ts`), instead of one
     listener per hook call.
   - Cancel the animations on unmount: `dock-buttons.tsx:80` and `phase-sweep.tsx:39-43` (`cancelAnimation`).
   - Load each table font and icon once, shared by the canvas and the spotlight layer
     (`table-fonts.native.ts`, `token-fx.native.tsx:104`, `spotlight-layer.native.tsx:32-36`).

## 4. Engine hot path (src/rules; golden games must stay identical)
1. **`constantInstructions`** (`constant-records.ts:20-23`): cache the result in a `WeakMap<ScenarioState, …>`. The state is
   immutable, so the same state always gives the same result. Do the same for `restricted()` (`restrictions.ts:16-28`),
   keyed by state and code. `syncConstants` (`constants.ts:116-122`): compare old and new modifiers field by field instead of
   comparing two `JSON.stringify` strings. Also cache `slotNumbers`/`cardEffects` per `(game, seat)` → `Map<cardId, numbers>`
   (`src/play/card-effects.ts:184-198`, the same pattern as `foresight.ts:90`).
2. **Effects by id**: add an `effectById(effects, id)` WeakMap index next to `effectsOf` (`rules/listen.ts:12-23`), and use it
   in `responses.ts:91/98/131/140`, `constants.ts:129`, `sheets.ts:30/81/331`, `objective.ts:31/40`, `stops.ts:88`,
   `table-hooks.ts:36`, `use-table-choice.ts:135` and `table-view.tsx:146`. The `src/play` callers import it from
   `src/effects` or `src/rules` according to the lint zones.
3. **`state.undo` snapshot** (`undo.ts:31-41`, `setup.ts:117-121`): the snapshot stays, because `docs/brief.md:268` requires
   one at each phase boundary. It stops being a deep copy: the state is immutable, so the snapshot keeps the reference
   `{ ...after, undo: <empty> }` and `cards: after.cards` instead of calling `cloneGame` and `structuredClone`.
   - First, confirm nothing mutates state in place: grep `src/rules` for assignments to state fields, and run
     `undo.test.ts`, `hide.test.ts` and the goldens.
   - Update the `state.undo` sentence in `docs/architecture.md:139`.
4. **`updateCard`** (`state.ts:528`): add `updateCards(state, patches)`, which copies the card map once for several cards.
   Use it where a loop or a single move changes several cards (`zones.ts:224-248` `moveCard`, ready/refresh). The output
   must stay the same.

## 5. Saving: leaner synchronous write
- `campaign-store.ts:12-14` `stored()`: remove the `JSON.parse(JSON.stringify)` round trip, since drizzle's json columns
  already serialize. Return the value cast to `StoredJson`. Check `standalone-store.ts:44-57` too.
- New `writeActive(user, save)` / `writeStandaloneActive`: `update saves set active_scenario = ?, updated_at = ? where id = ?`.
  `sessionStore`'s commit and undo (`table-session.ts:76-86`) and `standalone-session.ts:66-75, 113-121` call it.
  `writeSave` stays for log and loadout changes (a lost game, Resolution, setup).
- `replay.ts:25` `recordIntent`: keep the array copy (it is O(n) and cheap). The cost was the serializing, not the copy.
- List screens: `listSaves` and `listArchivedSaves` (`campaign-store.ts:43-56`) and the standalone list select the columns
  they need and skip `parseActive` on every intent. Check what the list rows read: `nextStep` needs `active != null` plus the
  log. `scenarios.tsx:52-57` reads `listStandalone` once per focus, not twice.

## 6. Screens: opening, the background, startup
1. **Table open** (`table-session.ts:57-59`, `standalone-session.ts:102`): open the session in an effect after the first
   paint (`startTransition` or `InteractionManager.runAfterInteractions`) and show the existing table placeholder or loading
   state until then. Keep the opened session in a module cache keyed by save id and intent count, so Resolution
   (`routes/resolution/[saveId].tsx:269-273`) reuses the replay instead of running it again.
2. **`recordUnclosedRun`** (`table-session.ts:96-106`, called from `(tabs)/index.tsx:170` and `briefing…:129`): this one
   stays a replay because it needs the outcome. Defer it out of the tap handler, after the navigation or the toast.
3. **`freezeOnBlur: true`** in `screenOptions` for both navigators (`routes/_layout.tsx:166`, `(tabs)/_layout.tsx:20`).
   Confirm the toast, the image queue and the deck-draft flow still update when a screen comes back into focus. Freezing only
   defers renders; it does not drop them.
4. **Deck draft**: give `useDeckDraft` a selector, so the pool and grid listen only to `heroes` and `cards`, not to `name`.
   `deck/[id].tsx:257`: replace the inline `renderItem`'s dependency on `draft` with `cards` and `heroes`, and wrap
   `DeckCardCell` (`deck-grid.tsx:64`) in `memo`, with the refused-card set computed once.
5. **Card pool cache** (`card-pool.tsx:199-240`, `routes/deck-import.tsx:53-73`): a module-level cache, a `WeakMap` keyed by
   the catalog db, of the sorted pool rows and `notAppliedCodes`, shared by the Cards tab, `/pool`, the deck pane and import.
   Sort with precomputed keys.
6. **Startup parsing**: make module-level parses lazy (on first call, memoized):
   - `rules-glossary.ts:62/78`: parse once, and precompute each entry's sort key and the folded search fields, so
     `rankOf`/`seeAlso` do not fold again. `rules-view.tsx:80`: run the search on `useDeferredValue(query)`.
   - `deck-import.ts:131` and `routes/deck-import.tsx:24-26`
   - `campaign-data.ts:21-33`, and `starter-decks.ts:41` reuses that parse.
7. **Toast and list height** (`card-pool.tsx:426`, `deck/[id].tsx:335-340`): position the toast absolutely, so it does not
   resize the FlashList twice per +/− tap.
8. **Backdrop** (`backdrop.native.tsx:90-125`): render each `(theme, scene, width, height)` once into an `SkImage` (Skia
   `drawAsImage` of the same element tree, cached at module level and released on theme or size change). Each `Screen`
   draws that image, so a push no longer re-runs FractalNoise and grit. Same for `FogVeil` (`art.tsx:266`). This keeps the
   design-system rule of one static canvas behind each screen.
9. **Briefing and tab bar**:
   - Briefing (`briefing/[saveId]/[scenarioId].tsx:56-60`, `standalone/briefing/[scenarioId].tsx:53-56`): `loadWorld`
     depends on what the world is built from (scenario, seat count, deck ids), not on the `seats`/`savedDecks` arrays.
   - `tab-bar.tsx:84-100`: recompute the badges only when a deck-store revision counter changes.
10. **Images** (`images/queue.native.ts:309`): read only the header bytes for the format sniff, and use `file.size`.

## Out of scope (noted, not done)
These are small wins with risk to the design or behaviour:
- Replacing the per-card glow `BlurMask` with a pre-rendered glow (`card-marks.native.tsx:25-27`).
- An `ArcRing` built from Views instead of one canvas per dial.
- Particle buffer reuse.
- A UI-thread lift for the dragged card.

Revisit these after on-device profiling.

---

## Order and commits
One commit per section, in the order 1 → 2 → 4 → 5 → 3 → 6, so the compiler guard and the engine work land first and each
commit stays green. Develop on branch `ccr-2163deb4-z1kz0c` and push there with `git push -u origin ccr-2163deb4-z1kz0c`.
After the work, run the `reviewer` agent on the diff, and the `ux` agent because `src/play` and `src/screens` change.

## Verification
- `pnpm test`, `pnpm lint` and `npx tsc --noEmit` after every section. Engine changes must leave every `golden*.test.ts`,
  `full-game.test.ts`, `undo.test.ts`, `hide.test.ts` and `replay.test.ts` unchanged.
- The new compiler test passes with zero bailouts in `src/play` and `src/screens`.
- A timing script in the scratchpad (not committed): replay each golden game through `reduce` and time the total, before
  and after section 4, and time `writeSave` against `writeActive` on a 500-intent save with better-sqlite3. Report the
  numbers.
- `node --experimental-strip-types scripts/card-smoke.ts --all` passes, so no throw, refusal or stall comes from the engine
  changes.
- `pnpm data:check` passes; nothing under `data/` should change.
- This cloud session has no phone, simulator or Maestro, so on-device feel (React DevTools Profiler, Perf Monitor, frame
  timing on card pickup, scrub, the spotlight and table open) stays open. Say so in the final report.
