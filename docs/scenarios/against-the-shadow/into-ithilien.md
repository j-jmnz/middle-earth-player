# Into Ithilien

Against the Shadow part 2 (pack `HoN`), standalone only, on Easy and Normal (Q03.2, E03.2). Encounter sets Into Ithilien, Brooding Forest, Creatures of the Forest and Southrons (`ats.setup-into-ithilien`). Brooding Forest is shared with The Drúadan Forest, Creatures of the Forest with The Morgul Vale, Southrons with The Siege of Cair Andros and Assault on Osgiliath. The ally objective rules (Celador, the Ithilien Guardians) are `ats.ally-objectives`; Battle and Siege are `hon.battle` and `hon.siege`; Archery is `hon.archery`.

- **Piles.** Stage 1A's Setup adds Celador to the staging area, makes Ithilien Road the active location and has each player search for a copy of Southron Company and add it to the staging area. The data stages Celador (05025) and the four Southron Company (05027), and makes Ithilien Road (05028) the active location. Override in `data/overrides.json`: Southron Company is `staging` with 4 copies in both modes, one for each of up to four players; DragnCards' Q03.2 stages all 4 and E03.2 stages 1 and leaves 3 in the encounter deck. The normalizer drops the Easy encounter copies a per-player Setup stages (`stagedPerPlayer`, `scripts/data/normalize/scenario-piles.ts`). The piles do the Setup, so `05068:setup:1` is empty (as `10125:setup:1`).
- **Errata.** Blocking Wargs (`faq.errata.05029`): the scan-read ledger line has no parenthetical, so it already is the erratum.

## Data

- **Stats of the two ally objectives** (`data/overrides.json`). Hall of Beorn has no stat fields for an objective, so Celador (05025) and Ithilien Guardian (05026) have none, and `isAllyLike` (an objective with hit points) is false without the override. The scans print Willpower 2, Attack 2, Defense 2 and 3 hit points for Celador and Willpower 2, Attack 2, Defense 1 and 2 hit points for the Guardian (`.cache/scans/05025.A.jpg`, `05026.A.jpg`); DragnCards agrees. Both are "Gondor. Ranger.".
- **Secluded Glade** (05047) prints "Immune to player card effects." as its first line; Hall of Beorn lists it as text, so an override sets the keyword `immune`.
- **Archery X** on Southron Mercenaries (05052) and on stage 2B (05069) is an unknown keyword token in the data: the records carry it (`archeryPlayers`), as for 142070.

## Readings

The readings of Into Ithilien use the statuses defined in the Readings bullet of `docs/scenarios/against-the-shadow.md`. Each key is the scan-read ledger line it reads (`data/printed/against-the-shadow.json`), `<code>:<side>:<n>`, with a note in brackets where one line holds several readings. The records are in `src/effects/authored/against-the-shadow/into-ithilien.ts` and read each as written here, but for the differences under Engine notes. The short source names:

- FFG-79021 = https://ffg-forum-archive.entropicdreams.com/topic/79021-into-ithilien-questions (community, no official reply)
- FFG-75007 = https://ffg-forum-archive.entropicdreams.com/topic/75007-celador (community, no official reply)
- FFG-90792 = https://ffg-forum-archive.entropicdreams.com/topic/90792-may-into-ithilien-2-handed-never-bother-you-again (community)
- FFG-88149 = https://ffg-forum-archive.entropicdreams.com/topic/88149-who-playtested-this-watcher-in-the-wood/page/3 (community)
- FFG-80167 = https://ffg-forum-archive.entropicdreams.com/topic/80167-hardrim-elite-and-attacks-from-the-staging-area (community, cites the FAQ)
- VOTP = https://visionofthepalantir.com/2018/03/18/into-ithilien/ (fan write-up, not a ruling)
- LOTRBLOG = https://lotrlcgblog.wordpress.com/2020/06/14/into-ithilien-quest/

### 05025 Celador

