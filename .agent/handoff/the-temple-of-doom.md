# Hand-off: the-temple-of-doom

## Read part
Readings: the rows of `.agent/handoff/the-temple-of-doom.research.md` apply as written, except the rows corrected here. All recommended/researched readings are filed in `docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md` (Readings) with sources. Shared name for the short code: templedoom.

Corrections from the scans (cache `.cache/scans/<code>.<side>.jpg`):
- 21065 Lost in the Dark is an ENCOUNTER SIDE QUEST (type encounter-side-quest, in the encounter pile, QP 8, Victory 10). "This stage" = this side quest. Cards go back under dial on defeat only (recommended). Not a main quest stage.
- 21068, 21069, 21070 are OBJECTIVE cards of the Power of Mordor deck: revealed, they stay in the staging area (rr.staging-area, rr.step-3-3). Covered in Darkness prints Objective, Doomed 5, and no discard text: it stays in play.
- 21066:A:2 is a constant text (no Forced): Khamûl engages the first player whenever not engaged with him.
- 21067:A:2 bars only Travel to it (literal); not "cannot be active by any effect".
- 21083:B:1: no card type list printed. Type of each discarded card: enemy, location, treachery, objective, side quest (encounter deck holds only enemy, location, treachery, side quest). +2 threat per different type; lasts the phase.
- 21081:B:1 printed: "each player deals 1 damage to a hero he controls and exhausts that hero. That hero cannot ready or be healed until the refresh phase." (read from ledger).
- 21053/21065/etc. wording read from the ledger, not the research.

## System design: the Power of Mordor deck (Temple of Doom and Fortress of Nurn)
Shape: a second deck of 5 objective/enemy/location cards (Khamûl 21066, Tower 21067, Under the Watchful Eye 21068, Armies of Mordor 21069, Covered in Darkness 21070), built at Setup (`buildPowerOfMordorDeck`), shuffled, beside the quest deck. Cards are revealed only by Tribute to Mordor's Forced (21053:A:1); an empty deck means the players lose. A revealed card is an encounter card (staging, When Revealed, Surge) and leaves to the ENCOUNTER discard pile (never back to its deck). No reshuffle of the deck.
Precedent: Angmar Awakened's Orc deck (`angmarOrcs` plain pile: `PLAIN_PILES` row in `src/rules/core/piles.ts`, no discard, cards go to the encounter discard), Harad deck, Investigation deck.
Plan (option B, recommended): a new plain pile `powerOfMordorDeck`.
- Data (scripts, not engine): the cards' pile `encounterDeck2` in the scenario data becomes `powerOfMordorDeck`; `scripts/data/normalize/scenario-piles.ts` case for it with `stepExists("buildPowerOfMordorDeck")`; `scripts/data/campaign-defs.ts` `sharedEncounterDeck2` for the two scenarios (cycle-defs.ts lines 167, 174); `scripts/data/vengeance-of-mordor.test.ts` line 125 expects encounterDeck2 (change it with the pile). Rebuilds `data/scenarios/the-temple-of-doom.json` and `the-fortress-of-nurn.json` (the second is the next scenario: only the pile name moves).
- One-name entries in shared lists, each inert unless the scenario deals the pile (like `angmarOrcDeck`): `PILE_ZONES` and `PLAIN_PILES`/`NAMED_PILES` in `src/rules/core/piles.ts`; `DEAL_PILES` and `PILES` in `src/catalog/scenario-data.ts`; `PileZone` state flag list `src/rules/engine/state-version.ts` (line ~57); table: `src/play/layout/layout.ts` SECOND_DECKS, `src/play/store/pile-ids.ts` (SecondPileId, a label, a case), `src/play/motion/motion.ts` SECOND_DECK_PILES, `src/play/canvas/table-canvas-views.ts` (a view). Run `pnpm test scenario` file-size check: none of these may grow past its limit; check `wc -l` of each before editing and use a new small file (`src/rules/families/mordor/power.ts`) for logic. Cards of other scenarios the hook can reach: none (a pile not dealt is never read: `pileDealt`).
- Verbs (mordor family, `src/catalog/families/mordor.ts`, engine `src/rules/families/mordor/power.ts`): `RevealPowerOfMordor` (top card of the pile revealed as an encounter card; `onEmpty: loseGame`, record field), runsInFrame. Reuse the existing reveal path (`moveEncounter`, RevealTop*).
- Triggers: end-of-round window (reuse the one Sauron Worship / Danger in Dorwinion use); "when leaves play" (reuse); "after threat raised" (`threatRaised`, reuse; note noteThreatRaised flag is Danger in Dorwinion only).
Hook in shared code: none beyond the list names above (no new line in the reducer).

