# Lighter table on weaker phones: card picture quality, a fog switch, per-card redraws (user request, 2026-10-31)

## Context

On a crowded table, a weaker phone struggles. Reading the code turned up three costs:

1. **Picture memory.** The table keeps a decoded copy of each face-up card at its on-screen size × the phone's pixel ratio (`src/play/table-images.native.ts`, `coverPixels` in `src/play/table-pictures.ts`). A hand card is kept at the scrub's lifted size (`HAND_PICTURE_SCALE` ≈ 2.3), so the hand takes about half of this memory.
2. **The drifting fog.** Behind the transparent table canvas, the `table` scene's backdrop (`src/screens/backdrop.native.tsx`) redraws the whole screen about 30 times a second in Dark theme for as long as the screen is open. Only Reduce motion stops it today.
3. **Every card redrawn on every change.** Any canvas render (a game step, a card picked up, new targets, a banner beat) rebuilds the drawing of every card (`table-canvas.native.tsx`, `piece`). That covers each card's body, its marks and its overlay of badges, tokens and pills, about 45 cards on a crowded table, though usually only one or two changed.

The changes:

- A **Card pictures** setting (High, the default, or Low). Low decodes the table's and the hand's pictures at half the pixel ratio, never below 1×; the combat spotlight stays at full resolution.
- A **Moving fog** switch.
- Caching each card's drawing so cards that did not change are skipped.

The long-press preview and the Card screen use `expo-image`, not this pipeline, so they stay as they are.


---

## A. Card pictures (High / Low)

1. **Setting**, `src/play/table-settings.ts`:
   - Add `CARD_QUALITY_OPTIONS = ["high", "low"] as const` and `CardQualityOption`.
   - Add `cardQuality` to `TableSettings`, defaulting to `"high"`.
   - Parse it in `parseSettings` the way `uiScale` and `theme` are parsed, so old saves load as High.
   - `restoreDefaults` and the JSON row in `settings-store.ts` cover it, so no migration is needed.
2. **Ratio**, `src/play/table-pictures.ts`:
   - Add `pictureRatio(device, quality)`: the device ratio on High, `Math.max(1, device / 2)` on Low.
3. **Decode**, `src/play/table-images.native.ts`:
   - Add a last parameter: `useTableImages(boxes, picture, revision, ratio?)`. When it is absent, use `PixelRatio.get()` in the body; code-standards rule out a non-literal default.
   - Turn the boxes into pixel boxes (× ratio) before `Pictures.want`. `atSize` then calls `coverPixels(..., 1)`.
   - `Pictures` gets the ratio in `want()`:
     - The key (`boxesKey`) rounds the boxes in points and holds the ratio, so `want()` runs when the setting changes.
     - `redecode()` compares pixels with a slack of half a point (`SLACK * ratio`). Going from High to Low, a copy is 4× the area it needs (over its 2× limit), so it shrinks. Going from Low to High, it is too small, so it grows. The old copy is drawn until the new one is ready.
     - A code whose copy fits its box drops the decode queued for it, so a quick High, Low, High does not decode every card again.
   - The spotlight (`use-spotlight-images.native.ts`) keeps the default ratio.
4. **Wire it**, `src/play/table-canvas.native.tsx`:
   - Subscribe narrowly: `useStore(tableSettings, (s) => s.settings.cardQuality)`.
   - Pass `pictureRatio(PixelRatio.get(), quality)` to `useTableImages`.

## B. Moving fog switch

1. **Setting**, `table-settings.ts`:
   - Add `fogDrift: boolean`, default `true`, parsed with `flag()`.
2. **Use it**, `src/screens/backdrop-drift.ts`:
   - `useDriftRunning()` returns `focused && !reduceMotion && fogDrift`, reading `fogDrift` through a narrow `useStore` selector.
   - Both backdrops (`backdrop.native.tsx` and the web `backdrop.tsx`) and `HeroArt`'s fog already go through this hook. With the switch off, every screen's fog holds still: the canvas is drawn once and no frame callback runs.

## A + B. Settings UI

- **Words**, `src/play/settings-words.ts`:
  - `QUALITY_WORDS = { high: "High", low: "Low" }`.
  - `QUALITY_LINE = "Low draws the table's cards a little softer, easing a slow phone."`
  - `FOG_LINE = "Off holds the fog still, easing a slow phone."`; when the Light theme or Reduce motion already holds the fog still, the row is dimmed and says so (`fogLine`).
- **Rows**, `src/play/setting-rows.tsx`:
  - In **Display**, after Strong outlines: a `SettingChoice` titled "Card pictures", with a stretched `Segmented` (`id("quality")`).
  - In **Motion and feel**, after Reduce motion: a `SettingSwitch` labelled "Moving fog" (`id("fog")`).
  - The Settings screen and the table's settings panel both draw `SettingsRows`, so both show the new rows, and a change applies during a game.

## C. Skip redrawing cards that did not change

