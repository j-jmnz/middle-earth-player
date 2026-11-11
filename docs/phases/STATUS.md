# Phase status

Status is `not started`, `active`, or `completed`. This file keeps only what is current (`.claude/rules/docs-standards.md`).

## Rules

- If nothing is active, the only legal start is the lowest-numbered phase whose dependencies are completed. Dependencies live in the phase file, not in this table.
- When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active. More than one phase may be active only when their files say they can run beside each other.
- A phase is `completed` when its exit is green and `/reviewer` reports no blocks. A phase that changes `src/screens` or `src/play` also needs `/ux` to report no blocks. Write the date.
- A scenario phase has an engine half and a screen half (`docs/handover/agent-brief.md`, Scenario procedure). When the engine half's exit is green and reviewed, write `engine done` in the note and leave the phase `active`. The phase is completed when both halves are.
- Phases 27 to 33 and 37 to 60 (Mirkwood Paths, Dream-chaser and Ered Mithrin) have one review round per phase, as `.claude/agents/orchestrator.md` "One review round" says, in place of "`/reviewer` reports no blocks" (user instructions, 2026-10-27, 2026-10-30, 2026-11-05). A block the fix pass leaves open goes in the phase's note.
- Maestro flows are written in the phase that names them. `maestro test` runs after the last phase; it does not gate an earlier phase.
- Phone and tablet checks are not tracked: no phase waits on one, and none is listed here (user instruction, 2026-11-06).
- Current counts live in code: the engine version in `src/rules/engine/version.ts`, the playable scenarios in `src/campaign/playable.ts`, the printed lines no record owns in `src/effects/open-lines.ts` (`pnpm effects open`).

## Phases

