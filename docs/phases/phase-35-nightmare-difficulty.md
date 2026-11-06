# Phase 35 — Nightmare difficulty

Depends on: phase 34
Blocks: phase 36

Plan: [docs/plans/done/nightmare-mode.md](../plans/done/nightmare-mode.md).

## Goal

A third difficulty, Nightmare, deals a scenario's Nightmare deck and places its setup card. It is offered with the Eye of Sauron wherever the scenario's Nightmare cards are all automated.

## Work

- `Difficulty` gains `Nightmare` (`DIFFICULTIES`), and saves accept it. `placementsAt` turns the Normal piles into the Nightmare ones.
- `buildStart` names the setup card (`definition.nightmareCard`). `startScenario` places it in the in-play zone `nightmare`, side A faceup.
- The setup card is printable as an engine card (type `nightmare`), and the world loads the Nightmare deck's rows.
- `NIGHTMARE_PLAYABLE` and `isNightmarePlayable` (`src/campaign/playable.ts`). `difficultyProblems` refuses a Nightmare deal elsewhere, in Campaign Mode and standalone.
- The briefing's difficulty switch shows Nightmare with the Eye (`Segmented` `icons`), where the scenario is on the list. Its note says what Nightmare changes. The encounter list shows the Nightmare set, and the rule chips show "Nightmare setup card".
- The Scenarios list puts the Eye before a Nightmare game's line. The table's top bar shows the Eye after the dials, and a tap opens the setup card.

## Exit

- `src/campaign/nightmare.test.ts` green. The effect coverage test keeps `NIGHTMARE_PLAYABLE` honest.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green.
- Phone check, open: the switch with three segments on a phone and a tablet, and the Eye in the switch, in the list and in the top bar, on Dark and Light.
