# Handover: phase 47, A Storm on Cobas Haven

For the session that starts `docs/phases/phase-47-a-storm-on-cobas-haven.md`. The phase file is the spec and the exit. This file covers where the work starts and the traps phase 46 hit. Delete it, or cut it to what is still open, in the phase's last commit.

## Where it starts

- Phase 46's engine half is done (`docs/phases/STATUS.md`), so phase 47's engine half can start. Nothing is in flight.
- `pnpm scenario:new a-storm-on-cobas-haven --dry-run` lists 9 files and 4 registry edits, with the fixture names `haven-won` and `haven-lost`. Run it without `--dry-run`, then run `pnpm data:build`.
- `pnpm effects:draft a-storm-on-cobas-haven` writes the bundle. Most of the scenario's lines come from templates; what is left is mostly mechanics, not records.

## Lines that are the same

Write one of each group and copy the rest (`docs/plans/effect-authoring.md`, Templates and copied lines). The draft does not group these yet (`docs/plans/scenario-pipeline.md`, Next steps):

- **Dol Amroth Warship.** 110102 (its two sides) and 12123 print the same two lines: the on-course bonus, and "set it aside" when destroyed.
- **Raider Flagship's engagement cost.** 12120:B:3 and 12121:B:2 read the same.
- **The four towers** (12134 to 12137). Each prints "Guarded." and "If ~ is free of encounters, add it to the staging area, controlled by the players."
- **Exact matches the draft prints.** These lines already have records: Rough Waters 11053:A:2, and Voyage Across Belegaer 11171:B:5 and B:7.

## Mechanics to read for

Read each against its scan and the rule spans before designing anything. Check the existing vocabulary first: the `sea` family (heading, ships, Boarding, the Corsair deck, fleets) and Guarded (`wor.guarded-x`, `GuardObjective`).

- **The towers.** "Free of encounters" moves a tower to the staging area under the players' control. Staging folds rank "controlled" by `claimed`, so a freed tower must set it (`docs/phases/STATUS.md`, Rules and engine).
  - Sea-ward Tower: 2 more cards in each Sailing test.
  - Tower of the Gull: a Combat Action any player may take.
  - The Beacon: take control of a set-aside Warship.
  - Tower of the Heron: −4 to the archery total.
- **Guarding by Ship enemies.**
  - 12121's When Revealed attaches a non-unique Ship enemy to each unguarded objective.
  - 12126 attaches at the end of the quest phase while it is in the staging area.
  - 12127 and 12133 attach and guard.
  - 12121:B:3 bars advancing while an objective is guarded.
- **Raider Flagship (12124).**
  - Only Ship objectives may attack it.
  - It reveals and engages the top card of the Corsair deck at the end of the encounter phase.
  - It gets −50 engagement cost by the stage and the heading.
  - Stage 3 wins when it is in the victory display, and gets +5 quest points for each Ship enemy in play.
- **Ships changing sides.** Corsair Skirmisher (12125) can become a Ship objective the players control. Belfalas Islet (12129) treats an enemy as out of play while it is active. Taking on Water (12132) attaches as a Condition with its own Forced effect and Action.
- **The campaign card (11209).**
  - Its Setup has each player attach a Modification boon to each of their ship-objectives.
  - Thunderstruck is shuffled into the encounter deck and Crowley into the Corsair deck.
  - Calaerion comes into play under the player with the Dream-chaser, and Gavin under any player.
  - One player may take a Círdan's Blessing not in the pool: reuse `ChooseCards` `who: "onePlayer"` from phase 46.
  - Its Resolution spends 4 XP to write "Gavin returned" in the log. That is new: an XP spend that writes a log fact.
- **Gavin's two lines (11210:A:3, A:4) close in this phase.**
  - "When Gavin leaves play (other than by his ability), remove him from the game."
  - The Planning Action shuffles Gavin and a random set-aside Send for Help into the encounter deck.
  - The four Send for Help cards have no B side in the ledger (`docs/phases/STATUS.md`, Rules and engine). Read their scans before you write a record.

## Traps phase 46 hit

- **The verb lists.** A Setup verb on the quest card must go in `revealsPerPlayer`, and a Shadow verb that asks a player or pushes effects must go in `runsInFrame`. Otherwise the Setup is skipped without a word, or the Shadow throws only inside a golden (`docs/plans/effect-authoring.md`, Mechanic families).
- **Choice words.** Every new `Choose` or `Pick` gets words in `src/play/words`, or a words test fails. That test is in the full suite, not in `pnpm test:scenario`.
- **The full suite.** Run the full `pnpm test` before every commit, not only `pnpm test:scenario`.
- **Making the scenario playable.** Once no line is open, `scripts/checks/effect-coverage.test.ts` wants the scenario in `src/campaign/playable.ts`. That changes the tests of The Drowned Ruins, which expect the next part to be `soon`: its `golden.test.ts` (`next: "soon"`) and its `campaign.test.ts`. Change only those expectations.
- **Fixtures.**
  - Add the scenario's Setup answers to `SETUP_CHOICES` in `src/campaign/fixtures.test.ts`, and to the seed finder's and `game.ts`'s `choices`.
  - `scripts/e2e/fixtures.ts` rewrites every scenario's fixtures. Restore the others with `git checkout` and commit only this scenario's file.
  - Expect no `haven-won`: no Dream-chaser part has one.
- **Readings.** Check each record against `docs/plans/effect-authoring.md`, Readings the review catches, before the review. Every card bug in phase 46's review was of one of those kinds.
- **Unreached records.** List the records no golden reaches (the XP lines especially), and give each a card test in the same task. Phase 46's fix pass had to add them.
- **File size.** Keep a hand-written file under about 500 lines. The Command and Blessing records went into `src/effects/authored/pool/DCCEDrownedRuins.ts` for that reason. A new pool file goes in `pool/index.ts`.
- **Other scenarios' lines.** Leave them alone, even when the draft shows one. The City of Corsairs X on 12161:A:1 is phase 48's, though the `max` amount it needs exists.

## Suggested split

One implementer task per mechanic cluster, each green and committed before the next. Then one code review and one UX review in parallel, then one fix pass (`.cursor/agents/orchestrator.md`, One review round):

1. The towers, guarding and "cannot advance while guarded": 12134 to 12137, 12121, 12126, 12127, 12133.
2. Raider Flagship, the heading conditions, the Warships and the stage records: 12120, 12122, 12123, 110102, 12124, 12128 to 12130.
3. The treacheries and Corsair Skirmisher: 12125, 12131, 12132.
4. The campaign card, Gavin, Send for Help and the XP lines: 11209, 11210.
5. The goldens, the campaign test, the seed finder, the flows and the table words.

## Open, not blocking

- **Spyglass (11203:A:5).** Where its copy comes from in a campaign needs the user's decision (`docs/brief.md`).
- **Phase 48's Setup.** Which Stormcaller card it flips is open (`docs/phases/STATUS.md`, row 48).
- **Measure the phase.** The phase's last commit message records the measure (`docs/plans/scenario-pipeline.md`, After each scenario phase).
