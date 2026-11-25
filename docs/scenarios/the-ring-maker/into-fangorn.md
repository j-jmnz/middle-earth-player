# Into Fangorn

The Ring-maker part 3 (The Voice of Isengard, `VoI`), standalone only, on Easy and Normal (Q04.3, E04.3). Encounter sets Into Fangorn, Ancient Forest and Weary Travelers (`rm.setup-into-fangorn`; the insert spells the last "Weary Travellers"; Ancient Forest is shared with The Three Trials, Weary Travelers with The Dunland Trap and The Nîn-in-Eilph). The scenario adds the Hinder keyword (`rm.hinder`) and the "does not stack" clause (`rm.does-not-stack`).

- **Setup.** Stage 1A prints "Add Edge of Fangorn to the staging area and attach Mugash to that location. Shuffle the encounter deck. Reveal X encounter cards where X equals the number of players in the game minus 1." (`07065:A:1`, read from the scan; Hall of Beorn's text adds the word "additional"). The Setup reader gives it a staging step with an attach step, a shuffle and the step `revealPlayersLessOne`.
- **Piles.** The staging pile holds Edge of Fangorn (07032). DragnCards stages the objective Mugash (07031), but the Setup attaches him to Edge of Fangorn, so an override (`scenarioPiles`) puts him in the set-aside pile. The quest pile holds the three stages.
- **Errata.** None for a card of this scenario.

## Data

- Mugash here is the objective (07031) with the Guarded keyword; the enemy of To Catch an Orc is another card. Stage 1B prints Time 4, 2B Time 4 and 3B Time 3 (`07065:B:1`, `07066:B:1`, `07067:B:1`).
- Hinder is on the three Huorn enemies (07033, 07034, 07035) and is not in the `keywords` of `data/cards`; the records name it by their first lines. Immune to player card effects is on Edge of Fangorn (`faq.immune-expanded`).
- Ancient Forest (07050) and Tangled Woods (07051) print "This ability does not stack with other copies".

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Hinder (`07033:A:1`, `07034:A:1`, `07035:A:1`) (span-settled). While engaged with a player, an enemy with Hinder is not dealt a shadow card and does not make an attack during the combat phase. At the beginning of the combat phase each player removes 1 progress from the current quest for each Hinder enemy engaged with him; when the quest holds no progress the progress is removed from the active location, and when neither holds any there is no effect. Not taken: the enemy still attacks, or the progress comes off a location first. Basis: `rm.hinder`.
- Hinder and an attack by effect (researched, community-agreed). A Hinder enemy is stopped from attacking in the combat phase only; the Forced attack of Angry Huorn at the beginning of the resource phase (`07034:A:2`) and the immediate attack of The Forest's Malice (`07037:A:1`) are not made "during the combat phase" and resolve. An engaged Hinder enemy that attacks by a card effect, or outside the combat phase, is dealt a shadow card as any such attack is. Not taken: Hinder stops every attack, or an effect attack is dealt no shadow card. Basis: `rm.hinder` (the no-shadow and no-attack clauses describe the combat phase), `rr.attacks-outside-the-combat-phase`, `faq.enemy-attacks-outside-combat`. Sources: https://ffg-forum-archive.entropicdreams.com/topic/127326-the-forests-malice (four posters agree), https://visionofthepalantir.com/2018/06/11/into-fangorn.
- `07051:A:1`, `07050:A:1` (span-settled). Two copies of Ancient Forest in the staging area give each Forest location there +1 Threat and +3 quest points in all, not +2 and +6; the same holds for Tangled Woods. Basis: `rm.does-not-stack`.
- `07051:A:1` (span-settled). The gained Travel cost is on each Forest location in play (the staging area and the active location); the ledger reads "in play". Basis: the printed line.
- `07031:A:1` to `07031:A:3` (span-settled). The Setup attaches Mugash to Edge of Fangorn, which guards him; a hero exhausts to claim him when he is free of encounters and he attaches to that hero. If the attached hero takes damage, Mugash returns to the top of the encounter deck. Basis: the printed lines, `rr.objective-cards`.
- `07065:B:3`, `07066:B:2` (span-settled). The players cannot advance from stage 1 unless Mugash is attached to a hero; when the last counter leaves stage 1B or 2B, Mugash is shuffled into the encounter deck and the stage advances. Basis: the printed lines, `rm.time-x`.
- `07057:A:2` (span-settled). Off Track attaches to a location in play as a Condition with the text the card gives: the location gets +2 quest points and gains a Forced effect that removes an additional time counter from the current quest at the end of each refresh phase, if able. Basis: the printed line.
- `07052:A:1` (span-settled). "Either remove 1 time counter from a card in play, or return the active location to the staging area": the first player selects the card when more than one card holds a counter, and the players decide as a group which of the two the effect does (an either-or is no listed matter of the first player's final say); the first needs a card that holds a time counter. Not taken: the players choose the card. Basis: `rr.first-player` (an encounter effect that targets a single card with several eligible targets: the first player selects it), the printed line.
- `07058:A:1` (span-settled). In Need of Rest removes a hero from the quest and attaches to it; the Condition damages the attached hero after a time counter leaves the current quest. Basis: the printed line.
- Surge (`07057:A:1`) (span-settled). Basis: `rr.surge`.
