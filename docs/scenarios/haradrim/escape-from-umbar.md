# Escape from Umbar

Haradrim part 1 (The Sands of Harad, `TSoH`), standalone only, on Easy and Normal (Q07.1, E07.1). Encounter sets Escape from Umbar, Harad Soldiers and Harad Territory (`hrd.setup-escape-from-umbar`). The scenario adds the Archery X keyword (`hrd.archery`) and the encounter side quests Southron Champion (16040) and In Enemy Territory (16045) (`hrd.side-quests`, `hrd.encounter-side-quests`).

- **Setup.** Stage 1A prints "Add "Seize them!" to the staging area. Each player adds 1 different location to the staging area and puts 1 copy of Umbar Sentry into play engaged with him. Shuffle the encounter deck." (`16066:A:1`). The Setup reader gives it a staging clause, `eachPlayerAddsLocation` and the step `putCopyEngagedEachPlayer`. The card's title has straight quotes in the data and curly ones on the quest card; the reader names it with both.
- **Piles.** The staging pile holds "Seize Them!" (16014) and one copy of each of the five Umbar locations (16016 to 16020), which the Setup finds in the encounter deck (`searched`, so they are dealt with the encounter pile and the encounter count includes them). No override moves a pile.
- **Counts.** Hall of Beorn lists 2 Enemy Pursuit (16021), 5 Umbar Sentry (16015) and 1 Umbar Street (16017) at Easy; DragnCards loads 1, 4 and 2. Three `scenarioCounts` rows keep Hall of Beorn's Normal counts for the first two and the DragnCards Easy count of Umbar Street (staged copy only).
- **Side quests.** Southron Champion (Harad Soldiers) and In Enemy Territory (Harad Territory) are in the encounter pile, one copy each, at both difficulties. Their set was `null` in `data/cards`; the scenario files of Hall of Beorn give it, and the card normaliser reads it from there.
- **Errata.** None.

## Data

- Stage 2A has "When Revealed: End the current phase." (`16067:A:1`). Stage 1B and 2B cannot hold more than 15 progress tokens, and neither can be defeated while a player is engaged with an enemy.
- "Seize Them!" is lost to the Forced effect that removes progress from the main quest when an enemy destroys a character; the players lose when the main quest has no progress at the end of a round it has been in play for the whole of.
- Umbar Sentry and Southron Archer print Archery; Archery is a keyword the data does not hold, the records name it by the line.

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/haradrim.md`. Each key is the scan-read ledger line (`data/printed/haradrim.json`), `<code>:<side>:<n>`. Sources read: the Sands of Harad insert (`hrd.archery`, `hrd.side-quests`), https://warriorsofthewestblog.wordpress.com/2016/12/12/turn-by-turn-report-escape-from-umbar/ and https://visionofthepalantir.com/2019/09/08/escape-from-umbar/ (play reports, not rules authorities).

- Archery X (`16015:A:1`) (span-settled). The cumulative archery damage is dealt to characters in play at the beginning of each combat phase and may be split among the players; the first player decides a disagreement; [defense] does not block it. Basis: `hrd.archery`.
- Side quests (`16040:A:1`, `16045:A:1`) (span-settled). An encounter side quest revealed from the encounter deck goes to the staging area; its "when revealed" effect cannot be canceled by player card effects; it functions like a quest card and is added to the victory display when defeated, with no advance to the next stage. Basis: `hrd.encounter-side-quests`, `hrd.side-quests-in-play`, `hrd.current-quest`, `faq.side-quest-current-quest-text`.
- "End the current phase" (`16067:A:1`) (recommended). The phase ends at once: nothing else of that phase's steps is resolved, the rest of the "When Revealed" effect (shuffle, engage an enemy for each player) still resolves, and the game proceeds to the next phase. Not taken: the phase finishes its current step first. Basis: the printed line. The play reports above describe the same, none is an official ruling. Sources read, none rules on it: https://hallofbeorn.com/LotR/Details/Flee-the-City-TSoH (card page, no ruling), https://ffg-forum-archive.entropicdreams.com/topic/224887-the-sands-of-harad/page/6 (no post on it), the two play reports above. The FAQ and the Rules Reference in `data/rules/` say nothing on it. No official or community answer found, so it stays recommended.
- "Seize Them!" (`16014:A:2`) (recommended). "In play the entire round" counts from the round the main quest entered play: a stage revealed in the middle of a round does not count for that round. Not taken: the check runs the round the stage is revealed. Basis: the printed line. Sources read, none rules on it: https://hallofbeorn.com/LotR/Details/Flee-the-City-TSoH (card page, no ruling), https://ffg-forum-archive.entropicdreams.com/topic/224887-the-sands-of-harad/page/6 (no post on it), https://visionofthepalantir.com/2019/09/08/escape-from-umbar/ (play report). The FAQ and the Rules Reference in `data/rules/` say nothing on it. No official or community answer found, so it stays recommended.
- Umbar Sentry (`16015:A:2`) (span-settled). The Forced effect is a choice the player makes when it attacks: remove 1 progress, or the Sentry gets +2 Attack. Basis: the printed line.
- Setup copies (span-settled). The copy of Umbar Sentry each player puts into play is found in the encounter deck; with fewer players the other copies stay in it. Basis: `16066:A:1`.

## Readings to confirm

- "End the current phase": recommended. See Readings.
- "Seize Them!": recommended. See Readings.
