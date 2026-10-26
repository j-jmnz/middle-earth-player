# Phase 25 — Hold and slide through the hand

Depends on: phase 23
Blocks: nothing
Can run beside: phases 14, 15, 16, 24 and 26

Plan: `docs/plans/board-ux.md` (user list item 8). User decision, 2026-10-26: this is the hand. The player deck stays hidden (`docs/brief.md`). Implementer: `implementer` on Sonnet 5.5.

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
- Keep files under about 300 lines and split by behavior. Put the gesture wiring in `src/play/hand-gestures.native.ts`, and keep the canvas file under 300 lines.
- Keep every testID. If one moves behind a new control, update the `.maestro/*.yaml` flows that use it.

**When you finish**
- Exit gate: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm data:check`.
- A cloud session has no phone. List the phone checks as open in `docs/phases/STATUS.md`; do not mark them done.
- Report back when the exit is green. The main session runs `reviewer` and `ux`.

**Phase-specific**
- Gesture Handler 3: compose a `LongPress` (minDuration 250, maxDist 8) followed by a `Pan`. Use `Gesture.Exclusive` with the drag pan, or a pan with `activateAfterLongPress(250)` for the scrub and a separate pan for the drag. Keep the drag-to-play path exactly as it behaves now for a fast move.
- The finger position is read on the UI thread. Only the index change crosses to JS (for the haptic). The canvas draws from shared values.
- The 350 ms long press on table cards (not the hand) is unchanged.

## Handover from phase 23

Phase 23 is merged. What phase 25 builds on:

- Every duration, curve and spring is a token in `src/play/motion-tokens.ts` (`MOTION`; distances and scales in `SHAPE`). Add the scrub's tokens there: `scrubRise` and `scrubSpread` (220 ms each, ease-out cubic is the house curve for an entrance, `tween(220, "outCubic")`), the 35% dim if it fades, and the 1.5 scale and the 250 ms hold as shapes and gates. The 250 ms long-press `minDuration` and the 8 pt `maxDist` are gesture thresholds, not motion: they stay out of `motionScale` (as the top bar's 400 ms fallback and the dock's `ARM_MS` do). Every token stays at or under 500 ms (`motion-tokens.test.ts`).
- Every duration passes through `motionScale(speed, reduced)` (1 Normal, 0.6 Quick, 0 under reduced motion), read once with `useMotionScale()` (`motion-run.ts`); hand Reanimated `timing(token, scale)` or `springConfig(token, scale)`. Under reduced motion (scale 0) the rise and spread snap.
- The hurry tap: a touch on the canvas calls `finishMotions(progress, clear)` in the canvas pan's `onBegin`, which sets the running card clock to 1 and drops the pending `tickLand`; the touch is then handled as usual. A scrub starts on a press held still, so it begins with a hurry: the hand is at rest under the finger by the time the scrub's 250 ms hold elapses. Keep `finishMotions` in `onBegin` when you compose the long press and the pan, and keep it from delaying or swallowing the drag-to-play path.
- Haptics live in `src/play/haptics.ts`: `tickLand()` (a played card landing, at most one per new state) is beside `tickArmed`. A card played from a scrub's drag lands with `tickLand` as any play does; do not add a second tick for it.
- `tokenDeltas(prev, next)` (`token-deltas.ts`) drives the token pops and floating numbers; the scrub sends no intent, so it changes no count and pops nothing.
- A card drawn into the hand arrives on an arc with a flip, staggered 90 ms (`stagger`, `SHAPE.maxStagger`); the scrub's flattened fan reads the same slots from `layout.ts`, so a scrub that starts mid-draw sees the cards at rest after the hurry.
