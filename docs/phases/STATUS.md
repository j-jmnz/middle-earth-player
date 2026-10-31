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
- Current counts live in code: the engine version in `src/rules/version.ts`, the playable scenarios in `src/campaign/playable.ts`, the printed lines no record owns in `src/effects/open-lines.ts` (`pnpm effects:open`).

## Phases

| Phase | Work | Status | Note |
| --- | --- | --- | --- |
| 0 | Correct the brief | completed | 2026-10-23. |
| 1 | Tooling shell | completed | 2026-10-23. |
| 2 | Catalog build | completed | 2026-10-23. |
| 3 | Phone databases | completed | 2026-10-23. The open-card Maestro flow runs with the suite. |
| 4 | Scenario 1 fixture | completed | 2026-10-23. |
| 5 | Image cache | completed | 2026-10-23. Airplane-mode resume not run on a phone. |
| 6 | Deck builder | completed | Redesigned 2026-10-25. Phone check open: fling the full pool and type in the filter; the redesigned deck screens; `.maestro/deck.yaml` not run. |
| 7 | Round engine | completed | Review fixes not re-reviewed. |
| 8 | Scenario 1 effects | completed | 2026-10-24. |
| 8b | Data store | completed | 2026-10-24. |
| 8c | Printed text and rule spans | completed | 2026-10-24. Scoring wording differs between the Rules Reference and the Learn to Play; the brief follows the Learn to Play. |
| 8d | Campaign from cards | completed | 2026-10-24. Deferred: the no-replacement case of the fellowship-of-heroes rule. |
| 9 | Starter effects | completed | 2026-10-24. Marked completed by the user without a second review; review fixes not re-reviewed. |
| 10 | Campaign shell | active | 2026-10-24. Review fixes not re-reviewed. Phone checks, its Maestro flows and the native compile of `modules/booklet-pdf` (Swift, Kotlin) are open. |
| 11 | Scenario 1 table | active | 2026-10-24. Review fixes not re-reviewed. Phone checks and every Maestro run open; `.maestro/scenario-1.yaml` needs the scenario 1 won fixture. |
| 12 | A Knife in the Dark | active | 2026-10-24. Engine done. Review fixes not re-reviewed. Phone checks and both Maestro runs open; the won flow has no fixture (user-accepted). |
| 13 | Flight to the Ford | active | 2026-10-26. Engine done. `/ux` not run. Phone checks; three Maestro flows written, not run; fixtures `ford-*` not committed. |
| 14 | The Ring Goes South | active | 2026-10-26. Engine done. `/reviewer` and `/ux` not run. Phone checks; four Maestro flows written, not run; fixtures `south-*` not committed. |
| 15 | Journey in the Dark | active | 2026-10-30. Engine done; review round done. Phone checks open; three Maestro flows written, not run; fixtures `moria-*` not committed. Not on Nightmare. |
| 16 | Breaking of the Fellowship | active | 2026-10-30. Engine done; review round done. Phone checks open (true solo and two-handed through 2B); four Maestro flows written, not run; fixtures `breaking-*` not committed. Not on Nightmare. |
| 17 | Design system | completed | 2026-10-23. Superseded by Carved Stone (`docs/design-system.md`). |
| 18 | Card frames follow the card | completed | 2026-10-26. ux fix not re-reviewed. Phone check open. |
| 19 | Top bar and table menu | completed | 2026-10-26. Phone checks open; `.maestro/table-menu.yaml` not run. |
| 20 | Phase carousel | completed | 2026-10-26. Phone checks open. |
| 21 | Choice tray | completed | 2026-10-26. Phone checks open. |
| 22 | Declutter the board | completed | 2026-10-26. Phone checks open. |
| 23 | Motion pass | completed | 2026-10-26. Phone checks open. |
| 24 | Combat spotlight | completed | 2026-10-27. Look and timing superseded by the 2026-10-29 redesign. Phone checks open. |
| 25 | Hold and slide through the hand | completed | 2026-10-27. Phone checks open. |
| 26 | Peek at the other seat | completed | 2026-10-27. Phone checks open; `.maestro/seat-peek.yaml` not run. |
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
| 42 | Raid on the Grey Havens | not started | |
| 43 | Flight of the Stormcaller | not started | |
| 44 | The Thing in the Depths | not started | |
| 45 | Temple of the Deceived | not started | |
| 46 | The Drowned Ruins | not started | |
| 47 | A Storm on Cobas Haven | not started | |
| 48 | The City of Corsairs | not started | Open: which Stormcaller card the campaign Setup flips (12151 has no Campaign Mode only side; only 110042 has one). |

## Open items

### Fixtures and Maestro

