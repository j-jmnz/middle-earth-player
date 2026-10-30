# Phase 21 — Choice tray

Depends on: phase 19
Blocks: phase 22
Can run beside: phases 14, 15, 16, 18 and 20

Plan: `docs/plans/done/board-ux.md` (user list items 7 and 10). User decision, 2026-10-26: a night tray over the dock. Implementer: `implementer` on Sonnet 5.5.

## Goal

A choice whose options are not all whole cards on the table opens a compact night tray over the command column. The tray shows the options and nothing else. The step, the readout and the buttons stay in the dock under it, once. A tap anywhere outside the tray folds it, which replaces Look at the table.

## Now

- `SidePanel` (`src/play/table-panel.tsx:42-142`) sits on `SheetFrame edge="right"` (`src/play/sheet-paper.tsx`):
  - paper;
  - 46% of the width, 320 to 480 pt;
  - anchored to the right and the bottom (`table-view.tsx:168-171`).
- It covers the whole command column and about 135 pt of the canvas.
- It repeats:
  - the eyebrow and title;
  - the readout;
  - the refusal;
  - the threat line;
  - all of `DockButtons`.
- "Look at the table" (`sheet-collapse`, `table-panel.tsx:139`) folds it. `Choose` (`sheet-expand`, `use-table-choice.ts:299`) brings it back.
- When it opens: `panel = asked || !onTheTable(sheet, onTable)` (`use-table-choice.ts:110-112`). `panelOpen = panel && folded !== sheet.key`.
- `PileList`, `LogPanel`, `ThreatPanel` and `SettingsPanel` (phase 20 renamed `ReferencePanel`; the phases and Stops moved to the carousel) use the same rectangle, so two can stack.

## Build

**Tray (`src/play/choice-tray.tsx`)**
- It is anchored to the top of the dock's button block and rises over the command column's upper part, where the quest band is. It is the command column's width plus up to 40 pt into the canvas, at most 340 pt, and never covers the dock's armed line or buttons.
- Night raised fill, hairline edge, `rounded-card` corners on the top and on the canvas side.
- Its top shows only a muted count ("2 of 4 picked", or the pick's own words from the sheet). It does not repeat the step or the moment, which the dock already shows.
- Options are tiles, one per row:
  - a 32×44 card picture when the option is a card;
  - the name;
  - the deciding stat (the sheet's `stats`);
  - the foreseen-damage pill, when there is one.
- A picked tile has the gold edge and check, as on the table.
- Refused options show as dashed hairline outlines, each with its reason in muted.
- A tile's long press opens the card preview. "Read the card" leaves the tray.
- It scrolls inside itself. Nothing else scrolls with it.
- `sheet-option-<id>` stays on each tile.

**Outside tap**
- While the tray is open, a tap on the canvas, the top bar or the empty part of the command column folds it.
- That tap is swallowed: it sends no intent and picks nothing.
- `sheet-collapse` is removed. `Choose` (`sheet-expand`) on the dock brings the tray back.
- There is no scrim. The table stays visible.

**Screen reader**
- The tray is the default and does not fold on outside taps, so every choice stays a control a screen reader reaches.
- The web build keeps listing every choice (it reports a screen reader).

**Reading panels (`src/play/reading-panels.tsx`)**
- `PileList`, `LogPanel` and `ThreatPanel` open in one place, the same tray frame, one at a time. A new one replaces the last.
- Each has a labeled ✕ Close and closes on a tap outside.
- The Log may stay on paper (design system: paper is what gets recorded).

**Motion** (values to move to `motion-tokens.ts` in phase 23)
- The tray enters in 260 ms decelerate (translateY 16 to 0, plus a fade).
- It leaves in 180 ms accelerate. Today the panels have no exit.
- Both snap under reduced motion.

**Removals**
- The paper copy of `DockButtons` in the panel.
- The panel's eyebrow, title, readout, refusal and `threatLine`.
- The `SheetFrame edge="right"` path, if nothing else uses it.

## Data

- `use-table-choice.ts` keeps `panelOpen`, `fold` and `expand` with the same meaning.
- Add `foldOutside()`: a no-op while a screen reader is on.
- `table-view.tsx` calls it from a hit layer under the tray, or from the canvas tap when `panelOpen`, before the tap is routed to `onTap`.

## Tests

- `src/play/table-choice.test.ts` or `use-table-choice` logic tests:
  - an outside tap while the tray is open folds it and sends no intent;
  - with a screen reader on it does not fold;
  - `Choose` reopens the same sheet key;
  - a new moment opens its tray unfolded.
- `src/play/back.test.ts`: Back closes a reading panel, then folds the tray, then (phase 19) the menu order holds.

## E2E

- Update every flow that taps `sheet-collapse`.
- The flows that tap `sheet-option-*` keep working: assert that one still does.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- The web export at 844×390 and 667×375 shows a choice tray with tiles over the command column, the dock's buttons visible under it, and the encounter deck visible.
- `docs/design-system.md` (Table, Panels) is rewritten for the tray.
- STATUS.md lists the phone checks as open:
  - the tray at 667×375 with six options;
  - an outside tap that folds without picking a card.
