# The Black Serpent

Haradrim part 7 (The Black Serpent, `TBS`), standalone only, on Easy and Normal (Q07.7, E07.7). Encounter sets The Black Serpent and Harad Soldiers (`hrd.setup-the-black-serpent`). The scenario adds Guarded (X) with a list of types (`hrd.guarded-x`, `hrd.guarded-x-example`), Valour (`bts.valour`) and the encounter side quest Don't Let Them Escape! (17104).

- **Setup.** Stage 1A prints "Set each Harad objective aside, out of play. Add The Black Serpent to the staging area. Shuffle the encounter deck. The first player randomly selects 1 set aside Harad objective, reveals it, and adds it to the staging area." (`17106:A:1`). The reader gives an aside of the three Harad objectives (Banner of the Serpent 17091, The Serpent's Garb 17092, Summons from Mordor 17093), a staging clause and the step `revealRandomAsideObjective`.
- **Piles.** The staging pile holds The Black Serpent (17094); the set-aside pile holds the three Harad objectives. No override.
- **Side quest.** Don't Let Them Escape! (The Black Serpent) is in the encounter pile at both difficulties.
- **Guarded (X) (what the engine needs).** Ered Mithrin's Guarded (X) (`emce.guarded-x`, user ruling: with no matching card the objective stays unguarded) and The Wilds of Rhovanion's (`wor.guarded-x`) exist. The cycle prints three forms: Guarded (enemy or location), Guarded (enemy) and Guarded (location); the guard is the first discarded card of a listed type. Each objective has an Action that exhausts it.
- **Errata.** None.

## Data

- Stage 1B, 2B and 3B require the first player to claim any unattached Harad objective and attach it to a hero, and cannot be defeated until each Harad objective in play is attached to a hero. Stage 3A attaches a random objective to The Black Serpent.
- The Black Serpent (17094) cannot leave the staging area or take damage; X is the stage number.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: `hrd.guarded-x`, `hrd.guarded-x-example`, https://lotr-lcg-quest-companion.gamersdungeon.net/haradrim-cycle-quest-the-black-serpent.html (a fan site that restates the empty-deck rule), https://visionofthepalantir.com/2019/12/03/the-black-serpent/.

- Guarded (X) (span-settled). On reveal, discard cards from the encounter deck until one of a listed type is discarded; add it to the staging area and attach the objective to it; after that it works as the Guarded keyword. Basis: `hrd.guarded-x`, `hrd.guarded-x-example`.
- Several types (span-settled). "Guarded (enemy or location)" takes the first discarded card of either type; "Guarded (enemy)" and "Guarded (location)" take one of that type. Basis: `hrd.guarded-x-example`.
- No match (user ruling, `docs/scenarios/ered-mithrin.md`). An empty encounter deck while resolving the keyword: the discard pile is shuffled in and the discard continues; if no card of the type exists the objective is unguarded. Basis: that ruling.
- Capital letters (span-settled). Summons from Mordor prints "GUarded (location)" on the card; the ledger corrects it. Basis: the scan (`17093:A:1`).
- Attached objectives (span-settled). The Action of each Harad objective is usable by the player who controls it once a hero holds it; while attached to an encounter card the passive lines apply. Basis: the printed lines.

## Readings to confirm

None beyond the user ruling above.
