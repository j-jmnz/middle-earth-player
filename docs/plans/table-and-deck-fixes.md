# Plan: table and deck fixes

## Context

The user sent six changes from playing the app: one about deck import, four about the game table, and one about the deck screens. Each section below is a separate commit. The work runs through `orchestrator`: Sonnet implementers, then one review round with `reviewer` (all sections) and `ux` (sections 2–5 touch `src/play` and `src/screens`). User decisions (2026-11-05):
- RingsDB: accept personal deck links (`/deck/view/<id>`) as well as decklists.
- Earlier stages: shown in the current stage's large preview, by swipe or the strip. Nothing new is drawn on the table.
- Readiness: remove the dot and the words "Ready to play" from every deck row and cover, and remove the Decks tab badge.

Every code change follows `.cursor/rules/code-standards.mdc`, with the React Compiler kept at zero bailouts. Each visible change updates `docs/design-system.md` or `docs/design-system-table.md`, and the brief where it states the behavior, following `docs-standards.mdc`. Run `pnpm docs:index` after any heading change.

## 1. RingsDB deck links

Today `parseDecklistRef` (`src/screens/deck/import.ts`) takes a bare id, `/decklist/view/<id>[/<slug>]` and `/api/public/decklist/<id>.json`. A test asserts that `/deck/view/<id>` returns null.

- Change `parseDecklistRef` to return `{ kind: "decklist" | "deck"; id } | null`.
  - It also accepts `/deck/view/<id>[/<slug>]` and `/api/public/deck/<id>.json`.
  - A bare id stays a decklist.
- Replace `decklistUrl` with `ringsDbUrl(ref)`. For a deck it is `https://ringsdb.com/api/public/deck/<id>.json`.
  - That payload has the same `name`, `heroes` and `slots` shape, so `readDecklistBody` and `buildDecklist` do not change. Confirm the shape with one live fetch during implementation.
- `src/screens/routes/deck-import.tsx` `onImport` uses the ref.
  - The invalid-input message becomes "That is not a RingsDB deck or decklist."
  - A failed fetch of a `deck` ref says the deck may be private: "RingsDB did not return that deck. Make it public in its RingsDB sharing settings."
- Tests in `import.test.ts`:
  - Flip the `/deck/view` case and add cases for both deck URL shapes.
  - Keep `/api/public/decklist/4821` with no `.json` rejected.
- Docs: `docs/brief.md` (Deckbuilding, the Import paragraph) and the input placeholder text, if it says "decklist".

## 2. Hide the quest meter once the quest has resolved

Cause: after `resolveQuest` the dock's quest readout is null, so `questScaleOf` (`src/play/readouts/quest-scale.ts`) falls back to the engine. It reports `live: game.phase === "Quest"`. Committed willpower is cleared by then, so window 3.4 shows a false "−N Short".

- Set `live: game.phase === "Quest" && !game.questResolved` (`state-types.ts`, `questResolved`).
- The head and `meterShown` in `src/screens/table/view.tsx` already follow `scale.live`, and the dock takes the numbers back by itself.
- Tests in `quest-scale.test.ts`:
  - `live` is false with `questResolved: true` in the Quest phase.
  - `live` stays true in `questCommit` and `staging`.
- Docs: `docs/design-system-table.md`, Quest scale: "drawn in the Quest phase until the quest resolves".

## 3. Earlier quest stages in the stage's preview

There is no stage-history field. A defeated stage keeps its instance and moves to `setAside`, or to `victory` in the sea games (`advanceStage`, `src/rules/quest/quest.ts`). Derive the history on the UI side; the engine and goldens do not change.

- New pure helper `earlierStages(game): string[]` (card ids, oldest first), in `src/play/cards/` beside `table-preview.ts`. Once stages are separate it reads the viewed seat's game (`viewOf`).
  - The order comes from `game.stagesReached` when it is set (branching quests). Otherwise it is `game.stages` before the current stage's code.
  - Each code maps to its quest-type instance in `setAside` or `victory`. A code with no instance is skipped.
