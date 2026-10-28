# Phase 29 handover (Passage Through Mirkwood)

Branch `ccr-4c9464c7-sy2mz9`. Delete this file in the final commit.

## Done
- STATUS.md: phase 29 marked `active`.
- All 44 open lines now have records (`src/effects/authored/passage-through-mirkwood.ts`, `pool/RevCore.ts`); `passage-through-mirkwood` is in `playable.ts`; `open-lines.ts` regenerated.
- Engine (all optional state, Fellowship byte-identical): quest family `BranchStage` + `questCardDefeated` trigger + `ExhaustEach` (`families/quest-branch.ts`, `stage-reveal.ts`, `quest.ts`); condition `stageReached`; campaign family `RemoveFromGame`; deck family flag `cannotDraw` (drawOne); travel costs of cards unpayable (`restrictions.ts`); pick filter `mostDamaged`; `AttachSelf` to `highestThreat`; attachments family `readyPayment` (`attachments-ready.ts`, hooked in `machine.ts` refresh); `DiscardEach` from a hand announces `discardedFromHand`.

## In progress
- Behavior tests for every record (`src/campaign/mirkwood-*.test.ts` over `scripts/mirkwood-scene.ts`), not written yet. Records are untested beyond schema, coverage, and card-smoke (not run yet).

## Design decisions
- Branching stage 3 (01120:B:1 -> 01121 or 01122, the other removed): quest family verb `BranchStage { codes }` on a `forced` / `questCardDefeated` record of the stage card; `scenarioDefinition` copies it onto the stage entry (`stages[i].branch`), `advanceStage` picks at random with the seeded RNG, moves the other to `removed`, and records `stagesReached` (only in a quest that branches). Condition `stageReached` reads it for 01129's Resolution. A stage a branch leads to is terminal.
- Trigger `questCardDefeated` (about no card; subject = the defeated quest card): queued by `afterProgress` only when a record hears it, and by a defeated side quest; Mendor (01135:A:3) and 01120:B:1 hear it.
- 01121 prints 0 quest points: `Restrict advance` always, and `WinGame` when Ungoliant's Spawn is destroyed.
- Caught in a Web: `AttachSelf` `control: highestThreat`; `readyPayment` flag asks the hero's controller before the refresh phase readies cards (`readyAsked` table marker).

## Next
1. Behavior tests, card-smoke, golden (`golden-mirkwood.test.ts`, `scripts/mirkwood-scene.ts`, `mirkwood-game.ts`), campaign test, brief.md, phone half (Maestro flows, fixtures).

## Lines still open
None.
