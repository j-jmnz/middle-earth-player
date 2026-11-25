# The Mûmakil

Haradrim part 4 (The Mûmakil, `M`), standalone only, on Easy and Normal (Q07.4, E07.4). Encounter sets The Mûmakil and Jungle Forest (`hrd.setup-the-mumakil`; Jungle Forest is in The Sands of Harad and shared with The Long Arm of Mordor). The scenario adds the Capture objectives and the encounter side quest Guardians of the Jungle (17025).

- **Setup.** Stage 1A prints "Set each copy of Wild Mûmak and each Capture objective aside, out of play. Each player adds 1 different location to the staging area. Shuffle the encounter deck." (`17026:A:1`). The reader gives one aside clause naming the four Wild Mûmak (17015) and the four Capture objectives (Horse-hair Lasso 17011, Poisoned Spear 17012, Pit Trap 17013, Noose of Vines 17014; trait Capture) and `eachPlayerAddsLocation`.
- **Piles.** The set-aside pile holds Wild Mûmak and the four Capture objectives. DragnCards sets aside one copy each of Mûmak Trail (17020), Jungle Trail (16056), Forest Clearing (16057) and Dense Jungle (16058); four overrides stage them as locations the Setup finds in the encounter deck.
- **Stage 2A name.** DragnCards spells it "Capture the Mumakil", Hall of Beorn and the scan "Capture the Oliphaunts" (`17027`); the collector number maps the row (`dragnCardCodes`).
- **Side quest.** Guardians of the Jungle (The Mûmakil) is in the encounter pile at both difficulties.
- **Capture objectives (what the engine needs).** Stage 2A attaches one random set-aside Capture objective for each player to a Wild Mûmak in play, in player order; each is an objective the Mûmak guards; each Capture has its own Response that adds it and the Mûmak to the victory display; stage 2B cannot be defeated while a Capture objective is in play. Wild Mûmak is shuffled into the encounter deck by stage 1B each time the active location is explored.
- **Errata.** Dwarf Pipe (17007) has an erratum in Hall of Beorn's data; the FAQ lists none, so no span exists. The ledger line follows the scan.

## Data

- Wild Mûmak has Indestructible, is immune to player card effects and takes no more than 3 damage a round.
- Stage 1B cannot be advanced unless the number of Wild Mûmak in play equals the number of players.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: the Mûmakil rulesheet (it has no rule of its own beyond the Setup: `hrd.setup-the-mumakil`), the Sands of Harad insert.

- Attaching a Capture objective (`17027:A:1`) (recommended). The player chooses the Wild Mûmak in play for each objective; two Capture objectives may be on one Mûmak. Not taken: one objective for each Mûmak. Basis: the printed line says "a Wild Mûmak in play". Sources read: https://www.hallofbeorn.com/LotR/Details/Capture-the-Oliphaunts-TMk, https://visionofthepalantir.com/tag/mumak, https://www.fantasyflightgames.com/media/ffg_content/lotr-lcg/support/LotR-FAQ.pdf (search result only); the Rules Reference states no limit on attachments to one card. No official or community answer found, so the status stays recommended.
- Capture objective ownership (span-settled). An attached objective is a guarded objective of the enemy it is attached to; the engaged player resolves its Response. Basis: `rr.guarded`, the printed lines.
- Wild Mûmak limit (span-settled). "Cannot take more than 3 damage each round" is counted for the round; the excess is lost. Basis: the printed line.
- Mûmak Trail (`17020:A:1`) (span-settled). The gained Response searches for a Wild Mûmak when the location leaves play as an explored location. Basis: the printed line.
- Side quest (span-settled). `hrd.side-quests-in-play`.

## Readings to confirm

- Attaching a Capture objective: recommended. See Readings.
