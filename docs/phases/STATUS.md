# Phase status

Status is `not started`, `active`, or `completed`. This file keeps only what is current (`.claude/rules/docs-standards.md`).

## Rules

- A phase is a file in `docs/phases/` with its spec, dependencies and exit, and a row in the table below. If nothing is active, the only legal start is the lowest-numbered phase whose dependencies are completed.
- When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active. More than one phase may be active only when their files say they can run beside each other.
- A phase is completed when its exit is green and `/reviewer` reports no blocks (one review round when `orchestrator` runs it: `.claude/agents/orchestrator.md`, One review round). A phase that changes `src/screens` or `src/play` also needs `/ux` to report no blocks. Then delete its row and its file; what is still open goes under Open items.
- A scenario phase has an engine half and a screen half (`docs/agents/agent-brief.md`, Scenario procedure). When the engine half's exit is green and reviewed, write `engine done` in the note and leave the phase `active`. The phase is completed when both halves are.
- Phone and tablet checks are not tracked: no phase waits on one, and none is listed here (user instruction, 2026-11-06).
- Current counts live in code: the engine version in `src/rules/engine/version.ts`, the playable scenarios in `src/campaign/playable.ts`, the printed lines no record owns in `src/effects/open-lines.ts` (`pnpm effects open`).

## Phases

No phase is open.

| Phase | Work | Status | Note |
| --- | --- | --- | --- |

## Open items

### Reviews
- Review fixes not re-reviewed: the round engine, the starter effects, the campaign shell, scenario 1's table, A Knife in the Dark, the card frames' ux fix, The Massing at Osgiliath, The Battle of Lake-town, The Stone of Erech, The Old Forest and Fog on the Barrow-downs. `/ux` not run on Flight to the Ford; `/reviewer` and `/ux` not run on The Ring Goes South.

### Readings (not user-confirmed)
- Beechbone 10118:A:2 reads X as 0 when its own cost destroys him (`recommended`, docs/brief.md, Core round).
- A claimed treasure is not an attachment for card effects (`recommended`, docs/brief.md, Ered Mithrin).
- A played player side quest goes to the staging area: The Lost Realm text read from a transcription; no official PDF is pinned in data/sources.json (docs/brief.md).
- East Road Ranger 10008:A:1: "committed to a side quest" means committed while a side quest is the current quest (`recommended`).

### Engine code
- The leave-play loss is checked in loseWhenLeftPlay and still in destroyCard and releaseAttachments: foresight.ts reads `lost` from the latter two, so they stay until foresight uses loseWhenLeftPlay.

### Cards tab views
- `pnpm data sync pictures` has not run since every card got a picture check: Google Drive's quota refused it (2026-11-18). Re-run it, then check that no pin moved to a smaller picture.
- The Messenger of the King heroes keep RingsDB's pictures (about 430×600): no larger source was found (agent recommendation, not user-confirmed).
- Six Nightmare cards (901810, 904109, 904307, 904308, 904309, 905005) are each a one-card set in the Encounter cards view: their scenario files name a set of their own.
- The light theme of the Cards tab views, the card-group route and the spoiler ask has not been checked.
- The Attack on Dol Guldur, The Wizard's Quest, The Woodland Realm, The Mines of Moria and Escape from Khazad-dûm pictures come from cardgame.tools; re-run `pnpm data sync pictures` once Google Drive's quota allows. Durin's Bane (51311), Chamber of Mazarbul (51211) and Mendor (51111) keep their scans.

