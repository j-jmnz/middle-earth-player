# Celebrimbor's Secret

The Ring-maker part 8 (pack `CS`), standalone only, on Easy and Normal (Q04.8, E04.8). Encounter sets Celebrimbor's Secret, Misty Mountain Orcs and Broken Lands (`rm.setup-celebrimbors-secret`; the two other sets are from The Voice of Isengard). The rulesheet defines the Scour keyword (`rm.scour`, with its example) and The Orcs' Search (`rm.the-orcs-search`).

- **Setup.** Stage 1A prints "Add Bellach, The Orcs' Search, and The Secret Chamber to the staging area. Attach Celebrimbor's Mould to The Secret Chamber. Each player adds a different Ost-in-Edhil location to the staging area. Shuffle the encounter deck." (`08122:A:1`). The Setup reader gives a staging step, an attach step and the location step for each player (trait Ost-in-Edhil).
- **Piles.** The staging pile holds Bellach (08124), The Orcs' Search (08125), The Secret Chamber (08126) and the Ost-in-Edhil locations (Ruined Plaza 08130, Collapsed Tower 08131, Ancient Foundation 08132, City Remains 08133). DragnCards stages Celebrimbor's Mould (08127), but the Setup attaches it to The Secret Chamber, so an override (`scenarioPiles`) puts it in the set-aside pile. The quest pile holds two stages.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B and 2B print Time 3 and trigger each Scour effect currently in play when the last counter leaves (`08122:B:2`, `08123:B:2`). Bellach is immune to player card effects and cannot be engaged until stage 2B holds 12 progress.
- Scour is printed in bold on Bellach, Bellach's Scout, Prowling Orc, Collapsed Tower and Ancient Foundation (`rm.scour`), and four cards of the scenario read "underneath The Orcs' Search". Scour is not in the `keywords` of `data/cards`; the records name it by the lines `08124:A:2`, `08128:A:2`, `08129:A:2`, `08131:A:2` and `08132:A:1`.
- Bellach (08124) prints X as the number of cards underneath The Orcs' Search.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Scour (span-settled). The keyword does nothing alone; when a quest card or encounter card tells the players to trigger a scour effect, they resolve the effect that follows the keyword on each card named, in an order the first player chooses; each player resolves per-player effects ("Each player must search ...") in player order. A scour effect on a card in the discard pile triggers only when a card says so (`08133:A:1`). Not taken: the effect triggers by itself. Basis: `rm.scour` and its example (Bellach and Collapsed Tower).
- "Trigger each Scour effect currently in play" (`08122:B:2`, `08123:A:1`, `08123:B:2`, `08134:A:1`) (span-settled). Each card in play with the keyword is a trigger, whether it is in the staging area, engaged or the active location. Basis: `rm.scour`.
- `08133:A:1` (recommended). "Trigger the topmost Scour effect in the discard pile, if able": the card nearest the top of the encounter discard pile that has the keyword; the card stays in the discard pile and its effect is resolved as if it were in play. With no such card nothing happens. Not taken: the effect of the first card found from the bottom. Basis: `rm.scour` (the effect that follows the keyword on that card). Sources: none found for this card; https://rulespal.com/the-lord-of-the-rings-the-card-game-celebrimbors-secret/rulebook and https://visionofthepalantir.com/2018/06/30/celebrimbors-secret/ give the rulesheet text only.
- The Orcs' Search (`08125:A:1`, `08125:A:2`) (span-settled). A location with damage equal to its printed quest points goes facedown underneath The Orcs' Search; any tokens and attachments on a card are discarded first; a card there is not in play and only interacts with effects that name the cards underneath. Each card underneath raises each player's threat by 1 at the end of the refresh phase. Basis: `rm.the-orcs-search`.
- Damage on a location (`08130:A:1`, `08131:A:2`, `08132:A:1`, `08128:A:2`, `08129:A:1`, `08135:A:1`) (span-settled). Damage placed on a location is tracked on the location and counts for the check of `08125:A:1`. Basis: `rm.the-orcs-search`, `rr.damage`.
- `08126:A:3` (span-settled). If The Secret Chamber is placed underneath The Orcs' Search the players lose the game. Basis: the printed line.
- `08127:A:1`, `08127:A:2` (span-settled). The first player claims Celebrimbor's Mould when it is free of encounters and attaches it to a hero; if that hero leaves play the players lose. The stage cannot advance unless it is attached to a hero. Basis: the printed lines.
- `08123:A:1` (span-settled). Stage 2A makes Bellach attack the player who controls the Mould, then attaches the Mould to Bellach. Basis: the printed line.
- `08123:B:3` (span-settled). Bellach is immune to player card effects and cannot be engaged unless stage 2B holds at least 12 progress; the players cannot win unless the Mould is attached to a hero. Basis: the printed line. The ledger corrects "at last" to "at least" and keeps the two sentences as separate lines.
- `08132:A:1` (span-settled). Ancient Foundation's scour assigns X damage among locations in play, X being the number of locations in play; two copies in play assign once. Basis: `rm.does-not-stack`.
- `08136:A:1`, `08135:A:2`, `08130:A:2`, `08133:A:2`, `08134:A:2` (span-settled). X is the number of cards underneath The Orcs' Search (or the cost of the destroyed ally for `08135:A:2`), counted when the shadow effect resolves. Basis: the printed lines.

## Readings to confirm

- `08133:A:1`: recommended. The topmost Scour card of the discard pile. See Readings.
