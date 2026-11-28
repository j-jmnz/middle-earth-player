# Danger in Dorwinion

Vengeance of Mordor part 2 (A Shadow in the East), standalone only, on Easy and Normal (Q09.2, E09.2). Encounter sets Danger in Dorwinion, Servants of Sauron, City of Rhûn and Under Guard (`vom.setup-danger-in-dorwinion`). The quest is three stages, and the scenario adds Plot objectives, Cultist enemies and the encounter side quests Shadow of Fear (21043) and Unwelcome Travelers (21052).

- **Setup.** Stage 1A prints "Setup: Set each Plot objective and each Cultist enemy aside, out of play. Each player searches the encounter deck for a different location and adds it to the staging area. One of those locations must be Side Street. Shuffle the encounter deck." (`21077:A:1`). The reader gives one aside clause naming the three Plot objectives (Bribes 21033, Submit or Die 21034, Sauron Worship 21035) and the three Cultist enemies (Priest of Sauron 21030, The Governor 21031, Black Númenórean 21032), `eachPlayerAddsLocation` and the step `mustBeLocation` (Side Street 21049).
- **Piles.** DragnCards loads the Plot objectives as a second shared deck and the Cultist enemies as a third; the cycle definition sets both aside. The locations the players add are searched in the encounter deck (the staging pile is empty).
- **Stage 2A and 3A.** Stage 2A adds 1 random set-aside Plot objective and reveals 1 encounter card per player; stage 3A adds 1 random set-aside Cultist and X enemies (X one less than the players) from the shuffled deck. The Hall of Beorn Easy counts equal the Normal ones for the six cards.

## Data

- Evidence of the Cult has Guarded (enemy) (`hrd.guarded-x`, `hrd.guarded-x-example`); Priest of Sauron, The Governor and Black Númenórean are Victory 6 and immune to player card effects.
- Stage 3B: the Cultist takes at most X damage each round, X the printed quest points of the active location; when it is defeated the players win.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/vengeance-of-mordor.md`. Each key is the scan-read ledger line (`data/printed/vengeance-of-mordor.json`), `<code>:<side>:<n>`. Sources read: the insert of A Shadow in the East, https://visionofthepalantir.com/2025/10/01/qotw-danger-in-dorwinion/ (a quest-of-the-week post whose comments are player reports), ALeP = https://alongextendedparty.com/semi-official-errata-faq-1-10/ (no entry for the scenario). A line not listed here is span-settled.

- Random set-aside Plot and Cultist (`21078:A:1`, `21079:A:1`) (recommended). The player who resolves the card draws the random card from the set-aside pile without looking, and the pile of a type that is empty adds nothing. Not taken: the first player picks. Why recommended: no source says who draws; the post above and the cards print "random" only, and no official ruling settles it.
- Secret Cultist (`21039:A:1`) (recommended). It attaches to the ally with the highest printed Attack among the allies in play; on a tie the first player chooses; with no ally it is discarded with no effect, and the attached ally is an enemy engaged with its owner, with a blank text box. Not taken: highest current Attack. Why recommended: the card says "highest attack"; the post above has players describing Gandalf the White with a Staff, and no official source settles ties or a missing ally.
- Seedy Tavern (`21047:A:1` to `21047:A:3`) (recommended). The facedown cards under it belong to no player's hand; "explored" includes an exploration in the staging area, so each facedown card is revealed whenever the location is explored there or as the active location. Not taken: only an active exploration reveals them. Why recommended: no source covers a Tavern explored in the staging area; the printed text says "explored" without "as the active location", unlike Hideous Deeps.
- Leader of the Cult (`21079:B:1`) (recommended). With no active location the cap X is 0 and the Cultist takes no damage. Not taken: no cap. Why recommended: the card gives no value for a missing active location; no source settles it.
- Stage 1B and 2B (`21077:B:1`, `21078:B:1`) (span-settled). A resource is placed each time the active location leaves play as an explored location, whatever the explorer. Basis: `rr.explored`.
