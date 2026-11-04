# Phase status

Status is `not started`, `active`, or `completed`. Git keeps the history; this file keeps only what is current (`.cursor/rules/docs-standards.mdc`: a note is one line of what is open, a done item is deleted, no dated sections).

## Rules

- If nothing is active, the only legal start is the lowest-numbered phase whose dependencies are completed. Dependencies live in the phase file, not in this table.
- When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active. More than one phase may be active only when their files say they can run beside each other.
- A phase is `completed` when its exit is green and `/reviewer` reports no blocks. A phase that changes `src/screens` or `src/play` also needs `/ux` to report no blocks. Write the date.
- Phases 12 to 16 each have an engine half and a phone half (phase 12 describes them). When the engine half's exit is green and reviewed, write `engine done` in the note and leave the phase `active` or `not started`. The phase is completed when both halves are.
- Phases 27 to 33 (Mirkwood Paths and The Dark of Mirkwood, plan `docs/plans/mirkwood-paths.md`) have **one review round per phase** (user instruction, 2026-10-27). The main session runs `/reviewer` once on the phase's diff, and `/ux` once when `src/screens` or `src/play` changed, hands their blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that pass leaves open goes in the phase's note and does not keep the phase open. This replaces "`/reviewer` reports no blocks" for those phases. Phases 29 to 33 have an engine half and a phone half, as phase 12 describes.
- Phases 37 to 48 and 39b (Dream-chaser, plan `docs/plans/dream-chaser.md`) have one review round per phase, as `.cursor/agents/orchestrator.md` "One review round" says (user instruction, 2026-10-30). Phases 40 to 48 have an engine half and a phone half, as phase 12 describes.
- Maestro flows are written in the phase that names them. `maestro test` runs after the last phase; it does not gate an earlier phase.
- A cloud session has no phone, simulator or Maestro. Phone checks stay open and are listed here, not marked done.
- Current counts live in code: the engine version in `src/rules/engine/version.ts`, the playable scenarios in `src/campaign/playable.ts`, the printed lines no record owns in `src/effects/open-lines.ts` (`pnpm effects:open`).

## Phases

