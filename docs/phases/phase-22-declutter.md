# Phase 22 — Declutter the board

Depends on: phase 21
Blocks: nothing
Can run beside: phases 14, 15, 16, 20 and 23

Plan: `docs/plans/board-ux.md` (user list item 5). Implementer: `implementer` on Sonnet 5.5.

## Goal

The table shows what the current decision needs and nothing else. Everything removed stays reachable in one place: the preview, the log, the threat panel, or an expanding line.

## Audit

The decisions below are this phase's. Keep this table in the phase file, updated if the build differs.

| Item | Where | Decision | Why |
| --- | --- | --- | --- |
| Quest band (stage name, progress bar, count) | `src/play/quest-band.tsx`, `table-view.tsx:251` | Remove | The quest card's strip on the canvas shows progress / quest points. The stage name goes into the quest card's preview title. |
| "Active: …" locations line | `table-view.tsx:252` | Remove | The active location is drawn. |
| Ring-bearer held by another seat line | `table-view.tsx:257` | Replace | A small Ring mark on the dial of the seat that holds the Ring-bearer. Its accessibility label says it. |
| Dock note, guide line and unavailable lines | `src/play/table-dock.tsx` | Fold | One line shows. An "i" pill (`dock-more`) expands the rest in place. The first-game guide stays one line at most. |
| Picked-cards line | `table-dock.tsx` | Remove | The picked marks on the cards and the primary's verb ("COMMIT 2") already say it. The screen reader still hears it in the primary's hint. |
| Reading pills (Undo, Read the card, List, Actions (n), Choose) | `use-table-choice.ts:287-299` | Merge | Undo always shows. When more than two others would show, they fold into one `More` pill that opens a small popover (`dock-more-actions`). With two or fewer, they show as now. |
| Effect pills down a card's edge | `canvas-pieces.native.tsx` (`Badges`) | Cap | Two pills and "+n". The preview lists all of them. |
| Empty-zone words | canvas | Keep | Already faint. |
| Engagement-cost pills on staging enemies | canvas | Keep | They decide engagement. |
| Not-applied mark, delayed-effect clock | canvas | Keep | Already small. |
| Threat dial meter ticks | top bar | Keep | They decide engagement. |

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

## Implementer notes (Sonnet 5.5)

**Before you start**
- Read `.cursor/agents/implementer.md` first and follow it. Ignore its `model` line.
- Then read:
  - this file;
  - `docs/plans/board-ux.md`;
  - `docs/design-system.md` (Table);
  - `docs/architecture.md` (Play).
- Implement this phase only.

**What you may change**
- This phase may edit `docs/design-system.md` (Table) for what it changes. That is the exception to "do not restyle screens". `/ux` reviews it.
- No new dependency. Motion is Reanimated, drawing is Skia, gestures are Gesture Handler, haptics are `src/play/haptics.ts`. No `any`.
- Colors come from `tableTokens` (`src/play/tokens.ts`). A hex in a component is a miss.

**Boundaries**
- `src/play` never imports `src/screens`.
- `src/screens` never imports `src/rules`.
- The reducer is the only writer of numbers.

**Code and tests**
- Logic goes in pure `.ts` files with a Vitest next to them. There are no component tests: Vitest runs in node on `*.test.ts`.
- Keep files under about 300 lines and split by behavior.
- Keep every testID. If one moves behind a new control, update the `.maestro/*.yaml` flows that use it.

**When you finish**
- Exit gate: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm data:check`.
- A cloud session has no phone. List the phone checks as open in `docs/phases/STATUS.md`; do not mark them done.
- Report back when the exit is green. The main session runs `reviewer` and `ux`.

**Phase-specific**
- `readout.ts`, `outcome.ts` and the sheets do not change. Only what the screen shows changes.
- A screen reader keeps every sentence: a folded line is still in the accessibility label or the hint.
- The Maestro flows that assert the quest band's testIDs move to the quest card's preview, or are dropped with a note in STATUS.md if nothing else reads them.
- Do not remove the threat dials' ticks or the engagement pills. They are the engagement foresight the table-experience plan built.
