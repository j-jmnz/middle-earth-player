# Phase 20 — Phase carousel

Depends on: phase 19
Blocks: phase 23
Can run beside: phases 14, 15, 16, 18 and 21

Plan: `docs/plans/done/board-ux.md` (user list items 6 and 13). Implementer: `implementer` on Sonnet 5.5.

## Goal

The middle of the top bar shows where the round is. A tap opens a strip of the round's phases. The player moves through it to see the phases before and after, with their steps, the current step marked and the stops.

## Now

- `PhaseRail` (`src/play/table-chrome.tsx:42-84`): previous step, current step (gold caps), next step; the current step alone under 760 pt.
- Words: `src/play/rail.ts` (`ROUND`, `STEP_WORDS`, `railFor`, `windowPoint`).
- A tap opens `ReferencePanel` (`src/play/table-panel.tsx:277`, data `turnReference` in `src/play/reference.ts`): phases, steps, the Stops switches and the table settings, on a paper side panel.
- The rail does not mark the stops (open note in `docs/phases/STATUS.md`).

## Build

**Collapsed (`rail`)**
- The pill holds:
  - "Round 3" in muted label;
  - the phase in Marcellus caps gold with the soft glow it has now;
  - the step in bone label: "Round 3 · QUEST · Staging".
- At either side, the previous and next phase names in muted, with a chevron. Under 760 pt, the pill only, with "R3".
- A small gold "S" sits by the next chevron when one of the player's stops is ahead in this phase and Stops are on.
- When the phase changes, the names slide one place (280 ms ease-out, the old phase leaving to the left) and the pill's edge flashes gold for 300 ms. A step change cross-fades the step word (200 ms). Both snap under reduced motion.

**Open (`carousel`)**
- A tap on the pill opens a strip under the top bar, across the canvas. It is a horizontal snap-scroll of the round's seven phases (`ROUND` order: Resource, Planning, Quest, Travel, Encounter, Combat, Refresh), one card per phase (`carousel-phase-<id>`), centered on the current one.
- Each card shows the phase name and its steps from `turnReference()`, with the player's decision in one muted line.
  - The current step is outlined, as the turn reference does now.
  - Past phases this round are muted, with a done mark (`RingMark` done); later ones are plain.
  - An action window shows its Stop switch, a whole 44 pt row as now, and the master Stops switch sits at the head of the strip.
- The strip's surface is night raised with a hairline, not paper: it is reading, not deciding.
- A chevron at each end and a swipe move one phase. A tap outside the strip, the pill again, or Android Back closes it. It sends no intent.
- Motion (values to move to `motion-tokens.ts` in phase 23):
  - the strip drops in, 240 ms ease-out (translateY −12 to 0, plus a fade);
  - it leaves in 180 ms;
  - it snaps under reduced motion;
  - nothing animates while it scrolls.

**Settings**
- `ReferencePanel` keeps only the table settings (Strong outlines, First-game guide, the Responses used every time). It opens from the menu's Table settings (phase 19). Rename it `SettingsPanel` if that reads better.

## Data

- A pure `phaseCarousel(game, stops)` in `src/play/rail.ts` (or `src/play/carousel.ts` if `rail.ts` would pass 200 lines). It returns `{ round, phases: [{ id, name, state: "past" | "current" | "next", steps: [{ id, words, decision, current, window, stop }] }], stopAhead }`.
- Every word comes from `STEP_WORDS`, `turnReference` and `data/rules` through them. Invent none.

## Tests

`src/play/rail.test.ts`:
- seven phases in order;
- past, current and next for a game in the quest phase and in the combat phase;
- `stopAhead` true when a stop is later in this phase and false when it was earlier;
- the steps and decisions equal `turnReference`'s.

## E2E

Update the flows that assert `rail-current`, which is kept. Add a step to `.maestro/table-menu.yaml`: tap `rail`, assert `carousel-phase-quest`, tap outside, assert the strip is gone. (As built it asserts `carousel-phase-combat` and `rail-phase` "Combat": the flow's lost fixture is parked in the Combat phase, not Quest.)

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- The web export at 844×390 and 667×375 shows the pill, and the open strip with the current phase centered.
- `docs/design-system-table.md` (): the rail paragraph and the turn reference in Panels are rewritten.
- STATUS.md: the open "the rail does not mark each stop" note is closed. The phone checks are open:
  - the slide on a phase change;
  - the strip's swipe;
  - the Stop switches' 44 pt rows.
