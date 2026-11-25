# Race Across Harad

Haradrim part 5 (Race Across Harad, `RAH`), standalone only, on Easy and Normal (Q07.5, E07.5). Encounter sets Race Across Harad, Desert Sands and Mordor Orcs (`hrd.setup-race-across-harad`). The scenario adds the Orcs' area with a second quest deck (`hrd.prepare-the-orcs-area`, `hrd.orcs-area`, `hrd.orcs-area-different-stage`, `hrd.orcs-area-same-stage`), the Tamed Mûmak objectives and Doomed X on player cards (`hrd.doomed-x-player-cards`).

- **Setup.** Stage 1A prints "Set River Harnen and 1 copy of Uruk Warg-rider aside, out of play. Each player takes control of a Tamed Mûmak. Remove each remaining Tamed Mûmak from the game. Create the Orcs' area with a second quest deck consisting of stage 1C, 2C, 3C, and 4C. Place Uruk Chieftain in the Orcs' area." (`17047:A:1`, read from the scan: Hall of Beorn's text says "Ford of Harnen" and puts Uruk Chieftain in the quest deck sentence). The reader gives an aside, the step `takeControl` for the players, `removeFromGame` and the step `createOrcsArea` (the four C stages, then Uruk Chieftain).
- **Piles.** The set-aside pile holds River Harnen (17039), Uruk Warg-rider (16063), the four Tamed Mûmak (17038), Uruk Chieftain (16061) and the Orcs' quest deck, stages 1C to 4C (17051 to 17054). The quest pile holds the players' stages 1A to 4A (17047 to 17050). DragnCards' second quest deck (`sharedQuestDeck2`) maps to the set-aside pile (`groups` in `scripts/data/cycle-defs.ts`), and its rows, which carry the guid of the stage of the same title, are named by collector number (`dragnCardCodes`). A quest card in the set-aside pile is not a stage of the players' deck (`scripts/data/normalize/scenarios.ts`). DragnCards also sets aside one copy of five locations (Expanse of Harad, Blistering Erg, Harad Road, Towering Dunes, Desert Oasis); five overrides put them in the encounter pile, because stage 1B searches the encounter deck for locations.
- **The Orcs' area (what the engine needs).** A second quest deck of four stages whose C and D sides are in play; a play area for cards (enemies, locations) beside the staging area. The Orcs' stage gets progress at the end of each quest phase; it advances through its C and D sides. While the Orcs and the players are at different stages, the cards in the Orcs' area are immune to player card effects, cannot leave it and are not in the staging area; at the same stage they are. A table widget for the area is the scenario author's.
- **Tamed Mûmak.** Each player takes control of one (objective ally); "If Tamed Mûmak leaves play, the controlling player is eliminated" (`17038:A:3`).
- **Errata.** None.

## Data

- Stages 2B to 4B cap the progress placed each round at 5 (10 with every Tamed Mûmak committed). Stage 4B wins the game; stage 2D, 3D and 4D lose it when defeated at the wrong stage or by the Orcs.
- Racing Warg attaches to an Orc enemy; Uruk Pursuer, Pursuers from Mordor and Harad Road are added to the Orcs' area.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: `hrd.orcs-area`, https://visionofthepalantir.com/2018/07/09/race-across-harad/, https://community.fantasyflightgames.com/topic/243779-habemus-race-across-harad-spoilers/?page=4 (a forum thread that asks the player side quest question without an official answer).

- The Orcs' stage (span-settled). The top stage of the Orcs' deck is "the Orcs' stage"; its Forced effect places X progress, where X is the discarded card's Threat plus the total Threat in the Orcs' area. Basis: `hrd.orcs-area`, `17051:B:2`.
- Same stage (span-settled). Players are at "the same stage" when their main quest stage's name and number match the Orcs' ("2B-Racing North" and "2D-Racing North"). Basis: `hrd.orcs-area-different-stage`.
- Catching up (span-settled). When the Orcs reach the players' stage, the cards in their area stop being immune, can leave, and count in the staging area; the players may engage enemies and travel to locations there. Basis: `hrd.orcs-area-same-stage`.
- Stage 2C "has already defeated stage 2B" (`17052:A:1`) (span-settled). The Orcs' stage reads the players' progress through their own quest deck, not their current stage. Basis: the printed line.
- A side quest as the current quest (recommended). A player side quest or encounter side quest chosen as the current quest does not change the stage the players are at for the "same stage" test; the main quest stage does. Not taken: the side quest counts. Basis: `hrd.orcs-area-different-stage` (it says "main quest stage"). Sources: the forum thread above raised it without an official answer.
- Printed spelling (span-settled). Stage 2D, 3D and 4D print "Orc's area" and "Orcs' area"; both name the same area. Basis: the scans (`17052:B:2`, `17053:B:2`).
- River Harnen (`17039:A:2`) (span-settled). The players cannot travel there unless stage 4B holds at least 20 progress; the ledger reads "there is at least 20 progress". Basis: the printed line.
- Doomed X on player cards (span-settled). `hrd.doomed-x-player-cards`, `rr.doomed-x`.

## Readings to confirm

- A side quest as the current quest: recommended. See Readings.
