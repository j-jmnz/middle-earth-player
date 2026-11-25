# The Dunland Trap

The Ring-maker part 4 (pack `TDT`), standalone only, on Easy and Normal (Q04.4, E04.4). Encounter sets The Dunland Trap, Dunland Warriors and Weary Travelers (`rm.setup-the-dunland-trap`; the two other sets are in The Voice of Isengard). The rulesheet prints the Secrecy X keyword of the player cards (`rm.secrecy`) and a strategy tip about the many "after a player draws" Forced effects.

- **Setup.** Stage 1A prints "Set Chief Turch and Munuv Dûv Ravine aside, out of play. Make Old South Road the active location. Each player searches the encounter deck for a Boar Clan enemy and puts it into play engaged with him. Shuffle the encounter deck." (`08011:A:1`; Hall of Beorn's text spells the ravine "Du^v"). The Setup reader gives it an aside, an active location and the step `eachPlayerEngagesTraitEnemy` (trait Boar Clan).
- **Piles.** The `setAside` pile holds Chief Turch (08014) and Munuv Dûv Ravine (08015), the `activeLocation` pile Old South Road (08016). Chief Turch is the enemy card of this scenario. No override.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B prints Time 2 (`08011:B:1`); stage 3B prints Time X, where X is 5 times the number of players (`08013:B:1`). Stage 2A makes Munuv Dûv Ravine the active location and returns the previous one to the staging area (`08012:A:1`).
- Chief Turch (08014) prints "Chief Turch engages the first player" and a Forced effect on every enemy that engages a player (`08014:A:2`, `08014:A:3`). Old South Road (08016) removes a time counter from the current quest at the end of the refresh phase.
- Hills of Dunland (08020) and Hithaeglir Foothills (08019) read the draw of cards; Hills of Dunland prints the "does not stack" clause.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Draw triggers (`08017:A:2`, `08018:A:1`, `08019:A:3`, `08020:A:1`) (span-settled). A draw of several cards is one draw: "after a player draws any number of cards" triggers once, and the rulesheet's tip orders the Forced effects of several cards that share the trigger one after the other. Basis: `rr.drawing-cards`, the rulesheet tip (`tdt`).
- `08020:A:1` (span-settled). Hills of Dunland in the staging area gives itself the Forced effect: after a player draws, discard the top card of the encounter deck; if it is a Dunland enemy it enters play engaged with that player. A second copy in the staging area adds nothing. Basis: `rm.does-not-stack`.
- `08019:A:2` (span-settled). "X is the number of resource tokens on this card" gives the X of the card's printed stat its value, live. Basis: `rr.constant-ability`.
- `08013:B:1` (span-settled). Time X on the final stage: the players put 5 times their number of time counters on it when it is revealed. Basis: `rm.time-x`.
- `08013:B:3` (span-settled). When the last counter leaves the stage, the players make engagement checks; then each engaged enemy makes an attack; the players win when no hero was destroyed. Basis: the printed line, `rr.attack-resolution-chart`.
- `08013:A:1`, `08014:A:1` (span-settled). Chief Turch is put into play engaged with the first player; he cannot leave play and cannot have attachments, and he engages the first player. Basis: the printed lines.
- `08014:A:3` (span-settled). Each time any enemy engages a player a time counter is removed from the current quest; the Boar Clan enemies the Setup puts into play engaged are engaged by an effect and trigger it. Not taken: only an engagement check triggers it. Basis: `rr.engaged`, the printed line.
- `08012:A:1`, `08012:B:2` (span-settled). Stage 2B advances to stage 3A at the end of the combat phase; each player discards each Item and each Mount attachment and all allies but one at 2A. Basis: the printed lines.
- `08021:A:1`, `08022:A:1` (span-settled). While the location is the active location the resource phase draw is none (Plains of Enedwaith) or 2 cards (Hithaeglir Stream) for every player. Basis: the printed lines.
- `08005:A:1` (Close Call, Doomed X) (settled). The reading is in the cycle file, Player card readings, under the key `08005:A:1`.
