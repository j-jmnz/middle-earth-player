# Phase 25 — Hold and slide through the hand

Depends on: phase 23
Blocks: nothing
Can run beside: phases 14, 15, 16, 24 and 26

Plan: `docs/plans/done/board-ux.md` (user list item 8). User decision, 2026-10-26: this is the hand. The player deck stays hidden (`docs/brief.md`). Implementer: `implementer` on Sonnet 5.5.

## Goal

The player presses and holds the hand. It rises and spreads out larger. Sliding a finger left and right lifts each card in turn, enlarged above the finger. Letting go on a card opens its preview.

## Now

- The hand peeks up from the bottom edge: 56% of a card, slightly fanned (`layout.ts:321`).
- Gestures in `src/play/table-canvas.native.tsx:152-232` race against each other (`Gesture.Race(pan, hold, tap)`):
  - a tap picks or previews;
  - a 350 ms long press previews one card;
  - a pan drags a playable card toward a target.
- There is no way to look through the hand without opening each card.

## Build

**Starting the scrub**
- On a hand card, or the hand strip between cards, a press held still (under 8 pt of movement) for 250 ms starts a scrub. A selection haptic ticks (`tickArmed`).
- A movement before 250 ms is a drag, which plays a card as now. A tap is a tap as now. The 350 ms preview on a single hand card is replaced by the scrub; the scrub's release opens the same preview.

**While scrubbing**
- The hand rises so that whole cards show, and its scale grows to about 1.5. The fan flattens and spreads across the canvas width, overlapping evenly. Rise 220 ms, spread 220 ms, both from `motion-tokens.ts`.
- The card under the finger lifts above the others, scaled 1.25 over the spread, so it is drawn above the finger, not under it. A selection tick plays each time the card under the finger changes.
- The rest of the table dims under night at 35%.
- Releasing on a card opens `CardPreview` for that card, as a long press does now.
- Sliding up past the top of the risen hand, or releasing off the hand, cancels. The hand settles back with no preview.
- No intent is sent during a scrub, and nothing is picked.

**Reduced motion**
- The hand shows risen and spread at once. The lift is instant.

**Screen reader**
- With a screen reader on, the scrub is off. The hand cards stay reachable through the list path that exists now.

## Data

- A pure `handScrub` in `src/play/hand-scrub.ts`:
  - `spreadLayout(layout, canvas)` gives the risen, spread hand slots.
  - `cardAt(spread, x)` gives the index under the finger (the nearest center).
  - `cancelled(spread, y)` says whether the finger is above the risen hand.
- The canvas animates between the normal and spread layouts.

## Tests

`src/play/hand-scrub.test.ts`:
- one, five and nine cards spread inside the canvas width;
- `cardAt` at each card's center and at the edges;
- above the hand cancels;
- every card keeps at least a 44 pt slice in the spread.

## E2E

None. The gesture is phone-only. The simulator does not close a drag exit (`.cursor/agents/implementer.md`).

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- `docs/design-system.md` (Table, Gestures) is rewritten.
- STATUS.md lists the phone checks as open:
  - hold, slide and release on 3, 6 and 9 cards;
  - a fast drag still plays a card;
  - a tap still picks;
  - the ticks on each card change;
  - the scrub in planning with glowing cards.
