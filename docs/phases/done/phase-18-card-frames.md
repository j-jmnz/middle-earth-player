# Phase 18 — Card frames follow the card

Depends on: nothing
Blocks: nothing
Can run beside: phases 14, 15, 16 and 19

Plan: `docs/plans/done/board-ux.md` (user list item 9). Implementer: `implementer` on Sonnet 5.5.

## Goal

Every mark drawn in the shape of a card sits on the card at its turn, whether that turn is a fanned hand card's tilt or an exhausted card's quarter turn:
- the halo;
- the gold edge;
- the picked edge;
- the veil;
- the beat ring.

A tap on a fanned card's corner hits that card.

## Now

- `Moving` (`src/play/canvas/pieces.native.tsx:445-468`) turns only its `children`. `drawBody` (`src/play/canvas/table-canvas.native.tsx:239-252`) puts `Glow` and `CardBody` there, so the halo turns with the card.
- `drawOverlay` (`table-canvas.native.tsx:253-273`) draws the following on `slotBounds(slot)` (`src/play/layout/layout.ts:337-341`), which swaps width and height for an exhausted card and ignores `slot.tilt`:
  - `Marks` (the gold edge, the picked edge, the check ring, the veil; `canvas/pieces.native.tsx:338-361`);
  - the beat ring.
- So a fanned hand card has a straight frame on a tilted picture. The end cards turn about 5°; a longer hand turns more.
- `hitBounds` and `hitSlot` (`layout.ts:344-366`) ignore the tilt too.

## Build

- One pure helper, `cardFrame(slot)` in `src/play/layout/layout.ts` (or a new `src/play/canvas/frame.ts` if `layout.ts` would pass 400 lines). It returns the card's center, its unturned width and height, and its turn (`slotRotation`, `src/play/motion/motion.ts:17`). The body and every card-shaped mark read it.
- Draw the card-shaped marks inside the turned group, next to `Glow`. `Moving` gains a second turned slot, or `drawBody` takes the marks:
  - the gold edge;
  - the picked edge;
  - the veil (dim and muted);
  - the beat ring.
- These stay upright in the overlay, as `docs/design-system.md` says (tokens and effects stay upright):
  - tokens;
  - effect pills;
  - the option pill;
  - the not-applied mark;
  - the clock;
  - the picked check ring's center, with its "-1" or "+2".
- `hitSlot` turns the touch point back by the slot's tilt around the card's center before testing the unturned rect. An exhausted card keeps its sideways footprint.
- The halo must not bleed onto the next card (open note in `docs/phases/STATUS.md`, Table follow-up). Keep the blurred rect inset so that only about 3 pt of blur shows past the edge at sigma 4.5.

## Tests

- New `src/play/layout/layout.test.ts` (or `frame.test.ts`):
  - `cardFrame` gives the same turn as `slotRotation` for a fanned card, an exhausted card and a straight card;
  - a point inside a tilted card's corner but outside its unturned rect hits that card;
  - a point inside the unturned rect but outside the tilted card does not.

## E2E

None. The canvas is phone-only.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- `docs/design-system-table.md` (Marks of the open moment) says the edge, veil and beat ring follow the card's turn.
- STATUS.md lists the phone check as open: a five-card fanned hand in planning, with glowing and picked cards, the end cards' frames on the picture, and no blur on the neighbors.
