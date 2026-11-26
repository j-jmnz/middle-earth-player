# The Nîn-in-Eilph

The Ring-maker part 7 (pack `NiE`), standalone only, on Easy and Normal (Q04.7, E04.7). Encounter sets The Nîn-in-Eilph and Weary Travelers (`rm.setup-the-nin-in-eilph`; Weary Travelers is from The Voice of Isengard). The rulesheet defines advancing to parallel stages (`rm.parallel-stages`) and prints Secrecy X (`rm.secrecy`).

- **Setup.** Stage 1A prints "The first player takes control of Nalir. Set the Ancient Marsh-dweller aside, out of play. Each player searches the encounter deck for a different location and adds it to the staging area. Shuffle the encounter deck." (`08094:A:1`).
- **Piles.** The `setAside` pile holds Nalir (08102) and Ancient Marsh-dweller (08103); `groups: { player1Play1: "setAside" }` moves Nalir out of player 1's play area. The staging pile holds the four Marsh locations the load list stages (08106 to 08109). The quest pile holds eight stages: 1A, the three stage 2 cards (08095 to 08097), the three stage 3 cards (08098 to 08100) and 4A (08101). DragnCards spells the pack "The Nin-in-Eilph", which `dragnPackAliases` maps to `NiE`; Hall of Beorn has no OCTGN guid for stage 2 and 3. No count override.
- **Errata.** None for a card of this scenario.

## Data

- Stage 1B advances to a random stage 2A when it is revealed (`08094:B:1`). Each stage 2B and 3B prints Time 3 and advances to a different stage of the same number at random when the last counter leaves (`08095:B:2`, `08098:B:2`), and a lasting effect each; each stage 2B also prints a Forced effect on defeat that advances to a random stage 3A (`08095:B:4`). Stage 4B prints Time 2 and ends the game when Ancient Marsh-dweller is defeated.
- Many encounter cards read "after any number of time counters are removed from the current quest" (Ancient Marsh-dweller, Giant Swamp Adder, Neekerbreekers).

## Readings

The statuses are those of the Readings bullet of `docs/scenarios/the-ring-maker.md`. Each key is the scan-read ledger line (`data/printed/the-ring-maker.json`), `<code>:<side>:<n>`.

