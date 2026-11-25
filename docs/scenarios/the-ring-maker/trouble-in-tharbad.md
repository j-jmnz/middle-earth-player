# Trouble in Tharbad

The Ring-maker part 6 (pack `TiT`), standalone only, on Easy and Normal (Q04.6, E04.6). Encounter sets Trouble in Tharbad and Misty Mountain Orcs (`rm.setup-trouble-in-tharbad`; Misty Mountain Orcs is from The Voice of Isengard). The rulesheet defines the threat elimination level (`rm.threat-elimination-level`) and the rules for an attack made against Nalir (`rm.attacks-against-nalir`).

- **Setup.** Stage 1A prints "Set Bellach and The Crossing at Tharbad aside, out of play. Search the encounter deck for 1 copy of Spy From Mordor per player, and add them to the staging area. Make The Empty Mug the active location. The first player takes control of Nalir, as an ally. Shuffle the encounter deck." (`08066:A:1`; Hall of Beorn's text spells the enemy "Spy from Mordor"). The Setup reader gives each sentence its clause; the Spy copies are one for each player.
- **Piles.** The `setAside` pile holds Nalir (08068), Bellach (08070) and The Crossing at Tharbad (08071); `groups: { player1Play1: "setAside" }` moves Nalir out of player 1's play area, where DragnCards loads him. The `activeLocation` pile holds The Empty Mug (08069); the staging pile holds the Spy From Mordor copy (08072). No count override.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B prints Time 4 and lowers each player's threat elimination level by 10 each time the counters run out (`08066:B:2`, which the ledger spells "elimination"; the source text misspells it). Stage 1B also cancels progress and reduces each player's threat by an equal amount (`08066:B:3`) and ends when all players have 0 threat (`08066:B:4`). Stage 2B prints Time 3 and moves the progress to The Crossing at Tharbad (`08067:B:4`).
- Nalir (08068) is the objective-ally of this scenario; Bellach (08070) prints X as the number of players. The Crossing at Tharbad (08071) prints "+2 quest points for each player", cannot leave the staging area and ends the game when explored.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Threat elimination level (`08066:B:2`) (span-settled). A player's threat elimination level is the threat at which the player is eliminated, 50 by default; the stage lowers it by 10 for the rest of the game each time the last counter leaves. A player whose threat is equal to or higher than the current level is eliminated, as `rr.threat-elimination-level` has it. Not taken: the level resets with the stage. Basis: `rm.threat-elimination-level`.
- Attacks against Nalir (span-settled). An attack made against Nalir works as an attack against the player who controls him, except that undefended damage must be assigned to Nalir. Basis: `rm.attacks-against-nalir`, `08083:A:1`, `08083:A:2`.
- `08068:A:1` to `08068:A:3` (span-settled). The first player controls Nalir from the Setup as an ally; at the beginning of the refresh phase his controller raises threat by 1 for each player in the game; if Nalir leaves play the players lose. Basis: the printed lines, `rm.attacks-against-nalir`.
- `08066:B:3` (span-settled). Each time progress is placed on stage 1B all of it is canceled and each player's threat is reduced by an equal amount (the amount of the canceled progress); the players cannot go below 0. Not taken: each player reduces by the total. Basis: `rr.threat-threat-dial`.
- `08066:B:4` (span-settled). When every player has 0 threat the players advance to stage 2. Basis: the printed line.
- `08067:B:2` (recommended). Bellach attacks Nalir as an immediate attack by an effect: Nalir is the defender and takes the damage; the players choose between that and raising each player's threat by 3. Not taken: the first player chooses for all. Basis: `rm.attacks-against-nalir`. Sources: none found.
- `08067:B:4` (span-settled). Each time any character leaves play, its controller raises threat by 2. Basis: the printed line.
- `08070:A:2` (span-settled). Orc and Creature enemies get -30 engagement cost and +1 Threat while Bellach is in play. Basis: the printed line.
- `08069:A:1`, `08069:A:2` (span-settled). Players cannot reduce their threat while The Empty Mug is in play; while it is in the victory display the current quest gains a Forced effect that removes from the game a card whose effect reduced a player's threat. Basis: the printed lines.
- `08075:A:2` (span-settled). Time counters cannot be removed from the current quest while Tharbad Hideout is the active location. Basis: the printed line, `rm.time-x`.

## Readings to confirm

- `08067:B:2`: recommended. Bellach's attack on Nalir and the choice. See Readings.
