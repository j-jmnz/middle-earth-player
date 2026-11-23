# over-the-misty-mountains-grim hand-off

## Read (done)
Scaffold written (pnpm scenario new; data build; pack 226 KB, about 57.9k tokens, 26 drafts, 47 open lines). Readings are in docs/scenarios/the-hobbit.md, section Over the Misty Mountains Grim (+ Readings to confirm).
Piles: encounter 12, encounterDeck2 11, quest 3 (cards). encounterDeck2 deals as SetAside instructions.

## Mechanics, no new verb found
- Deck swap 131028:A:1: DiscardAllInPlay (enemy any, location any, attachment playerCard false, objective) + SetAsideEncounterDeck + ShuffleSetAsideSet x2 (Misty Mountain Goblins, The Great Goblin) + search The Great Goblin to staging + ShuffleEncounterDeck. Sea family precedent (src/rules/families/sea/swap.ts, the-city-of-corsairs.ts).
- 131028:B:1 inVictory condition (angmar precedent); B:2 ChooseX (max Bilbo's baggins pool) + pay + RevealEncounter times 3/player - X, min 1: Build must check the amount expression allows it; if not, a flag on RevealEncounter (encounter family).
- 131026:B:1: copy the 132001:A:2 record's search shape (pack has it).
- Gains-text locations (131041, 131067, 131068), conditional surge (131064, 131062): precedents in Dwarrowdelf and Angmar.