## Mechanics: reuse first (confirm in Build with the catalog; names found)
Existing: SkipQuestPhase, AdvanceStage, ShuffleStageFromVictory, AddToVictory, progressCap / stageNoProgress / noProgressPlaced flags, AttachToDial/DetachFromDial, eliminationReduction flag, playerThreatReductionCap / threatReductionCap flags, cannotReady, blankText, cannotBeEngaged, attackOnlyByEngaged, canTravel flags, DiscardFromDeck, ModifyHeld, BarDamageToEngaged, ImmediateAttack, AddSetAsideToStaging, RevealTopThenDiscard, Doomed keyword.
Likely NEW (all in the mordor family unless Build finds one):
1. `RevealPowerOfMordor` (above).
2. Quest stage count in the victory display (double-sided quest cards only; Amount `questStagesInVictory`): check `vom.quest-stages-vs-side-quests` and amounts of the quest family; new Amount if absent (X for Ulchor, Hall of Horrors, Temple of Sauron, stage 2B).
3. Cards under the threat dial: `PutTopUnderDial` (each player, 10), `DiscardTopUnderDial`, `ShuffleUnderDialBack` (on the side quest's defeat) (check AttachToDial first; it attaches cards, may not hold facedown deck cards).
4. Stage 1B: resource placed at end of planning phase; at 2 add to victory display and advance to a random facedown stage 2 (`shuffleStageTwosUnder` setup step: runs at setup; `AdvanceStage` to the topmost stage under).
5. Stage 2B counters: threat +2 per different card type discarded (needs a count of types discarded: new verb `AddThreatPerDiscardedType`), copies discard by title (`DiscardCopiesOfDiscarded`), cost-sum progress cap (`CapProgressByDiscardedCost`; or reuse progressCap with a computed amount).
6. Narrow Opening "cannot play more than 1 card each round" (check cannotPlayCards / a counter; likely a new flag `playedThisRound`).
7. Khamûl / Ulchor's Guard constant engage (`EngageWhile`-like continuous check; check "cannotEngageSeat" and engage verbs).
8. Crumbling Passage: make active, previous back to staging with progress kept (check MakeActiveLocation variants).
9. Hall of Horrors: X damage, all to one character per player (check AssignDamage).

Files at the size limit to not grow: check `scripts/checks/file-size.test.ts` OVER_LIMIT list for `src/catalog/scenario-data.ts`, `src/rules/core/piles.ts`, `src/play/store/pile-ids.ts`, `src/play/layout/layout.ts`; put logic in new files.

Conflicts: none (research file has 0 conflict rows).
Pack: `.agent/pack/the-temple-of-doom.md`, 252 KB (about 64.5k tokens), 23 drafts, 23 schema files, 12 cookbook sections.

## Build part
Render: `.agent/render/the-temple-of-doom.md` (229 pieces by template, none as JSON); snapshot `scripts/data/effects/render/snapshots/the-temple-of-doom.txt`.
Commits on feat/the-temple-of-doom: 1ddf20e6 (pile and verbs), 615309d7 (records, playable, music), later commits listed in the report.

Pile: `powerOfMordorDeck` (pile name `powerOfMordor`, `NAMED_PILES`), a plain pile like `angmarOrcDeck`. Data side: cycle-defs.ts groups of the two scenarios, scenario-piles.ts case, scenarios.ts EXTRA_DECKS, vengeance-of-mordor.test.ts; `data/scenarios/the-temple-of-doom.json` and `the-fortress-of-nurn.json` changed (only the pile name of 5 cards each). Table: layout.ts, pile-ids.ts, motion.ts, table-canvas-views.ts, pile-piece.native.tsx. No STATE_VERSION bump (a zone name only; angmarOrcDeck was added the same way).

New in the mordor family (src/catalog/families/mordor.ts, engine src/rules/families/mordor/):
- Verbs: RevealPowerOfMordor (power.ts, runsInFrame, onEmpty loseGame), ShuffleStagesUnder (index.ts, shuffleStages of quest/order.ts), PickLowestDefense (pick.ts), PutUnderDial and DiscardUnderDial (dial.ts), DiscardCopiesOfLooked (cards.ts).
- Amount discardedEncounterTypes (cards.ts, amount hook; the schema field is in effect-schema-amount.ts).
- Flags engagesFirstPlayer and engagesWithUlchor (settle sweep engage.ts, reuses ring-maker engageEnemies), defendOnlyByEngaged (combat.defense hook; the attack side reuses the pelennor flag attackOnlyByEngaged).
- Settle sweeps in the mordor manifest (SETTLE_ORDER.sweep lists "mordor"): engage, return of the cards under the dials when Lost in the Dark lies in the victory display (dial.ts, cards marked by owner and stackedAt, zone under, host the side quest), elimination for The Tower of Barad-dûr (level.ts).
- Stage flag `ordered` (ShuffleStagesUnder names it; src/catalog/stage-order.ts, boundary.ts, state-types.ts, quest/order.ts): the quest advances in quest-deck order, each stage printing Victory goes to the victory display on defeat, the last stage defeated wins. Stage 1B uses AdvanceStage alone: leaveStage adds stage 1 (Victory 10) to the display.
- Shared one-liners: pick schema none; `pick` pile name list (effect-schema-amount.ts pileNameSchema, words/instruction.ts PILE_NAMES); wilderland/night.ts askCurrentQuest leaves out a side quest holding cannotBeCurrentQuest (Tribute). pick.ts untouched (lowestDefense would have needed it; PickLowestDefense is the verb instead).
Reuse: Tribute win via trigger questDefeated forced WinGame; Narrow Opening LimitPlaysPerRound; Crumbling Passage MakeActive; stage 2B noProgressPlaced; stage 2B 21085 uses questProgressCap on the table (cap on the current quest; with X = 0 the engine reads the cap as 0).

Open points for the judge and the Tests task:
- 21057:A:1 "Then, either ...": the Choose has no thenResolves condition (Choose takes no `when`); a Tribute out of play makes no difference to the choice.
- 21085:B:2 cap is `questProgressCap` on the table, not on the stage: a side quest that is the current quest is capped too.
- 21081:B:1 "until the refresh phase" is `until: endOfCombat` (the last phase before refresh).
- 21065:A:1 "When this stage is defeated" has no record: the settle sweep returns the cards (a record cannot claim the whenRevealed line with a forced timing).
- 21068:A:2 depends on the cardsDrawn event, announced only when a record hears it; check the opening hand at Setup does not count.
- 21054:A:2: cannotBeEngaged holds unless exactly 4 quest stages lie in the victory display.
- Words task: asks needed for 21022/21023/21059/21061/21085 picks (`pnpm test scenario the-temple-of-doom --words` fails today); spec-coverage test needs rows (Tests task).

## Tests part
Fixed (wrong rows): 21053:A:1 (RevealPowerOfMordor now has `removeDamage {code, amount}`: the 4 tokens come off first, then the reveal; one record step); 21059:A:1 (pick `staging: true`); 21060:A:1 (both constant records hold only `matches host enemy`); 21064:A:2 (target `characters`, the live class); 21081:B:1 (render words for endOfCombat: "until the combat phase ends, that is until the refresh phase begins"; engine timing is the same, the flags lapse when Refresh begins, test proves it); 21085:B:2 (new stat `stageProgressCap`/`stageProgressPlaced` on the stage card, `src/rules/families/mordor/stage-cap.ts`, read in `putOnStage` of quest.ts; X = 0 holds the stage shut; a side quest that is the current quest is not capped). 21061:A:2 rewritten (Shadow records only keep a picked card inside a frame: `Repeat 1` around the top-card move). 21054:A:3 reading corrected in the scenario file ("for each character"). 21069: the sweep announces the engagement (engageWith queues `engaged`), proven in lines.test.ts.
Tests: spec.test.ts (rows for every line the stubs listed, plus 21057:A:1 both options and Tribute out of play); lines.test.ts (Power of Mordor deck 21053:A:1/A:2, Place of Evil via rows, stage cap 21085:B:2, 21081:B:1, Lost in the Dark 21065:A:1/A:2, 21068:A:2 opening hand, Khamûl 21066:A:2/A:3, Guard 21058:A:1, 21069:A:1, 21070:A:2, stage 1 21080:A:1/B:2, Narrow Opening 21062:A:1, 21083:B:1, 21084:B:1, 21067:A:3, durations 21058:A:2, 21064:A:2/A:3, 21085:B:2, negatives for 21054:A:2 and 21081:B:2). `src/rules/families/mordor/temple.test.ts` (Build) fixed to typecheck.
Left for Words: asks for 21022/21023/21059/21061/21085 picks, and the new PickLowestDefense ask (Fanaticism tie); `PickLowestDefense` added to ENGINE_ASKING in test/harness/record-walk.ts.
Shared engine: quest.ts putOnStage (2 lines), core/lasting.ts (count stat), render stats.ts/stat-notes.ts (the snapshots of escape-from-umbar and the-road-to-isengard change only by the endOfCombat words).

## Words part
Asks: `src/play/words/asks/the-temple-of-doom.ts`, 12 entries (21022, 21023, 21024 ties say the tied count and the Attack or cost; 21056 owned; 21057 Choose and two rows with Tribute's damage; 21059; 21060 PickLowestDefense (no tie count: the pick schema has no lowestDefense, so the count is not readable); 21068, 21081, 21085 owned, card in `why`). No caution: no row raises threat.
Table step: `readouts/mordor/temple.ts` + `temple-words.ts` (dials Tribute (warms, critical with 3 damage and empty deck), Ulchor (hit points left), Temple (goal), Cap (stage 2B); seat marks Lost in the Dark "P1 7"/"Dark 7", Narrow Opening "P1 0/1"/"Play 0/1", Covered in Darkness "P1 0/1"/"Cap 0/1"); `scenario-dials.ts` wiring and `labelTail` trim; Power of Mordor pile already drawn by Build ("Mordor" with count). Test `src/play/scenarios/the-temple-of-doom-table.test.ts`; shots `test/scenarios/the-temple-of-doom/screens.ts` (7 moments, read at 844x390 and 667x375). Docs: scenario file `## Table`, `docs/design-system-table.md` "The Temple of Doom's table pieces".

## Games part
Goldens (test/scenarios/the-temple-of-doom/game.ts, golden.test.ts; filler card cost 2 in `templedoomWorld`): solo won Normal seed 1 (71 intents); two-handed won Normal seed 5 (112); two-handed won Easy seed 1 (122); solo lost threat (weak, seed 4, 61); solo lost every hero destroyed (brittle, seed 2, 41); solo lost empty Power of Mordor deck (strong, `tribute: false`, seed 3, 142). About 550 intents in all.
Policy: Dorwinion rules plus Ulchor first (engage and attack rank) and `takeTribute` (the current-quest Choose takes Tribute when offered); `tribute: false` leaves every Choose to `choose`. The simple player won here, no soak policy needed.
Data fix (outside the records, needed for any win): overrides for 21053 Tribute to Mordor (QP 12) and 21065 Lost in the Dark (QP 8), both null from Hall of Beorn; scans read. data/cards/ASitE.json and src/catalog/version.ts moved with it.
Test fix: scripts/data/vengeance-of-mordor.test.ts line 79 named the old pile `encounterDeck2`; now `powerOfMordorDeck`.
Fixture: `templedoom-lost` (seed 1, 176 intents, round 5). Seed finder scripts/e2e/vengeance-of-mordor/the-temple-of-doom.ts uses templedoomIntent. Standalone test written. Shot read: `--fixture templedoom-lost --at 150 --landscape --tap "text=Continue"`: Tribute dial 3, Ulchor dial 9, Lost in the Dark seat marks "P1 8"/"P2 6", Mordor pile 5. Not shot: Covered in Darkness marks above 0, Narrow Opening marks above 0 (tests only).