On every canvas render, `piece()` rebuilds the body, marks and overlay for every slot. The rebuilt elements are always new objects, so nothing below the canvas can skip work. The React Compiler can't memoize per item inside a `.map`. A canvas still records its whole scene on each commit (code-standards). What this saves is the JS-thread cost of building and reconciling about 45 cards' nodes, along with their badge, token and pill subtrees.

1. **Pure props and equality**, new file `src/play/table-piece.ts`:
   - `PieceProps` holds everything one card's drawing reads, as primitives or stable references:
     - The card: `slot`, `motion`, `clock`, `flip`, `image`, `name`, `sphere`, `encounterBack`.
     - Highlight and marks: `dim`, `glow` (picked, tappable), the frame flags (tappable, picked, dimmed, beat, veiledHand) and `veiled`.
     - Overlay: `info` (`SlotNumbers | null`), `optionMark`, `inactive`, `owner`, `share`, `contrast`.
     - Shared: `fonts`, `backs`, `tokens`, `t`, `s`.
   - `pieceProps(slot, ctx)` builds them from the canvas's per-render context (highlight, targets, beats, images, game and seat). The `isTappable`, `pickedCount`, `dimmed` and `veiledByLook` logic moves here unchanged.
   - `samePiece(a, b)` compares every field shallowly, except:
     - `slot` is compared with `sameSlot`, field by field over `CardSlot`'s primitive fields. Layout makes new slot objects whenever `keep` changes, such as on a pickup.
     - `info` is compared with `sameNumbers`, a structural compare. `slotNumbers` is cached per game state, so it is a new object on every step.
     - `clock` is ignored when both motions are `still()`, since `Moving` draws a still card without the clock.
2. **Component**, new file `src/play/table-piece.native.tsx`:
   - `TablePiece = memo(Piece, samePiece)` renders `Moving` with the body, frame, overlay and the flip's `back`.
   - `drawBody`, `drawFrame` and `drawOverlay` move here from `table-canvas.native.tsx`, which shrinks that file.
   - `HandScrub` takes a `piece` callback; it receives the same `TablePiece` render.
   - The leaving ghosts (`Leaving`) and the lifted-card overlay stay where they are, since there are only a few of them.
3. **Stable shared props**, in the canvas:
   - The `tokens` and `backs` objects must keep their identity between renders. Check that the compiler memoizes them, since `useSharedImage` returns stable images. If it doesn't, build each object in a small hook.
   - `src/play/compiler.test.ts` must stay at zero bailouts (no `try`, no non-literal defaults, no store reads in render).
4. **Out of scope**: the per-step recompute of `slotNumbers` for every card (`card-effects.ts`) stays. With `sameNumbers`, unchanged cards still skip their redraw.

---

## Tests

- `src/play/table-pictures.test.ts`:
  - `pictureRatio`: 3→1.5, 2→1 and 1→1 on Low; unchanged on High.
  - On a full table on a 3× phone, Low weighs at most about ¼ of High, under about 4.5 MB, using `pictureBytes` like the existing 16 MB check.
- The `parseSettings` test (wherever it lives today, e.g. `settings-store.test.ts`):
  - A missing or invalid `cardQuality` becomes `"high"`, and a missing `fogDrift` becomes `true`.
  - `"low"` and `false` round-trip.
- `src/play/settings-words.test.ts`: `QUALITY_WORDS` has a word for every option in `CARD_QUALITY_OPTIONS`.
- New `src/play/table-piece.test.ts`, on the `crowdedTable()` fixture laid out with `tableLayout`:
  - Picking up one card: `samePiece` is false only for that card, true for the rest.
  - A damage token on one card: only that card differs.
  - A new clock with still motions: equal. A moving card: differs.
  - A new `slotNumbers` object with the same contents: equal.

## Docs (current state only, per `docs-standards.mdc`)

- `docs/architecture.md`:
  - Images: copies are kept at the Card pictures ratio. The spotlight, the preview and the Card screen are not affected.
  - Performance: each card's drawing is a memoized `TablePiece`, and only changed cards are rebuilt.
- `docs/design-system.md`:
  - Settings, Display line: add Card pictures (High, Low) and Moving fog.
  - Backdrops: the fog holds still when Moving fog is off.
- `docs/brief.md`: add both settings to the Settings row (Screens) and to the `settings` table description (Persistence and shipping).
- Run `pnpm docs:index` and confirm the index test passes.

## Verification

- Run the touched tests, then the full `pnpm test`, `pnpm lint` (import boundaries) and the compiler test (zero bailouts).
- These phone checks can't be done in a cloud session and stay open:
  - With Low on a full table, cards are slightly soft, and the preview and Card screen stay sharp.
  - With Moving fog off, the backdrop holds still.
  - Picking up a card or a game step feels smoother on a slow phone.
- After the implementers, run `reviewer` and then `ux` (`src/play` and `src/screens` change).