- Scenario 1's `won` fixture is not committed. `scripts/e2e-fixtures.ts --won` searches for it. Until it exists `.maestro/scenario-1.yaml` cannot run, and `knife-lost` (dealt from its log) is missing, so `.maestro/a-knife-in-the-dark-loss.yaml` cannot run either.
- A Knife in the Dark's won flow has no genuine win (user-accepted, 2026-10-25).
- Fixtures not committed, because no real win of the earlier scenarios exists to chain from: `ford-start`, `ford-won`, `ford-lost`; `south-start`, `south-stage-4`, `south-won`, `south-lost`; `anduin-won`; `dol-guldur-won`, `dol-guldur-lost`; `nibin-dum-won`; Mirkwood Paths parts 4 and 5; `moria-won`, `moria-pairs`, `moria-lost`; `breaking-solo`, `breaking-pair`, `breaking-won`, `breaking-lost`. A fixture is a real save (phase 13).
- No Maestro flow has run. The flows that cross a stage advance must pass the quest advance screen (`quest-advance-progress`, Progress is optional); a fixture parked on a When Revealed question shows the question instead.
- `seat-peek.yaml`, `scenario-1-loss.yaml` and `the-caves-of-nibin-dum.yaml` read `continue-next`, now matched by its accessibility label: run them.
- `.maestro/mirkwood-start.yaml` picks a Fellowship starter deck that a non-saga briefing may refuse.
- `.maestro/deck.yaml` and `.maestro/rules.yaml` are phone flows; they cannot run on an expanded tablet.
- No Maestro flow plays an attack through the redesigned combat spotlight.
- `voyage-won` and `fate-won` are not committed (the Fate fixtures carry a Voyage win played from the golden): no auto-played win with real decks was found (the shipped pair in 100 seeds, each prebuilt deck solo in 40, 17 two-handed pairs in 60). The goldens win only with synthetic heroes.
- `LowerThreatByRaise` (08062) bypasses `lowerThreatByEffect`, so the Hard cap and Expert bar do not stop it. Engine refusal strings in `sea-ships.ts` still say "ship-objective".

### Rules and engine

- Dream-chaser: which side a set-aside upgraded card turns up on is decided per scenario (phases 40-48); `SetAside` deals facedown.
- Dream-chaser: Aflame, Grapple and Exploration stay unparsed until their scenario phases; the Island Map chip and panel arrive with phase 45.
- Revenant's damage limit is two Forced records: `effect-coverage.test.ts` refuses a constant record on a printed "Forced:" line.
- Staging folds rank "controlled" by `claimed`; a freed tower (phase 47) must set it.
- The Corsair reshuffle glides the discard to the deck without a count pop.
- Nightmare 904605 Sahír's Pursuer and 905402 Patrol Ship print ENEMY (Ship trait), so they stay non-ship enemies.

- Fellowship-of-heroes with no replacement left in the collection is not modelled (`ltp.fellowship-of-heroes`, `rr.fellowship-of-heroes`).
- Simultaneous Forced and delayed effects resolve in a fixed order, not the first player's choice (FAQ 1.02).
- `src/play/threat-level.ts` shows 50 as the elimination level and ignores The One Ring's `eliminationReduction`.
- Burglar's Turn loot has no table UI.
- Collapsed Mine's per-round cap ignores progress placed before it appears (fixing it moves every game; in the brief).
- 41004:B:1 prints "searches the encounter deck"; the record also searches the discard pile.
- The Oath: the Tokens dial does not open the quest preview; the Resolution joins used Adaptations with a comma, not "and".
- Escape from Dol Guldur: the claim prompt does not name the lasting effect.
- A confirmed "another" defender cannot be backed out of (the declaration frame has no pass).
- Phase 13 reviewer notes, not fixed: one function for passing the first player token; one immediate attack; the 141028 Setup record that setup does not read; the module-level map in `announceProgress`; non-burden verbs in the burden family; a hard-coded "Ring-bearer's" in `burden-words.ts`.
- `CountsAs` and `byEncounterDeck` live in the shared schema, not a family. `why.ts` matches the "different heroes" refusal by its wording.
- Ledger readings 41050.A, 41012.A and 01090.A were re-checked against the scans, not user-confirmed.
- Frodo's Choice (142068:A:2): its Ring-bearer clauses find nothing, since stage 2A removed the Ring-bearer from the game; the revealer takes the first player token for the game. Not user-confirmed.
- One active location per separate stage (phase 16) is read from `rr.active-location` and `mec109.multiple-staging-areas`, not stated by a card. Not user-confirmed.
- Separate stages: `viewOf` builds a new state per call, so state-keyed memos miss inside a view (speed only). The normalizer's `searched` rule marks every staged location of a quest with an each-player-adds-location clause.
- Journey in the Dark and Breaking of the Fellowship Nightmare decks (9065xx, 9066xx) have no records.

### Screens and code

