# over-the-misty-mountains-grim hand-off

## Read (done)
Scaffold written (pnpm scenario new; data build; pack 226 KB, about 57.9k tokens, 26 drafts, 47 open lines). Readings are in docs/scenarios/the-hobbit.md, section Over the Misty Mountains Grim (+ Readings to confirm).
Piles: encounter 12, encounterDeck2 11, quest 3 (cards). encounterDeck2 deals as SetAside instructions.

## Mechanics, no new verb found
- Deck swap 131028:A:1: DiscardAllInPlay (enemy any, location any, attachment playerCard false, objective) + SetAsideEncounterDeck + ShuffleSetAsideSet x2 (Misty Mountain Goblins, The Great Goblin) + search The Great Goblin to staging + ShuffleEncounterDeck. Sea family precedent (src/rules/families/sea/swap.ts, the-city-of-corsairs.ts).
- 131028:B:1 inVictory condition (angmar precedent); B:2 ChooseX (max Bilbo's baggins pool) + pay + RevealEncounter times 3/player - X, min 1: Build must check the amount expression allows it; if not, a flag on RevealEncounter (encounter family).
- 131026:B:1: copy the 132001:A:2 record's search shape (pack has it).
- Gains-text locations (131041, 131067, 131068), conditional surge (131064, 131062): precedents in Dwarrowdelf and Angmar.

## Build (done)
Commits on feat/over-the-misty-mountains-grim: Misty Mountain Goblins set 71cadfa4 (never rewrite; later changes are `fix: ... Misty Mountain Goblins`); lessX flag d91c8301; own records 2cf41c47; specs 0ad38dd7; Western Lands cherry-pick b0f99548 (from 0bad3ba0; the-hobbit.ts and open-lines.ts conflicts kept both sides).
Records: set-misty-mountain-goblins.ts (exports MISTY_MOUNTAIN_GOBLINS_EFFECTS, spread by the-hobbit.ts, because the barrel takes only files that export AUTHORED_EFFECTS and are named for a scenario/campaign), over-the-misty-mountains-grim.ts (quest, Over the Misty Mountains Grim, The Great Goblin sets).
Added: RevealEncounter `lessX: true` (encounter family; times minus the effect's X, at least 1); StageDiscarded `trait` (wilderland family); lineTimings reads "Forced: When faced with the option to travel" as constant too (scripts/data/normalize/timings.ts, for 131067:A:2). Render words and read-field samples updated.
Engine fact: a stage card arrives with face B (arrivalFace), so at stage 3's arrival 131028:A:1 (swap) and B:2 (reveal 3 per player less X) resolve in one frame, in that order; there is no A-side completion before B. The kit's `resolve` act runs the records of both sides, so spec rows for 131028 A:1 and B:2 isolate by what they expect.
Bilbo's spend is a DiscardResources of X from his pool (SpendResources takes a literal amount); his pick is `type: "card"` (the layout cannot put a hero in the heroes zone).
Specs so far (spec.test.ts): 131027:B:1, 131028:A:1, B:1, B:2 (x2), 131064:A:1, 131072:A:1, A:2, 131073:A:1 (x2). Still no row: 131026:A:1, B:1, 131028:B:3, 131062, 131063, 131064:A:2, 131066, 131067, 131068, 131069, 131071; the Misty Mountain Goblins rows are Finish too. Asks missing: 131070:whenRevealed:1 @0.0 and 131073:whenRevealed:1 @0 (Pick enemy). Goldens, seed finder, -lost fixture, campaign test, Table step: Finish.
Guffawing: Delay (endOfPhase, subject picked) + Pick player highestThreat (first player breaks a tie) + SwitchActor + Engage target previous; works in a row (engaged with the highest-threat seat).
Doc: docs/scenarios/the-hobbit.md cites angmar-awakened.md "Jailor Gornákh", no such heading, so scripts/docs/index.test.ts fails (Read task's text).
