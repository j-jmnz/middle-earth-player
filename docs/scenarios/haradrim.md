# Haradrim

The data, rulings and readings of the Haradrim cycle, scenario by scenario. Product rules, the Domain and the Core round are in `docs/brief.md`; the authority order is in `.claude/rules/authority.md`.

The cycle of 2016: the deluxe expansion The Sands of Harad (`TSoH`, three scenarios) and its six Adventure Packs The Mûmakil (`M`), Race Across Harad (`RAH`), Beneath the Sands (`BtS`), The Black Serpent (`TBS`), The Dungeons of Cirith Gurat (`DoCG`) and The Crossings of Poros (`CoP`). Like The Ring-maker it is `kind: "cycle"` (`data/campaigns/haradrim.json`): no campaign card, no booklet, no boon or burden and no Campaign Mode, so every game is standalone. Nightmare is not built. The cycle is data: `scripts/data/cycle-defs.ts` (its nine scenarios with the DragnCards decks `Q07.n` and `E07.n`), `scripts/data/campaign-defs.ts` (its seven products), `scripts/data/normalize/setup-haradrim.ts` (the Setup sentences of the stage 1A cards the other readers do not read), and `scripts/data/haradrim.test.ts` (its piles, counts and spans). The printed ledger is `data/printed/haradrim.json`.

- **Data.** Each scenario's encounter sets are printed in the insert of The Sands of Harad (`tsoh`) or the pack's rulesheet (`mum`, `rah`, `bts`, `tbs`, `dcg`, `cop`), as the span `hrd.setup-<scenario id>`. The FFG rulesheets have a text layer; `bts` was read for Valour only (`bts.valour`) and is now read whole. The piles are the DragnCards load lists' (Q07.1 to Q07.9, E07.1 to E07.9), checked against the stage 1A card's Setup; the departures are overrides in `data/overrides.json`, each with its reason and source, and are named in the scenario's file. The Setup readers' printed text differs from Hall of Beorn's in Race Across Harad (River Harnen, the Orcs' area): the ledger line wins.
- **Rules the cycle owns.** Side quests (`hrd.side-quests`, `hrd.encounter-side-quests`, `hrd.player-side-quests`, `hrd.side-quests-in-play`, `hrd.current-quest`, `hrd.anatomy-of-side-quests`, `hrd.limit-one-in-victory-display`), Archery X (`hrd.archery`), Immune to player card effects (`hrd.immune-to-player-card-effects`), the heat tracker (`hrd.heat-tracker`), objective-heroes and heroes in the staging area (`hrd.objective-heroes`, `hrd.objective-hero-elimination`, `hrd.heroes-in-the-staging-area`, `hrd.guarded-heroes`, `hrd.stage-number`), the Orcs' area (`hrd.prepare-the-orcs-area`, `hrd.orcs-area`, `hrd.orcs-area-different-stage`, `hrd.orcs-area-same-stage`), Doomed X on player cards (`hrd.doomed-x-player-cards`), the Search objective and Track X (`hrd.search-objective`, `hrd.track`, `hrd.track-example`), Valour (`bts.valour`), Guarded (X) with types (`hrd.guarded-x`, `hrd.guarded-x-example`), the Captives of Cirith Gurat (`hrd.captives-of-cirith-gurat`), set aside encounter sets (`hrd.multiple-encounter-sets`, `hrd.removed-from-the-game`) and the Encounter keyword (`hrd.encounter-keyword`).
- **FAQ spans and errata.** The FAQ has no span for a card of the cycle: its answers on side quests and Guarded (`faq.side-quest-current-quest-text`) are used. The FAQ lists no erratum for a Haradrim card. Hall of Beorn marks an erratum on Dwarf Pipe (17007) and Quickbeam (17135); the scan and the ledger hold the printed text, and the erratum is read at the player card tests.
- **Shared encounter sets.** The first scenario that deals a set holds its readings; a later scenario reuses them. Harad Soldiers: Escape from Umbar, The Black Serpent, The Crossings of Poros. Harad Territory: Escape from Umbar, Beneath the Sands, The Dungeons of Cirith Gurat. Desert Sands: Desert Crossing, Race Across Harad, The Crossings of Poros. Desert Creatures: Desert Crossing, Beneath the Sands, The Crossings of Poros. Jungle Forest: The Long Arm of Mordor, The Mûmakil. Mordor Orcs: The Long Arm of Mordor, Race Across Harad, The Dungeons of Cirith Gurat, The Crossings of Poros. A card keeps one record in every scenario that deals it, so a fix in one scenario's reading moves the others' saved games.
- **Mechanics the engine has not read before.** The heat tracker (a counter, not a time counter), objective-heroes and heroes in the staging area, guarded heroes, Capture objectives attached to enemies, the Orcs' area with a second quest deck and a table widget, Track X and the Search objective, Guarded (enemy or location), captured characters as guarded objectives with a blank text box, branching stages with set aside encounter sets and the Encounter keyword. The cycle owns the side-quest code, the Guarded code, the Track keyword and the objective heroes. Each is built by the scenario that first deals it (`docs/agents/agent-brief.md`, Scenario procedure); none is built by the data.
- **Readings.** Each scenario file lists what its cards, rulesheet and sources leave open or settle, with sources (`.claude/rules/authority.md`, Open points). A reading is `span-settled` (a rule span or the printed line settles it), `researched` (an official online source settles it) or `recommended` (no official source settles it); each file's Readings to confirm lists every `recommended` reading and every one settled by community discussion alone. The research rows were written against source text, so the scenario's Read task confirms every line against the scan-read ledger.