| Phase | Work | Status | Note |
| --- | --- | --- | --- |
| 0 | Correct the brief | completed | 2026-10-23. |
| 1 | Tooling shell | completed | 2026-10-23. |
| 2 | Catalog build | completed | 2026-10-23. |
| 3 | Phone databases | completed | 2026-10-23. The open-card Maestro flow runs with the suite. |
| 4 | Scenario 1 fixture | completed | 2026-10-23. |
| 5 | Image cache | completed | 2026-10-23. |
| 6 | Deck builder | completed | Redesigned 2026-10-25. |
| 7 | Round engine | completed | Review fixes not re-reviewed. |
| 8 | Scenario 1 effects | completed | 2026-10-24. |
| 8b | Data store | completed | 2026-10-24. |
| 8c | Printed text and rule spans | completed | 2026-10-24. Scoring wording differs between the Rules Reference and the Learn to Play; the brief follows the Learn to Play. |
| 8d | Campaign from cards | completed | 2026-10-24. Deferred: the no-replacement case of the fellowship-of-heroes rule. |
| 9 | Starter effects | completed | 2026-10-24. Marked completed by the user without a second review; review fixes not re-reviewed. |
| 10 | Campaign shell | completed | 2026-11-06. Review fixes not re-reviewed. |
| 11 | Scenario 1 table | completed | 2026-11-06. Review fixes not re-reviewed. |
| 12 | A Knife in the Dark | completed | 2026-11-06. Review fixes not re-reviewed. |
| 13 | Flight to the Ford | completed | 2026-11-06. Marked completed by the user; `/ux` not run. |
| 14 | The Ring Goes South | completed | 2026-11-06. Marked completed by the user; `/reviewer` and `/ux` not run. |
| 15 | Journey in the Dark | completed | 2026-11-06. Review round done. Not on Nightmare. |
| 16 | Breaking of the Fellowship | completed | 2026-11-06. Review round done. Not on Nightmare. |
| 17 | Design system | completed | 2026-10-23. |
| 18 | Card frames follow the card | completed | 2026-10-26. ux fix not re-reviewed. |
| 19 | Top bar and table menu | completed | 2026-10-26. |
| 20 | Phase carousel | completed | 2026-10-26. |
| 21 | Choice tray | completed | 2026-10-26. |
| 22 | Declutter the board | completed | 2026-10-26. |
| 23 | Motion pass | completed | 2026-10-26. |
| 24 | Combat spotlight | completed | 2026-10-27. |
| 25 | Hold and slide through the hand | completed | 2026-10-27. |
| 26 | Peek at the other seat | completed | 2026-10-27. |
| 27 | Multi-campaign data | completed | 2026-10-27. |
| 28 | Campaign registry, saga gating, log, booklets | completed | 2026-10-27. |
| 28b | Collapsible sections and run history | completed | 2026-10-28. Open review notes below. |
| 29 | Passage Through Mirkwood | completed | 2026-11-06. Review round done. |
| 30 | Journey Along the Anduin | completed | 2026-11-06. Review round done. |
| 31 | Escape from Dol Guldur | completed | 2026-11-06. Review round done. |
| 32 | The Oath | completed | 2026-11-06. Review round done. |
| 33 | The Caves of Nibin-Dûm | completed | 2026-11-06. Review round done. |
| 34 | Nightmare data and pictures | completed | 2026-11-06. |
| 35 | Nightmare difficulty | completed | 2026-11-06. Review rounds done. |
| 36 | Nightmare effects | completed | 2026-11-06. Review round done; known limits under Open items. |
| 37 | Dream-chaser data | completed | 2026-10-30. Review round done. Open: A Storm on Cobas Haven Easy counts follow Hall of Beorn, not a printed mark. |
| 38 | Dream-chaser campaign shell and XP | completed | 2026-10-31. Review round done. |
| 39 | Sea mechanics family | completed | 2026-10-31. Engine only; review round done. Open: Upgraded-side ship stats; face-aware records; Sailing events. |
| 39b | Ships on the table | completed | 2026-10-31. Review round done. |
| 40 | Voyage Across Belegaer | completed | 2026-10-31. Review round done. |
| 41 | The Fate of Númenor | completed | 2026-10-31. Review round done. |
| 42 | Raid on the Grey Havens | completed | 2026-10-31. Review round done. |
| 43 | Flight of the Stormcaller | completed | 2026-10-31. Review round done. |
| 44 | The Thing in the Depths | completed | 2026-10-31. Review round done. |
| 45 | Temple of the Deceived | completed | 2026-11-01. Review round done. |
| 46 | The Drowned Ruins | completed | 2026-11-04. Review round done. |
| 47 | A Storm on Cobas Haven | completed | 2026-11-04. Review round done. |
| 48 | The City of Corsairs | completed | 2026-11-05. Review round done. |
| 49 | Ered Mithrin data | completed | 2026-11-05. Review round done. Open: Crypt Stalker Easy count unconfirmed. |
| 50 | Ered Mithrin campaign shell, treasures and the pool | completed | 2026-11-05. Review round done. Open: a discovered treasure cannot be put in a deck from the app. |
| 51 | Wilderland mechanics family | completed | 2026-11-05. Engine only; review round done. Not built: Caves-deck bottom and arrange (18055, 18079), Crypt Key's Discover modifiers, a look window for Discover. |
| 51b | Wilderland on the table | completed | 2026-11-05. Review round done. |
| 52 | Journey Up the Anduin | completed | 2026-11-06. Review round done. |
| 53 | Lost in Mirkwood | completed | 2026-11-06. Review round done. |
| 54 | The King's Quest | completed | 2026-11-06. Review round done. |
| 55 | The Withered Heath | completed | 2026-11-06. Review round done. |
| 56 | Roam Across Rhovanion | completed | 2026-11-06. Review round done. |
| 57 | Fire in the Night | completed | 2026-11-06. Review round done. Marked completed by the user; the side-quest area is under Open items. |
| 58 | The Ghost of Framsburg | completed | 2026-11-06. Review round done. |
| 59 | Mount Gundabad | completed | 2026-11-06. Review round done. |
| 60 | The Fate of Wilderland | completed | 2026-11-06. Review round done. |
| 61 | The Two Towers data | completed | 2026-11-07. Review round done. Open: MEC112 2023 wording unverified. |
| 62 | The Two Towers campaign shell | completed | 2026-11-07. Review round done. |
| 63 | The Uruk-hai | completed | 2026-11-10. Review round done. Open: `hai-won`. |
| 64 | Helm's Deep | completed | 2026-11-11. Review round done. Open: `deep-won`. |
| 65 | The Road to Isengard | completed | 2026-11-11. Review round done. Open: `isengard-won`. |
| 66 | The Passage of the Marshes | completed | 2026-11-11. Review round done. Open: `marshes-won`. |
| 67 | Journey to the Cross-roads | completed | 2026-11-11. Review round done. Open: `roads-won`. |
| 68 | Shelob's Lair | completed | 2026-11-11. Review round done. Open: `lair-won`. |
| 69 | The Return of the King data | completed | 2026-11-11. Review round done (with phase 70). Plan: `docs/plans/return-of-the-king.md`. |
| 70 | The Return of the King campaign shell | completed | 2026-11-11. Review round done. Open: six campaign-card lines left to their scenarios. |
| 71 | The Passing of the Grey Company | active | 2026-11-11. |
| 72 | The Siege of Gondor | not started | |
| 73 | The Battle of the Pelennor Fields | not started | |
| 74 | The Tower of Cirith Ungol | not started | |
| 75 | The Black Gate Opens | not started | |
| 76 | Mount Doom | not started | |

## Open items

