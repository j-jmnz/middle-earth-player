# Desert Crossing

Haradrim part 2 (The Sands of Harad, `TSoH`), standalone only, on Easy and Normal (Q07.2, E07.2). Encounter sets Desert Crossing, Desert Creatures and Desert Sands (`hrd.setup-desert-crossing`). The scenario adds the heat tracker and the temperature (`hrd.heat-tracker`) and the encounter side quests Seek Shade (16023), Find Water (16048) and Craft Remedy (16053).

- **Setup.** Stage 1A prints "Each player searches the encounter deck for a copy of Burnt Sands and adds it to the staging area. Shuffle the encounter deck. Place the heat tracker next to the quest deck and set the temperature to 10." (`16068:A:1`). The Setup reader gives a per-player staging clause (one copy of Burnt Sands, 16025, for each player, of the four in the set) and the step `setTemperature` with count 10.
- **Piles.** The staging pile holds Burnt Sands. No override.
- **Side quests.** Seek Shade, Find Water and Craft Remedy are in the encounter pile, one copy each, at both difficulties.
- **Heat tracker (what the engine needs).** A counter next to the quest deck, shown as a threat tracker: the temperature, set to 10 at Setup, increased by quest stages and cards, reduced by Seek Shade, with the players lost at 60 or more (`16068:B:3`, `16069:B:2`, `16070:B:3`). Cards read its tens digit (X). It is not a time counter: the Ring-maker's time code is not used.
- **Errata.** None.

## Data

- The three stages each increase the temperature by 4 at the end of the round; stage 2B and 3B deal or add its tens digit as X. Stage 1B: each ally entering play is exhausted or takes 1 damage.
- Were-worm, Scorched Hamada and Unbearable Heat read X as the tens digit; Burnt Sands gets +2 Threat at 40 or more.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: `hrd.heat-tracker`, https://visionofthepalantir.com/2019/08/17/desert-crossing/, https://lotr-lcg-quest-companion.gamersdungeon.net/ (a fan site; it explains the heat tracker setup as the insert does).

- Temperature (span-settled). Any unused threat tracker serves as the heat tracker; its value is the temperature; at 60 the players lose the game. Basis: `hrd.heat-tracker`.
- Tens digit (span-settled). X is the tens digit of the temperature: 10 to 19 is 1, 20 to 29 is 2, up to 5; at 60 the game is over. Basis: the printed lines (`16026:A:1`, `16029:A:1`).
- Temperature at 0 (recommended). Seek Shade's "reduce the temperature by 10" cannot take the temperature below 0, as a threat dial holds no negative value. Not taken: a negative temperature. Basis: the FAQ answer that a threat dial holds no negative value (`lotr_faq_19.pdf`, page 18). Sources: none found for the heat tracker.
- Were-worm shadow (`16028:A:3`) (span-settled). "+2 Attack instead if the temperature is 40 or higher" replaces the +1. Basis: the printed line.
- Beasts of Legend (`16070:A:1`) (span-settled). "Each player searches the encounter deck, discard pile, and victory display for a Were-worm": one different Were-worm for each player, if able; the cards found in the victory display leave it. Basis: the printed line.
- Side quests (span-settled). Seek Shade, Find Water and Craft Remedy follow the side-quest rules of Escape from Umbar. Basis: `hrd.side-quests-in-play`.

## Readings to confirm

- Temperature at 0: recommended. See Readings.