- Parallel stages (`08094:B:1`, `08095:B:2`, `08098:B:2`) (span-settled). The first player shuffles each stage 2 (except the one in play) together and picks one at random to replace the current stage 2; the previous stage 2 goes back into the quest deck with the unused ones; progress on the replaced stage is lost. The same steps apply to a different random stage 3A. Not taken: the progress carries over. Basis: `rm.parallel-stages`.
- Stage 2B and 3B "Return this stage to the quest deck" (span-settled). The replaced stage is shuffled with the other unused stages of its number and can come back later. Basis: `rm.parallel-stages`.
- `08095:B:4` and its siblings (span-settled). "When the players defeat this stage, advance to a random stage 3A" picks among the three stage 3 cards; a stage 3 defeated advances to stage 4A. Basis: the printed lines, `rm.parallel-stages`.
- Time counters on a replaced stage (span-settled). A stage put back into the quest deck keeps no counters and gets its Time 3 again when it is revealed again. Not taken: the counters stay on the card. Basis: `rm.time-x` (counters are put on a card when it is revealed), `rm.parallel-stages` (the replaced stage goes back to the quest deck and loses its progress).
- `08103:A:2`, `08103:A:3` (span-settled). Ancient Marsh-dweller places a resource token on itself after any number of time counters leave the current quest, and gets +1 Threat and +1 Attack for each token. One removal of several counters is one trigger. Basis: the printed lines ("any number of time counters").
- `08098:A:1`, `08101:A:1` (span-settled). Ancient Marsh-dweller is added to the staging area from out of play or from an engagement, and all damage is healed from it. Basis: the printed lines.
- `08109:A:1` (span-settled). Sinking Bog gives each character -1 Willpower, -1 Attack and -1 Defense for each Item attached; two copies in the staging area count once. Basis: `rm.does-not-stack`.
- `08106:A:1` (span-settled). The Forced effect that Fen of Reeds gives itself needs the stage change ("after the players advance to a quest stage"); a stage that replaces a parallel stage counts as an advance. Basis: the printed line, `rm.parallel-stages`.
- `08095:B:3`, `08096:B:3`, `08097:B:3` (span-settled). The three lasting effects of the stage 2 cards: no resource gain or card draw by a player card effect; a random discard from hand to commit to the quest; at most 1 card played by each player each round. Basis: the printed lines.
- Nalir (08102) (span-settled). The same card as in Trouble in Tharbad; the rule for an attack made against him is printed for Trouble in Tharbad only, so no attack is made against him here. Basis: `rm.attacks-against-nalir` ("Nalir is an objective-ally in Trouble in Tharbad").
- 08094:B:1, 08095:B:2 and siblings, 08098:B:2 (span-settled). "A different stage 2A" is any of the three stage 2 cards but the one in play; stage 1B picks among all three; a 2B's defeat (`08095:B:4`) picks among the three stage 3 cards; a defeated stage 3 goes on to 4A. The replaced stage keeps no progress and no counters. Basis: `rm.parallel-stages`.
- 08095:B:3 (recommended). "Player card effects cannot be used to gain resources or draw cards" bars a player card's effect (event, ally, attachment, hero ability); the resource and draw phases are framework steps and still run. Not taken: the phases are barred too. Basis: `rr.player-deck`, `rr.immune`. URL read: https://ffg-forum-archive.entropicdreams.com/topic/125582-nin-in-eilph-playthrough-experiences (a player's description, no ruling).
- 08096:B:3 (recommended). Each player who commits one or more characters first discards 1 card at random from hand; with an empty hand he cannot pay and commits none. Not taken: an empty hand commits freely. Basis: the printed words "in order to ... must first" (a cost). URLs read: the same forum thread and https://hallofbeorn.com/LotR/Details/Fleeing-from-Tharbad-NiE?Lang=EN (card text only).
- 08097:B:3 (span-settled). Cards played, in any phase, not cards put into play; each player counts his own. Precedent: Oppressive Forest (`docs/scenarios/standalone-scenarios/the-old-forest.md`), `rr.play-and-put-into-play`; the engine has `LimitPlaysPerRound`.
- 08099:B:3 (recommended). The cap is on readying in the refresh phase only (`CapRefresh`, as 07036:A:1); the player chooses which stay exhausted; a card effect that readies is not limited. No source addresses it.
- 08100:B:3 (span-settled). Engagement cost may go below 0 (`rr.modifiers`). 08098:B:3: each location in play, the active one and those in the staging area.
- 08101:A:1, 08101:B:2 (span-settled). "Makes an attack against each player in player order" is an ordinary enemy attack on each player in turn (shadow card dealt, defender chosen by that player, enemy exhausts, ready again for the next attack in the line as written by `faq.additional-attacks`); the enemy stays in the staging area. At B:2 the attacks come first, then 2 time counters go back on the stage. 08101:B:3: Marsh-dweller defeated wherever it is.
- 08104:A:2 (recommended). Giant Swamp Adder attacks "the engaged player"; a copy in the staging area has none and does nothing. Not taken: it attacks the first player from the staging area. URLs read: https://ffg-forum-archive.entropicdreams.com/topic/277776-unofficial-official-rulings-thread, https://www.hallofbeorn.com/LotR/Details/Giant-Swamp-Adder-NiE (no ruling).
- 08105:A:1 (recommended). Neekerbreekers: the engaged player deals 2 damage to one ally he controls (his choice); a staged copy or a player with no ally does nothing. URL read: https://www.hallofbeorn.com/LotR/Details/Neekerbreekers-NiE (no ruling).
- 08108:A:1 (recommended). Hidden Eyot puts 2 time counters on the current quest even when the stage had none (Time X only puts counters on reveal; this is a printed response). URL: none addresses it (`rm.time-x`).
- 08108:A:2 (span-settled). Each player must exhaust a character to travel; if one cannot, travel is refused (`rr.travel`).
- 08106:A:2, 08107:A:2 (span-settled). The count of time counters, or the destroyed-character test, is made when the shadow resolves.
- 08109:A:2 (span-settled). Shadow counts attachments of any kind, A:1 only Items.
- 08110:A:2 (span-settled). Shifting Marshland removes 1 counter; on a stage with none nothing happens; the last counter's Forced runs.
- 08111:A:1 (span-settled). Each player in player order finds a Creature enemy (a player who finds none skips); it is put into play engaged, not revealed; a Creature found by one player is not found by the next.
- 08102:A:2 (span-settled). Forced at the start of the refresh phase: the first player (who controls Nalir) raises his own threat by the number of players.

Sources: the researcher's rows (`.agent/handoff/the-nin-in-eilph.research.md`); no row conflicts with a user ruling or a reading above.