- `05025:A:1` (span-settled). Celador is an ally objective: both an objective and an ally. His text commits him while he lies in the staging area, so he counts his stats in the quest total (Willpower; Attack under Battle; Defense under Siege), every effect on "characters committed to the quest" affects him, and the Forced and shadow lines that hurt committed characters hurt him. Not taken: He is an objective only. Basis: `ats.ally-objectives`; rr.current-quest; hon.battle; hon.siege.
- `05025:A:1` (use) (researched). In the staging area no player controls him: he cannot attack, defend or exhaust to pay a cost (Overgrown Trail), and effects that need no control of the target (damage, healing) can affect him. Not taken: Players may use him there. Basis: `ats.ally-objectives` (control only after a player takes it); rr.ownership-and-control; FFG-75007 (one clear answer, agreed by the asker, no official reply).
- `05025:A:2` (unsuccessfully) (span-settled). "Players quest unsuccessfully" is a quest resolution where the threat in the staging area is higher than the committed strength. A tie is neither successful nor unsuccessful, so no damage. Not taken: Failed means threat at least strength. Basis: rr.step-3-4.
- `05025:A:2` (a character leaves play) (researched). Any character of any player (hero, ally, Gandalf and Sneak Attack characters, an Ithilien Guardian once a player controls it) that leaves play deals 1 damage to Celador, one trigger for each. The trigger holds after a player takes control of him. An enemy or an objective that is no ally leaving play does not trigger it. Not taken: Only the controller's characters, or only while he is in the staging area. Basis: FFG-79021 (Gandalf, Bofur and Sneak Attack characters; the effect goes on after he leaves the staging area); FFG-90792 (Gandalf leaving play damages him); `ats.ally-objectives`.
- `05025:A:3` (span-settled). "Remove him from the game" replaces the discard pile: he is out of play for the rest of the game and stage 1B's skip fails, so the players go to stage 2. Not taken: Celador is discarded. Basis: rr.removed-from-game (the line of Mendor, 01135:A:4).

### 05026 Ithilien Guardian

- `05026:A:1` (span-settled). Same readings as 05025:A:1 and the use row. Basis: `ats.ally-objectives`.
- `05026:A:2` (span-settled). When it is revealed it is added to the staging area, as every revealed objective is (rr.objective-cards, the reveal frame), and gains surge (rr.gains), so one more encounter card is revealed after the effect (ltp.surge). The record is the surge alone. Not taken: Surge is printed, so it applies at a later reveal too. Basis: rr.gains; rr.surge; ltp.surge; rr.objective-cards.
- `05026:A:3` (shadow) (recommended). The attacking enemy takes 2 damage as direct damage at step 6.4.2; an enemy that is destroyed leaves play, the attack has no attacker and no damage is dealt. Not taken: The attack still resolves. Basis: rr.step-6-4-2; rr.step-6-4-3; ltp.shadow-discard. Sources: VOTP (restates the card). No official or agreed source for an enemy destroyed by its own shadow card; the reading follows the step order.

### 05027 Southron Company

- `05027:A:1` (span-settled). +2 Threat and +2 Attack while the current quest card has the battle or siege keyword, tested continuously and counting a keyword the quest card gained (stage 4B gains siege at threat 37). Not taken: Tested once when revealed. Basis: rr.gains; rr.current-quest. Sources: VOTP, LOTRBLOG (restate the line).
- `05027:A:2` (shadow) (recommended). +1 Attack, or +2 instead if the current quest card has a keyword: any keyword counts, Battle, Siege and Archery X. Stage 1 (Battle) gives +2, stage 2 (Siege, Archery X) +2, stage 3 (prints none) +1, stage 4 +1 until it gains siege. Not taken: Only battle or siege. Basis: the plain wording of the line; ledger lines 05068:B:1, 05069:B:1, 05069:B:2, 05071:B:1. Sources: no ruling found (FFG forum, VOTP, Hall of Beorn, BoardGameGeek).

### 05028 Ithilien Road

- `05028:A:1` (span-settled). While it is the active location every enemy in the staging area has engagement cost 0, so an engagement check engages each of them against the first player; stage 3 (05070:B:2) still stops the checks. Not taken: Cost 0 only for engagement checks. Basis: rr.active-location; rr.engagement-check; rr.step-5-2; rr.step-5-3; VOTP ("considered to be 0").
- `05028:A:2` (shadow) (recommended). "After it attacks": the enemy finishes the attack and deals its damage, then at the end of the attack (rr.step-6-4-4) returns to the staging area; its shadow card is discarded as normal. Not taken: It returns at once and deals no damage. Basis: rr.shadow-effects; rr.step-6-4-4; ltp.shadow-discard; faq.next-player (an analogy for "after this attack"). Sources: no ruling for the card (Google, Hall of Beorn, VOTP, FFG forum).

### 05029 Blocking Wargs

- `05029:A:2` (span-settled). 1 damage to each character committed to the quest: every player's, and Celador and the Guardians in the staging area. Not taken: The ally objectives are not hurt. Basis: faq.errata.05029; `ats.ally-objectives`.
- `05029:A:3` (shadow) (span-settled). 1 damage to the defending character; an undefended attack has none, so no effect. Basis: rr.step-6-4-2; rr.step-6-4-3.

