# The Temple of Doom

Vengeance of Mordor part 3 (A Shadow in the East), standalone only, on Easy and Normal (Q09.3, E09.3; DragnCards labels the deck "Temple of Doom"). Encounter sets The Temple of Doom, Ulchor's Guard, Twisted Tunnels, Easterling Raiders and The Power of Mordor (`vom.setup-the-temple-of-doom`). The quest is a stage 1 and four stage 2 cards; the scenario adds Thane Ulchor and Tribute to Mordor.

- **Setup.** Stage 1A prints "Setup: Shuffle each of the stage 2 quest cards together and place them facedown under this stage. Create The Power of Mordor deck (see insert) and set it next to the quest deck. Add Thane Ulchor and Tribute to Mordor to the staging area. Shuffle the encounter deck." (`21080:A:1`). The reader gives the steps `shuffleStageTwosUnder` and `buildPowerOfMordorDeck` (the set The Power of Mordor, `vom.power-of-mordor-deck-the-temple-of-doom`) and a staging clause.
- **Piles.** The five Power of Mordor cards are the second encounter deck (`encounterDeck2`); Thane Ulchor and Tribute to Mordor are staged; the four stage 2 cards are quest cards dealt in any order.
- **Quest stages.** "Quest stage" counts the double-sided cards from the quest deck in the victory display and no side quest (`vom.quest-stages-vs-side-quests`): stage 1B adds itself to the victory display when it advances, so it counts.

## Data

- Thane Ulchor has Indestructible and is immune to player card effects; Hall of Horrors and Thane Ulchor read X from the quest stages in the victory display.
- Each stage 2B stops progress while there are 4 quest stages in the victory display; Tribute to Mordor cannot be the active quest while Thane Ulchor has hit points.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/vengeance-of-mordor.md`. Each key is the scan-read ledger line (`data/printed/vengeance-of-mordor.json`), `<code>:<side>:<n>`. Sources read: the insert of A Shadow in the East (`vom.power-of-mordor-deck-the-temple-of-doom`, `vom.quest-stages-vs-side-quests`), https://visionofthepalantir.com/2020/11/19/the-temple-of-doom/ (a play article with one reader correction, no designer answer), ALeP = https://alongextendedparty.com/semi-official-errata-faq-1-10/ (no entry for the scenario). A line not listed here is span-settled.

- Thane Ulchor's X and engagement (`21054:A:2`) (span-settled). X is 1 more than the quest stages in the victory display, and he cannot be engaged, by a player or an effect, unless X is 5; the first stage 1 and three stage 2 cards make 4, so he is engageable at the last stage. Basis: `vom.quest-stages-vs-side-quests`; the post above reaches the same count but calls its own wording loose.
- Power of Mordor cards (recommended). A revealed card of the Power of Mordor deck is an encounter card that resolves as revealed; Khamûl the Easterling, which has no Victory number, goes to the encounter discard pile when defeated, not back to the Power of Mordor deck. Not taken: a discarded card returns to its own deck. Why recommended: the post above says Khamûl "can possibly return" through the encounter deck; no official source says where a discarded Power of Mordor card goes.
- Tribute to Mordor (`21053:A:1`) (span-settled). With 4 or more damage tokens it removes 4 and reveals the top card of the Power of Mordor deck; with none to reveal the players lose the game. Basis: the printed line (ledger misprint note).
- Hall of Horrors (`21056:A:2`) (span-settled). Each player deals all X damage to one character he controls. Basis: the printed words "a character he controls"; the post above corrected "amongst" to a single character.
- Stage 1B (`21080:B:1`, `21080:B:2`) (span-settled). The quest phase is skipped, the resource is placed at the end of the planning phase, and the second advances to the topmost stage 2A. Basis: the printed line.