- `previewCards` (`table-preview.ts`): when `cardId` is the quest stage, add `earlierStages` after the stage's own related cards (its side B and attachments).
  - Each earlier stage's `role` reads "Earlier stage" and its title reads its stage number ("Stage 1B"). Its picture is its B side through `pictureKey`.
- `CardPreview` (`src/play/cards/card-preview.tsx`) already walks `[card, ...related]` with `at`/`setAt` and a strip of chips.
  - Add a horizontal swipe on the shown card (react-native-gesture-handler `Gesture.Pan`, horizontal only, failing on a vertical move so it does not fight the close gesture). A swipe steps `at` by one, clamped.
  - This applies to every preview with related cards.
  - The strip's chips stay the accessible path, and the swipe gives the screen reader a hint.
- Tests:
  - `earlierStages` for a linear quest, a branching quest (`stagesReached`), a sea game (victory) and separate stages.
  - `previewCards` lists the earlier stages after side B with the role.
  - The swipe helper's step and clamp as a pure function.
- Docs:
  - `docs/design-system-table.md`, Cards (the card shown large): the earlier stages and the swipe.
  - `docs/brief.md`, if it lists what the stage preview shows.

## 4. Crowded staging and engagement rows use the command column's free room

Today the canvas and the command column (`testID="command"`, `commandWidthOf`: 30% of the width, 210–280 pt) are side by side in `src/screens/table/view.tsx`. A row that is too wide squeezes, then folds into the "+n" stack (`src/play/layout/row-fold.ts`, `placeRow`/`placeEngaged` in `src/play/layout/layout.ts`). The column's top is usually empty: the head only stands above the dock, and after section 2 it is gone once the quest resolves.

- Make the canvas full width and lay the command column over its right edge.
  - The column is absolute on the right with `pointerEvents="box-none"`, so taps on its empty top reach the canvas. The dock and head keep their own touches.
  - Keep `canvasX`, the spotlight `stageArea` and the hand strip as they are measured now. The hand and play area stay left of the column.
- Layout input `reach: 0 | 1 | 2`: how many top rows (staging, then engaged) lie wholly above the column's occupied part.
  - The occupied part is the dock, the head when it shows, `HEAD_GAP`, and a small margin. It comes from `columnHeight`, `dockHeight` and the head's height in `view.tsx`.
  - Reduce it to the 0/1/2 count before it reaches the layout, so a dock that grows or shrinks by a few points does not re-lay the table or re-record the Skia scene. Only crossing a row boundary does.
- In `layout.ts`, the row width for a row the reach covers is the normal width plus the column's width less a gap.
  - The extra width is used only when the row would otherwise squeeze below its natural spacing or fold. An uncrowded row keeps exactly today's positions, so goldens and the crowded-table baseline only move for crowded rows.
  - The staging row's right-end piles (encounter deck, discard, victory) stay where they are now. The extension goes past them, so they never move under the dock. If that reads badly in review, move the piles to the extended end instead.
- When the dock grows into a row (the tray opens), that row loses the reach and squeezes or folds as today, with the existing slot motion. Raise this with the user in the ux review if it jumps too much.
- Keep `layout.ts` under 500 lines (`scripts/checks/file-size.test.ts`). The reach arithmetic can live in a new `src/play/layout/column-reach.ts`.
- Tests:
  - Layout tests: a crowded staging row with reach 1 folds fewer groups; an uncrowded row is unchanged with any reach; the engaged row needs reach 2.
  - A `column-reach` unit test for the boundary math.
  - Update `crowded-table.baseline.json` only where the reach applies, and say so in the commit.
