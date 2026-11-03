# Phase 19 — Top bar and table menu

Depends on: nothing
Blocks: phases 20, 21 and 26
Can run beside: phases 14, 15, 16 and 18

Plan: `docs/plans/done/board-ux.md` (user list items 11, 12 and 13). Implementer: `implementer` on Sonnet 5.5.

## Goal

The top bar has three zones and nothing else:
- the threat dials at the left;
- the phase rail at the middle;
- one menu button at the right.

Back, Log, Rules and Booklet move into the menu.

## Now

`src/screens/table/view.tsx:194-223`, left to right:
- `‹ Path` or `‹ Scenarios` (`table-back`);
- the dials (`ThreatRing compact`, plus Life and Burden when the scenario has them);
- `PhaseRail`;
- Round N (`table-round`, hidden under 760 pt);
- Log (`log-open`), Rules, Booklet (`booklet-open`).

## Build

**Layout**
- The bar stays 44 pt, inside both side safe-area insets.
- Left: the dials, in seat order, then Life and Burden. Their behavior is unchanged in this phase.
- Middle: `PhaseRail`, centered on the screen rather than on the space left over. Phase 20 restyles it.
- Right: a 44 pt menu button (`table-menu`). It shows a printed icon if one fits (`src/ui/icon-map.ts`), else three dots drawn as views. The accessibility label is "Menu".

**Menu (`src/play/chrome/table-menu.tsx`)**
- A popover anchored under the button, at the top right. Night raised fill, hairline edge, `rounded-card` corners, 220 to 260 pt wide.
- Rows are 48 pt and are `TextButton`-style bone text, each with its icon where the game has one. In order:
  1. **Leave the table**: the `TableNav` back label as its detail ("To the path", "To the scenarios"). testID `table-back`. A muted line under it says "The game is saved".
  2. **Log** (`log-open`).
  3. **Rules** (`rules-open`).
  4. **Booklet** (`booklet-open`).
  5. **Table settings** (`settings-open`). It opens `ReferencePanel` as it opens from the rail now. Phase 20 moves the phases out of it and leaves the settings.
- A row closes the menu and then acts.
- A tap anywhere outside closes the menu and sends nothing.
- Android Back closes it first: `src/play/chrome/back.ts` gets a `menu` layer above the preview.

**Round**
- The separate Round text goes. The rail's accessibility label already says the round; until phase 20, the rail shows "R3" before the current step when it is not narrow.

**Code layout**
- Move the top bar out of `table/view.tsx` (352 lines) into `src/screens/table/top-bar.tsx`. `table/view.tsx` passes it the handlers.

**Motion** (values to move to `src/ui/motion-tokens.ts` in phase 23)
- The popover enters in 200 ms ease-out: scale 0.96 to 1 from the top right, plus a fade.
- It leaves in 150 ms ease-in.
- It snaps under reduced motion.

## Tests

- `src/play/chrome/back.test.ts`: Back closes the menu before anything else.
- A pure `menuItems(nav)` in `table-menu` words (or `src/play/chrome/table-menu-items.ts`): the five rows in order, with Leave named for the path and for the scenarios. Tested.

## E2E

- Update every `.maestro/*.yaml` that taps `log-open`, `booklet-open` or `table-back`: tap `table-menu` first.
- Add `.maestro/table-menu.yaml`: open a fixture save, open the menu, open the Log, close it, open the menu, leave the table.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- The web export (`npx expo export --platform web`, opened in headless Chromium at 844×390 and 667×375) shows the dials at the left, the rail centered, the menu button at the right, and the menu open with its five rows.
- `docs/design-system-table.md` (top bar) is rewritten for the three zones and the menu.
- STATUS.md lists the phone checks as open:
  - the menu in reach;
  - the bar at 667×375 with two seats, Life and Burden.