| Phase | Work | Status | Note |
| --- | --- | --- | --- |
| 0 | Correct the brief | completed | 2026-10-23. |
| 1 | Tooling shell | completed | 2026-10-23. |
| 2 | Catalog build | completed | 2026-10-23. |
| 3 | Phone databases | completed | 2026-10-23. The open-card Maestro flow runs with the suite. |
| 4 | Scenario 1 fixture | completed | 2026-10-23. |
| 5 | Image cache | completed | 2026-10-23. Airplane-mode resume not run on a phone. |
| 6 | Deck builder | completed | Redesigned 2026-10-25. Phone check open: fling the full pool and type in the filter; the redesigned deck screens; `.maestro/features/deck.yaml` not run. |
| 7 | Round engine | completed | Review fixes not re-reviewed. |
| 8 | Scenario 1 effects | completed | 2026-10-24. |
| 8b | Data store | completed | 2026-10-24. |
| 8c | Printed text and rule spans | completed | 2026-10-24. Scoring wording differs between the Rules Reference and the Learn to Play; the brief follows the Learn to Play. |
| 8d | Campaign from cards | completed | 2026-10-24. Deferred: the no-replacement case of the fellowship-of-heroes rule. |
| 9 | Starter effects | completed | 2026-10-24. Marked completed by the user without a second review; review fixes not re-reviewed. |
| 10 | Campaign shell | active | 2026-10-24. Review fixes not re-reviewed. Phone checks, its Maestro flows and the native compile of `modules/booklet-pdf` (Swift, Kotlin) are open. |
| 11 | Scenario 1 table | active | 2026-10-24. Review fixes not re-reviewed. Phone checks and every Maestro run open; `.maestro/scenarios/a-shadow-of-the-past/scenario-1.yaml` needs the scenario 1 won fixture. |
| 12 | A Knife in the Dark | active | 2026-10-24. Engine done. Review fixes not re-reviewed. Phone checks and both Maestro runs open; the won flow has no fixture (user-accepted). |
| 13 | Flight to the Ford | active | 2026-10-26. Engine done. `/ux` not run. Phone checks; three Maestro flows written, not run; fixtures `ford-*` not committed. |
| 14 | The Ring Goes South | active | 2026-10-26. Engine done. `/reviewer` and `/ux` not run. Phone checks; four Maestro flows written, not run; fixtures `south-*` not committed. |
| 15 | Journey in the Dark | active | 2026-10-30. Engine done; review round done. Phone checks open; three Maestro flows written, not run; fixtures `moria-*` not committed. Not on Nightmare. |
| 16 | Breaking of the Fellowship | active | 2026-10-30. Engine done; review round done. Phone checks open (true solo and two-handed through 2B); four Maestro flows written, not run; fixtures `breaking-*` not committed. Not on Nightmare. |
| 17 | Design system | completed | 2026-10-23. Superseded by Carved Stone (`docs/design-system.md`). |
| 18 | Card frames follow the card | completed | 2026-10-26. ux fix not re-reviewed. Phone check open. |
| 19 | Top bar and table menu | completed | 2026-10-26. Phone checks open; `.maestro/features/table-menu.yaml` not run. |
| 20 | Phase carousel | completed | 2026-10-26. Phone checks open. |
| 21 | Choice tray | completed | 2026-10-26. Phone checks open. |
| 22 | Declutter the board | completed | 2026-10-26. Phone checks open. |
| 23 | Motion pass | completed | 2026-10-26. Phone checks open. |
| 24 | Combat spotlight | completed | 2026-10-27. Look and timing superseded by the 2026-10-29 redesign. Phone checks open. |
| 25 | Hold and slide through the hand | completed | 2026-10-27. Phone checks open. |
| 26 | Peek at the other seat | completed | 2026-10-27. Phone checks open; `.maestro/features/seat-peek.yaml` not run. |
| 27 | Multi-campaign data | completed | 2026-10-27. |
| 28 | Campaign registry, saga gating, log, booklets | completed | 2026-10-27. Phone checks open; `mirkwood-start`, `scenarios-boxes`, `booklet-dark-of-mirkwood` flows not run. |
| 28b | Collapsible sections and run history | completed | 2026-10-28. Phone checks open; `history`, `sections-fold` flows not run. Open review notes below. |
| 29 | Passage Through Mirkwood | active | 2026-10-28. Engine done. Phone checks open; both Maestro flows not run. |
| 30 | Journey Along the Anduin | active | 2026-10-28. Engine done. Phone checks open; `anduin-won` fixture missing, so the win flow cannot run. |
| 31 | Escape from Dol Guldur | active | 2026-10-28. Engine done. Phone checks open; both fixtures wait on `anduin-won`, so neither flow can run. |
| 32 | The Oath | active | 2026-10-28. Engine done. Phone checks open; both flows not run; no Mirkwood Paths part 4 fixture. |
| 33 | The Caves of Nibin-Dûm | active | 2026-10-28. Engine done. Phone checks open; `nibin-dum-won` missing; no Mirkwood Paths part 5 fixture. |
| 34 | Nightmare data and pictures | active | 2026-10-30. Built: 72 decks (637 cards), the nine built scenarios' `nightmare` blocks, the `nightmare` source (730 pictures pinned), the ledger (88 sides), the Eye icon. Open: `pnpm scans:pack` on the build machine; pictures on a phone. |
| 35 | Nightmare difficulty | active | 2026-10-30. Built: the Nightmare deal and setup card, saves, the briefing switch, the list line, the top bar's Eye; `/reviewer` and `/ux` rounds done. Open: the switch, list and top bar on a phone and a tablet. |
| 36 | Nightmare effects | active | 2026-10-30. Engine done: all seven playable scenarios on `NIGHTMARE_PLAYABLE`; review round done (known limits in the phase file). Open: one Nightmare game per scenario on a phone. |
| 37 | Dream-chaser data | completed | 2026-10-30. Review round done. Open: A Storm on Cobas Haven Easy counts follow Hall of Beorn, not a printed mark. |
| 38 | Dream-chaser campaign shell and XP | completed | 2026-10-31. Review round done. Phone checks open: Spend XP, Hard/Expert pickers, path and log XP rows, MEC111 reader; flows `dream-chaser-start`, `booklet-dream-chaser` not run. |
| 39 | Sea mechanics family | completed | 2026-10-31. Engine only; review round done. Open: the fleet choice on the seat picker and briefing (phase 39b); Upgraded-side ship stats; face-aware records; Sailing events. |
| 39b | Ships on the table | completed | 2026-10-31. Review round done. Phone checks open: compact Heading dial and its scroll at 667 × 375, Sailing strip and Done, Boarding into a full row, fold stack and list, Corsair piles at Large, reader buttons. |
| 40 | Voyage Across Belegaer | completed | 2026-10-31. Engine done, review round done. Phone checks and every Maestro run open (`voyage-across-belegaer*.yaml`, `sea-table.yaml`, `sea-duo.yaml`, extended `dream-chaser-start.yaml` with unrun ids); `voyage-won` missing, so the win flow cannot run. |
| 41 | The Fate of Númenor | completed | 2026-10-31. Engine done, review round done. Phone checks open: Lost Island hiding (badges, tiles, Details, log, shuffle), Uncharted pile and crowded-table geometry, look sheets; both Maestro flows unrun; `fate-won` missing, so the win flow cannot run. |
| 42 | Raid on the Grey Havens | completed | 2026-10-31. Engine done, review round done. Phone checks open: Burn "2/5" pill and Aflame pills at 667 × 375 and the three scales, burn-pick row marks, Burn reader button, briefing Counsel offer; both Maestro flows unrun; `raid-won` missing, so the win flow cannot run. |
| 43 | Flight of the Stormcaller | completed | 2026-10-31. Engine done, review round done. Phone checks open: the Stormcaller's area (stage pill, Apart plate, veil, fold), the banner and stage 4 advance view, Hidden Cove caution, both themes; both Maestro flows unrun; `stormcaller-won` missing, so the win flow cannot run. |
| 44 | The Thing in the Depths | completed | 2026-10-31. Engine done, review round done. Phone checks open: grappled stacks and the ×N pill, the Ship "n/9" pill, the lowered engagement row at Large, travel cautions, the stage 2 banner, the Trait list scrolling; both Maestro flows unrun; `depths-won` missing, so the win flow cannot run. |
| 45 | Temple of the Deceived | completed | 2026-11-01. Engine done, review round done. Phone checks open: Island Map chip and panel at three scales, travel direction rows and glyph, the coming-soon path after the win; both Maestro flows unrun; `temple-won` missing, so the win flow cannot run. |
| 46 | The Drowned Ruins | completed | 2026-11-04. Engine done, review round done. Phone checks open: the Grotto pile (top-card preview and speech, the glide back to it), Command's armed Done and up-to notes, the flip naming its side, Into the Abyss counts; both Maestro flows unrun; `ruins-won` missing, so the win flow cannot run. |
| 47 | A Storm on Cobas Haven | completed | 2026-11-04. Engine done, review round done. Phone checks open: a controlled tower in staging (fold rank, reader label, its Action from either seat), guarded and re-guarded towers, the Islet's "1 held" pill and where the held enemy returns, the Skirmisher as a ship, Taking on Water's three exhaust picks and host caution, the added-phase rail and carousel, the Tactics hero list, Gandalf's entry, Gavin's Planning Action; both Maestro flows unrun; `haven-won` missing, so the win flow cannot run. |
| 48 | The City of Corsairs | not started | Coming soon (user decision, 2026-11-01). Open: which Stormcaller card the campaign Setup flips (12151 has no Campaign Mode only side; only 110042 has one). |

