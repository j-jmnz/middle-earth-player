# The Dungeons of Cirith Gurat

Haradrim part 8 (The Dungeons of Cirith Gurat, `DoCG`), standalone only, on Easy and Normal (Q07.8, E07.8). Encounter sets The Dungeons of Cirith Gurat, Mordor Orcs and Harad Territory (`hrd.setup-the-dungeons-of-cirith-gurat`). The scenario adds The Captives of Cirith Gurat (`hrd.captives-of-cirith-gurat`), Valour (`bts.valour`), Abaan and the encounter side quest Captured! (17131).

- **Setup.** Stage 1A prints "Set Uruk Chieftain aside, out of play. Add The Captives of Cirith Gurat and 1 copy of Dungeon Cell to the staging area. Attach Abaan to Dungeon Cell. Each player searches the encounter deck for a different Orc enemy and adds it to the staging area. Shuffle the encounter deck. Starting with the first player, each player discards cards from the top of his deck until an ally that is not in play is discarded and attaches that ally to an unattached enemy in the staging area." (`17132:A:1`). The reader gives an aside, a staging clause, the shared attach step, the search of an Orc enemy for each player, a shuffle and the step `captureAllyFromDeck`.
- **Piles.** The staging pile holds The Captives of Cirith Gurat (17119) and Dungeon Cell (17125); the set-aside pile holds Uruk Chieftain (16061) and Abaan (17120), whom the Setup attaches. DragnCards stages Abaan and four Orc enemies (Jailer of Cirith Gurat 17121, Prison Guard 17122, Uruk of Mordor 16062, Uruk Warg-rider 16063); five overrides put Abaan aside and the four enemies in the encounter pile, because the players find them there.
- **Side quest.** Captured! (The Dungeons of Cirith Gurat) is in the encounter pile at both difficulties.
- **Captured characters (what the engine needs).** While a character is attached to an encounter card, it is a guarded objective with a blank text box: it loses its card type and its player card status; when it is rescued it gets both back. A card in a player's deck is discarded, found and attached as an ally from the deck (`captureAllyFromDeck`); a hero is attached by stage 3A as a captive. The Captives objective discards tokens and attachments from a captured character, returns an objective free of encounters to its owner, exhausted. Abaan: the first player gains control while he is free of encounters; the players lose if he leaves play.
- **Errata.** None.

## Data

- Stage 1B makes enemies and locations that guard an objective immune to player card effects and reveals an encounter card after characters are rescued; stage 2B needs 2 resources and no engaged enemy; stage 3A adds Uruk Chieftain and attaches a hero to an enemy as a captive.
- Prison Guard and Dungeon Cell hold captured characters (Dungeon Cell: +X Threat, X the printed Willpower of the attached objective).

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: `hrd.captives-of-cirith-gurat`, https://visionofthepalantir.com/2019/11/10/the-dungeons-of-cirith-gurat/ and https://lotr-lcg-quest-companion.gamersdungeon.net/haradrim-cycle-quest-the-dungeons-of-cirith-gurat.html (fan sources, no official ruling on the side quest). User rulings that touch it: the Uruk-hai Captives (`docs/scenarios/the-two-towers/the-uruk-hai.md`), Lost in Mirkwood (`docs/scenarios/ered-mithrin/lost-in-mirkwood.md`).

- Captured characters (span-settled). `hrd.captives-of-cirith-gurat`: a character attached to an encounter card is a guarded objective with a blank text box and loses card type and player card status; rescued, it regains both. Basis: that span.
- Captured! (`17131:A:1`) (recommended). The ally attached to the side quest is the one the player loses control of; when the quest is defeated it returns to its owner's control, exhausted, as a rescued objective, and the threat reduction uses the printed cost. Not taken: the ally is discarded. Basis: `hrd.captives-of-cirith-gurat`. Sources: the review above states the same.
- Not eliminated (user ruling, `docs/scenarios/ered-mithrin/lost-in-mirkwood.md`). A player is not eliminated while an enemy holds their only hero; a guard that leaves play returns the hero, exhausted. Basis: that ruling, applied to stage 3A.
- Abaan (`17120:A:1`) (span-settled). "While Abaan is free of encounters, the first player gains control of Abaan"; attached to Dungeon Cell he is guarded by it. Basis: the printed line.
- Ally that is not in play (span-settled). The discard stops at the first ally that no player has in play (unique allies in play are skipped). Basis: the printed line.
- Setup ally (span-settled). The captured ally keeps its owner. Basis: `hrd.captives-of-cirith-gurat`.
