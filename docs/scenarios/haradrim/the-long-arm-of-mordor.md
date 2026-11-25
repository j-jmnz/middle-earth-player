# The Long Arm of Mordor

Haradrim part 3 (The Sands of Harad, `TSoH`), standalone only, on Easy and Normal (Q07.3, E07.3). Encounter sets The Long Arm of Mordor, Mordor Orcs and Jungle Forest (`hrd.setup-the-long-arm-of-mordor`). The scenario adds the objective-hero card type (`hrd.objective-heroes`, `hrd.objective-hero-elimination`), heroes in the staging area (`hrd.heroes-in-the-staging-area`), guarded heroes (`hrd.guarded-heroes`), the stage number (`hrd.stage-number`) and the encounter side quest Uruks of the Eye (16060).

- **Setup.** Stage 1A prints "Set Uruk Chieftain aside, out of play. Each player adds 1 copy of Sauron's Enforcers to the staging area. Move each hero to the staging area. Each player takes control of an objective-hero and adds 2 resources to its resource pool. Remove each remaining objective-hero from the game. For the remainder of the game, heroes in the staging area are in play but under no player's control, immune to player card effects, and their text boxes are considered to be blank." (`16071:A:1`). The reader gives an aside, a per-player stage, the steps `moveHeroesToStaging`, `takeObjectiveHero` (count of resources 2), `removeFromGame` and `heroesInStagingAreaBlank`.
- **Piles.** The set-aside pile holds the four objective heroes (16031 to 16034) and Uruk Chieftain (16061). The objective heroes had no encounter set and were not dealt; the card normaliser now deals the `Objective_Hero` type of a built product (`scripts/data/normalize/product-cards.ts`). DragnCards sets the four Sauron's Enforcers (16035) aside; an override stages them, one for each player, as the Setup says.
- **Objective heroes (what the engine needs).** Each player takes control of one chosen in turn order from the four; the others leave the game. An objective-hero is a neutral hero with no threat cost that does not count toward the limit of 3; it collects 1 resource in the resource phase. "If X leaves play, you are eliminated from the game" cannot be modified. Heroes in the staging area are under no player's control, immune to player card effects and blank; a player takes control of one by moving it from the staging area. Stage 3A attaches each hero in the staging area to a different Orc enemy as a guarded hero.
- **Side quest.** Uruks of the Eye (Mordor Orcs) is in the encounter pile at both difficulties.
- **Errata.** None.

## Data

- Stage 1B and 2B deal damage of undefended attacks to a hero in the staging area; the first card each player plays each phase needs no resource match. Stage 1B advances on a successful quest; stage 2B returns control of a hero to each player when defeated.
- Stage 4A adds Uruk Chieftain to the staging area; it cannot take non-combat damage and the stage cannot be defeated while it is in play.
- Sauron's Enforcers, Southron Boma and Overrun by Orcs read X as the stage number of the main quest.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: the Sands of Harad insert (`hrd.objective-heroes`, `hrd.heroes-in-the-staging-area`, `hrd.guarded-heroes`); no forum thread settles the recommended reading.

- Heroes in the staging area (span-settled). A hero there does not collect resources; if its hit points reach 0 it is destroyed and placed in its owner's discard pile; "owner" is the player who chose it as a starting hero. Basis: `hrd.heroes-in-the-staging-area`.
- Objective-heroes (span-settled). The four are dealt at Setup; each player takes one in turn order, starting with the first player, and the rest are removed. Basis: `hrd.objective-heroes`.
- Elimination (span-settled). The text "If X leaves play, you are eliminated from the game" cannot be modified; the player who controls the objective-hero is eliminated. Basis: `hrd.objective-hero-elimination`.
- Guarded heroes (span-settled). A hero attached to an Orc enemy by stage 3A is guarded by it and is treated like a guarded objective; the enemy's defeat returns it (`16073:B:2`). Basis: `hrd.guarded-heroes`, `rr.guarded`.
- Attachments on a moved hero (recommended). "Move each hero to the staging area" leaves the attachments of the hero attached; they stay in play with it, and a blank text box leaves their own text active. Not taken: the attachments are discarded. Basis: the printed line. Sources: none found.
- Boma shadow (`16036:A:3`) (span-settled). "If the defending character is an objective-hero, ready it and cancel all damage from this attack." Basis: the printed line.
- Sauron's Enforcers (span-settled). Each player adds 1 copy to the staging area; with fewer than 4 players the other copies are shuffled into the encounter deck, as the per-player Setup cards of other scenarios are. Basis: `16071:A:1`.

## Readings to confirm

- Attachments on a moved hero: recommended. See Readings.
