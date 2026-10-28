# Phase 33 handover (The Caves of Nibin-Dûm)

## Done
- STATUS `active`. New family `caves` (catalog/families/caves.ts, rules/families/caves.ts, caves-progress.ts): flags engagementCostZero, noProgressPlaced, losesNoDamage, excessToQuestProgress, questProgressCap/Placed, noQuestProgress, combatDamageCanceled, attackableAsEngaged; verbs BottomOtherLooked, RemoveSourceFromGame, SetAsideInPlay; conditions stageProgress, xReachesRemaining, highestThreat; amount `stage`.
- Records: src/effects/authored/the-caves-of-nibin-dum.ts and pool/TDoM.ts (41042, 41048, 41049). Ledger: inert line 1 on 41048/41049. `effects:open` has no line for this scenario; playable.ts updated.
- Quest tests: src/campaign/nibin-quest.test.ts (green). Scene: scripts/nibin-dum-scene.ts.

## In progress
- Encounter card tests (enemies, locations, treacheries), Cave Torch tests, boon tests.

## Next
- Golden (scripts/nibin-dum-game.ts, golden-nibin-dum.test.ts), campaign tests, phone half (choice-words, brief, Maestro, fixtures), card-smoke, full verification.

## Decisions
- 0-quest-point stage is no longer met on arrival (quest.ts advanceStage): 41005 prints 0 and adds 4 per enemy, its When Revealed has not run yet. 01121/01128 unaffected (Restrict advance).
- Lost in the Dark: only the controller of the Cave Torch chooses; if nobody controls it nothing happens.
- Highest threat (41051:B:1) counts players still in the game.
- Ranger Sense "up to 3 progress" Cave Torch action offers 1 to 3.
- Input-only edits: standalone.test.ts (playable list), oath-campaign.test.ts (cards for the later scenario), choice-words.test.ts (Oath section excludes Caves pool records).

## Lines still open
- none for this scenario
