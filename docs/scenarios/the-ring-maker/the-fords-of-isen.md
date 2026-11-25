# The Fords of Isen

The Ring-maker part 1 (The Voice of Isengard, `VoI`), standalone only, on Easy and Normal (Q04.1, E04.1; DragnCards labels the decks "Fords of Isen"). Encounter sets The Fords of Isen, Dunland Warriors and Dunland Raiders (`rm.setup-the-fords-of-isen`; the two Dunland sets are shared with The Dunland Trap and The Antlered Crown). The cards print the Time X keyword on the three quest stages (`rm.time-x`) and the Gríma objective-ally (`rm.grima-objective-ally`).

- **Setup.** Stage 1A prints "Add The Islet to the staging area and attach Gríma to that location. Each player searches the encounter deck for 1 different Dunland enemy and adds it to the staging area. Shuffle the encounter deck." (`07059:A:1`, read from the scan). The Setup reader turns it into a staging step with an attach step and a search of one Dunland enemy for each player (`scripts/data/normalize/setup-the-ring-maker.ts`).
- **Piles.** The staging pile holds Gríma (07016) and The Islet (07017) as the load list has them; the Setup attaches Gríma to The Islet, so the build accepts an attached card in the staging pile (`pileAccepts`). The quest pile holds the three stages. No override.
- **Errata.** None for a card of this scenario.
- **Cards of other scenarios.** The Dunland Warriors and Dunland Raiders cards (07042 to 07048) keep one record in each scenario that deals them (`docs/scenarios/the-ring-maker.md`).

## Data

- Stage 1B has Time 5 (`07059:B:1`), stage 2B Time 2 (`07060:B:2`) and stage 3B Time 3 (`07061:B:1`). Each stage 2B and 3B prints the Forced effect that resolves when the last counter is removed and puts the counters back. The ledger holds the printed order of stage 2B (When Revealed first, then Time 2), where the source text lists the Time line first.
- Gríma (07016) has the objective-ally type: an objective and an ally (`rm.grima-objective-ally`). Fords of Isen (07018) and The King's Road (07019) read the cards in a player's hand; Gap of Rohan (07020) removes a time counter from the current quest with its shadow effect.
- Immune to player card effects is printed on The Islet (`faq.immune-expanded`).

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Gríma hero (span-settled). While the scenario is played no player can use the hero card Gríma (07002); the scenario author builds the deck check that refuses it. Not taken: both Gríma cards in play. Basis: `rm.grima-objective-ally`, `rr.unique-cards`.
- `07016:A:1` to `07016:A:3` (span-settled). Gríma is attached to The Islet at Setup. The first player gains control of him when he is free of encounters; he then sits in that player's play area and acts as any ally (his Action: exhaust to draw a card). If Gríma leaves play, the players lose. Basis: `rm.grima-objective-ally`, the printed lines.
- `07059:B:2`, `07059:B:3` (span-settled). When the last time counter leaves stage 1B, Gríma is discarded from play, which loses the game by `07016:A:3`. The players cannot advance unless the first player controls him. Not taken: the discard is a cost the players avoid. Basis: the printed lines, `rm.time-x`.
- Cards in hand (`07019:A:1`, `07019:A:2`, `07042:A:1`, `07042:A:2`, `07043:A:1`, `07043:A:2`, `07044:A:1`, `07047:A:1`, `07060:B:3`, `07061:B:2`) (span-settled). A condition on "any player" reads every player's hand, and a value that counts the cards in a hand is counted live. Not taken: counted once at the reveal. Basis: `rr.constant-ability`, `rr.lasting-effects`.
- "After a player draws any number of cards" (`07046:A:2`, `07048:A:1`) (span-settled). Cards drawn at the same time are one draw: the effect triggers once for the draw. Basis: `rr.drawing-cards`.
- `07020:A:2`, `07022:A:1` (span-settled). "Remove 1 time counter from the current quest" removes it from the stage in play; when it removes the last one the Forced effect of that stage triggers as it does at the end of a refresh phase. Basis: `rm.time-x`, `mec108.time-x`.
- `07045:A:2`, `07049:A:2` (recommended). Old Hatreds and Wild Men of Dunland attach to the current quest as a Condition with the text the card gives. The attachment leaves play with the stage it is attached to when the quest advances, as an attachment does when its host leaves play (`rr.attachment-cards`); the next stage does not inherit it. Not taken: the attachment moves to the next stage. Basis: `rr.attachment-cards`, `rr.quest-advancement`. Sources: none found for these two cards.
- `07022:A:1` (span-settled). Each player chooses between removing a time counter from the current quest and searching for a Dunland enemy; if any player has 5 or more cards in hand the effect cannot be canceled. Basis: the printed line.

## Readings to confirm

- `07045:A:2`, `07049:A:2`: recommended. The Condition leaves play with the stage. See Readings.
