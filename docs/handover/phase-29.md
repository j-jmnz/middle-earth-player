# Phase 29 handover (Passage Through Mirkwood)

Branch `ccr-4c9464c7-sy2mz9`. Delete this file in the final commit.

## Done
- STATUS.md: phase 29 marked `active`.

## In progress
- Reading the drafts (`pnpm effects:draft passage-through-mirkwood`: 44 open lines on 28 cards) and designing the engine work.

## Design decisions
- Branching stage 3 (01120:B:1 -> 01121 or 01122, the other removed): quest family verb `BranchStage { codes }` on a `forced` / `questCardDefeated` record of the stage card; `scenarioDefinition` copies it onto the stage entry (`stages[i].branch`), `advanceStage` picks at random with the seeded RNG, moves the other to `removed`, and records `stagesReached` (only in a quest that branches). Condition `stageReached` reads it for 01129's Resolution. Fellowship states gain no field.
- Trigger `questCardDefeated` (new, quest family): about the defeated quest card (main stage, and side quests), heard by Mendor (01135:A:3).
- 01121 prints 0 quest points: `Restrict advance` always, and `WinGame` when Ungoliant's Spawn is destroyed.

## Next
1. Engine families and tests, then records (`src/effects/authored/passage-through-mirkwood.ts`, `pool/RevCore.ts`).
2. Golden, campaign test, playable.ts, brief.md, phone half (Maestro flows, fixtures).

## Lines still open
All 44 (none written yet).