### README
- The README showcase (`scripts/showcase/`): a first full capture run on a Mac or the showcase workflow, its contact sheet checked and failed flows fixed; then a Screens section, each shot a `<picture>` (Rivendell capture for GitHub's light theme, Ringwraiths otherwise) with the captions and alt text of `scripts/showcase/shots.ts`.

### Releases
- The Android release key is not set up (`docs/releasing.md`, Android key), so no release has been cut; the release workflow has not run yet, dry run first. TestFlight (optional) is not set up.
- The first release with the open-game checks (world hash, per-move checks, checkpoints) carries no card, campaign or engine change, so open games convert cleanly (`docs/brief.md`, Persistence and shipping).
- The release notes' golden-check comparison (`scripts/release/reach.ts`) has not run against a real previous tag; the first tag after it compares by `ENGINE_CHANGES` only.

### Desktop
- Frame time on the drawn table was measured only in a GPU-less sandbox (software rendering); measure idle, a card motion and a spotlight on real hardware before the first desktop release (`docs/architecture.md`, Desktop).
- `marksText` (`src/play/canvas/table-canvas-views.ts`) and `secondSlotLine` (`src/play/words/scenarios/sea.ts`) lost their screen with the web list table; only tests call them. Delete them with their tests in a change that is not desktop work, since removing them moves the phone bundle.
- A booklet missing on the desktop reads "This booklet is not on this phone.": route files cannot have `.canvaskit` variants, so the wording is the phone's. Pending user decision.
- A failed web save is retried only by the next successful save: catching it in `src/screens/data/game-store.ts` would change the phone bundle. Pending user decision.
- Windows and macOS packaging has been proven only in CI (`docs/releasing.md`); open each packed app by hand on each OS once before the first release.
- `marksText` (`src/play/canvas/table-canvas-views.ts`) and `secondSlotLine` (`src/play/words/scenarios/sea.ts`) lost their last screen with the web list table; delete them in a change that may touch the phone bundle.

### Fixtures
- `flame-won` is not committed: no seed in 100 wins Shadow and Flame with the saved decklists (they cannot damage Durin's Bane enough for Dark Pit to discard it).
- `stone-won` is not committed: no seed in 100 wins Foundations of Stone with the saved decklists.
- `rivendell-won` is not committed: no seed in 500 wins Road to Rivendell with the saved decklists.
- `gate-won` is not committed: no seed in 500 wins The Redhorn Gate with the saved decklists.
- `frommoria-won` is not committed: no seed in 400 wins Flight from Moria with the saved decklists (heroes destroyed by round 3).
- `level-won` is not committed: no seed in 500 wins The Seventh Level with the saved decklists (their heroes are gone by round 3).
- `pit-won` is not committed: no seed in 500 wins Into the Pit with the saved decklists (their heroes are destroyed by round 3 or 4).
- `town-won` is not committed: no seed in 100 wins The Battle of Lake-town with the saved decklists.
- `osgiliath-won` is not committed: no seed in 1200 wins The Massing at Osgiliath with the saved decklists (their heroes fall by round 2 to 4).
- `erech-won` is not committed: no seed in 500 wins The Stone of Erech with the saved decklists.
- `forest-won` is not committed: no seed in 100 wins The Old Forest with the saved decklists.
- `downs-won` is not committed: no seed in 500 wins Fog on the Barrow-downs with the saved decklists.
- `carrock-won` is not committed: no seed in 900 wins Conflict at the Carrock with the saved decklists (they cannot kill the four Trolls before threat 50).
- `returnmirkwood-won` is not committed: no seed in 600 wins Return to Mirkwood two-handed on Easy with the saved decklists.
- `realm-won` is not committed: no seed in 1000 wins The Dread Realm with the saved decklists.
- `dum-won` is not committed: no seed in 600 wins The Battle of Carn Dûm with the saved decklists.
- `rhudaur-won` is not committed: no seed wins The Treachery of Rhudaur with the saved decklists under the golden policy.
- `ettenmoors-won` is not committed: no seed in 100 wins Across the Ettenmoors with the saved decklists.
- `gram-won` is not committed: no seed in 100 wins Escape from Mount Gram with the saved decklists.
- `eriador-won` is not committed: no seed in 700 wins The Wastes of Eriador with the saved decklists.
- `dike-won` is not committed: no seed in 600 wins Deadmen's Dike with the saved decklists (their heroes cannot put 9 damage on Thaurdir).
- `hills-won` is not committed: no seed in 100 wins The Weather Hills with the saved decklists (Defenders of Gondor, Swords of the Noldor, Easy).
- `chetwood-won` is not committed: no seed in 100 wins Intruders in Chetwood with The One Deck and Defenders of Gondor under five policies.
- `marshes-won` is not committed: no seed in 600 wins The Passage of the Marshes with The One Deck and Defenders of Gondor (every game reaches threat 50 by round 4).
- `doom-won` is not committed: no seed in 800 wins Mount Doom with the saved decklists (the Ring-bearer falls in combat in round 1).
- `ungol-won` is not committed: no seed in 600 wins The Tower of Cirith Ungol with the saved decklists.
- `fields-won` is not committed: no seed in 100 wins The Battle of the Pelennor Fields with the saved decklists.
- `gondor-won` is not committed: no seed in 400 wins The Siege of Gondor with the saved decklists (threat or Aragorn's death ends every game by round 3).
- `company-won` is not committed: no seed in 400 wins The Passing of the Grey Company with the saved decklists (threat ends every game by round 4).
- `lair-won` is not committed: no seed in 600 wins Shelob's Lair with The One Deck and Defenders of Gondor.
- `roads-won` is not committed: no seed in 600 wins Journey to the Cross-roads with The One Deck and Defenders of Gondor.
- `isengard-won` is not committed: no seed in 600 wins The Road to Isengard with The One Deck and Defenders of Gondor.
- `deep-won` is not committed: no seed in 100 wins Helm's Deep with The One Deck and Defenders of Gondor.
- `hai-won` is not committed: no seed in 1000 wins The Uruk-hai with The One Deck and Defenders of Gondor.
- `wilderland-won` is not committed: none of 100 seeds (and 750 more under five other policies) wins The Fate of Wilderland with the starter decklists.
- `gundabad-won` is not committed: none of 100 seeds wins Mount Gundabad with the starter decklists; the hero carrying Wormsbane leaves play in the first rounds or threat runs out.
- `framsburg-won` is not committed: none of 100 seeds wins The Ghost of Framsburg with the starter decklists.
- `night-won` is not committed: none of 100 seeds wins Fire in the Night with the starter decklists.yaml` takes two.
- `rhovanion-won` is not committed: none of 100 seeds wins Roam Across Rhovanion with the starter decklists.
- `heath-won` is not committed: none of 100 seeds wins The Withered Heath with the starter decklists.
- `kingsquest-won` is not committed: none of 100 seeds wins The King's Quest with the starter decklists.
- `lostmirk-won` is not committed: none of 100 seeds wins Lost in Mirkwood with the starter decklists.
- `upanduin-won` is not committed: no seed in 600 wins Journey Up the Anduin with the starter decks under the scenario's policy.
- Scenario 1's `won` fixture is not committed. `scripts/e2e/fixtures.ts --won` searches for it. `knife-lost` (dealt from its log) is missing until it exists.
- Fixtures not committed, because no real win of the earlier scenarios exists to chain from: `ford-start`, `ford-won`, `ford-lost`; `south-start`, `south-stage-4`, `south-won`, `south-lost`; `anduin-won`; `dol-guldur-won`, `dol-guldur-lost`; `nibin-dum-won`; Mirkwood Paths parts 4 and 5; `moria-won`, `moria-pairs`, `moria-lost`; `breaking-solo`, `breaking-pair`, `breaking-won`, `breaking-lost`. A fixture is a real save: each starts from the log the earlier parts write when won, and joins `src/campaign/fixtures.ts` when `scripts/e2e/fixtures.ts --won` finds that chain.
- The committed `journey-along-the-anduin.json` and `the-caves-of-nibin-dum.json` fixtures predate the log's `modes`, `modeDefault`, `xpGained` and `marks` fields; `scripts/e2e/fixtures.ts` rewrites them with those fields, the same seeds and the same intents.
- `voyage-won`, `fate-won`, `raid-won`, `stormcaller-won`, `depths-won`, `temple-won`, `ruins-won` and `haven-won` are not committed (the Fate fixtures carry a Voyage win played from the golden): no auto-played win with real decks was found (the shipped pair in 100 seeds, each prebuilt deck solo in 40, 17 two-handed pairs in 60). The goldens win only with synthetic heroes.
- `LowerThreatByRaise` (08062) bypasses `lowerThreatByEffect`, so the Hard cap and Expert bar do not stop it. Engine refusal strings in `sea/ships.ts` still say "ship-objective".
- `belegost-won`, `pony-won`, `annuminas-won`, `guldur-won`, `quest-won`, `woodland-won`, `mines-won`, `khazad-won` and `dreadnaught-won` are not committed: no seed won its scenario with the saved decklists (30 to 500 seeds each).
- The Mines of Moria has no two-handed golden for the stage pair A Presence in the Dark and Drums in the Deep: every two-handed seed tried lost.

### Rules and engine
- Dream-chaser data: A Storm on Cobas Haven's Easy counts follow Hall of Beorn, not a printed mark.
- Sea family, not built: Upgraded-side ship stats, face-aware records, Sailing events.
- Wilderland family, not built: the Caves deck's bottom and arrange (18055, 18079), Crypt Key's Discover modifiers, a look window for Discover.
- A Shadow of the Past: the encounter smoke (`scripts/card-smoke/encounter.ts`, `KNOWN`) finds Escape to Buckland's Response (141024:response:1, hideSucceeded) offered during a travel's Hide test and refused with "Travel was refused". Not fixed.
- Lost in the Wild: a player-card `canPick` condition knows a hand pick is a discard only when its record says `discarded: true` (Jewels of Wilderland, Glittering Lute); other campaigns' records are not marked.
- Treasures cannot be played from a hand (no path for type `treasure`); only the claim puts one into play.
- Wilderland: an Evil Creatures enemy shuffled back into the encounter deck keeps its deck mark (`deckRoute`); no card does this yet.
- The King's Quest: the goldens' policy keeps Underground Lake in the Caves deck, so no golden explores an X-quest-point location; unit tests cover it. 18079:B:2 has no `anyPlayer`, so only the first player is offered the stage's Caves look. `freeTreasures`' gate is always true in real games (the scan of the staging area is the real gate).
- Lost in Mirkwood: no golden wins on the nemesis route (stage 4A, The Forest of Great Fear); unit tests cover it. With two players each holding a hero (18074), `heldDial` marks only the first seat's dial.
- Dream-chaser: which side a set-aside upgraded card turns up on is decided per scenario (phases 40-48); `SetAside` deals facedown.
- Dream-chaser: the two Grapple variants on Nightmare cards (fewest or most enemies grappled) stay unparsed.
- The Havens Burn and the Dream-chaser location are upgradable on the MEC111 log, but no source prints their Upgraded sides: their XP rows cannot be bought. Gavin and the four Send for Help cards have no B side in the ledger either.
- The Drowned Ruins goldens never put an Underwater location in the victory display, so the XP for them is checked only by the card tests.
- A Storm on Cobas Haven, known limits: the `exhausted` trigger fires only for the Exhaust verb, so a sea sweep announces `shipExhausted` between actions (Taking on Water's 2 damage lands after the exhausting action; an exhaust and ready inside one action is missed); The Beacon may be used with no Warship set aside; an added phase does not give back once-per-phase uses; the "If Send for Help (X) is upgraded" clauses are unrecorded (no Upgraded side printed); the 3-or-more-players branch of 12121:A:1 is tested by no scene.
- A Storm on Cobas Haven, not reached by a golden (card tests only): the Skirmisher's Response and the ship it becomes, a Warship's set-aside on destruction, Send for Help (Tactics), 11209:B:6 to B:8.
- Revenant's damage limit is two Forced records: `effect-coverage.test.ts` refuses a constant record on a printed "Forced:" line.
- The Corsair reshuffle glides the discard to the deck without a count pop.
- The City of Corsairs, not reached by a golden (card tests only): the Corsair Waters limit and the Umbar Slaver's spend trigger (the auto-player plays no cards); no two-handed golden wins by sinking the Stormcaller.
- Nightmare 904605 Sahír's Pursuer and 905402 Patrol Ship print ENEMY (Ship trait), so they stay non-ship enemies.
- Fellowship-of-heroes with no replacement left in the collection is not modelled (`ltp.fellowship-of-heroes`, `rr.fellowship-of-heroes`).
- Simultaneous Forced and delayed effects resolve in a fixed order, not the first player's choice (FAQ 1.02).
- `src/play/readouts/threat-level.ts` shows 50 as the elimination level and ignores The One Ring's `eliminationReduction`.
- Collapsed Mine's per-round cap ignores progress placed before it appears (fixing it moves every game; in the brief).
- 41004:B:1 prints "searches the encounter deck"; the record also searches the discard pile.
- The Oath: the Tokens dial does not open the quest preview; the Resolution joins used Adaptations with a comma, not "and".
- Escape from Dol Guldur: the claim prompt does not name the lasting effect.
- A confirmed "another" defender cannot be backed out of (the declaration frame has no pass).
- Phase 13 reviewer notes, not fixed: one function for passing the first player token; one immediate attack; the 141028 Setup record that setup does not read; the module-level map in `announceProgress`; non-burden verbs in the burden family; a hard-coded "Ring-bearer's" in `words/scenarios/burden.ts`.
- `CountsAs` and `byEncounterDeck` live in the shared schema, not a family. `why.ts` matches the "different heroes" refusal by its wording.
- Separate stages: `viewOf` builds a new state per call, so state-keyed memos miss inside a view (speed only). The normalizer's `searched` rule marks every staged location of a quest with an each-player-adds-location clause.
- Journey in the Dark and Breaking of the Fellowship Nightmare decks (9065xx, 9066xx) have no records.
- Nightmare, A Knife in the Dark: an exhaust of The One Ring paid as a cost (`exhaustCode`, other Frodo versions) is not announced, so Menacing Wraith (906202:A:2) does not hear it.
- Nightmare, Passage Through Mirkwood: Ungoliant's Spawn discards a character at 0 Willpower when its effect resolves, not again later in the phase.
- Nightmare, Journey Along the Anduin: A Flooded Ford's "gains doomed X" raises threat on reveal but is not announced as the doomed keyword; Troll Attack's shadow (900208:A:2) deals the Troll's Attack as damage to a hero of each other player without making an attack, and reads the Attack after its `endOfAttack` modifiers have expired.
- Nightmare, Escape from Dol Guldur: Torture Master captures the hero the attack was made against, not each of several defenders; with 3 or 4 players the logged prisoner swap (01131:A:3) may leave one player with two prisoners.
- Ered Mithrin data: Crypt Stalker (19099) Easy count is 1 (Hall of Beorn) against E08.7's 2; no printed source settles it.
- Ered Mithrin data: the EMCE box prints collector numbers one below Hall of Beorn and RingsDB; codes and `printings[].number` follow the sources' number.

### Rules and engine (Angmar Awakened)
- Objective allies (Wilyador, Iârion, Amarthiúl, Captain Sahír, Na'asiyah): a player card that returns one to "its owner's hand" puts it in the encounter discard pile, and the players lose when it leaves play (agent recommendation; no ruling found, `docs/brief.md`, A Journey to Rhosgobel). Not user-confirmed.
- Angmar Awakened data: Easy counts of Angmar Captain (09045, 1) and Angmar Marauder (09044, 2) in Escape from Mount Gram and Ruins of Arnor (09056, 2) in The Treachery of Rhudaur follow Hall of Beorn against DragnCards' E05 decks; no printed icon check. Not user-confirmed.
- Angmar Awakened data: `MEC108_CHANGED` is empty because no scan shows the MEC108 printing of the 155 reprinted encounter cards; a rewording cannot be found until one is read. Not user-confirmed.
- Claimed objectives with no printed return (Athelas, the Clues of Rhudaur) go to the encounter discard pile with their hero (semi-official FAQ 1.23, community; `docs/brief.md`, A Journey to Rhosgobel). Not user-confirmed.
- Claimed objectives whose text claims them "if unattached" (Ashen Brazier, Loot objectives, Durin's Key, Urdug's Horn) return to the staging area when detached (agent recommendation, no source; `docs/brief.md`, Ered Mithrin). Not user-confirmed.
- Angmar Awakened data: the Prison Cell, Savage Trollspawn and Amarthiúl (Wastes) piles follow each quest's Setup over DragnCards' load layout (agent recommendation). Not user-confirmed.
- Angmar Awakened campaign cards: Iârion's Pendant at 10166:B:1 goes to the player the first player names, as the Ered Mithrin boon-ally ruling (agent recommendation; no ruling found). Not user-confirmed.
- Angmar Awakened campaign cards: "add the Mysterious Omens side quest to the Campaign Log" (10159:A:2) adds it to the Campaign Pool (agent recommendation). Not user-confirmed.
- Angmar Awakened campaign cards: the Amarthiúl hero ban ends at 10188:A:2 and does not return in The Dread Realm (agent recommendation). Not user-confirmed.
- The Weather Hills: Cold from Angmar (09054) attaches to the current quest card, the side quest when one is current (community sources only). Not user-confirmed.
- The Weather Hills: the quest-card count (09031 and others) follows Intruders in Chetwood's reading. Not user-confirmed.
- The Weather Hills: "End the current phase" (09070:A:1) ends any phase once the effect and an attack in progress finish, combat included. Not user-confirmed.
- The Weather Hills: Amon Forn (09026:A:2) hears Orc enemies returned to the staging area as well as revealed ones. Not user-confirmed.
- The Weather Hills: Mysterious Omens' boons (10160:A:3): each player in turn may take one boon still set aside; it is Permanent and recorded with its hero. Not user-confirmed.
- The Weather Hills: Stalwart (10165:A:4) marks the hero for the phase and the attachment is played through the normal play. Not user-confirmed.
- Test kit: `test/harness/game-kit.ts` hands a game only the Wilderland and Angmar log facts, while `src/campaign/briefing.ts` also hands XP, Two Towers and Return of the King facts; sharing one helper moves 17 Dream-chaser, Two Towers and Return of the King goldens, so those goldens are dealt without facts a real game has. Not fixed.
- Deadmen's Dike: Thaurdir's burden (10166:A:3) attaches to him although he "Cannot have attachments" (09033:A:2, rr.cannot); no ruling found. Not user-confirmed.
- Deadmen's Dike: a boon chosen at Mysterious Omens in this scenario is recorded with its hero at 10166:B:1 (orchestrator decision; not in the printed text). Not user-confirmed.
- Deadmen's Dike: a burden's current host counts for "the hero with the most" (10168 to 10170), ties chosen by the first player, moving on any Sorcery reveal. Not user-confirmed.
- Deadmen's Dike: Broken Battlements (09036:A:2) places 1 time counter for each player. Not user-confirmed.
- Deadmen's Dike: Fornost Square (09038:A:2) takes 1 token per discard effect or cost from the top of the first player's deck, not per card. Not user-confirmed.
- Deadmen's Dike: Haunted Keep's first-Undead surge (09039:A:1) tallies from the round's start. Not user-confirmed.
- Deadmen's Dike: Deadmen's Gate (09040:A:1) hears an event played for its Action or Response as triggered; encounter card abilities do not count. Not user-confirmed.
- Deadmen's Dike: Terror of the North (09064:A:1) pools card types across all players' discards. Not user-confirmed.
- Deadmen's Dike: Arnor Ravaged (100158:A:2) moves 1 damage once per attack. Not user-confirmed.
- Deadmen's Dike: Norbury Tombs' Travel (09037:A:2) is a cost and cannot be paid with no enemy in the encounter discard pile (rr.travel; community sources for the card). Not user-confirmed.
- Deadmen's Dike: Heavy Curse (09066:A:2) raises a card played from any zone, and a card played from the discard pile counts as its own copy (community source only). Not user-confirmed.
- Deadmen's Dike: The Power of Angmar (09067:A:2) locks only player card effects on player discard piles (community source only). Not user-confirmed.
- Deadmen's Dike: stage 2B (09074:B:2) needs its 13 progress and Thaurdir at 9 damage, and an empty deck eliminates at each check (community source only). Not user-confirmed.
- `AddSetAsideToStaging` announces no entering play (no `announceEntered`, no family hook) for a set-aside card it stages; routing it through `moveEncounter` moves 14 goldens (Dream-chaser, Ered Mithrin, Fellowship and Two Towers scenarios), so Thaurdir uses `EnterSetAsideStaging` instead. Not fixed.
- Renderer gaps, Deadmen's Dike (behaviour proven by tests): "top 5 of his discard pile" per player (09037:A:1, 09067:A:3), an unpayable Travel cost (09037:A:2, 09018:A:1), `playerAbilityTriggered` from a played event (09040:A:1), what `discardLocked` blocks (09067:A:2), `eliminatedAtEmptyDeck` (09073:B:3, 09074:B:2), 10166:B:1's choice and earned burden print as JSON; the 09074:whenRevealed:1 "then" check runs per reveal because `Repeat` takes no `when`.
- The Wastes of Eriador: a flip of the Time objective to the side already up changes nothing (agent recommendation). Not user-confirmed.
- The Wastes of Eriador: at Night (10012:A:1) progress cannot be placed on quest cards, a current side quest included, but the active location still takes it (two forum members, no official answer). Not user-confirmed.
- The Wastes of Eriador: Northern Warg's +1 Threat (10018:A:1) covers itself and Wargs entering later in the phase (community note). Not user-confirmed.
- The Wastes of Eriador: Eriador Wastes' cap (10023:A:1) counts quest-card progress only and does not stack between copies (community only). Not user-confirmed.
- The Wastes of Eriador: Predatory Wolves (10027:A:1) counts Amarthiúl as an ally of cost 0, and a player may take the search option instead (one forum reply). Not user-confirmed.
- The Wastes of Eriador: Determination's "determined" mark is cumulative and kept if the character later falls (agent recommendation). Not user-confirmed.
- The Wastes of Eriador: Northern Warg's shadow makes no third attack in the combat phase (community only). Not user-confirmed.
- Renderer gaps, The Wastes of Eriador (behaviour proven by tests): what `noQuestProgress` covers at Night (10012:A:1), the recalculated Warg pick (10018:A:1), who engages Blood-thirsty Warg (10019:A:1), `checkCostPerDamaged` (10020:A:2), Eriador Wastes' per-round, non-stacking cap and unpayable Travel (10023:A:1, A:2), Amarthiúl in Predatory Wolves' pick (10027:A:1), `Earn` in 10171:B:1 prints as JSON.
- Escape from Mount Gram: starting threat is the starting hero's threat cost, dropping the log's starting-threat modifier (10038:A:1). Not user-confirmed.
- Escape from Mount Gram: heroes moved to the captured deck at setup have not left play, and their Easy Mode resource is dropped (10038:A:1). Not user-confirmed.
- Escape from Mount Gram: Capture X on a short or empty captured deck, and on cards added to staging without being revealed. Not user-confirmed.
- Escape from Mount Gram: the join target among several areas, and the joiner's stage 2B leaving play (10039:B:2). Not user-confirmed.
- Escape from Mount Gram: an eliminated head seat's area passes to the first joined seat clockwise (no source covers a player who had already joined). Not user-confirmed.
- Escape from Mount Gram: advancing together returns each area's active location to the staging area (no ruling found). Not user-confirmed.
- Escape from Mount Gram: Jailor Gornákh (10041:A:1) on a tie, when already engaged, and not hearing a Prison Cell put into play. Not user-confirmed.
- Escape from Mount Gram: the area's own player chooses for Dungeon Guard and Prison Cell (10044:A:2, 10046:A:2), and Prison Cell's put-into-play is not a rescue. Not user-confirmed.
- Escape from Mount Gram: Captives of Gornákh's host pool is every encounter card in play in the area (10051:A:1). Not user-confirmed.
- Escape from Mount Gram: Interrogation (10052) counts a hero's cost as 0 and its Doomed 2 is immediate. Not user-confirmed.
- Escape from Mount Gram: the refresh raise (10174:B:1) counts the stage reached plus the side quests in the victory display. Not user-confirmed.
- Escape from Mount Gram: stolen cards (10174:B:3) include unique heroes left in the captured deck, but not cards still under another card; they are barred as deck cards only. Not user-confirmed.
- Escape from Mount Gram: Loot the Dungeons' quest points count living players, one number for every area (10175:A:1). Not user-confirmed.
- Escape from Mount Gram: a player whose heroes in play are gone but who has a captured hero stays in the game (orchestrator decision taking the recommendation, rr.player-elimination). Not user-confirmed.
- Escape from Mount Gram: Berelind (10176:A:1) places progress on a quest card in play the player chooses in their area. Not user-confirmed.
- Escape from Mount Gram: stage 2B's progress rescues one captured card per point (10039:B:1; community source only). Not user-confirmed.
- Renderer gaps, Escape from Mount Gram (behaviour proven by tests): the `captured` family's verbs, conditions, amount and pick filter, `SwitchActor`, `ShuffleSetAsideSet`, `RaiseThreatTo`, `StartSeparateStage reveal` and `ProgressQuest` print as JSON; 10049:A:2 reads "every enemy in play" without the area limit; which area's first player acts (10044:A:2, 10046:A:2, 10051:A:1).
- Across the Ettenmoors: with no side quest left in the deck, 10064:B:1, 10065:A:1 and 10066:A:1 discard the deck to empty and reveal nothing (agent recommendation; the order against the current-quest choice rests on one forum answer). Not user-confirmed.
- Across the Ettenmoors: an active safe location blanks encounter side quests (community sources) and leaves a treachery's Surge in place (agent recommendation). Not user-confirmed.
- Across the Ettenmoors: Cruel Mountain-troll's (10074) excess is damage beyond remaining hit points, from combat only (community source). Not user-confirmed.
- Across the Ettenmoors: Troll-fells' (10077:A:2) search for a safe location (community source). Not user-confirmed.
- Across the Ettenmoors: Barren Moorland (10078:A:1): its trigger and stacking (community source); the ally's controller chooses (agent recommendation). Not user-confirmed.
- Across the Ettenmoors: Arador's Bane (10079): either option may be chosen when both can act (community source). Not user-confirmed.
- Across the Ettenmoors: No Rest (10080): one per hero, the first player choosing among the hosts (agent recommendation). Not user-confirmed.
- Across the Ettenmoors: Scavenge for Supplies (10083): the first player breaks highest-threat ties and the free play skips the +1 cost (agent recommendation). Not user-confirmed.
- Across the Ettenmoors: Losing Time's shadow (10183:A:3): the defending player chooses +3 Attack or +3 Defense (agent recommendation; a play-through agrees). Not user-confirmed.
- Across the Ettenmoors: the Losing Time clock (10182:A:3) fully reveals a copy (community play-throughs), and with no copy left the resources stay (agent recommendation). Not user-confirmed.
- Renderer gaps, Across the Ettenmoors (behaviour proven by tests): the travel Forced and Responses of the four safe locations name no destination (10068 to 10071); `excessToEachQuest`, `damagedCannotFace` and `progressPlacedHere` show as flags (10074, 10076, 10081); the safe-location choice's zones (10075:A:2); who chooses for Barren Moorland (10078:A:1); "1 copy per player" in 10064:A:1's pile header.
- The Treachery of Rhudaur: declining the side-quest choice on stage 1 leaves no current quest (10094:B:3; agent recommendation). Not user-confirmed.
- The Treachery of Rhudaur: after the last side quest flips, the current quest is the main quest 2B (10094:B:4; agent recommendation). Not user-confirmed.
- The Treachery of Rhudaur: 10094:B:2 removes the side quests still unflipped from the game (community source only). Not user-confirmed.
- The Treachery of Rhudaur: a discard that runs the encounter deck out resets it and carries on (10097, 10107; agent recommendation by analogy with faq.last-encounter-card). Not user-confirmed.
- The Treachery of Rhudaur: Forbidden Descent (10101:A:1) takes all progress placed on a quest, card effects included, and each copy takes its own first 2 (text from a community source; scope and stacking agent recommendation). Not user-confirmed.
- The Treachery of Rhudaur: Ghostly Ruins' Travel (10103:A:2) is a cost unpayable with no Undead enemy in the encounter discard pile (community source only). Not user-confirmed.
- The Treachery of Rhudaur: Dark Covenant (10107:A:2) raises threat by the destroyed character's Willpower just before it was destroyed (agent recommendation). Not user-confirmed.
- The Treachery of Rhudaur: Quiet the Spirits (10109:A:1): an Undead entering play by any route engages the highest-threat player (community source); ties go to the first player (agent recommendation). Not user-confirmed.
- The Treachery of Rhudaur: Decipher Ancient Texts' 3 uses per round (10113:A:2) are shared by all players (community source only). Not user-confirmed.
- The Treachery of Rhudaur: each Clue's boon (10184:B:1) goes into its controller's deck as well as the pool (agent recommendation). Not user-confirmed.
- Renderer gaps, The Treachery of Rhudaur (behaviour proven by tests): unclaimed side quests counted by 10094:B:4, Ghostly Ruins' unpayable Travel (10103:A:2), the main quest barred from Centuries of Sorrow's choice and Haunting Fog with no current quest (10105:A:2, 10108:A:1), Amarthiúl as an ally and the shared limit (10113), the boon into the deck (10184:B:1), "Restricted." on 10185 to 10187.
- `modifiedStat` (`src/rules/core/keywords.ts`) reads traits with no effect list, so a trait an effect grants is not seen by stat conditions such as `defendingAgainst` (the condition path sees it).
- Intruders in Chetwood: quest cards in play are the main quest, the staged side quests, encounter and player, at least 1 (09016, 09019, 09047, 09048, 09050). Not user-confirmed.
- Intruders in Chetwood: Iârion's Response (09016:A:3) hears a side quest revealed by a search of the encounter deck, not of the discard pile. Not user-confirmed.
- Intruders in Chetwood: Iârion held facedown under Rescue Iârion (09024:A:2) stays in play and has not left it. Not user-confirmed.
- Intruders in Chetwood: Time counters come off after the end-of-refresh Forced effects. Not user-confirmed.
- Intruders in Chetwood: Outlying Homestead (09020:A:2) bars threat reduction by player card effects only. Not user-confirmed.
- Intruders in Chetwood: Sudden Assault (09021:A:1) attacks first and searches for an Orc War Party only if no attack was made. Not user-confirmed.
- Intruders in Chetwood: Angmar Orc's ally choice (09043:A:1) may take Iârion; the first player chooses. Not user-confirmed.
- Intruders in Chetwood: Pressing Needs (09049:A:2): search-and-reveal a side quest or make a different quest card current; a staged player side quest is eligible. Not user-confirmed.
- Intruders in Chetwood: Weight of Responsibility (09050) counts quest cards when it resolves. Not user-confirmed.
- Intruders in Chetwood: Stop the War Party's Setup (09068:A:1): each player searches for one location with a different title. Not user-confirmed.
- Intruders in Chetwood: Protect the Innocent (10158:A:1) takes 1 damage per attack that damages a character. Not user-confirmed.
- Intruders in Chetwood: Orc Rearguard's cap (09023:A:1) holds on whichever quest is current (community source only). Not user-confirmed.
- Intruders in Chetwood: Iârion's control follows the first player token (09016:A:2), by the Aragorn and Calphon rulings and a community source only. Not user-confirmed.
- Renderer gaps, Intruders in Chetwood (behaviour proven by tests): 09016:A:2 control has no template; Orc War Party's stage bar does not say it binds the main quest only (09017:A:3); Orc Rearguard's cap does not say "each round" (09023:A:1); `lastTimeCounterRemoved` and `questDefeated` do not say "this card" (09024:A:3, 09051:A:2); Angmar Captain's X and target (09045:A:1); 09068:B:3's first player and win; the Pendant's cancel limits (10157:A:2); `SearchMove` with `when` prints as JSON.
- Angmar Awakened: the box's Setup steps other than the Orc deck (`prepareCapturedDeck`, `captureUnder` and the others) are catalog data only; the engine reads them in their scenarios' phases.

- The Battle of Carn Dûm: the Werewolf (10131:A:2) flips on exactly 3 shadow cards, by analogy with the official Thaurdir ruling. Not user-confirmed.
- The Battle of Carn Dûm: Thaurdir on stage 2B (10126:B:1) attacks each player in player order and fires no engagement event (community thread, no agreement). Not user-confirmed.
- The Battle of Carn Dûm: Thaurdir's Captain Forced (10127:A:4) is not heard for a Sorcery card revealed as a shadow card (community source only). Not user-confirmed.
- The Battle of Carn Dûm: engagement costs lowered by Champion Thaurdir (10128:A:3) do not go below 0 (agent recommendation). Not user-confirmed.
- The Battle of Carn Dûm: Carn Dûm Garrison's shadow (10129:A:2) counts the attacking enemy's shadow cards, itself included (agent recommendation). Not user-confirmed.
- The Battle of Carn Dûm: Orc Grunts (10130:A:2) reduce only progress landing on the current quest after the active location's share (community only). Not user-confirmed.
- The Battle of Carn Dûm: any player's event deals the Werewolf (10131:A:1) a shadow card (agent recommendation). Not user-confirmed.
- The Battle of Carn Dûm: Fortress Walls (10135:A:1) counts resources spent from ally pools as well as hero pools (agent recommendation). Not user-confirmed.
- The Battle of Carn Dûm: Vile Affliction (10137:A:1) counts an X or blank cost as 0 (agent recommendation). Not user-confirmed.
- The Battle of Carn Dûm: a Thaurdir burden attaches to the staged Thaurdir although he cannot have attachments, and the Amarthiúl hero stays usable in The Dread Realm (agent recommendation). Not user-confirmed.
- `beginEnemyAttack` (`src/rules/combat/combat.ts`) deals a shadow card a second time for an attack from staging made by an enemy with `engagedWithAll` (The Ring Goes South's Watcher, Fire in the Night, The Withered Heath, Mount Gundabad, The Fate of Wilderland): `attackNowFromStaging` deals one first. Fixing it moves shipped goldens and needs `ENGINE_VERSION`. Not fixed; Thaurdir's path skips the extra deal.

- The Dread Realm: reanimating a card counts as engaging (10150 and the other reanimating cards; community forum agreement). Not user-confirmed.
- The Dread Realm: the Witch of Angmar (101156:A:1) resolves the When Revealed of her Sorcery shadow cards, from an official FAQ entry read only as quoted on the FFG forum (the FAQ PDF is unavailable). Not user-confirmed.
- The Dread Realm: "Sorcery cards in play" excludes shadow cards (101164, 10153; community consensus). Not user-confirmed.
- The Dread Realm: a Reanimated Dead counts as in play although facedown (agent recommendation). Not user-confirmed.
- The Dread Realm: a Reanimated Dead reanimated in a step attacks that step with two shadow cards (agent recommendation). Not user-confirmed.
- The Dread Realm: the defending player reanimates for the Unholy Crypt, Dark Halls and Dwimmerlaik lines (agent recommendation). Not user-confirmed.
- The Dread Realm: removing Possession from the game leaves its Reanimated Dead in play (agent recommendation). Not user-confirmed.
- The Dread Realm: ties for A Fell Dread go to the first player (agent recommendation). Not user-confirmed.
- The Dread Realm: Daechanar (10153:A:3) cancels the whole damage instance and the first player chooses the Sorcery card removed (agent recommendation). Not user-confirmed.
- The Dread Realm: the Wraith of Carn Dûm's host is chosen by the first player and its Forced is inactive while it lies attached (agent recommendation). Not user-confirmed.
- The Dread Realm: Sinister Dungeon is dealt as a shadow card instead of going to the discard pile (agent recommendation). Not user-confirmed.
- The Dread Realm: Dark Halls' shadow reanimates a copy of the defending character from the defending player's discard pile (agent recommendation). Not user-confirmed.
- The Dread Realm: progress the Altar of Midwinter cannot take goes to the quest card (agent recommendation). Not user-confirmed.
- The Dread Realm: stage 3's search shuffles the deck after, and the first player divides stage 3's progress freely (agent recommendation). Not user-confirmed.
- Renderer gaps, The Dread Realm (behaviour proven by tests): A Fell Dread's highest-threat host without one already (101163:A:1), the location count's zones (10152:B:3), the first player as the Altar's actor (10154:A:2), 10193's Setup verbs and its win line print as JSON or "(no instructions)".

### Screens and code
- Fire in the Night: the table has no side-quest deck area or current-quest mark (`docs/brief.md`, Ered Mithrin).
- Ered Mithrin: a discovered treasure cannot reach a deck from the app. `validateLoadout` admits it, but `deckSaveRefusal`, the import, the deck store and the Cards pool read deck-legal rows only, and a saved deck is not tied to a save's log. Needs a design.
- Ered Mithrin: `AddEncounterToPool` with `inPlay` counts in-play copies the pool did not deal in, an upper bound, since copies have no identity.
- Run history (28b): `recordUnclosedRun` has no test; a win left unconfirmed until an engine or data update drops it cannot be recorded; `run-writers.ts` imports `ScenarioState` through `play/store`.
- `items-baseline` collapsed on Android in the path; it is still in `card-pool.tsx` and `log/[saveId].tsx`.
- Why the path screen was laid out taller than the window on Android is not known. The action bar's overrun measure stays for screens that keep a bar.
- Web only: opening Cards, Import or a deck first can raise "error during concurrent rendering" (expo-sqlite "Sync operation timeout"; React recovers). Rows ending in a stepper warn "nested button".
- The combat spotlight's sprite is worked out twice per slot in an active frame.
- Not built from the Carved Stone handoff: the card screen's "Add to a deck"; the table's encounter row and right-hand piles; the handoff's defend tray.
- Tablet follow-ups: an Android `appCategory` or large-screen plugin if the table lock must hold on Android 16; pushed routes under the tabs; a Packs list-detail; a Deck import section in `docs/design-system.md`; a "Tap anywhere to close" hint on the preview.
- Run `pnpm assets scans` on the build machine before a release, so side B pictures and the `.scene` files are bundled.
- Scenario pipeline (`docs/plans/scenario-pipeline.md`): section E's ledger seed is built (`pnpm data ledger-seed`); its pile overrides and XP rows in data are not, nor are its Next steps; the core's remaining direct family calls (travel, pick, condition, amount, `syncThreatSaves`, `playSweep`, `heldByLapsedStage`) move behind the hooks when their family is next changed.
- Choice words: the entries marked Open in the allowlist of `src/play/words/scenario-words.test.ts` are bare prompts still to be named.
- Accessibility: the drawn canvas takes no keyboard focus and its own text and fixed alphas do not follow Bold Text or Reduce Transparency; on iOS, Escape and Z do nothing (React Native sends no key events there).
- Accessibility: at font scale 2 on a phone in landscape the dock's worst moment (a why line, a three-line primary, Cancel and More, an attack readout) passes its column even with the aids folded (`it.fails` in `dock/text-size-fit.test.ts`); at font scale 1 the longest caution with an attack readout passes it by up to 16 pt (`HAND_SLACK`, `budget.test.ts`). Needs a dock design.
- Accessibility: the Label in Name entries held in `OPEN` (`scripts/checks/a11y-web.ts`) are axe joining sibling text with no space on react-native-web; the names start with their visible words.
- Renderer gaps (`pnpm effects render`; behaviour proven by spec rows): Helm's Deep's `PlaceToken` names no token type or host (143033:A:2), `archeryBonus` and `archeryToAllies` show as flags (143037:A:1, 143058:A:2), the acting player is not shown to be the first player (143041:A:1, 143073:B:2) or the discarding player (143050:A:1, 143055:A:1, 143068:A:2), a Siege attachment's trait (143042:A:2), an `x` condition's count (143042:A:3), the Traits kept by a blank text (143043:A:1, 143061:A:2), searched zones (143074:A:1, 143054:A:2), `RevealFewer`'s duration (143020:A:2), `TriggerWizardry`'s only-player reading (143047:A:2, 143062:A:1), the Wolf's attack target (143052:A:1), a count taken before its stage leaves (143078:B:2), an ally-or-objective filter (143079:B:3) and a win shown as `trackQuestProgress` (143080:B:3); about 40 fortress, burden and wizardry pieces print as JSON.
- Renderer gaps, The Passage of the Marshes (behaviour proven by spec rows): `enteredHand` does not say draw only (144015:A:2), a Travel cost's refusal when it cannot be paid (144020:A:3, 144021:A:2, 144022:A:3), the first player shown as the actor (144021:A:1, 144064:A:1, 144064:B:1, 144065:B:2, 144065:B:3, 144066:B:2), the cancel's payer (144055:A:2) and the last stage's win (144066:B:2); 25 pieces of older verbs (`SearchMove`, `MoveEncounterCard`, `ExhaustEach`, `AttachToQuest`) print as JSON.
- Renderer gaps, Shelob's Lair (behaviour proven by spec rows): searched zones (144043:A:2, 144054:A:1), Cleft's "while in play" step gated on the victory display and `engagedWithFirst` (144045:A:2), later arrivals under Many Openings (144051:A:1), `MakeActive` returning the old location (144059:A:1), the Traits kept by Shelob's Poison's blank (144060:A:1), the target and timing of `afterThis` (144062:A:2), the Underground filter's reach into staging (144070:B:1), "each round" and "put into play" in `LimitEntries` and `questProgressCap` (144071:B:2, B:3), `resourceCancel` (144072:B:2) and whether a cancel option raises `whenRevealedCanceled` (144055:A:2); about 25 pieces print as JSON.
- Renderer gaps, Journey to the Cross-roads (behaviour proven by spec rows): a travel bar with no `location` reads "cannot travel to any location" where the engine bars that location only (144030:A:2; the template is shared, so rewording moves six other snapshots), `AddFromPile` and `deckOnly` print as JSON, later-arriving Harad enemies under a lasting effect (144029:A:1, 144039:A:1), the Travel refusal with the Harad deck empty (144032:A:2), and each player's own Setup choice and earned Brace of Coneys (144069:A:2, 144069:B:1).
- Effect templates: an unlabelled conditional constant ("If you are on-course, ~ gets +2 …") is read as triggered by `unreadBefore`; `SPLIT_LINES` in `scripts/data/effects/generate.ts` names one card's line.

### Rules and engine (The Two Towers)
- Not fixed from The Uruk-hai's review: `engagedThreatSeat` (143065:A:2) is declared in the pursuit family, not with `engagedThreat`.
- Six older records put `shadow: false` on a printed additional attack (18035:A:2 and its copies), against `faq.additional-attacks`, which deals the additional attack a new shadow card.
- Call of the Ring (144054:A:2) copies 19081:A:2, and 19081:A:2 and its copies (19013:A:3, 18035:A:2, 19106:A:2, 18047:A:2, 19132:A:2) deal no new shadow card to the additional attack (`faq.additional-attacks`); the fix moves The Passage of the Marshes' golden, so it is a separate change with `ENGINE_VERSION` (user decision, 2026-11-11).
- Saga Frodo's Response (141001:response:1) needs The One Ring 141085 exhausted; in The Two Towers the Ring is 144063, so the cancel is never offered in The Passage of the Marshes, Journey to the Cross-roads or Shelob's Lair. Fixing it can move their goldens.
- The Two Towers ledger reads the pinned 2014 and 2015 Treason of Saruman and Land of Shadow scans; no pinned scan shows MEC112's 2023 wording, so a rewording cannot be found (`scripts/data/printed/scope.ts`, `MEC112_CHANGED`).
- The lasting-effect class holder `enemies:<Trait>` reads printed traits (`heldBy`, `src/rules/core/holder-classes.ts`): a card that gains a trait is not reached. No card in play gains Harad.
- The Return of the King: the ledger's `eyeIcons` (Sauron's Eye icons on Mountain of Fire encounter cards) is not carried onto catalog cards; the Fortitude test needs it. The Dire, Assault and Phantom keywords are unknown to the build.
- The Return of the King campaign cards' lines left to their scenarios' Build: 145078:A:1 and B:1 (phase 73), 146069:A:1 and B:1 (phase 74), 146079:A:1 and A:2 (phase 76). Until then the waived hero-change penalty and burden sets of those Setups are not applied.
- Mount Doom's Keep resolution repeats "The players lose the campaign." in the heading and the settled note under it.
- Renderer gaps, The Passing of the Grey Company (behaviour proven by spec rows): `SearchMove`, `SpendResources`, `RemoveProgressFromQuest`, `HeroesGainResources`, `AddSetAsideToStaging` and the `resources` condition print as JSON (145016:A:3, 145017:A:2, 145017:A:3, 145019:A:2, 145020:A:2, 145063:B:1, 145064:A:1, 145065:A:1); the dial owner as `actorSeat` (145016:A:2); `noQuestProgress`'s scope (145027:A:2); `afterThis` and its defender (145029:A:2); `threatFloor` as each player's own starting threat (145064:B:2); campaign card 145066's records.
- Raiding the Coasts' discard row (145041:A:1) cannot name the attachment or its cost: an asks template names only the record's own card.
- Renderer gaps, The Siege of Gondor (behaviour proven by spec rows): a self-only travel bar reads "any location" (145030:A:2), `require` binding once across players (145030:A:3), `healCap` per character per round (145033:A:1), the damaged character as "the event's other card" (145033:A:2), the win left to the final stage (145069:B:2), and the `DiscardUntil`, `MoveEncounterCard`, `PlaceDamage`, `dealt` and `searchable` pieces printed as JSON (145039:A:2, 145040:A:2 and others).
- Renderer gaps, The Battle of the Pelennor Fields (behaviour proven by spec rows): the `pelennor` and campaign `aside` verbs, `GrantTrait`, `AttachSelfToPicked`, `SearchMove`, `DiscardUntil` and the `notHost`, `damageFirst`, `assault`, `attackOnlyByEngaged`, `undefendedToMinasTirith` and `shadowsImmune` pieces print as JSON or bare flags (145014, 145015, 145043 to 145080, 145078:B:2); City Wall's discard reads a fixed 4 (145046:A:2); stage 5A spawns a fresh Sorcerer Witch-king while the Captain stays set aside (145077:A:1).
- Renderer gaps, The Tower of Cirith Ungol (behaviour proven by spec rows): a self-only travel bar reads "any location" (146015:A:2), `DiscardUntil`, `MoveEncounterCard`, `AddSetAsideToStaging`, `PlaceDamage`, `FlipToEnemySide`, `GrantTrait`, `GrantIcon`, `CaptureRingBearer` and the campaign verbs print as JSON (146014:A:1, 146015:A:3, 146019:A:1, 146020:A:1, 146022:A:1, 146061:A:1, 146067:B:1, 146067:B:2, 146068:B:1, 146070:A:3, 146069:A:1, 146069:B:2), `advancesWhenFreed` and `phantom` show as bare flags (146066:B:3, 146071:A:2).
- The Black Gate Opens: the Embassy's faceup cards are not drawn on the table; the dock's Read button opens the pair's previews.
- Renderer gaps, The Black Gate Opens (behaviour proven by spec rows): a self-only travel bar reads "any location" (146024:A:1), the cancelling seat shown as "the acting player" (146031:A:2), a subjectless leave-play trigger shown as any card (146028:A:1), the Embassy, `totalOf`, `mostPerPlayer`, `PlaceUnderSelf`, `ReturnUnderToStaging`, `SearchMove`, `EngageNextPlayer`, `RemoveFromQuest`, `DealShadowTo`, `TakeControl`, `AssignDamage` and the campaign verbs printed as JSON, and `firstPlayerReveals`, `raiseThreatIfDestroys` and `endsInDefeat` as bare names (146025 to 146041, 146072 to 146074).
- Renderer gaps, Mount Doom (behaviour proven by spec rows): `firstPlayerTens`, `stageProgress`, `mostPerPlayer`, `DiscardUntil`, `MoveEncounterCard`, `AssignDamage`, `SearchMove`, `TravelTo`, `LimitEntries`, `UncancelableWhenRevealed`, `ChooseOption`, `EndCampaign` and the campaign verbs print as JSON, `other` as a bare flag (146043 to 146057, 146075:A:1, 146076, 146078:B:1, 146079).
- Easy: the DragnCards `E0C.12` deck keeps all ten Great Spider cards where Hall of Beorn keeps six; the E0C decks lead (user decision, 2026-11-07).

### Rules and engine (Dwarrowdelf)
- Refuse an effect's CommitToQuest for a character that cannot quest in every game (today only games dealing Freezing Cold 04023), and have Hobbit Pony 10007, Grappling Hook 11005, Windfola 12116 and Late Adventurer 131017 check the character can quest. Needs an `ENGINE_VERSION` change and moves replays of the games with 08112 and The Road to Isengard.
- Expanded `DiscardFromHand` picks (Cave Spider 04097, Saruman's Voice 143080) read the generic "Choose a card to discard.": asks entries keyed on `DiscardFromHand` are not read, and the sheet does not count the picks left.
- Foundations of Stone's commit-limit refusal and note wording is agent wording, not user-confirmed.
- Readings not user-confirmed (`docs/brief.md`, Dwarrowdelf): Wrapped!'s code 040076, and The Long Dark and Foundations of Stone dealing the encounter sets their load lists give where the rulesheets swap Hazards of the Pit and Deeps of Moria.
- Burning Low (03040:A:1) reads Dark once, when it resolves: a location that turns Dark later in the phase does not get the +2 (agent recommendation; re-reading needs effects in `modifiedStat`).
- With two Blinding Blizzards (901307) the first in staging takes the progress, with no first-player choice between them; Blinding Blizzard's progress readout ("3 / 5") does not warm near 5 (agent recommendation, `docs/brief.md`, The Redhorn Gate).
- Foundations of Stone: the Giant Cave Centipede's area pick with 3 or more separate areas is written but untested (the scene kit builds 1 or 2 seats).
- Shadow and Flame readings settled only by community discussion or recommended are marked so in `docs/brief.md` (Shadow and Flame); its two readings from A Long-extended Party's Semi-official Errata and FAQ (3.026, 3.057) rest on a fan FAQ, not an FFG ruling. Not user-confirmed.
- Foundations of Stone readings settled only by community discussion or recommended are marked so in `docs/brief.md` (Foundations of Stone). Not user-confirmed.
- The Long Dark readings settled only by community discussion or recommended are marked so in `docs/brief.md` (The Long Dark). Not user-confirmed.
- The Watcher in the Water readings settled only by community discussion or recommended are marked so in `docs/brief.md` (The Watcher in the Water). Not user-confirmed.
- Road to Rivendell readings settled only by community discussion or recommended are marked so in `docs/brief.md` (Road to Rivendell). Not user-confirmed.
- The Redhorn Gate readings settled only by community discussion or recommended are marked so in `docs/brief.md` (The Redhorn Gate). Not user-confirmed.
- Flight from Moria readings settled only by community discussion or recommended are marked so in `docs/brief.md` (Flight from Moria). Not user-confirmed.
- The pinned FAQ (`lotr_faq_19.pdf`) entries 1.21, 1.29, 1.45, 1.47, 1.53 and 1.54 have no `faq.*` span yet, so Flight from Moria's readings cite the PDF.
- The Seventh Level readings settled only by community discussion or recommended are marked so in `docs/brief.md` (The Seventh Level). Not user-confirmed.
- The Caves of Nibin-Dûm reads "attach Cave Torch to a hero of his choice" (41004:A:1) as the first player's own hero; the Dwarrowdelf cards with the same phrase read any player's hero, as the Khazad-dûm insert says of Cave Torch. Not reconciled: changing the Caves moves its goldens.
- Into the Pit readings settled only by community discussion or recommended are marked so in `docs/brief.md` (Into the Pit). Not user-confirmed.
- Renderer gaps, Shadow and Flame (behaviour proven by spec rows): `engagedWithThreatening`, `shadowsFromBalrog` and `excessExhausts` have no gloss; the Balrog deck's refill when empty and an after-attack "this card" that means the attacking enemy are not said (04150:A:2, 901801:A:3, 901801:A:4, 901802:A:1, 901808:A:2).
- Renderer gaps, Foundations of Stone (behaviour proven by spec rows): `commitAlliesLimitByHeroes`, `onlyRangedCombat` and `threatInOtherAreas` show as stats; progress placed on the acting player's own stage once areas are separate reads "the main quest stage" (04118:B:2, 04122:A:2, 04127:A:1, 901707:A:1).
- Renderer gaps, The Watcher in the Water (behaviour proven by spec rows): `progressToQuest` and a per-round `progressCap` show as stats; a constant that ends when its condition card leaves play reads "until the end of the game" (04065:A:1, 04067:A:1, 901501:A:2).
- Renderer gaps, Road to Rivendell (behaviour proven by spec rows): the final-stage win and a Response scoped to travel to its own card are not said (04040:B:3, 04042:A:1).
- Renderer gaps, The Redhorn Gate (behaviour proven by spec rows): a Shadow's "you" as the defending player, the final-stage win, and a set-aside of every copy are not said (03056:A:2, 04013:B:4, 901301:A:2).
- Renderer gaps, Flight from Moria (behaviour proven by spec rows): `BypassStage`, `ShuffleStages`, `questDeck`, `inVictory`, `ActAs` and `AddSourceToVictory` print as JSON (unchanged from Mount Gundabad); `bypassShuffles`, `bypassThreat`, `ignoresWillpower` and `noQuestProgress` show as stats; immunity to player card effects only, Restricted, a stage added to the victory display on advance, a per-round progress cap, an Action any player may use, the bypass heard by every engaged copy, and X as the characters an attack destroyed are not said (03025:A:1, 03029:A:1, 03069, 03070:B:2 and the other bypass lines, 03073:B:1, 03076:B:3, 901201:A:2, 901202:B:2, 901205:A:2, 901207:A:1, 901209:A:3).
- Renderer gaps, The Seventh Level (behaviour proven by spec rows): `excessToDamage` shows as a stat; `inVictory` and a hosted `PutIntoPlay` print as JSON; the Book's claim from another hero and its return when detached, the Spearman's own attack, the first player's character in a Forced someone else acts, a stage bar on an enemy, and the empty-discard shuffle are not said (03020:A:1, 03024:A:2, 03031:A:1, 03032:A:3, 03034:A:2, 901101:A:3, 901102:A:2).
- Renderer gaps, Into the Pit (behaviour proven by spec rows): `BottomOtherLooked`, `xReachesRemaining`, `inVictory`, `ShuffleSelfIntoEncounterDeck` and `GrantTrait` print as JSON; `optionalEngageThreat` shows as a stat; a before-damage Forced, a revealed-enemy replacement, an immune location left out of a count, a refused travel, Restricted, and a `noQuestProgress` exception are not said (03014:A:1, 03036:A:2, 03041:A:1, 03048:A:1, 03049:A:1, 03052:A:1, 03060:A:1, 03064:B:2, 03065:B:2, 901002:B:3, 901005:A:3, 901008:A:2).

### Rules and engine (Shadows of Mirkwood)
- The rulesheets of The Hunt for Gollum and Conflict at the Carrock (MEC02, MEC03) have no text layer, so their rules have no span in `data/rules`; `docs/brief.md` (The Hunt for Gollum, Conflict at the Carrock) cites the PDFs.
- Readings settled only by community discussion are marked so under each scenario in `docs/brief.md` (Shadows of Mirkwood). Not user-confirmed.
- A discarded shadow card keeps its `host` (`detach` in `src/rules/core/zones.ts`); clearing it changes every `golden.json` (the field only), so it waits for an all-scenario engine bump. Workarounds: `src/rules/families/encounter/moves.ts` (a move to the active location) and `inspectTargets` in `src/play/store/selectors.ts`.
- The Nightmare decks are not in `pnpm effects render --all`, so their renders have no snapshot (`scripts/data/effects/render/snapshots`).
- Renderer gaps, Shadows of Mirkwood (behaviour proven by spec rows and line tests): a pick or count of `control: any` does not say it reaches the staging area; the final-stage win (02013:B:2); `activeThreat`, `returnsToEncounterDeck`, `cannotTriggerEffects`, `progressCap`, `returnsWithoutActive`, `undefendedToHolder`, `shadowHitsAll` and `treacheryHitsAll` show as flags; "engaged with a player" reads "the player"; victory-display stats read "while in play"; the seat a Response or a next player is counted from; `escapePassed` heard only from its own test (02106:B:2); a self-only travel bar reads "any location" (02065:A:3).

### Rules and engine (Standalone scenarios)
- The Massing at Osgiliath has no rulesheet and no official ruling; its readings are in `docs/brief.md` (The Massing at Osgiliath). Agent recommendations, not user-confirmed: Snaga Scouts engages every copy (00002:A:1), Wainriders' threat per damage placed (00004:A:1), Wolves from Mordor (00003:A:1), Wainrider Captain's "top Scout" (00005:A:1), Morgulduin (00009:A:1), Pelennor Fields charged once and satisfied by the raise (00010:A:1), Cut Off's discard offered only when payable (00012:A:3), Ranger of Ithilien's shadow (00015:A:2), Through the Ruins' count (00017:B:2), Anduin Crossing's once a round and its quest-phase timing (00018:B:3).
- The Massing at Osgiliath, community only, not user-confirmed: Easy deals the Normal deck; Ranger of Ithilien enters committed in the quest phase (00015:A:1); Anduin Crossing's discard-or-commit-nothing (00018:B:3).
- The Battle of Lake-town: the Smaug deck and Burn X rules come from the Quest Companion, a community source, not a card or rulesheet. Not user-confirmed.
- The Battle of Lake-town, agent recommendations or community only, not user-confirmed: the blind play-or-staging Smaug choice; Smaug the Magnificent's excess (50206:A:2); burn damage on characters counts as an encounter effect and Great House's own Burn counts (50205:A:2, 50210:A:1, 50221:A:2); the hero-discard cancel offered from the first player (50209:A:2, 50210:A:2); Town-Baiting's defender is the last player (50211:A:1); North Pier bars damage but not Smaug's carry-over (50218:A:2); Fisherman's Dock's travel and exhaust (50223:A:2); Esgaroth Wharf's additional attack against Lake-town (50224:A:3); The Old Thrush's Defense -X lasts the attack (50208:A:2).
- The Stone of Erech, agent recommendations or community only, not user-confirmed: the Night objectives' 4-progress check is passive and the next one enters with no progress; Spectral counts Willpower modifiers, not Attack bonuses; Relic from the Dark Years covers the attack it is played in; Derufin enters ready under the first player; stage 2B's and Tarlang's Neck's choices are the first player's; Restless Dead and Blackroot Graves move, not reveal; the Night objective, Spectral and stage 3B Battle rules come from RulesPal's transcription, a community source (`docs/brief.md`, The Stone of Erech).
- The Old Forest, agent recommendations or community only, not user-confirmed: the Easy copy counts (Hall of Beorn only); a different random stage 2A returns the left stage to the quest deck (147001:B:1, 147002:B:2); the stage 2B Forced fires once per quest that placed progress anywhere; Ending and Failing's X counts Old Man Willow (147021); the revealing player chooses on Peril cards, the first player otherwise; "beginning of the round" is the Resource phase's start (147003:B:1); Falling Branches and Song of Sleep do nothing with no eligible committed character (147018, 147019) (`docs/brief.md`, The Old Forest).
- Renderer gaps, The Old Forest: the setup search's "different" prints as JSON (147001:A:1); `AdvanceToStage` prints as JSON (147002–147005:B:2); the first player as the extra card's revealer does not print (147005:B:1, 147011:A:3); the last stage's win has no words (147006:B:2); Old Man Willow's raise reads "the acting player", not the defending player (147007:A:2); `Restrict travelOnly` prints as JSON (147012:A:2); `blankText` does not say it keeps Traits (147019:A:2); `TakeRevealedCard` prints as JSON (147022:A:1).
- Fog on the Barrow-downs, agent recommendations or community only, not user-confirmed: the Easy copy counts (Hall of Beorn only); a left 4A copy returns to the quest deck, so a player can be trapped again; an empty encounter deck during a 4A Wight discard shuffles the discard in; the Hollow Circle, Standing Stones and Long Groping Arm searches shuffle even when nothing is found; a player who joins a stage later in the round is not held by Frozen by Fear; Tom Bombadil's chooser is the first player of the revealer's area; RulesPal's phase skip with nobody at 3B and its combining rule, and Vision of the Palantír's X in 4A, are community only; from the Build: a parked 3B's active location returns to the staging area, 4B's location cancel raises threat by the Threat read before the discard, the player chooses the Great Barrow when 4B is defeated, and Frozen by Fear also bars playing events; the first player chooses the Great Barrow when a 4B player is eliminated; from the Finish: stage 4A's discard shuffles the discard pile in when the deck runs out, an opt-in `reshuffle` on `DiscardUntil` set only there (148004:A:1), and Hollow Circle, Standing Stones and Great Barrow are Immune by override where Hall of Beorn lists no keyword (`docs/brief.md`, Fog on the Barrow-downs).
- Renderer gaps, Fog on the Barrow-downs: the `inVictory` condition (148002:B:2, 148003:B:3), `RaiseThreatAtStage` (148003:B:2), the `stagingArea`, `atStage` and `engagedWith` pick keys (148004:B:2, 148009:A:1, 148010:A:1, 148016:A:1, 148017:A:2, 148018:A:2), `{facedown, plus}` (148008:A:1), `ReturnFacedownToHands` (148008:A:2) and `ImmediateAttackEach` with a trait (148014:A:1) print as JSON; the 4A discard does not say the discard pile is shuffled in (148004:A:1); a travel `Restrict` with no location reads "any location" for "here" (148007:A:1); Dark-wight's "you" does not name the engaged player (148013:A:1); `noneReturned` reads as returned cards for attacks made (148014:A:1); `cannotTriggerEffects` has no words (148017:A:2).
- Renderer gaps, The Stone of Erech: `noQuestProgress` has no gloss for "quest card only" (50303:B:2); the `maxWillpower` pick filter prints as JSON (50306:A:2, 50306:A:3, 50319:A:2, 50326:A:1); the doomed gloss says "when played" for an encounter card (50314:A:3); `SkipTravelPhase` has no template (50324:A:1).
- Renderer gaps, The Battle of Lake-town (behaviour proven by spec rows and line tests): who may use the Refresh Action (50203:B:2); "defeat Smaug to defeat this stage" (50203:B:3); a shadow card per attack (50204:A:2); the acting player of a shadow is the defending player (50216:A:3); `step canTravel` and `AddSourceToVictory` print as JSON (50219:A:2); the Dock's second active slot and its unpayable case (50223:A:2).
- Renderer gaps, The Massing at Osgiliath (behaviour proven by spec rows and line tests): `noPlayerAttachments` (00001:A:1) and `damageToThreat` (00004:A:1) show as flags; the Witch-king's chooser and raised threat read "the acting player" and "the player the event is about", not the defending player (00001:A:3); the defenders' removal from combat (00007:A:2) and the old active location's return to staging (00009:A:2) do not print; `noEffectProgress` does not say it covers the quest and the active location, effect progress only (00018:B:1); Anduin Crossing's "ally named Ranger of Ithilien" filter does not say it takes the objective ally (00018:B:3).
- The Ruins of Belegost, agent recommendations or community only, not user-confirmed: most of its readings (`docs/brief.md`, The Ruins of Belegost, Readings), reading 4 (+1 Discover, 0 with no active location) forum-only; the Easy copy counts rest on Hall of Beorn and DragnCards; page 1 of the Scenario Rules insert is not online.
- Murder at the Prancing Pony, agent recommendations or community only, not user-confirmed: readings 4, 5, 8, 13, 14, 16, 17, 19, 20, 22, 23 recommended, 2, 6, 11, 12 community only, Hired Muscle's discard with no Brigand (`docs/brief.md`, Murder at the Prancing Pony); the Easy counts have no printed source; page 1 of the insert is not online.
- The Siege of Annúminas, agent recommendations or community only, not user-confirmed: readings 2, 3, 7, 8, 9, 10, 16 (`docs/brief.md`, The Siege of Annúminas). The Standard Game Mode card is not drawn on the table; only the City dial's tap shows it.
- Attack on Dol Guldur, agent recommendations or community only, not user-confirmed: readings 4, 5, 6, 8, 10, 13, 15, 16 (`docs/brief.md`, Attack on Dol Guldur).
- The Wizard's Quest, agent recommendations, not user-confirmed: readings 2 (7 random sets; the first player picks stages 2 and 3), 3, 9, 10, 11, 14 to 17 (`docs/brief.md`, The Wizard's Quest). The Woodland Realm, The Mines of Moria and Escape from Khazad-dûm share readings 2 and 3.
- The Woodland Realm, agent recommendations, not user-confirmed: readings 3, 9, 13 (a search of the encounter deck shuffles it even when the card prints no shuffle), 16, 17, 18, 20, 21, 22; Despair blanks Mendor, so his leaving play that round does not lose (`docs/brief.md`, The Woodland Realm).
- The Mines of Moria, agent recommendations or community only, not user-confirmed: readings 1 and 10 (effect) community only; 2, 3, 9, 10 (choice), 11, 14, 15, 17, 19, 20, 22 recommended. No rulebook is online (`docs/brief.md`, The Mines of Moria).
- Escape from Khazad-dûm, agent recommendations or community only, not user-confirmed: the Quick-build rules come from RulesPal's transcription; readings 2, 3, 14, 15, 18 to 22, 28, 31 to 33 recommended (`docs/brief.md`, Escape from Khazad-dûm).
- The Hunt for the Dreadnaught, agent recommendations or community only, not user-confirmed: Easy deals the Easy Mode card (reading 1); readings 2, 3, 8, 17 and parts of 9 to 12, 15, 20, 23 to 27 recommended; reading 16 (per-player values count the players who started) rests on RulesPal's transcription. Pride of Lebennin's mulligan is offered but has no effect, because the fleet is chosen after the opening hands (reading 3) (`docs/brief.md`, The Hunt for the Dreadnaught).
- Not built: Epic Multiplayer Mode (The Siege of Annúminas, Attack on Dol Guldur, The Hunt for the Dreadnaught); the competitive and Advanced-build modes of The Wizard's Quest, The Woodland Realm, The Mines of Moria and Escape from Khazad-dûm; the Hard Mode card of The Hunt for the Dreadnaught (40003) and its player-card contract A Perilous Voyage (40047).
- A kit's quest deck must be built by `ChooseQuestStage` (`src/rules/families/wizards-quest/quick.ts`): `stageNumber` counts the position in `state.stages`, so a scenario that keeps all its quest cards there reads the wrong stage number.
- Renderer gaps, standalone kits (behaviour proven by spec rows and line tests): `ClaimWhenFree`, `SetAsideInPlay`, `AdvanceToStage`, `AttackFirstPlayer`, `CarryAwayHero`, `ReturnFacedownToHands`, `FlipOver`, `PrepareFleet`, `PrepareCorsairDeck`, `DiscardGuarded`, `exploredPending` and `Restrict exceptTrait` print as JSON; the round caps (`questProgressCap`, `damageCap`, `progressCap`, `threatReductionCap`) do not say "each round"; `mustTravel` does not say "if able"; `noneReturned` reads as returned cards where it counts attacks made; pick tie-breaks (`highestThreat`, `highestAttack`, lowest engagement cost) and the engaging or acting player (often the first player) are not shown; flags such as `activeThreat`, `singleAttacker`, `attackPerShadow`, `pillage`, `shipFightable`, `excessDamagesShip` and `startingHand` have no gloss; living or starting players are not shown on per-player values.
- The Hunt for the Dreadnaught's top bar is crowded at stage 1B: the Cap dial's label sits under the phase rail (`src/play/readouts/standalone-scenarios/hunt.ts`).

## Standing decisions
- Sources are online; no physical card or box check (user, 2026-10-24). The nine MEC109 cards rest on the older printing's scans.
- Every Rules Reference action window opens; Responses are offered as soon as their trigger resolves; deckbuilding follows the Rules Reference (one to three heroes, no sphere match on save) (user, 2026-10-25).
- An event with no record cannot be played (`rr.triggered-ability`) (user, 2026-10-26).
- Every deck-legal player card is automated (user, 2026-10-26), Messenger of the King included; RingsDB's `(MotK)` hero stand-ins (`MotKA`) stay out of the pool and import as their ally (user, 2026-11-16).
- The player deck stays hidden; the two-handed peek shows the whole seat (user, 2026-10-26).
- Back order on the table is spotlight, scrub, peek, then the rest (user, 2026-10-27).
- Pinned RevCore encounter scans that are 2010/2012 Core Set printings are accepted where the text matches (user, 2026-10-27).
- The table is landscape only; only a tablet (shortest side 600 pt) rotates other routes (user, 2026-10-28).
- The hand scrub starts after a 150 ms hold and shows a fanned risen hand; the card preview has no Close (user, 2026-10-28).
- In Daylight, gold is a bronze with a cream `onGold` (user, 2026-10-28).
- The quest meter (the command column's head) shows only in the Quest phase (user, 2026-11-03).
- The victory display is a fanned pile at staging's right end, shown only while a card is in it; card lists (piles, rows, the choice's rows) show each card's picture on night (user, 2026-11-03).
- The combat spotlight stage is always dark, a lone attack runs about 2.2 s, and a destroyed target burns (user, 2026-10-29).
- Page art has no hard edges: it fades to black or into the fog; framed tiles and panels keep theirs (user, 2026-10-30).
- The screen reader path is independent of ordinary play: with no phone screen reader on, nothing drawn, touched, heard or timed changes, the web build included; new reader behaviour is gated on `useReaderMode()`, which the Table as a list setting set to Always also turns on (user, 2026-11-05, 2026-11-07).
- The Black Gate Opens ends when the last player is eliminated, and that end runs 146074's Resolution and unlocks Mount Doom; every other scenario's loss writes nothing (user, 2026-11-12).
- A rule reading no official ruling, rule span or agreed community answer settles takes the agent's recommendation, recorded in `docs/brief.md` as "agent recommendation (no ruling found)"; it is not an open item (user, 2026-11-12).
- One scenario pipeline; no more A/B tests (user decision, 2026-11-08). The procedure is in `docs/agents/agent-brief.md` (Scenario procedure).
- An open game is never dropped by the app: after an update the player chooses Continue (from the saved table, checked against the engine) or Restart (user decision, 2026-11-11).
- Desktop builds are unsigned: Windows Authenticode is an optional step behind secrets and macOS notarization is not wired (user decision, 2026-11-16; `docs/releasing.md`, Signing).
- The desktop origin and profile folder never change after the first release (user decision, 2026-11-16; `.claude/rules/release-standards.md`, Tags and releases).
- The desktop and web work never changes phone or iPad code or the Android and iOS bundles (user instruction, 2026-11-16; `docs/architecture.md`, Screens).
- The app may go online for the RingsDB deck import and a daily update check (on by default, a switch in Settings), and for nothing else (user decision, 2026-11-17; `docs/architecture.md`, Update check).
- Saves stay synchronous on desktop and web, as on the phone; the web waits for the database on a clock deadline, not a spin count (user instruction, 2026-11-16; `src/screens/data/web/sync-wait.ts`).
