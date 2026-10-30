# Phase 22 — Declutter the board

Depends on: phase 21
Blocks: nothing
Can run beside: phases 14, 15, 16, 20 and 23

Plan: `docs/plans/done/board-ux.md` (user list item 5). Implementer: `implementer` on Sonnet 5.5.

## Goal

The table shows what the current decision needs and nothing else. Everything removed stays reachable in one place: the preview, the log, the threat panel, or an expanding line.

## Audit

The decisions below are this phase's. Keep this table in the phase file, updated if the build differs.

| Item | Where | Decision | Why | Built |
| --- | --- | --- | --- | --- |
| Quest band (stage name, progress bar, count) | `src/play/quest-band.tsx`, `table-view.tsx:251` | Remove | The quest card's strip on the canvas shows progress / quest points. The stage name goes into the quest card's preview title. | Removed (`quest-band.tsx` deleted). The preview's title line is "Name · progress / points" (`questTitle` in `table-preview.ts`); a stage with no quest points is titled by its name with "To win: …" under it. `quest-stage` and `quest-progress` were in no Maestro flow. |
| "Active: …" locations line | `table-view.tsx:252` | Remove | The active location is drawn. | Removed. `the-ring-goes-south.yaml` asserted `active-locations`; the assertion is dropped. |
| Ring-bearer held by another seat line | `table-view.tsx:257` | Replace | A small Ring mark on the dial of the seat that holds the Ring-bearer. Its accessibility label says it. | The line was "The Ring-bearer is facedown under X" (the Ring-bearer captive under a location, not held by a seat). The Ring (`oneRing` icon, 12 pt, gold) sits by the label of the dial of the first player, the seat that gets the hero back (the Watcher's Forced effect always returns it there; a captive card keeps no controller); the dial's name says it (`ringWords`). `threat-<seat>-ring`; the flow asserts `threat-0-ring` and the words. `ring-bearer-held` is gone. |
| Dock note, guide line and unavailable lines | `src/play/table-dock.tsx` | Fold | One line shows. An "i" pill (`dock-more`) opens a popover with the rest. The first-game guide stays one line at most. | `dockLines` (`dock-lines.ts`, tested): guide, else note, else first refusal shows, one line under 400 pt tall, two above; "i" opens a popover (`dock-lines-popover.tsx`) with the full title and every line (see the layout fix below); a screen reader hears all from the folded line. A long single line also gets the "i". |
| Picked-cards line | `table-dock.tsx` | Remove | The picked marks on the cards and the primary's verb ("COMMIT 2") already say it. The screen reader still hears it in the primary's hint. | Removed; "Picked: …" leads the primary's hint. `TableChoice.picked` is now always set (it was null while the tray was open). |
| Reading pills (Undo, Read the card, List, Actions (n), Choose) | `use-table-choice.ts:287-299` | Merge | Undo always shows. When more than two others would show, they fold into one `More` pill that opens a small popover (`dock-more-actions`). With two or fewer, they show as now. | `dockPills(extras)` in `dock-extras.ts` (tested). The popover (`dock-more.tsx`) shares the table menu's frame (`popover-frame.tsx`, which `table-menu.tsx` now uses); it sits left of the command column, level with the pill. Back closes it like the menu (`back.ts`, `closeMore`). |
| Effect pills down a card's edge | `canvas-pieces.native.tsx` (`Badges`) | Cap | Two pills and "+n". The preview lists all of them. | `badgeSplit` in `card-effects.ts` (tested); `canvas-pieces.native.tsx` stays at 445 lines. |
| Empty-zone words | canvas | Keep | Already faint. | Kept. |
| Engagement-cost pills on staging enemies | canvas | Keep | They decide engagement. | Kept. |
| Not-applied mark, delayed-effect clock | canvas | Keep | Already small. | Kept. |
| Threat dial meter ticks | top bar | Keep | They decide engagement. | Kept. |

Also built, to keep the two-tap rule true: the armed line's room is sized to the longest thing the moment's buttons say when armed (`armed-room.ts`, two to four lines, so a caution is never cut) with its own 4 pt for the bar, held the same before and after arming (it was 36 pt plus a 3 pt bar, so a two-line caution moved every button down 3 pt when armed); the dock's text above the numbers scrolls alone and the readout, armed line and buttons are pinned to its foot; the dock's rows are 2 pt apart (were 4), its top padding 6 pt (was 8) and the readout's padding 4 pt (was 6), so a typical dock fits at 667x375 without scrolling.

## Build

- Apply the audit.
- The dock takes the height the quest band gave back. The armed line and the buttons stay pinned in the same place (the two-tap rule: arming moves nothing).
- The quest card's preview (`src/play/table-preview.ts`) gains the stage name and its progress / quest points as its title line, if it does not show them already.
- The `More` popover uses the menu's frame from phase 19 (`table-menu.tsx`). Share the frame; do not copy it.

## Tests

- `src/play/table-choice.test.ts` (or a new `dock-pills.test.ts`) on a pure `dockPills(extras)`:
  - Undo is first and always out;
  - three or more extras fold into More;
  - two or fewer do not.
- `src/play/card-effects.test.ts`: the cap gives two pills and "+n".

## E2E

- Flows that tap `sheet-expand`, `read-card` or the Actions pill tap `dock-more-actions` first when the pills fold.
- Check each flow's moment.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- The web export at 844×390 and 667×375 shows the command column with the dock only, and the More pill on a window with Actions.
- `docs/design-system.md` (Table, Command column and Cards) is rewritten.
- STATUS.md lists the phone checks as open:
  - the dock at 667×375 with the guide on and an armed line;
  - the quest progress readable on the quest card at about 51 pt cards.

## Layout fix (after the merge)

The three layout items the first build left open, as they stand after the fix round:

- **Worst dock at 667x375.** On a dense screen (under `DENSE_BELOW`, 400 pt) the dock is compacted and its words are budgeted (`dock-budget.ts`, tested with the longest card name in the caution). Rows are 44 / 40 / 40 pt (the pills are 36 pt in a 40 pt row with a 2 pt hit slop above and below, so every touch target is 44 pt), the readout and dock padding are tighter, and the armed bar's reserve is 2 pt. A dense armed line drops its "Tap again: " lead-in only when it is a consequence clause naming a card or a loss and that takes a line off (`armedWords`); a bare label keeps it, and the line's accessibility label is always the whole line. The worst dock's text window went from 11 pt to 45 pt at 667x375 (64 pt at 844x390): the step and one title line show without scrolling in every state. A title longer than the lines that fit is clamped (`planWords`) and whole in the popover and its accessibility label. When the room cannot hold the step, a title line and a label line, the folded line is dropped and the "i" pill sits on the title row.
- **The "i" lines.** The "i" opens a popover at every size (`dock-lines-popover.tsx`, `dock-more-lines`, the shared `popover-frame.tsx`): "✕ Close", the full title, the guide, the note and the refusals, at the left of the command column with its top level with the pill. Opening it changes nothing in the dock, so the earlier expand and fold loop (the opened state hid the readout, which un-cut the title, which unfolded it) is gone. It scrolls only past the room under the pill. Back closes it next to the More popover (`closeLines`, `back.ts`).
- **The tray at 844 wide.** The reach is deleted: the discard stands 8 pt from the canvas's edge, so any reach covered it. Reserving the reach in the canvas's right gutter instead was measured and rejected: the card size stays 56 at 844x390 without insets but falls to 52 with 47 pt insets (and 53 to 47 at 667). The tray is the command column's width; `tray-logic.test.ts` checks both encounter piles against the real layout at 844x390 and 667x375 with insets 0 and 47.
- **The tray's height.** While the tray is open on a dense screen the readout is one line (its words stay in the accessibility label) and the dock's words are not drawn under the tray (no half line shows in the 4 pt gap above the block). The tray covering the step and the title is an accepted trade-off. The armed line and the buttons are never covered and never move.
