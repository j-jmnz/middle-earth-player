# Phase 23 — Motion pass

Depends on: phase 20
Blocks: phases 24, 25 and 26
Can run beside: phases 14, 15, 16 and 22

Plan: `docs/plans/done/board-ux.md` (user list items 1 and 2). Implementer: `implementer` on Sonnet 5.5.

## Goal

The table moves like a game, not a form. Motion is slower than today but stays snappy. It shows what happened (a draw, a reveal, a play, damage, a card destroyed) and never holds the player up.

## Now

There are no motion tokens: every duration is a local literal. The list is in `docs/plans/done/board-ux.md` (What the table does now).
- Cards move in 320 ms ease-out cubic (`MOVE_MS`, `src/play/table-canvas.native.tsx:29,108`). Their paths are worked out in `src/play/motion.ts`.
- Nothing flips, staggers, overshoots or pops.
- Token counts change in place.

## Build

**Tokens (`src/play/motion-tokens.ts`)**
- Every duration, easing and spring the table uses: card move, flip, stagger, lift, land, exhaust, token pop, floating number, destroy, sheet, tray, menu, carousel, banner fade, preview, dial pop, threat badge.
- Move every literal in `src/play` to it. The values the phases before this one named are in their phase files.
- `motionScale(speed, reduced)`: 1 for Normal, 0.6 for Quick, 0 under reduced motion. Every duration passes through it.
- A new table setting, **Animation speed** (Normal, Quick):
  - in `src/play/table-settings.ts`;
  - stored as the others are (`src/screens/settings-store.ts`);
  - shown in the Table settings panel.

**Card motion** (canvas, `motion.ts` and `table-canvas.native.tsx`)

| Motion | What happens | Time |
| --- | --- | --- |
| Move | Arrivals ease out with a slight overshoot (`Easing.out(Easing.back(1.2))`). Departures ease in. | 420 ms; departures 300 ms |
| Draw | A card leaves the deck on a shallow arc (a 24 pt rise at mid-path), showing its printed back, and flips to its face at the midpoint (scaleX 1 → 0 → 1). Several drawn cards leave one after another. | stagger 90 ms |
| Reveal | An encounter card flips over its staging slot, then pops (scale 1.12, a 120 ms hold, settle on a spring). A dealt shadow card does not flip: it stays face down. | — |
| Play | A card from the hand lifts to 1.12 and glides to its slot. It lands with a squash: 0.96, then back to 1 on a spring. | lift 120 ms, glide 380 ms |
| Exhaust and ready | The quarter turn is a spring with a light overshoot. | about 350 ms |
| Leave | A destroyed or discarded card shakes (3 × ±4 pt, 50 ms each), then shrinks and fades to its pile. A card leaving play otherwise just fades. | shrink-fade 420 ms |

**Tokens on cards**
- When a damage, resource or progress count changes, its token pops: 1 → 1.4 → 1 on a spring, about 300 ms.
- A floating number rises 20 pt from it and fades over 700 ms: "+2" in gold for a gain, "−1" in threat red for damage or a loss, Marcellus 13 pt with a night outline.
- Progress placed on the quest card pops its strip's count the same way.

**Chrome**
- Phase title sweep: when the phase changes, the phase name in Marcellus display crosses the canvas center (fade in, slide 40 pt, fade out, 900 ms total).
  - Taps pass through it.
  - It is skipped under Quick, under reduced motion, and when Stops passed the whole phase.
- Seat handoff (two-handed play): when `activeSeat` changes, the acting seat's dial pulses (a gold ring, 1 → 1.12 → 1, 300 ms) and its hand slides up into place (300 ms).
- Banner: the fades go from 200 to 260 ms. The beats stay at 650 ms (an open phone check in STATUS.md).
- Sheets, tray, menu and carousel take their durations from the tokens. Nothing else changes for them.

**Hurry**
- A tap while card motions are running finishes them at once: their progress values are set to 1.
- The tap is then handled as usual. This is the only input path the motion touches, and it never delays an intent.

**Haptics**
- A light impact when a card lands from play, at most one per new state (`src/play/haptics.ts`, `tickLand`).

## Data

- `motion.ts` stays pure. `Motion` gains:
  - `flip` (start face down, turn at the midpoint);
  - `delay` (stagger);
  - `arc` (rise in points);
  - `land` ("squash" | "pop" | null).
- `motionsBetween` sets them.
- A pure `tokenDeltas(prev, next)` in `src/play/token-deltas.ts` lists `{ cardId, token, change }` from the two states' counts. The UI never computes a number of its own.

## Tests

- `src/play/motion.test.ts`:
  - drawn cards get increasing delays 90 ms apart;
  - a drawn card flips and a dealt shadow card does not;
  - a revealed encounter card pops;
  - a played card squashes.
- `src/play/token-deltas.test.ts`: damage +2, resource −1, progress +3 between two states, and nothing when counts are equal.
- `src/play/motion-tokens.test.ts`: `motionScale` is 0 under reduced motion, 0.6 under Quick, 1 under Normal. Every token is at most 500 ms except the spotlight and the sweep.

## E2E

None. The canvas is phone-only. The settings flow, if one exists, asserts the Animation speed row.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- `rg -n "duration\\(|withTiming\\(.*[0-9]{3}" src/play` finds no duration literal outside `motion-tokens.ts`.
- `docs/design-system-table.md` (Motion; Performance) is rewritten with the tokens.
- STATUS.md lists the phone checks as open:
  - draws, reveals, plays and token pops at Normal and Quick;
  - the hurry tap;
  - the sweep not hiding a moment;
  - no dropped frames with a full table;
  - reduced motion snapping everything.