### Releases
- The Android release key is not set up (`docs/releasing.md`, Android key), so no release has been cut; the release workflow has not run yet, dry run first. TestFlight (optional) is not set up.
- The first release with the open-game checks (world hash, per-move checks, checkpoints) carries no card, campaign or engine change, so open games convert cleanly (`docs/brief.md`, Persistence and shipping).
- The release notes' golden-check comparison (`scripts/release/reach.ts`) has not run against a real previous tag; the first tag after it compares by `ENGINE_CHANGES` only.

### Fixtures and Maestro
- `marshes-won` is not committed: no seed in 600 wins The Passage of the Marshes with The One Deck and Defenders of Gondor (every game reaches threat 50 by round 4). Until it exists `.maestro/scenarios/the-passage-of-the-marshes/the-passage-of-the-marshes.yaml` cannot run.
- `lair-won` is not committed: no seed in 600 wins Shelob's Lair with The One Deck and Defenders of Gondor. Until it exists `.maestro/scenarios/shelobs-lair/shelobs-lair.yaml` cannot run.
- `roads-won` is not committed: no seed in 600 wins Journey to the Cross-roads with The One Deck and Defenders of Gondor. Until it exists `.maestro/scenarios/journey-to-the-cross-roads/journey-to-the-cross-roads.yaml` cannot run.
- `isengard-won` is not committed: no seed in 600 wins The Road to Isengard with The One Deck and Defenders of Gondor. Until it exists `.maestro/scenarios/the-road-to-isengard/the-road-to-isengard.yaml` cannot run.
- `deep-won` is not committed: no seed in 100 wins Helm's Deep with The One Deck and Defenders of Gondor. Until it exists `.maestro/scenarios/helms-deep/helms-deep.yaml` cannot run.
- `hai-won` is not committed: no seed in 1000 wins The Uruk-hai with The One Deck and Defenders of Gondor. Until it exists `.maestro/scenarios/the-uruk-hai/the-uruk-hai.yaml` cannot run.
- `wilderland-won` is not committed: none of 100 seeds (and 750 more under five other policies) wins The Fate of Wilderland with the starter decklists. Until it exists `.maestro/scenarios/the-fate-of-wilderland/the-fate-of-wilderland.yaml` cannot run.
- `gundabad-won` is not committed: none of 100 seeds wins Mount Gundabad with the starter decklists; the hero carrying Wormsbane leaves play in the first rounds or threat runs out. Until it exists `.maestro/scenarios/mount-gundabad/mount-gundabad.yaml` cannot run.
- `framsburg-won` is not committed: none of 100 seeds wins The Ghost of Framsburg with the starter decklists. Until it exists `.maestro/scenarios/the-ghost-of-framsburg/the-ghost-of-framsburg.yaml` cannot run; its `CHOICE_*` lines are commented out.
- `night-won` is not committed: none of 100 seeds wins Fire in the Night with the starter decklists. Until it exists `.maestro/scenarios/fire-in-the-night/fire-in-the-night.yaml` cannot run; a win can ask up to four Resolution questions and `subflows/scenario-win.yaml` takes two.
- `rhovanion-won` is not committed: none of 100 seeds wins Roam Across Rhovanion with the starter decklists. Until it exists `.maestro/scenarios/roam-across-rhovanion/roam-across-rhovanion.yaml` cannot run, and it still needs the `CHOICE_*` and `CHOICE2_*` answers for the Resolution's location choice.
- `heath-won` is not committed: none of 100 seeds wins The Withered Heath with the starter decklists. Until it exists `.maestro/scenarios/the-withered-heath/the-withered-heath.yaml` (with `CHOICE2_SEAT`) cannot run.
- `kingsquest-won` is not committed: none of 100 seeds wins The King's Quest with the starter decklists. Until it exists `.maestro/scenarios/the-kings-quest/the-kings-quest.yaml` (and its `CHOICE2_*` path in `scenario-win.yaml`) cannot run.
- `lostmirk-won` is not committed: none of 100 seeds wins Lost in Mirkwood with the starter decklists. Until it exists `.maestro/scenarios/lost-in-mirkwood/lost-in-mirkwood.yaml` cannot run, and its pool and treasure asserts do not yet prove part 2 wrote them.
- `upanduin-won` is not committed: no seed in 600 wins Journey Up the Anduin with the starter decks under the scenario's policy. Until it exists `.maestro/scenarios/journey-up-the-anduin/journey-up-the-anduin.yaml` cannot run.
- Scenario 1's `won` fixture is not committed. `scripts/e2e/fixtures.ts --won` searches for it. Until it exists `.maestro/scenarios/a-shadow-of-the-past/scenario-1.yaml` cannot run, and `knife-lost` (dealt from its log) is missing, so `.maestro/scenarios/a-knife-in-the-dark/a-knife-in-the-dark-loss.yaml` cannot run either.
- A Knife in the Dark's won flow has no genuine win (user-accepted, 2026-10-25).
- Fixtures not committed, because no real win of the earlier scenarios exists to chain from: `ford-start`, `ford-won`, `ford-lost`; `south-start`, `south-stage-4`, `south-won`, `south-lost`; `anduin-won`; `dol-guldur-won`, `dol-guldur-lost`; `nibin-dum-won`; Mirkwood Paths parts 4 and 5; `moria-won`, `moria-pairs`, `moria-lost`; `breaking-solo`, `breaking-pair`, `breaking-won`, `breaking-lost`. A fixture is a real save: each starts from the log the earlier parts write when won, and joins `src/campaign/fixtures.ts` when `scripts/e2e/fixtures.ts --won` finds that chain.
- No Maestro flow has run. The flows that cross a stage advance must pass the quest advance screen (`quest-advance-progress`, Progress is optional); a fixture parked on a When Revealed question shows the question instead.
- `.maestro/features/mirkwood-start.yaml` picks a Fellowship starter deck that a non-saga briefing may refuse.
- `.maestro/features/deck.yaml` and `.maestro/features/rules.yaml` are phone flows; they cannot run on an expanded tablet.
- No Maestro flow plays an attack through the redesigned combat spotlight.
- `.maestro/config.yaml` lists `scenarios/*/*` and `features/*`: not yet run to see `maestro test .maestro` and the EAS `e2e` workflow (`flow_path: .maestro`) pick up every flow through it.
- The committed `journey-along-the-anduin.json` and `the-caves-of-nibin-dum.json` fixtures predate the log's `modes`, `modeDefault`, `xpGained` and `marks` fields; `scripts/e2e/fixtures.ts` rewrites them with those fields, the same seeds and the same intents.
- `voyage-won`, `fate-won`, `raid-won`, `stormcaller-won`, `depths-won`, `temple-won`, `ruins-won` and `haven-won` are not committed (the Fate fixtures carry a Voyage win played from the golden): no auto-played win with real decks was found (the shipped pair in 100 seeds, each prebuilt deck solo in 40, 17 two-handed pairs in 60). The goldens win only with synthetic heroes.
- `LowerThreatByRaise` (08062) bypasses `lowerThreatByEffect`, so the Hard cap and Expert bar do not stop it. Engine refusal strings in `sea/ships.ts` still say "ship-objective".

