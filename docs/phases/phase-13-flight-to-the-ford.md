# Phase 13 — Flight to the Ford

Depends on: phase 12
Blocks: phase 14

## Goal

`flight-to-the-ford` is playable, including the burden deck and the Ring-bearer's life tracker.

## Scenario

Booklet difficulty 5. Encounter sets: Flight to the Ford, Hunted, The Black Riders, The Nazgûl. Not The Ring.

Freeze a codes-and-counts fixture from the quest cards and the booklet. Assert the Normal deck size. Author the new effect records. Coverage stays red until every dealt ability has an effect id.

## Burden deck

The five burden cards numbered 81–85, shuffled, set beside the quest deck. When a burden is discarded, it goes to the encounter discard pile.

The booklet's win line adds all burden cards in the encounter deck and the discard pile to the campaign pool. It does not say to sweep the burden deck. Encode the sentence you can point at. Re-read the quest card before deciding the leftovers. Do not add a sweep the card does not print.

## Life

Starts at 15. Its own number. The refresh step does not increment it. Reducing life lowers that number. Healing a character does not raise it. Life 0 loses the game.

The life number and the threat number change only through engine steps. The widget renders only when this script declares it.

## E2E

`.maestro/flight-to-the-ford.yaml` opens a seeded save at the start of this scenario and asserts the life readout is 15. The same id is absent on a scenario 1 save. A resolution flow unlocks `the-ring-goes-south` on a win and writes nothing on a loss.

## Exit

Coverage is green. A win adds the burden cards the printed sentence names and unlocks `the-ring-goes-south`. A loss writes nothing. Life 0 loses. Healing does not raise life. On the phone, the tracker is visible for this scenario and hidden for scenario 1.
