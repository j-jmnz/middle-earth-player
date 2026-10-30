# Phase 26 — Peek at the other seat

Depends on: phases 19 and 23
Blocks: nothing
Can run beside: phases 14, 15, 16, 24 and 25

Plan: `docs/plans/done/board-ux.md` (user list item 4). User decision, 2026-10-26: the peek shows the whole seat. Implementer: `implementer` on Sonnet 5.5.

## Goal

In two-handed play, the player taps a seat's threat dial to see that seat's whole area:
- hand;
- play area;
- engaged enemies;
- deck and discard.

The table makes plain that this is not the seat acting. Who acts never changes by a peek.

## Now

- `shownSeat(game)` (`src/play/selectors.ts:189-192`) returns `game.activeSeat`. Everything per seat follows it:
  - the canvas (`table-canvas.native.tsx:64`, `useViews`);
  - the web list (`table-canvas.tsx:86`);
  - `useTableChoice` (`use-table-choice.ts:98`);
  - the pile list (`table-view.tsx:303`).
- Tapping a dial opens that seat's threat panel. It does not change what is shown.
- The acting seat's dial label is gold.

## Build

**State**
- A UI-only `viewedSeat: number | null` in the table store (`src/play/store.ts`). It is not engine state and not in the save.
- It resets to null:
  - on a new moment (a new sheet key);
  - when `activeSeat` changes;
  - when the table opens.

**Selectors**
- `shownSeat(game, viewed)` returns `viewed ?? game.activeSeat`. The drawing call sites use it: the canvas views, the web list, the pile list.
- `use-table-choice.ts` and everything that picks, pays or sends keep `game.activeSeat`. Name it `actingSeat` at those sites if that reads clearer.

**Dials (top left, phase 19)**
- A tap on the dial of a seat that is not shown peeks at that seat.
- A tap on the dial of the seat that is shown opens its threat panel, as now.
- The acting seat keeps its gold label. A viewed seat that is not acting gets a bone ring around its dial and a small eye mark.
- The labels become "Player 1 threat, acting" and "Player 2 threat, viewing".
- The hint on a dial that is not shown says "Shows Player 2's cards".

**While peeking**
- A raised night pill across the top of the canvas (`peek-banner`) reads "Viewing Player 2 · Player 1 is acting", with a gold `Back to Player 1` text button (`peek-back`).
- The viewed hand carries the night veil at 30%, and its cards do not glow.
- A tap on any card only opens its preview. Nothing is picked or sent.
- The dock stays the acting seat's. Its eyebrow already starts with the seat ("Player 1 · …").
- Android Back ends the peek before anything else that is open on the table (`src/play/back.ts`).

**Motion**
- The seat's zones slide out to the side and the other seat's slide in, 250 ms each way, from `motion-tokens.ts`. Going back reverses it.
- Phase 23's seat handoff plays when the engine turns to the other seat. A peek does not play it.
- It snaps under reduced motion.

## Tests

- New `src/play/selectors.test.ts`: `shownSeat` with and without `viewed`.
- `src/play/table-choice.test.ts`:
  - a card tap while peeking previews and sends nothing;
  - picks are still the acting seat's;
  - the peek ends on a new sheet key and on an `activeSeat` change.
- `src/play/back.test.ts`: Back ends the peek first.

## E2E

`.maestro/seat-peek.yaml` opens a two-handed fixture save, taps the second seat's dial, asserts `peek-banner`, taps `peek-back`, and asserts the banner is gone. Add a two-handed fixture if none fits (`scripts/e2e-fixtures.ts`).

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- `docs/brief.md` says in the table section that two-handed play may view the other seat's hand, because both hands are the one player's. It is a product rule, so it goes in the brief in the same change.
- `docs/design-system.md` (Table, top bar and Cards) is updated.
- STATUS.md lists the phone checks as open:
  - the peek and back in planning and in combat;
  - the slide;
  - the dials' viewing and acting marks at 667×375.