## Open items

### Fixtures and Maestro

- Scenario 1's `won` fixture is not committed. `scripts/e2e/fixtures.ts --won` searches for it. Until it exists `.maestro/scenarios/a-shadow-of-the-past/scenario-1.yaml` cannot run, and `knife-lost` (dealt from its log) is missing, so `.maestro/scenarios/a-knife-in-the-dark/a-knife-in-the-dark-loss.yaml` cannot run either.
- A Knife in the Dark's won flow has no genuine win (user-accepted, 2026-10-25).
- Fixtures not committed, because no real win of the earlier scenarios exists to chain from: `ford-start`, `ford-won`, `ford-lost`; `south-start`, `south-stage-4`, `south-won`, `south-lost`; `anduin-won`; `dol-guldur-won`, `dol-guldur-lost`; `nibin-dum-won`; Mirkwood Paths parts 4 and 5; `moria-won`, `moria-pairs`, `moria-lost`; `breaking-solo`, `breaking-pair`, `breaking-won`, `breaking-lost`. A fixture is a real save (phase 13).
- No Maestro flow has run. The flows that cross a stage advance must pass the quest advance screen (`quest-advance-progress`, Progress is optional); a fixture parked on a When Revealed question shows the question instead.
- `seat-peek.yaml`, `scenario-1-loss.yaml` and `the-caves-of-nibin-dum.yaml` read `continue-next`, now matched by its accessibility label: run them.
- `.maestro/features/mirkwood-start.yaml` picks a Fellowship starter deck that a non-saga briefing may refuse.
- `.maestro/features/deck.yaml` and `.maestro/features/rules.yaml` are phone flows; they cannot run on an expanded tablet.
- No Maestro flow plays an attack through the redesigned combat spotlight.
- `.maestro/config.yaml` lists `scenarios/*/*` and `features/*`: not yet run to see `maestro test .maestro` and the EAS `e2e` workflow (`flow_path: .maestro`) pick up every flow through it.
- The committed `journey-along-the-anduin.json` and `the-caves-of-nibin-dum.json` fixtures predate the log's `modes`, `modeDefault`, `xpGained` and `marks` fields; `scripts/e2e/fixtures.ts` rewrites them with those fields, the same seeds and the same intents.
- `voyage-won`, `fate-won`, `raid-won`, `stormcaller-won`, `depths-won`, `temple-won`, `ruins-won` and `haven-won` are not committed (the Fate fixtures carry a Voyage win played from the golden): no auto-played win with real decks was found (the shipped pair in 100 seeds, each prebuilt deck solo in 40, 17 two-handed pairs in 60). The goldens win only with synthetic heroes.
- `LowerThreatByRaise` (08062) bypasses `lowerThreatByEffect`, so the Hard cap and Expert bar do not stop it. Engine refusal strings in `sea/ships.ts` still say "ship-objective".