- Docs: `docs/design-system-table.md` (Command column; Spacing and the play area's rows), `docs/architecture.md` if it describes the canvas/column split.

## 5. Board glow and dim while the choice is listed in the right column

Cause: `use-table-choice.ts` calls `highlightKeys({ ..., panel: panel && !(responses && onTheTable(...)) })`. With `panel` true, `highlightKeys` (`src/play/canvas/highlight-of.ts`) clears `glow`, `dim` and `marks`. A list that opens because one option is folded or off the table, or after List, Actions or Commit, leaves the board's own options unlit.

- Pass the open-tray state instead: glow, dim and marks follow `tappable(sheet)` whenever the sheet has options on the table, whether the tray is open or folded. Only a sheet with no option on the table keeps no glow. Keep `keep` as it is.
- Make taps agree with the glow. In `onTap`, extend `answers` from Response windows to any tappable card of the open sheet: `tappable(sheet).has(cardId)` with the tray open picks the card rather than folding the tray (`tapAction`, `src/play/choice/tray-logic.ts`). Taps on other cards still fold.
  - The pick goes through the same `pick` as a tray row, so the tray's selection and the board stay in step.
- With a screen reader the list stays the path (`reader`). The glow is harmless, so leave it on.
- Tests:
  - `table-choice.test.ts` "keeps the moment's cards on the table while the tray is open": glow and dim are now set. Rename the test to say so.
  - New cases: a pick with one folded option glows the rest and dims the others.
  - `tray-logic.test.ts`: a tap on a tappable card with the tray open picks; a tap on any other card folds.
- Docs: `docs/design-system-table.md` (Choice tray: the paragraph that promises the glow only for Responses).

## 6. Remove "Ready to play", the readiness dot and the Decks tab badge

- `Readiness` (`src/screens/art/hero-tile.tsx`) always behaves as `quietReady` does now: a ready deck shows nothing, and a deck that is not ready shows what it needs in danger, with no dot. Drop the `quietReady` prop and its uses:
  - `DeckSummary.quietReady`;
  - `pressProps`, whose label drops the status when the deck is ready, everywhere;
  - `src/screens/routes/(tabs)/decks.tsx`, `deck/[id].tsx` and `src/screens/briefing/seat-picker.tsx`.
- The picker still disables a deck that is not ready, and shows its reason and "Open in Decks".
- `deckReadiness` (`src/screens/deck/status.ts`) keeps `{ ready: true }` for logic. Its text for a ready deck is no longer drawn; keep it for the screen-reader label, or drop it if nothing reads it, and adjust `status.test.ts` and `seat-state.test.ts`.
- `src/screens/nav/tab-bar.tsx`: remove `Badge`, `useUnreadyDeck` and their render sites in the dock and the rail. If nothing else reads the deck revision (`src/screens/deck/revision.ts`), say so in the review; do not delete it blindly.
- Check the Maestro flows for `-status` testIDs or "Ready to play" text (`.maestro/features/deck.yaml`, the scenario flows) and update them. They are not run in a cloud session.
- Docs: `docs/design-system.md` (the `ok` token's "Ready to play" use, the Not ready row) and `docs/brief.md` (Deckbuilding: the list's ready/not-ready filter stays; only the marks go).

## Verification

- Per section: `pnpm lint`, `pnpm typecheck` and `pnpm vitest run` on the touched test files, then `pnpm test:changed`.
- Section 4 also runs the layout and crowded-table tests and `src/play/compiler.test.ts`. A layout change moves the slots of crowded rows only; check that no golden or `data/` file changes (`pnpm data:check`).
- At the end: the full `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm data:check`, once on the final tree.
- A web check with the `run` skill (Expo web plus Playwright screenshots) of:
  - a crowded staging row before and after the quest (section 4);
  - a pick listed in the tray, with board glow and dim (section 5);
  - the stage preview swiping to the earlier stages (section 3);
  - the Decks list and picker with no dots (section 6).
- Open in `docs/phases/STATUS.md` (no phone in a cloud session):
  - on-device swipe feel;
  - the column overlay touch pass-through;
  - frame timing with the extended rows;
  - both themes.