### Rules and engine
- A Shadow of the Past: the encounter smoke (`scripts/card-smoke/encounter.ts`, `KNOWN`) finds Escape to Buckland's Response (141024:response:1, hideSucceeded) offered during a travel's Hide test and refused with "Travel was refused". Not fixed.
- The Fate of Wilderland readings the reading judge questions, not user-confirmed: 19155:A:2 carries a once-per-round limit the printed Forced lacks; 19160:A:1 fires when the attack is over, not when the blank shadow card is dealt.
- Journey Up the Anduin readings not user-confirmed: the treasure comes at exactly X resources (120165:A:3); the first player chooses the treasure and its character; progress placed after a successful quest counts for 18066:B:1; locations from 18066:A:1 are added as each is discarded; 18067:B:1 caps staging locations only; Lost in the Wild goes to the encounter discard when it discards the hand.
- Lost in the Wild: a player-card `canPick` condition knows a hand pick is a discard only when its record says `discarded: true` (Jewels of Wilderland, Glittering Lute); other campaigns' records are not marked.
- Treasures cannot be played from a hand (no path for type `treasure`); only the claim puts one into play.
- Wilderland: an Evil Creatures enemy shuffled back into the encounter deck keeps its deck mark (`deckRoute`); no card does this yet.
- The King's Quest: the goldens' policy keeps Underground Lake in the Caves deck, so no golden explores an X-quest-point location; unit tests cover it. 18079:B:2 has no `anyPlayer`, so only the first player is offered the stage's Caves look. `freeTreasures`' gate is always true in real games (the scan of the staging area is the real gate).
- Lost in Mirkwood: no golden wins on the nemesis route (stage 4A, The Forest of Great Fear); unit tests cover it. With two players each holding a hero (18074), `heldDial` marks only the first seat's dial.
- Wilderland readings not user-confirmed: Deep does nothing once its location is no longer active; a non-location Deep replacement other than a Dragon Sign goes to staging; Guarded (X) with no match leaves the objective unguarded.
- Dream-chaser: which side a set-aside upgraded card turns up on is decided per scenario (phases 40-48); `SetAside` deals facedown.
- Dream-chaser: the two Grapple variants on Nightmare cards (fewest or most enemies grappled) stay unparsed.
- The Havens Burn and the Dream-chaser location are upgradable on the MEC111 log, but no source prints their Upgraded sides: their XP rows cannot be bought. Gavin and the four Send for Help cards have no B side in the ledger either.
- The Thing in the Depths: if Sahír and Na'asiyah never enter play (a Northern Tracker explores the Helm from staging), stage 2 flips nothing, so the Black Key, Sea Serpent and Come Together never arrive and XP lines B:4 to B:6 cannot be earned. The literal reading is played and tested; no ruling found.
- The Drowned Ruins: Spyglass (11203:A:5) puts "Spyglass" into play from hand, deck or discard; where that copy comes from in a campaign is not settled, so the option is not offered (user decision needed).
- The Drowned Ruins: the Black Key stays on Sahír when he flips to his enemy side and gives no bonus there; no rule removes an attachment whose host stops being legal. No ruling found.
- The Drowned Ruins goldens never put an Underwater location in the victory display, so the XP for them is checked only by the card tests.
- A Storm on Cobas Haven, readings played literally and not user-confirmed: a tower the players control stays theirs when guarded again (it counts for 11209:B:7); Ramming Speed! (12131) reads only the Ship enemies engaged with the revealing player; Send for Help's hero and Gandalf are named by the revealing player; Coast of Anfalas' travel cost takes any player's ship; Taking on Water's Action belongs to its ship's controller and its "exhaust 3 characters" is an effect, not a cost; the Skirmisher taken as a ship keeps its immunity and has no Boarding. Settled by `dcce.ship-objectives`: Ship objectives count as allies for the Skirmisher's discard.
- A Storm on Cobas Haven, known limits: the `exhausted` trigger fires only for the Exhaust verb, so a sea sweep announces `shipExhausted` between actions (Taking on Water's 2 damage lands after the exhausting action; an exhaust and ready inside one action is missed); The Beacon may be used with no Warship set aside; an added phase does not give back once-per-phase uses; the "If Send for Help (X) is upgraded" clauses are unrecorded (no Upgraded side printed); the 3-or-more-players branch of 12121:A:1 is tested by no scene.
- A Storm on Cobas Haven, not reached by a golden (card tests only): the Skirmisher's Response and the ship it becomes, a Warship's set-aside on destruction, Send for Help (Tactics), 11209:B:6 to B:8.
- Revenant's damage limit is two Forced records: `effect-coverage.test.ts` refuses a constant record on a printed "Forced:" line.
- The Corsair reshuffle glides the discard to the deck without a count pop.
- The City of Corsairs: The Shattered Monument is dealt facedown from the encounter deck, so an upgraded game keeps it on side A and its immunity (`dealtFace` upgrades faceup deals only). Gavin ends in the encounter deck or discard pile in the upgraded goldens; not checked against the rules.
- The City of Corsairs, not reached by a golden (card tests only): the Corsair Waters limit and the Umbar Slaver's spend trigger (the auto-player plays no cards); no two-handed golden wins by sinking the Stormcaller.
- Nightmare 904605 Sahír's Pursuer and 905402 Patrol Ship print ENEMY (Ship trait), so they stay non-ship enemies.
- Fellowship-of-heroes with no replacement left in the collection is not modelled (`ltp.fellowship-of-heroes`, `rr.fellowship-of-heroes`).
- Simultaneous Forced and delayed effects resolve in a fixed order, not the first player's choice (FAQ 1.02).
- `src/play/readouts/threat-level.ts` shows 50 as the elimination level and ignores The One Ring's `eliminationReduction`.
- Burglar's Turn loot has no table UI.
- Collapsed Mine's per-round cap ignores progress placed before it appears (fixing it moves every game; in the brief).
- 41004:B:1 prints "searches the encounter deck"; the record also searches the discard pile.
- The Oath: the Tokens dial does not open the quest preview; the Resolution joins used Adaptations with a comma, not "and".
- Escape from Dol Guldur: the claim prompt does not name the lasting effect.
- A confirmed "another" defender cannot be backed out of (the declaration frame has no pass).
- Phase 13 reviewer notes, not fixed: one function for passing the first player token; one immediate attack; the 141028 Setup record that setup does not read; the module-level map in `announceProgress`; non-burden verbs in the burden family; a hard-coded "Ring-bearer's" in `words/scenarios/burden.ts`.
- `CountsAs` and `byEncounterDeck` live in the shared schema, not a family. `why.ts` matches the "different heroes" refusal by its wording.
- Ledger readings 41050.A, 41012.A and 01090.A were re-checked against the scans, not user-confirmed.
- Frodo's Choice (142068:A:2): its Ring-bearer clauses find nothing, since stage 2A removed the Ring-bearer from the game; the revealer takes the first player token for the game. Not user-confirmed.
- One active location per separate stage (phase 16) is read from `rr.active-location` and `mec109.multiple-staging-areas`, not stated by a card. Not user-confirmed.
- Separate stages: `viewOf` builds a new state per call, so state-keyed memos miss inside a view (speed only). The normalizer's `searched` rule marks every staged location of a quest with an each-player-adds-location clause.
- Journey in the Dark and Breaking of the Fellowship Nightmare decks (9065xx, 9066xx) have no records.
- Nightmare, A Knife in the Dark: an exhaust of The One Ring paid as a cost (`exhaustCode`, other Frodo versions) is not announced, so Menacing Wraith (906202:A:2) does not hear it.
- Nightmare, Passage Through Mirkwood: Ungoliant's Spawn discards a character at 0 Willpower when its effect resolves, not again later in the phase.
- Nightmare, Journey Along the Anduin: A Flooded Ford's "gains doomed X" raises threat on reveal but is not announced as the doomed keyword; Troll Attack's shadow (900208:A:2) deals the Troll's Attack as damage to a hero of each other player without making an attack, and reads the Attack after its `endOfAttack` modifiers have expired.
- Nightmare, Escape from Dol Guldur: Torture Master captures the hero the attack was made against, not each of several defenders; with 3 or 4 players the logged prisoner swap (01131:A:3) may leave one player with two prisoners.
- Ered Mithrin data: Crypt Stalker (19099) Easy count is 1 (Hall of Beorn) against E08.7's 2; no printed source settles it.
- Ered Mithrin data: the EMCE box prints collector numbers one below Hall of Beorn and RingsDB; codes and `printings[].number` follow the sources' number.

### Screens and code
- Fire in the Night: the table has no side-quest deck area or current-quest mark (`docs/brief.md`, Ered Mithrin).
- Ered Mithrin: a discovered treasure cannot reach a deck from the app. `validateLoadout` admits it, but `deckSaveRefusal`, the import, the deck store and the Cards pool read deck-legal rows only, and a saved deck is not tied to a save's log. Needs a design.
- Ered Mithrin: `AddEncounterToPool` with `inPlay` counts in-play copies the pool did not deal in, an upper bound, since copies have no identity.
- Run history (28b): `recordUnclosedRun` has no test; a win left unconfirmed until an engine or data update drops it cannot be recorded; `run-writers.ts` imports `ScenarioState` through `play/store`.
- A player side quest in the play row is drawn in a portrait rect, so its sideways scan is cropped; two seats with the same side quest show two plates of one name.
- `items-baseline` collapsed on Android in the path; it is still in `card-pool.tsx` and `log/[saveId].tsx`.
- Why the path screen was laid out taller than the window on Android is not known. The action bar's overrun measure stays for screens that keep a bar.
- Web only: opening Cards, Import or a deck first can raise "error during concurrent rendering" (expo-sqlite "Sync operation timeout"; React recovers). Rows ending in a stepper warn "nested button".
- The combat spotlight's sprite is worked out twice per slot in an active frame.
- Not built from the Carved Stone handoff: the card screen's "Add to a deck"; the table's encounter row and right-hand piles; the handoff's defend tray.
- Tablet follow-ups: an Android `appCategory` or large-screen plugin if the table lock must hold on Android 16; pushed routes under the tabs; a Packs list-detail; a Deck import section in `docs/design-system.md`; a "Tap anywhere to close" hint on the preview.
- Run `pnpm assets scans` on the build machine before a release, so side B pictures and the `.scene` files are bundled.
- Scenario pipeline (`docs/plans/scenario-pipeline.md`): section E (ledger seed, pile overrides, XP rows in data) is not built, nor are its Next steps; the core's remaining direct family calls (travel, pick, condition, amount, `syncThreatSaves`, `playSweep`, `heldByLapsedStage`) move behind the hooks when their family is next changed.
- Choice words: the entries marked Open in the allowlist of `src/play/words/scenario-words.test.ts` are bare prompts still to be named.
- The Maestro subflows in `.maestro/subflows/` and the eight Dream-chaser flows that call them are checked statically only, not run.
- Accessibility: the drawn canvas takes no keyboard focus and its own text and fixed alphas do not follow Bold Text or Reduce Transparency; on iOS, Escape and Z do nothing (React Native sends no key events there).
- Accessibility: at font scale 2 on a phone in landscape the dock's worst moment (a why line, a three-line primary, Cancel and More, an attack readout) passes its column even with the aids folded (`it.fails` in `dock/text-size-fit.test.ts`); at font scale 1 the longest caution with an attack readout passes it by up to 16 pt (`HAND_SLACK`, `budget.test.ts`). Needs a dock design.
- Accessibility: the Label in Name entries held in `OPEN` (`scripts/checks/a11y-web.ts`) are axe joining sibling text with no space on react-native-web; the names start with their visible words.
- Renderer gaps (`pnpm effects render`; behaviour proven by spec rows): Helm's Deep's `PlaceToken` names no token type or host (143033:A:2), `archeryBonus` and `archeryToAllies` show as flags (143037:A:1, 143058:A:2), the acting player is not shown to be the first player (143041:A:1, 143073:B:2) or the discarding player (143050:A:1, 143055:A:1, 143068:A:2), a Siege attachment's trait (143042:A:2), an `x` condition's count (143042:A:3), the Traits kept by a blank text (143043:A:1, 143061:A:2), searched zones (143074:A:1, 143054:A:2), `RevealFewer`'s duration (143020:A:2), `TriggerWizardry`'s only-player reading (143047:A:2, 143062:A:1), the Wolf's attack target (143052:A:1), a count taken before its stage leaves (143078:B:2), an ally-or-objective filter (143079:B:3) and a win shown as `trackQuestProgress` (143080:B:3); about 40 fortress, burden and wizardry pieces print as JSON.
- Renderer gaps, The Passage of the Marshes (behaviour proven by spec rows): `enteredHand` does not say draw only (144015:A:2), a Travel cost's refusal when it cannot be paid (144020:A:3, 144021:A:2, 144022:A:3), the first player shown as the actor (144021:A:1, 144064:A:1, 144064:B:1, 144065:B:2, 144065:B:3, 144066:B:2), the cancel's payer (144055:A:2) and the last stage's win (144066:B:2); 25 pieces of older verbs (`SearchMove`, `MoveEncounterCard`, `ExhaustEach`, `AttachToQuest`) print as JSON.
- Renderer gaps, Shelob's Lair (behaviour proven by spec rows): searched zones (144043:A:2, 144054:A:1), Cleft's "while in play" step gated on the victory display and `engagedWithFirst` (144045:A:2), later arrivals under Many Openings (144051:A:1), `MakeActive` returning the old location (144059:A:1), the Traits kept by Shelob's Poison's blank (144060:A:1), the target and timing of `afterThis` (144062:A:2), the Underground filter's reach into staging (144070:B:1), "each round" and "put into play" in `LimitEntries` and `questProgressCap` (144071:B:2, B:3), `resourceCancel` (144072:B:2) and whether a cancel option raises `whenRevealedCanceled` (144055:A:2); about 25 pieces print as JSON.
- Renderer gaps, Journey to the Cross-roads (behaviour proven by spec rows): a travel bar with no `location` reads "cannot travel to any location" where the engine bars that location only (144030:A:2; the template is shared, so rewording moves six other snapshots), `AddFromPile` and `deckOnly` print as JSON, later-arriving Harad enemies under a lasting effect (144029:A:1, 144039:A:1), the Travel refusal with the Harad deck empty (144032:A:2), and each player's own Setup choice and earned Brace of Coneys (144069:A:2, 144069:B:1).
- Effect templates: an unlabelled conditional constant ("If you are on-course, ~ gets +2 …") is read as triggered by `unreadBefore`; `SPLIT_LINES` in `scripts/data/effects/generate.ts` names one card's line.

### Rules and engine (The Two Towers)
- Beyond All Hope readings not user-confirmed (143071:B:1): the trim to three non-Fellowship heroes counts the living heroes on the log, not only those in the game; the fallen list is one shared list; the first player picks who earns the boon.
- Not fixed from The Uruk-hai's review: `engagedThreatSeat` (143065:A:2) is declared in the pursuit family, not with `engagedThreat`.
- Six older records put `shadow: false` on a printed additional attack (18035:A:2 and its copies), against `faq.additional-attacks`, which deals the additional attack a new shadow card.
- Call of the Ring (144054:A:2) copies 19081:A:2, and 19081:A:2 and its copies (19013:A:3, 18035:A:2, 19106:A:2, 18047:A:2, 19132:A:2) deal no new shadow card to the additional attack (`faq.additional-attacks`); the fix moves The Passage of the Marshes' golden, so it is a separate change with `ENGINE_VERSION` (user decision, 2026-11-11).
- Saga Frodo's Response (141001:response:1) needs The One Ring 141085 exhausted; in The Two Towers the Ring is 144063, so the cancel is never offered in The Passage of the Marshes, Journey to the Cross-roads or Shelob's Lair. Fixing it can move their goldens.
- Shelob's Lair readings not user-confirmed (`docs/brief.md`, The Two Towers): agent recommendations on the chooser of Shelob's Forced and A Heavy Burden (144040:A:3, 144052:A:3), the Secret Way's explore (144044:A:3), Cleft for Shelob (144045:A:2), stacking Under-way copies and its Shadow (144047:A:1), Deep Dark Passage per placement (144048:A:1), Den of Night hearing We Hates Them!'s cancel (144049:A:1), Exhalation of Decay's attachment (144050:A:1), Shelob's Poison with no hero (144060:A:1) and the per-player ally limit (144071:B:2); fan-review readings only on Blocked Tunnel's returned location (144059:A:1), stage 1's Response (144070:B:2) and Shelob's resources per damage instance (144072:B:2); community-settled only on Morgul Vale's "Then" (144043:A:2).
- The Two Towers ledger reads the pinned 2014 and 2015 Treason of Saruman and Land of Shadow scans; no pinned scan shows MEC112's 2023 wording, so a rewording cannot be found (`scripts/data/printed/scope.ts`, `MEC112_CHANGED`).
- Helm's Deep readings not user-confirmed (agent recommendation; `docs/brief.md`, The Two Towers): 143074:B:2 (progress on the active location only is not placed on the stage); 143074:A:1 (a staged Helm's Gate becomes active when none is found); 143033:A:1 (the tokens are a live staging amount).
- The Road to Isengard readings not user-confirmed (`docs/brief.md`, The Two Towers): agent recommendations on Saruman's Voice's hero (143068:A:2), the elimination at 0 cards once an effect ends (143080:B:3), "as if he is the only player" (143047:A:2), the Wolf outside an attack (143052:A:1), Orthanc cancelling the overflow and returning without tokens (143080:B:2), Orthanc revealing before discarding (143053:A:2) and Ring-wall's owner for an Ent (143055:A:1); community readings only on the Staff once per drawing player (143048:A:1) and a Wizardry shadow firing at its flip (143047:A:2, 143052:A:1).
- The Passage of the Marshes readings not user-confirmed (`docs/brief.md`, The Two Towers): agent recommendations on the Mire token on the active location (144016:A:2), Creeping Marshes after the keyword and always discarded (144024:A:2), Haunted Mere's reveal as a showing (144021:A:1), Evil-smelling Fens hitting Sméagol (144019:A:1), travel costs that eliminate (144019:A:2, 144023:A:2), the Searching Eye in the kept hand (144015:A:2), We Hates Them!'s chooser (144055:A:2), Gollum always engaged with the first player (144075:A:1), stacked Gollum discards (144064:B:2), no reshuffle on 2A (144065:A:1), one reveal on 2B (144065:B:3) and Gollum and Sméagol passing on the first player's elimination; forum readings only on an OR option that does nothing (144020:A:2, 144054:A:1).
- Journey to the Cross-roads readings not user-confirmed (`docs/brief.md`, The Two Towers): agent recommendations on Fierce Southrons' first option needing a Harad enemy in staging (144038:A:2), Brace of Coneys' two different options (144014:A:2), placing under The Black Gate after the attack (144037:A:2, 144039:A:2) and a Harad deck card being revealed, not only added (144068:B:1, 144032:A:2, 144036:A:2).
- The lasting-effect class holder `enemies:<Trait>` reads printed traits (`heldBy`, `src/rules/core/holder-classes.ts`): a card that gains a trait is not reached. No card in play gains Harad.
- The Return of the King: the ledger's `eyeIcons` (Sauron's Eye icons on Mountain of Fire encounter cards) is not carried onto catalog cards; the Fortitude test needs it. The Dire, Assault and Phantom keywords are unknown to the build.
- The Return of the King data readings not user-confirmed: The Battle of the Pelennor Fields deals the Harad enemies the campaign log records from the campaign card, not an aside pile; Reeking Moat's Easy count 3 has no printed source; the burden-set icons of the last campaign cards rest on Hall of Beorn's names.
- The Return of the King campaign cards' lines left to their scenarios' Build: 145078:A:1 and B:1 (phase 73), 146069:A:1 and B:1 (phase 74), 146079:A:1 and A:2 (phase 76). Until then the waived hero-change penalty and burden sets of those Setups are not applied.
- The Return of the King shell readings not user-confirmed (`docs/brief.md`, The Return of the King): the Andúril search asks the first player and costs every seat +1 starting threat (a community reading); either side of the Army of the Dead in the victory display earns its boon; the Corsair Fleet count reads whichever side is in play.
- Mount Doom's Keep resolution repeats "The players lose the campaign." in the heading and the settled note under it.
- Easy: the DragnCards `E0C.12` deck keeps all ten Great Spider cards where Hall of Beorn keeps six; the E0C decks lead (user decision, 2026-11-07).

## Standing decisions
- Sources are online; no physical card or box check (user, 2026-10-24). The nine MEC109 cards rest on the older printing's scans.
- Every Rules Reference action window opens; Responses are offered as soon as their trigger resolves; deckbuilding follows the Rules Reference (one to three heroes, no sphere match on save) (user, 2026-10-25).
- An event with no record cannot be played (`rr.triggered-ability`) (user, 2026-10-26).
- Every deck-legal player card is automated; Messenger of the King cards (`MotKA`, 22134) are out of scope (user, 2026-10-26).
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
- One scenario pipeline; no more A/B tests (user decision, 2026-11-08). The procedure is in `docs/handover/agent-brief.md` (Scenario procedure).
- An open game is never dropped by the app: after an update the player chooses Continue (from the saved table, checked against the engine) or Restart (user decision, 2026-11-11).
