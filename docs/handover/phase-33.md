# Phase 33 handover (The Caves of Nibin-Dûm)

## Done
- STATUS `active`. New family `caves` (catalog/families/caves.ts, rules/families/caves.ts, caves-progress.ts): flags engagementCostZero, noProgressPlaced, losesNoDamage, excessToQuestProgress, questProgressCap/Placed, noQuestProgress, combatDamageCanceled, attackableAsEngaged; verbs BottomOtherLooked, RemoveSourceFromGame, SetAsideInPlay; conditions stageProgress, xReachesRemaining, highestThreat; amount `stage`.
- Records (the-caves-of-nibin-dum.ts, pool/TDoM.ts 41042/41048/41049); ledger inert line 1 on 41048/41049; playable.ts; effects:open has no line for this scenario.
- Tests: nibin-quest, nibin-torch, nibin-encounter, nibin-boons, nibin-campaign, nibin-standalone, golden-nibin-dum (+ golden json), play/nibin-table, choice-words (Caves section). Scripts: nibin-dum-scene.ts, nibin-dum-game.ts.
- Phone half: caves-words.ts, attack sheet note, Resolution sentence "completes the campaign" (`settledSentence(.., completes)`), carry sentence capital/verb, brief + architecture, Maestro flows written.

## In progress
- Fixtures nibin-dum-won / nibin-dum-lost (scripts/e2e-nibin-dum.ts, chains from oath-won): search running; fixtures.ts + fixtures.test.ts + e2e route comment to wire.

## Next
- Full verification list, STATUS note (engine half done is NOT to be written; phone checks and Maestro open), delete this file.

## Decisions
- A stage that arrives with 0 quest points is not met on arrival (quest.ts advanceStage): 41005 prints 0 and adds 4 per enemy, its When Revealed has not run yet. 01121/01128 unaffected (Restrict advance).
- usage.ts does not announce an exhausted cost (changing it moves golden-south): the Cave Torch's Action and Cavern Warg's Response exhaust through an `Exhaust` instruction instead of a cost.
- Lost in the Dark: only the controller of the Cave Torch chooses; if nobody controls it nothing happens.
- Highest threat (41051:B:1) counts players still in the game.
- Cave Torch "up to 3 progress" offers 1 to 3.
- Input-only edits: standalone.test.ts (playable list), oath-campaign.test.ts (cards for the later scenario), choice-words.test.ts (Oath section excludes Caves pool records).

## Lines still open
- none for this scenario