- Run history (28b): `recordUnclosedRun` has no test; a win left unconfirmed until an engine or data update drops it cannot be recorded; `run-writers.ts` imports `ScenarioState` through `play/store`.
- A player side quest in the play row is drawn in a portrait rect, so its sideways scan is cropped; two seats with the same side quest show two plates of one name.
- Rounded chrome (`docs/plans/done/rounded-chrome.md`), phone checks open: both themes on a phone; the capsule controls' pressed darken (`filter: brightness`); the command column's radial fade and the start block's soft scene; the dock with choice rows open on a short phone; the carousel's seven rows at 667 × 375; `.maestro/table-menu.yaml`.
- Hub layout (`docs/plans/done/hub-layout.md`), phone checks open: both hubs, the campaign setup (carry-over rows) and History (cards, Manage, the Archive toast's Undo, Delete in place) on a phone and an iPad in both orientations, both themes; `start=1` from a finished path; flows `briefing`, `booklet`, `mirkwood-start`, `the-caves-of-nibin-dum`, `history` not run.
- `items-baseline` collapsed on Android in the path; it is still in `card-pool.tsx` and `log/[saveId].tsx`.
- Why the path screen was laid out taller than the window on Android is not known. The action bar's overrun measure stays for screens that keep a bar.
- Web only: opening Cards, Import or a deck first can raise "error during concurrent rendering" (expo-sqlite "Sync operation timeout"; React recovers). Rows ending in a stepper warn "nested button".
- The combat spotlight's sprite is worked out twice per slot in an active frame.
- Not built from the Carved Stone handoff: the card screen's "Add to a deck"; the table's encounter row and right-hand piles; the handoff's defend tray.
- Tablet follow-ups: an Android `appCategory` or large-screen plugin if the table lock must hold on Android 16; pushed routes under the tabs; a Packs list-detail; a Deck import section in `docs/design-system.md`; a "Tap anywhere to close" hint on the preview.
- Performance pass (`docs/plans/done/performance-pass.md`): its out-of-scope items (the per-card glow, an ArcRing of Views, particle buffer reuse, a UI-thread lift) wait for on-device profiling.
- Run `pnpm scans:pack` on the build machine before a release, so side B pictures and the `.scene` files are bundled.

### Phone and tablet checks

None ran. Each needs a device.

- Booklets: import, open, last page after a kill, Back; first open from the APK; Android pinch, double tap, pan and the sharper redraw.
- Data: airplane-mode play after a kill with images cached; `user.db` keeps the deck and log after a catalog version bump; a changed engine version drops the open scenario.
- Campaign screens: the path (stops resume or begin, Campaign log, the foot clear of three-button and gesture navigation), the briefing, the log rows (Prisoner, carry-over, Used this campaign), the four-cover Books grid, the Resolution and outcome reports.
- Table chrome: the top bar at 667x375 with two seats; the rail and its three lines on the screen's middle; the dial and its pop under the top edge; the banner centered and its swipe; the menu, carousel, tray and dock at 667x375 and 844x390; the opening quest screen (Begin, Continue, Progress).
- Table canvas: a crowded table at Small, Medium and Large on a phone and a tablet; stacked play rows; picture sharpness and decode memory on a low-end Android; quest scale only in the Quest phase; side B pictures upright; each card shows its own picture after an earlier build.
- Two-handed handoff: with Stops on, a Pass whose other-seat window the table passes shows no flash of that seat (`followAnswers`); a seat the table turns back to draws its pictures at once (`PARKED`).
- Gestures and motion: drag smoothness; the 150 ms scrub hold, the lifted card's grow and the cancel line; peek and back; card motion at Normal and Quick; reduced motion snaps; haptics on iOS and Android.
- Combat spotlight (redesign): look at Normal and Quick in Dark and Light; cost on a low-end Android; the burn shader on each GPU; additive Atlas blending; skip on canvas, bar and dock. Handover: `docs/handover/combat-spotlight-open.md`.
- Performance: frame timing of card pickup, the hand scrub, the spotlight and opening the table (Profiler, Perf Monitor), and the loading frame on a cache miss; screens hidden by React Activity re-shown with their state (tabs, stacked screens, the table's pictures, a tab under a sheet's scrim, iOS swipe-back); the Sent and landing ticks' feel.
- Separate stages (Breaking of the Fellowship): the staging owner tag, per-dial ticks, the peek banner's room, the per-seat quest advance screens and `table-area` with VoiceOver and TalkBack; fallen-hero art.
- Scenario sheets: Caught in a Web, Wolf Rider's second attack, The Oath's end-of-round Response and Tokens dial, the Pillar on the attack sheet; a person winning and losing each playable scenario with the log matching.
- Look and theme: Skia fog and its drift (smooth, cheap, still under reduced motion), grit, `filter` effects, Barlow and Marcellus SC weights, Light's multiply and Dark's screen art blends with no hard edge, Small and Large scales, both themes, keep-awake, `userInterfaceStyle: automatic` after a prebuild.
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
- The quest scale shows only in the Quest phase (user, 2026-10-29).
- The combat spotlight stage is always dark, a lone attack runs about 2.2 s, and a destroyed target burns (user, 2026-10-29).
- Page art has no hard edges: it fades to black or into the fog; framed tiles and panels keep theirs (user, 2026-10-30).