## Scenario files

- `docs/scenarios/haradrim/escape-from-umbar.md`: Escape from Umbar
- `docs/scenarios/haradrim/desert-crossing.md`: Desert Crossing
- `docs/scenarios/haradrim/the-long-arm-of-mordor.md`: The Long Arm of Mordor
- `docs/scenarios/haradrim/the-mumakil.md`: The Mûmakil
- `docs/scenarios/haradrim/race-across-harad.md`: Race Across Harad
- `docs/scenarios/haradrim/beneath-the-sands.md`: Beneath the Sands
- `docs/scenarios/haradrim/the-black-serpent.md`: The Black Serpent
- `docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md`: The Dungeons of Cirith Gurat
- `docs/scenarios/haradrim/the-crossings-of-poros.md`: The Crossings of Poros

## Player card readings

The player card readings use the same statuses. The keys are `<code>:<line>`, written from the scan-read ledger (`data/printed/player-cards.json`).

- Valour (`17058`, `17084`, `17110`, `17113`, `17118`) (span-settled). A Valour Action or Response can only be used by a player whose threat is 40 or higher; an event with a Valour effect and another one gives the choice of one. Basis: `bts.valour`.
- Side quests of the player pool (`16013`, `17003`, `17036`, `17059`, `17087`) (span-settled). A player side quest is played in the planning phase for its cost and placed in the staging area; "Limit 1 copy in the victory display" sends a second defeated copy to its owner's discard pile. Basis: `hrd.player-side-quests`, `hrd.limit-one-in-victory-display`, `docs/brief.md` (Player side quests, contracts and saga cards).
- Encounter (`17144`) (span-settled). Wind from the Sea is a player card with an encounter back, set aside at Setup and shuffled in by Flight to the Sea (`17140`). Basis: `hrd.encounter-keyword`.
- `17135:A:1` (span-settled). Quickbeam's printed text is the ledger's: "Cannot have restricted attachments." and the Action that deals 2 damage to ready him; Hall of Beorn's erratum marker matches it. Basis: the scan.
- `17056:A:1` (span-settled). Haradrim Spear attaches to a Harad character (the card's trait is Harad); Hall of Beorn's text said "Haradrim". The record follows the scan. Basis: the scan.
- `17007` (span-settled). Dwarf Pipe is read from the scan; the FAQ has no erratum for it.

## Readings to confirm

Each scenario file lists its own; none of the player card readings needs confirming.