### 05046 Overgrown Trail and 05047 Secluded Glade

- `05046:A:1` (researched). Any player exhausts a ready Ranger character he controls; Celador and the Guardians cannot pay in the staging area (no controller) and can once a player controls them. Not taken: An uncontrolled ally objective may pay. Basis: rr.ownership-and-control; `ats.ally-objectives`; FFG-75007 (the thread's own example is this card).
- `05046:A:2` and `05047:A:2` (shadow) (recommended). Remove X progress from the current quest card (not the active location), X the attacking enemy's current Threat, modified ones included (Southron Company +2); all of it when fewer is there. Not taken: X is the printed Threat. Basis: the wording "attacking enemy's Threat"; rr.gains. Sources: no ruling found (Hall of Beorn, FFG forum, VOTP).
- `05047:A:1` (span-settled). Immune to player card effects: the keyword (data override). Basis: faq.immune-expanded; faq.legolas-immune-location.

### 05048 Lost Companion

- `05048:A:1` (step 1) (span-settled). Each player in turn order removes one character he controls from the quest, if able. Ally objectives are controlled by no one, so no player removes them in this step. Not taken: A player may choose an ally objective. Basis: rr.ownership-and-control; `ats.ally-objectives`.
- `05048:A:1` (step 2) (recommended). Only a player's own committed characters count for "has no characters committed". When it applies every committed character goes back to the staging area, but Celador and the Guardians, committed by a standing text, are committed again at once. Not taken: Ally objectives count, and are removed for good. Basis: `ats.ally-objectives`; rr.ownership-and-control; rr.step-3-4. Sources: no ruling on ally objectives (Hall of Beorn shows the first sentence only; VOTP, LOTRBLOG, FFG forum).

### 05049 Morgul Spider

- `05049:A:1` (recommended). Until the end of the round +1 Attack for each character of any player not committed to a quest, counted again as the game changes; exhausted characters in play count, Celador and the Guardians in the staging area do not (they are committed). Not taken: The count is fixed when it is revealed. Basis: faq.lasting-effects; `ats.ally-objectives`. Sources: the FAQ's own example (Poisoned Vapour, "each damaged character") is a condition on the game state that is read again when the state changes, as "currently" is here; no official ruling names Morgul Spider. VOTP (https://visionofthepalantir.com/2018/03/18/into-ithilien/, "at that time"), https://talesfromthecards.wordpress.com/2014/05/06/surviving-into-ithilien/ and the FFG forum archive play-through (https://ffg-forum-archive.entropicdreams.com/topic/308703-preotets-play-throughs/) restate the card and do not say; Hall of Beorn has no ruling. None of them settles it: the only support is the analogy to the FAQ's own example, so the live count is an agent recommendation. After the quest phase nobody is committed, so in combat the Spider gets +1 for every character in play.

### 05050 Forest Bat

- `05050:A:1` (recommended). The first player chooses a questing hero (an ally is no hero), deals it 2 damage and removes it from the quest; the hero stays in play unless it is destroyed; with no questing hero nothing happens. Not taken: Any questing character. Basis: the printed word "hero"; `ats.ally-objectives` (ally objectives are allies). Sources: VOTP (restates the card); no ruling on a hero destroyed by the damage.
- `05050:A:2` (shadow) (recommended). The defending player, the player attacked (an undefended attack too), raises his threat by the attacking enemy's current Threat. Not taken: Only the active player. Basis: the printed words; rr.step-6-4-2. Sources: none found.

### 05051 Watcher in the Wood

- `05051:A:1` (raise) (recommended). Each player raises his threat by the total number of questing characters of all players, plus Celador and the Guardians while they are committed in the staging area. Not taken: Each player his own count, or ally objectives not counted. Basis: the wording ("the number of questing characters", not "his"); `ats.ally-objectives`; FFG-88149 (leans to the total, nobody confirms). Sources: no official reply.
- `05051:A:1` (surge) (recommended). The test for surge is made when surge is resolved, after the raise, so a raise to 37 counts on stage 4 (it gains siege). Not taken: The test before the raise. Basis: rr.gains; rr.surge; ltp.surge. Sources: none speaks to the order.
- `05051:A:2` (shadow) (span-settled). Each player raises his threat by the enemies engaged with him; the attacking enemy counts. Basis: rr.engaged.

### 05052 Southron Mercenaries

- `05052:A:1` and `05052:A:2` (span-settled). Archery X, X the players: at the start of each combat phase the players deal X damage to characters in play, divided as they choose (the first player decides a dispute), cumulative with each other archery; Defense does not block it. Basis: hon.archery.
- `05052:A:1` (ally objectives) (recommended). Celador and the Guardians in the staging area can take archery damage: they are ally cards in play, hon.archery lets damage go to characters under any player's control and does not forbid more, and `ats.ally-objectives` makes them allies. Not taken: Only controlled characters. Basis: hon.archery; `ats.ally-objectives`. Sources: no ruling for an uncontrolled ally objective (BoardGameGeek, FFG forum, VOTP, Hall of Beorn).
- `05052:A:2` (recommended). X counts the players in the game now; an eliminated player is no player. Not taken: Fixed at setup. Basis: hon.archery; rr.player-elimination. Sources: none found.
- `05052:A:3` (shadow) (span-settled). +1 Attack, or +3 instead if the attacking enemy has the Harad trait (Southron Company, Southron Mercenaries, Haradrim Elite, Mûmak). Basis: the printed line; traits from `data/cards`.

### 05053 Haradrim Elite

- `05053:A:1` (span-settled). Forced: when it enters play it makes an immediate attack against the first player from the staging area, dealt a shadow card, the four combat steps run with an action window after each; all players may defend; it stays in the staging area. Not taken: No shadow card. Basis: faq.enemy-attacks-outside-combat; rr.attacks-outside-the-combat-phase; faq.peril-attacks; FFG-80167.
- `05053:A:2` (shadow) (span-settled). It attacks again after this attack resolves, with a new shadow card; the chain repeats while that shadow is this shadow. Basis: the printed parenthetical; faq.enemy-attacks-outside-combat.

### 05054 Mûmak

- `05054:A:1` (span-settled). No attachment can be attached to it. Basis: rr.attachment-cards.
- `05054:A:2` (recommended). It takes at most 3 damage each round from any source (combat, archery, direct); the count restarts each round and damage from earlier rounds does not count. Not taken: 3 damage in all. Basis: the wording "each round"; VOTP ("3 damage per turn, including damage dealt outside combat"). Sources: one fan write-up; the other Mûmak thread found (https://ffg-forum-archive.entropicdreams.com/topic/196028-saga-journey-to-the-cross-roads-oliphaunt-text) is about another card.

### 05055 Southron Support

- `05055:A:2` (span-settled). Each player in turn order, the first player first, searches the encounter deck and discard pile for a Harad enemy and adds it to the staging area, if able (not revealed); a player who finds none adds none; then the encounter deck is shuffled. Doomed 3 is the keyword. Basis: rr.search; rr.doomed-x; faq.cancel-encounter-effect; traits from `data/cards`.

### 05068 Ambush in Ithilien, 05069 Southron Counter-attack, 05070 The Hidden Way, 05071 Approaching Cair Andros

- `05068:A:1` (span-settled). The piles place Celador, Ithilien Road as the active location (placed, not travelled to) and one Southron Company for each player; the Setup record is empty. Basis: rr.search; rr.active-location; `ats.setup-into-ithilien`.
- `05068:B:1` (span-settled). Battle; the reminder text carries no rule. Basis: hon.battle.
- `05068:B:2` (span-settled). Completed with Celador in the staging area (not removed from the game, not controlled) the quest goes to stage 3, bypassing stage 2; otherwise to stage 2 as usual. Not taken: Stage 2 is skipped whenever Celador is anywhere in play. Basis: `ats.ally-objectives`; rr.removed-from-game; rr.quest-advancement. Sources: VOTP agrees.
- `05069:B:1` (span-settled). Siege; the reminder text carries no rule. Basis: hon.siege.
- `05069:B:2` and `05069:B:3` (span-settled). Two printed paragraphs, "Archery X." and "X is the number of players in the game.": the quest card is in play, so the archery applies at the start of each combat phase, cumulative with the cards' own. Not taken: Archery only on enemies. Basis: hon.archery; rr.in-play-and-out-of-play.
- `05069:B:4` (span-settled). Completed, the quest goes to stage 4, bypassing stage 3, so The Hidden Way's When Revealed does not happen. Basis: rr.quest-advancement.
- `05070:B:1` (span-settled). The first player takes control of every Ranger objective in the staging area (Celador, the Guardians). Each goes to his play area, is no longer committed by its own text and can be committed by him like any ally; control stays with him. Not taken: Control passes every round. Basis: `ats.ally-objectives`; VOTP, LOTRBLOG.
- `05070:B:2` (span-settled). No engagement checks and no optional engagement while this stage is current, with Ithilien Road active too; effects that engage a named enemy are not stopped. Not taken: Engaging by card effect is stopped too. Basis: rr.step-5-2; rr.step-5-3; rr.optional-engagement; rr.engagement-check.
- `05071:B:1` (recommended). Siege is a standing condition, tested continuously: while any player's threat is 37 or higher the stage has siege (strength counts Defense, Southron Company's bonuses apply), and it ends when every dial is below 37. Not taken: Tested once at the start of the round. Basis: rr.gains; hon.siege. Sources: VOTP and LOTRBLOG restate the card; the wording is a plain "If" with no timing.
- `05071:B:2` (researched). Forced: at the end of each round each player raises his threat by 2, with the Refresh phase's own +1, 3 in all. Not taken: The +2 replaces the +1. Basis: faq.simultaneous-effects; FFG-79021 (one answer, no objection; the quest says no "instead").
- `05071:B:3` (span-settled). Defeating the last stage wins the game: the record is empty. Basis: the printed line.

## Table

The lines create no tracker, dial or zone. What the table shows for each, checked with `pnpm game scene` and the readout and preview tests (`src/play/cards/ithilien-preview.test.ts`):

- **Committed ally objectives** (`05025:A:1`, `05026:A:1`; `ats.ally-objectives`). The card lies in the staging area with its damage and hit points, like any staged card. The quest meter and the dock's quest readout add its stat through `committedWillpower` (Celador and both Guardians with one committed hero: 6 under Battle, 5 under Siege). The card is not lifted, since the commitment is a constant and not the card's `committed` field. Its preview line names the commitment and the stat it adds now (`ithilienDetail` in `cards/dungeon-preview.ts`, Attack under Battle, Defense under Siege); the line is gone once a player controls the card.
- **Quest card keywords** (`05068:B:1`, `05069:B:1` to `B:3`, `05071:B:1`): the stage card's chips show Battle (05068), Archery 1 and Siege (05069). The Siege that stage 4 gains at threat 37 is a chip too (`cardKeywords` reads the gained flag); below 37 it has none. The meter's caption, the quest readout, the commit list and its note, the committed pill and the phase reference say "attack" under Battle and "defense" under Siege (`phases/quest-stat.ts`, `questStatNow`); a stage with neither says "willpower".
- **Archery damage** (`05052:A:1`, `05069:B:2`): the assignment lists Celador and the Guardians as targets (`archeryRecipients`; tested in `lines.test.ts` through the real archery window).
- **Ally objectives under a player's control** (`05070:B:1`): normal ally rows, committed as any ally.
- **Skipped stage** (`05068:B:2`, `05069:B:4`): no widget; the quest card is the one after the skipped stage.
- **Mûmak's cap** (`05054:A:2`): nothing is drawn; the cap is a hidden count.

## Engine notes

Where the engine does not read a reading above to the letter, and why. The flags and the verb are in the family `pelargir` (`src/catalog/families/pelargir.ts`, `src/rules/families/pelargir/`).

- `05025:A:1`, `05026:A:1`: the flag `committedInStaging` (a constant with `condition: sourceIn staging`) commits the card; no instance field is set, so nothing is cleared at the end of the quest. Four shared reads see it, each inert for a game with no such card: `committedWillpower` (`src/rules/quest/quest.ts`) adds the stat the quest uses (`questStatOf`); the filter `committed` and the ally type of a staged objective with hit points (`src/rules/interpret/pick.ts`); `archeryRecipients` (`src/rules/combat/combat.ts`). The same constant sets `guardedAlly`, so a staged ally objective that is destroyed or discarded leaves play as a guarded ally does (announced once, hit by "a character leaves play"), and any player's filter sees it as a character.
- `05025:A:2` (a character leaves play): the Guardian that leaves play after a player took control is an objective in the discard pile when the event is read, so a second record hears the Ranger objectives (`05025:forced:3`).
- `05068:B:2`, `05069:B:4`: the flag `skipsNextStage` on the stage (a constant, with the Celador condition for stage 1) makes `advanceStage` (`src/rules/quest/quest.ts`) take the stage after the next, through `skippedStage` (`families/pelargir/stage-skip.ts`).
- `05070:B:1`: the verb `TakeControlOfStagedObjectives { trait }` (`families/pelargir/control.ts`) moves each objective with the trait to the first player's play area.
- `05049:A:1`: the When Revealed record sets `attackForUncommitted` until the end of the round and a constant counts the uncommitted characters while it holds; the constant claims the same line, so `scripts/checks/effect-coverage.test.ts` lists it (`LASTING_CONSTANT_RECORDS`).
- `05048:A:1` (step 2): no marker; the removal of every committed character runs for each player who has none, which is the same result as one removal when any player has none.
