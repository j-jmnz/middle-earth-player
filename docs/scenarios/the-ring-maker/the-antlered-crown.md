# The Antlered Crown

The Ring-maker part 9 (pack `TAC`), standalone only, on Easy and Normal (Q04.9, E04.9). Encounter sets The Antlered Crown, Dunland Warriors and Dunland Raiders (`rm.setup-the-antlered-crown`; the rulesheet spells the two sets "Dunlending Warriors" and "Dunlending Raiders", the cards "Dunland"). The rulesheet defines the Raven deck (`rm.raven-deck`).

- **Setup.** Stage 1A prints "The first player takes control of Chief Turch. Set Raven Chief and Raven Chief's Camp aside, out of play. Reveal 1 copy of Dunland Battlefield and make it the active location. Reveal 1 copy of Raven War-camp and add it to the staging area. Create the Raven deck (see insert) and set it next to the quest deck. Each player chooses 1 different enemy from the Raven deck and adds it to the staging area. Shuffle the encounter deck and Raven deck." (`08147:A:1`). The Setup reader gives each sentence its clause; the Raven deck is the step `buildRavenDeck` with the six enemies of Dunland Warriors and Dunland Raiders (07042 to 07044 and 07046 to 07048).
- **Piles.** The `setAside` pile holds Chief Turch (08150), Raven Chief (08151), Raven Chief's Camp (08152) and the six Raven deck enemies; `groups: { player1Play1: "setAside", sharedEncounterDeck2: "setAside" }` moves Chief Turch and the Raven deck, which DragnCards loads in player 1's play area and as the second shared deck. The `activeLocation` pile holds Dunland Battlefield (08157), the staging pile one Raven War-camp (08155).
- **Override.** The Easy deck holds 2 Raven War-camp copies: Hall of Beorn lists 4 at Normal and 2 at Easy and DragnCards' E04.9 loads 3 (`data/overrides.json`, `scenarioCounts`, with its reason and source). The Normal deck stages 1 and leaves 3 in the encounter deck.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B prints Time 3 and removes a time counter from each location in play when the last counter leaves (`08147:B:2`); stage 3B prints Time 2 and ends with Raven Chief in the victory display (`08149:B:3`). Locations print Time on their first line (Raven War-camp 3, Raven Village 2, Dunland Battlefield 3, Raven Country 4, Raven Chief's Camp 3).
- Raven Skirmisher (08154) and Raven Country (08158) read "the Time X value on the active location"; Raising the Cry (08159) places X time counters, X being the "Time X" value of the location.
- Chief Turch (08150) is the objective-ally of this scenario and is immune to player card effects.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- The Raven deck (span-settled). The enemies of both sets are removed from the encounter deck and shuffled into a separate deck. A card revealed from the Raven deck has its staging resolved as if just revealed from the encounter deck; a card with Surge revealed from it makes the players reveal the top card of the encounter deck. An enemy that would leave play goes to the discard pile of the deck it came from; an empty Raven deck is refilled from its discard pile. Basis: `rm.raven-deck`.
- "Reveal" or "take" a Raven deck card (`08148:A:1`, `08148:B:2`, `08149:A:1`, `08155:A:1`, `08156:A:1`) (span-settled). Each is a reveal from the Raven deck when the card says "reveal" (When Revealed and Surge apply) and a take-and-add when it says "takes the top card ... and adds it to the staging area" (`08148:A:1`); the Setup choice of an enemy and the draw of Raven War-camp ("draws the top card of the Raven deck and puts it into play engaged") are not reveals. Not taken: every Raven deck card is a reveal. Basis: `rm.raven-deck` ("when a player is instructed to reveal"), `faq.reveal-and-add`.
- Shadow cards from the Raven deck (`08156:A:2`) (recommended). Raven Village deals the attacking enemy 2 additional shadow cards from the Raven deck; the cards are shadow cards drawn from that deck, and a Raven deck with fewer than 2 cards is refilled from its discard pile as `rm.raven-deck` says. Not taken: the cards come from the encounter deck. Basis: the printed line, `rm.raven-deck`. Sources: none found.
- Time X on locations (`08155:A:1`, `08156:A:1`, `08157:A:1`, `08158:A:1`, `08152:A:2`) (span-settled). A location gets its counters when it is revealed (or put into the staging area as the Setup does) and loses one at the end of each refresh phase wherever it is; the Forced effect and the re-placing of the counters follow the keyword. Basis: `rm.time-x`.
- "The Time X value" (`08154:A:2`, `08158:A:2`, `08159:A:1`) (recommended). It is the X printed in the keyword of the card (3 for Dunland Battlefield), not the counters left on it. Not taken: the counters left. Basis: the printed wording ("the 'Time X' value on that location"); `rm.time-x` names the keyword's X as the number of counters put on the card. Sources: none found.
- `08159:A:1` (span-settled). Raising the Cry removes 1 time counter from each location in play, then places X counters on each location left with none; with no location in the staging area it gains Surge. Basis: the printed line.
- `08150:A:1` to `08150:A:3`, `08013:A:1` (span-settled). The first player controls Chief Turch from the Setup; he does not exhaust to defend and is immune to player card effects; if he leaves play the players lose. Basis: the printed lines.
- `08151:A:1`, `08152:A:1` (span-settled). While Raven Chief's Camp is in play Raven Chief cannot be damaged; the Camp is immune to player card effects and exhausts each damaged character when its counters run out. Basis: the printed lines.
- `08149:B:3` (span-settled). At the end of the round, if Raven Chief is in the victory display, the players win the game. Basis: the printed line.
- `08160:A:1` (span-settled). Fierce Folk has Doomed 3, raises each player's threat by 3 when revealed, and stops events being played for the round after each player draws 3 cards. Basis: `rr.doomed-x`, the printed line.

## Readings to confirm

- `08156:A:2`: recommended. The shadow cards come from the Raven deck. See Readings.
- "The Time X value": recommended. The printed X. See Readings.