### Rules and engine

- Dream-chaser: which side a set-aside upgraded card turns up on is decided per scenario (phases 40-48); `SetAside` deals facedown.
- Dream-chaser: the two Grapple variants on Nightmare cards (fewest or most enemies grappled) stay unparsed.
- The Havens Burn and the Dream-chaser location are upgradable on the MEC111 log, but no source prints their Upgraded sides: their XP rows cannot be bought. Gavin and the four Send for Help cards have no B side in the ledger either.
- The Thing in the Depths: if Sahír and Na'asiyah never enter play (a Northern Tracker explores the Helm from staging), stage 2 flips nothing, so the Black Key, Sea Serpent and Come Together never arrive and XP lines B:4 to B:6 cannot be earned. The literal reading is played and tested; no ruling found.
- The Drowned Ruins: Spyglass (11203:A:5) puts "Spyglass" into play from hand, deck or discard; where that copy comes from in a campaign is not settled, so the option is not offered (user decision needed).
- The Drowned Ruins: the Black Key stays on Sahír when he flips to his enemy side and gives no bonus there; no rule removes an attachment whose host stops being legal. No ruling found.
- The Drowned Ruins goldens never put an Underwater location in the victory display, so the XP for them is checked only by the card tests.
- A Storm on Cobas Haven, readings played literally and not user-confirmed: a tower the players control stays theirs when guarded again (it counts for 11209:B:7); Ramming Speed! (12131) reads only the Ship enemies engaged with the revealing player; Gavin's "any player's control" seat is named by the first player, Send for Help's hero and Gandalf by the revealing player; Coast of Anfalas' travel cost takes any player's ship; Taking on Water's Action belongs to its ship's controller and its "exhaust 3 characters" is an effect, not a cost; an added Refresh (11213) raises threat and passes the first player token again; the Skirmisher taken as a ship keeps its immunity and has no Boarding. Settled by `dcce.ship-objectives`: Ship objectives count as allies for the Skirmisher's discard.
- A Storm on Cobas Haven, known limits: the `exhausted` trigger fires only for the Exhaust verb, so a sea sweep announces `shipExhausted` between actions (Taking on Water's 2 damage lands after the exhausting action; an exhaust and ready inside one action is missed); The Beacon may be used with no Warship set aside; an added phase does not give back once-per-phase uses; the "If Send for Help (X) is upgraded" clauses are unrecorded (no Upgraded side printed); the 3-or-more-players branch of 12121:A:1 is tested by no scene.
- A Storm on Cobas Haven, not reached by a golden (card tests only): the Skirmisher's Response and the ship it becomes, a Warship's set-aside on destruction, Send for Help (Tactics), 11209:B:6 to B:8.
- Revenant's damage limit is two Forced records: `effect-coverage.test.ts` refuses a constant record on a printed "Forced:" line.
- Staging folds rank "controlled" by `claimed`; a freed tower (phase 47) must set it.
- The Corsair reshuffle glides the discard to the deck without a count pop.
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
- Phase 13 reviewer notes, not fixed: one function for passing the first player token; one immediate attack; the 141028 Setup record that setup does not read; the module-level map in `announceProgress`; non-burden verbs in the burden family; a hard-coded "Ring-bearer's" in `words/burden.ts`.
- `CountsAs` and `byEncounterDeck` live in the shared schema, not a family. `why.ts` matches the "different heroes" refusal by its wording.
- Ledger readings 41050.A, 41012.A and 01090.A were re-checked against the scans, not user-confirmed.
- Frodo's Choice (142068:A:2): its Ring-bearer clauses find nothing, since stage 2A removed the Ring-bearer from the game; the revealer takes the first player token for the game. Not user-confirmed.
- One active location per separate stage (phase 16) is read from `rr.active-location` and `mec109.multiple-staging-areas`, not stated by a card. Not user-confirmed.
- Separate stages: `viewOf` builds a new state per call, so state-keyed memos miss inside a view (speed only). The normalizer's `searched` rule marks every staged location of a quest with an each-player-adds-location clause.
- Journey in the Dark and Breaking of the Fellowship Nightmare decks (9065xx, 9066xx) have no records.

### Screens and code

- Run history (28b): `recordUnclosedRun` has no test; a win left unconfirmed until an engine or data update drops it cannot be recorded; `run-writers.ts` imports `ScenarioState` through `play/store`.
- A player side quest in the play row is drawn in a portrait rect, so its sideways scan is cropped; two seats with the same side quest show two plates of one name.
- Rounded chrome (`docs/plans/done/rounded-chrome.md`), phone checks open: both themes on a phone; the capsule controls' pressed darken (`filter: brightness`); the command column's radial fade and the start block's soft scene; the dock with choice rows open on a short phone; the carousel's seven rows at 667 × 375; `.maestro/features/table-menu.yaml`.
- Hub layout (`docs/plans/done/hub-layout.md`), phone checks open: both hubs, the campaign setup (carry-over rows) and History (cards, Manage, the Archive toast's Undo, Delete in place) on a phone and an iPad in both orientations, both themes; `start=1` from a finished path; flows `briefing`, `booklet`, `mirkwood-start`, `the-caves-of-nibin-dum`, `history` not run.
- `items-baseline` collapsed on Android in the path; it is still in `card-pool.tsx` and `log/[saveId].tsx`.
- Why the path screen was laid out taller than the window on Android is not known. The action bar's overrun measure stays for screens that keep a bar.
- Web only: opening Cards, Import or a deck first can raise "error during concurrent rendering" (expo-sqlite "Sync operation timeout"; React recovers). Rows ending in a stepper warn "nested button".
- The combat spotlight's sprite is worked out twice per slot in an active frame.
- Not built from the Carved Stone handoff: the card screen's "Add to a deck"; the table's encounter row and right-hand piles; the handoff's defend tray.
- Tablet follow-ups: an Android `appCategory` or large-screen plugin if the table lock must hold on Android 16; pushed routes under the tabs; a Packs list-detail; a Deck import section in `docs/design-system.md`; a "Tap anywhere to close" hint on the preview.
- Performance pass (`docs/plans/done/performance-pass.md`): its out-of-scope items (the per-card glow, an ArcRing of Views, particle buffer reuse, a UI-thread lift) wait for on-device profiling.
- Table performance settings (`docs/plans/done/table-performance-settings.md`), phone checks open: Card pictures Low on a full table on a 2x and a 3x phone (a little softer; the long press and the Card screen sharp), a High, Low, High switch mid-game, Moving fog off holding the fog still, pickup and game-step frame timing with the memoized `TablePiece` against the commit before it, the table panel's fold at Medium and Large; `.maestro/features/table-menu.yaml` not run.
- Settings page and table panel (user request, 2026-11-01), phone checks open: the selected `Segmented` thumb staying a capsule after a pick in phone portrait on Android (its radius is now in the style), the new Performance group, the longer details and Ringwraith / Rivendell / System on one line at Large on a 320 pt phone, the two-column tablet split (Display and Performance, then Motion and feel, At the table and About).
- Playtime, card search, command head and deck/briefing requests (user request, 2026-11-03), phone checks open: the play clock across background, foreground and a table hidden by Activity; the quest meter's tween and reduced-motion snap, its gradients on native, full/compact/hidden heads on real phones' insets; the victory rows' 44 pt targets and the Victory display reading; the threat and Heading change badges inside the bar's foot; the denser smoke against card art and its frame cost at 110 sprites; deck drag (long press with the FlashList scroll, the lifted cell over its neighbours, auto-scroll, haptics, Move up/down with VoiceOver and TalkBack); HeroTrio at 30 × 42 in Light; the briefing seat fold with a screen reader; `.maestro/features/deck.yaml` not run.
- Run `pnpm scans:pack` on the build machine before a release, so side B pictures and the `.scene` files are bundled.
- Scenario pipeline (`docs/plans/scenario-pipeline.md`): section E (ledger seed, pile overrides, XP rows in data) is not built; the core's remaining direct family calls (travel, pick, condition, amount, `syncThreatSaves`, `playSweep`, `heldByLapsedStage`) move behind the hooks when their family is next changed.
- The Maestro subflows in `.maestro/subflows/` and the eight Dream-chaser flows that call them are checked statically only, not run.
- Effect templates: an unlabelled conditional constant ("If you are on-course, ~ gets +2 …") is read as triggered by `unreadBefore`; `SPLIT_LINES` in `scripts/data/effects/generate.ts` names one card's line.

### Phone and tablet checks

None ran. Each needs a device.

- The app after the file restructure (`src/ui`, the feature folders of `src/play` and `src/screens`): the Android and iOS bundles build (`expo export`); a dev build on a phone opening every tab, a table and a booklet has not run.
- Booklets: import, open, last page after a kill, Back; first open from the APK and from an iOS Debug and Release build (the module linked through its podspec); Android pinch, double tap, pan and the sharper redraw.
- Data: airplane-mode play after a kill with images cached; `user.db` keeps the deck and log after a catalog version bump; a changed engine version drops the open scenario.
- Campaign screens: the card names in the log's rows and the path's pool open the card's preview on a tap (and as links with VoiceOver and TalkBack); the path (stops resume or begin, Campaign log, the foot clear of three-button and gesture navigation), the briefing, the log rows (Prisoner, carry-over, Used this campaign), the Books grid (four covers a row on a tablet; every cover over its scene, the Rules Reference over Journey Along the Anduin), the Resolution and outcome reports.
- Table chrome: the top bar at 667x375 with two seats; the rail and its three lines on the screen's middle; the dial and its pop under the top edge; the banner centered and its swipe; the menu, carousel, tray and dock at 667x375 and 844x390; the opening quest screen (Begin, Continue, Progress).
- Table canvas: a crowded table at Small, Medium and Large on a phone and a tablet; stacked play rows (the back row's tokens inside its band); the attack and defense pills in the enemy attacks step beside the effect pills; the 48 pt phase title centered on the screen; a hand of 13 or more cards (half-card overlap) and its scrub at one card size; the table menu's six rows fit under the top bar at 667x375, and Setup card opens the campaign card's Setup side; the briefing's Campaign card and Quest cards rows (both sides of each stage, the spoiler warning) on a phone and a tablet; History's hero tiles under each run and game (scroll cost of a long list); picture sharpness and decode memory on a low-end Android; quest scale only in the Quest phase; side B pictures upright; each card shows its own picture after an earlier build.
- Victory pile and card lists (user request, 2026-11-03): the fanned victory pile and its gold coin at staging's right end in Dark and Light on a phone and a tablet (the fan clear of the encounter discard, the coin clear of the top bar), the play mark on a discard pile (Elven-light), the night card lists' pictures and scrolling, and the choice's 51 × 71 rows at 667x375 and 844x390.
- Staging threat list (user request, 2026-11-04): a tap on the quest meter (full and compact) opens the list, its pressed dim, the list's rows and the "Other effects" line in Dark and Light, VoiceOver and TalkBack on the meter's button.
- Phase titles and spotlight (user request, 2026-11-04): the COMBAT sweep as Combat opens with enemies engaged (over the shadow deal) and the RESOURCE sweep over the draw and the resource pops, neither under a spotlight; an immediate attack outside the Combat phase (Crushing Arm after travel) plays its spotlight, then the table passes on.
- Two-handed handoff: a Pass that turns the table to the other seat cuts to it at rest, with no flash of either seat's heroes or play area (`kindMoves`); a window the table passes is not drawn (`followAnswers`); pictures of a seat turned back to draw at once (`PARKED`).
- Gestures and motion: drag smoothness; the 150 ms scrub hold, the lifted card's grow and the cancel line; the scrub's forward push into the drag (13 pt, from any part of the card) and the shake and reject haptic of a card that cannot be played; the reject haptic and dock line on a play the heroes cannot pay for; peek and back; card motion at Normal and Quick; reduced motion snaps; haptics on iOS and Android.
- Combat spotlight (redesign): look at Normal and Quick in Dark and Light; cost on a low-end Android; the burn shader on each GPU; additive Atlas blending; the black and grey smoke reads as smoke over the cards in both themes (`srcOver`); skip on canvas, bar and dock. Handover: `docs/handover/combat-spotlight-open.md`.
- Performance: frame timing of card pickup, the hand scrub, the spotlight and opening the table (Profiler, Perf Monitor), and the loading frame on a cache miss; screens hidden by React Activity re-shown with their state (tabs, stacked screens, the table's pictures, a tab under a sheet's scrim, iOS swipe-back); the Sent and landing ticks' feel.
- Separate stages (Breaking of the Fellowship): the staging owner tag, per-dial ticks, the peek banner's room, the per-seat quest advance screens and `table-area` with VoiceOver and TalkBack; fallen-hero art.
- Scenario sheets: Caught in a Web, Wolf Rider's second attack, The Oath's end-of-round Response and Tokens dial, the Pillar on the attack sheet; a person winning and losing each playable scenario with the log matching.
- Look and theme: Skia fog and its drift (smooth, cheap, still under reduced motion), grit, `filter` effects, Barlow and Marcellus SC weights, Light's multiply and Dark's screen art blends with no hard edge, Small and Large scales, both themes, keep-awake, `userInterfaceStyle: automatic` after a prebuild.
- Resign, briefing previews and Campaigns folds: Resign in the table menu (the confirm, then the lost outcome and the run in History); a tap on a briefing hero tile and a long press on a Ring-bearer candidate open the card; the candidate's square painting in both themes; Other journeys and New playthrough fold like Coming later (the stored fold, the count when folded, VoiceOver).
- Tablets: iPad rotation on the tabs, deck editor and briefing; the rail; the portrait guard on the table (Split View, Stage Manager, Android 16); foldables; Campaigns art edge on an iPad in landscape; the briefing scene's Skia fade (`SceneCanvas`) on an iPad in landscape in Dark and Light: no line under the picture, no band at the pane's right edge, the dim matching the browser's.

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
