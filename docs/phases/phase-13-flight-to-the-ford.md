# Phase 13 — Flight to the Ford

Engine half depends on: phase 12's engine half
Phone half depends on: phase 12
Blocks: phase 14

**State (2026-10-26):** engine half done and merged (the `burden` family; records in `src/effects/authored/flight-to-the-ford.ts`; `flight-to-the-ford` is in `src/campaign/playable.ts`). `/reviewer` ran on it (non-blocking findings listed in `STATUS.md`); `/ux` has not. The phone half is built and unit-tested; the phone checks, the three Maestro runs and their fixtures are open.

## Goal

`flight-to-the-ford` is playable, including the burden deck and the Ring-bearer's life. Follow the scenario procedure in phase 12.

## Cards

- Stage 1A (141028) Setup, in printed order: shuffle each burden of the Flight to the Ford burden set (five cards, numbered 81 to 85) into a Burden deck. Attach An Evil Wound (141057) to the Ring-bearer. Set Ford of Bruinen and The Witch-king aside, out of play. Add The Last Bridge and 1 Fell Rider per player to the staging area. Set the Ring-bearer's life at 15. Shuffle the encounter deck.
- 1B: the players cannot advance unless The Last Bridge is in the victory display. Forced: at the end of the round, reduce the Ring-bearer's life by 1.
- 2B (141029): When Revealed adds Ford of Bruinen and The Witch-king. While at least 1 Nazgûl enemy is in play, +15 quest points (the source prints this line twice; the ledger has it once). Defeating this stage wins.
- Campaign card 141056 front, Response: after an enemy is declared as an attacker, shuffle the top card of the burden deck into the encounter deck to cancel that attack. Any player may trigger it. That is a response offered to every seat, with no limit printed.
- Campaign card back: add each burden card **in play**, in the encounter deck, and in the discard pile to the Campaign Pool. Burdens left in the burden deck are not earned. The brief's earlier paraphrase dropped "in play". The card wins.
- Sources disagree on the Black Steed Easy count (3 against 1). Settle it from the printed Easy marks.
- Booklet difficulty 5. Encounter sets: Flight to the Ford, Hunted, The Black Riders, The Nazgûl. Not The Ring.

## Burden deck

A zone created by the Setup line. When a burden is discarded, it goes to the encounter discard pile (MEC109, The Burden Deck).

## Life

Created by the Setup line at 15. Its own number. The refresh step does not change it. Reducing life lowers it. Healing a character does not raise it. Life 0 loses the game. The life number changes only through engine steps with a cause.

## E2E

`.maestro/flight-to-the-ford.yaml` opens a seeded save at the start of this scenario and asserts the life readout is 15 and the burden deck count is 5. The same ids are absent on a scenario 1 save. A resolution flow unlocks `the-ring-goes-south` on a win and writes nothing on a loss.

Written, 2026-10-26 (cloud session, none has run): `.maestro/flight-to-the-ford.yaml` (the start: life 15, burden deck 5, kill and relaunch), `.maestro/flight-to-the-ford-win.yaml` (the Resolution asks nothing and unlocks `the-ring-goes-south`) and `.maestro/flight-to-the-ford-loss.yaml` (Defeat at life 0 writes nothing); `scenario-1.yaml` asserts `life` and `burden-deck` are absent. The ids are `life` and `burden-deck` (the value is `<id>-value`). **Open:** their fixtures `ford-start`, `ford-won` and `ford-lost` are not committed. A fixture is a real save, and these start from the log that scenarios 1 and 2 write when won; no win of either has been found with the starter decks (phases 11 and 12), so the chain cannot be built honestly. Add the three names to `src/campaign/fixtures.ts` when `scripts/e2e/fixtures.ts --won` finds the chain.

## Exit

The procedure's two halves. A win adds exactly the burdens the campaign card names. Life 0 loses. Healing does not raise life. On the phone, the tracker and the burden deck show for this scenario and are hidden for scenario 1.
