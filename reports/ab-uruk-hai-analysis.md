# Why the fast track was not faster on The Uruk-hai

An analysis of the A/B in `docs/plans/scenario-fast-track.md` (The A/B: The Uruk-hai, both arms fresh), from the brief in `docs/handover/ab-uruk-hai.md`. It proposes; the user decides what to adopt (`docs/plans/scenario-fast-track.md`, Decision). Neither arm's branch was changed.

## The answer in short

Both arms spent about 40% of their time waiting on test suites: 60 minutes fast, 55 classic. They wrote their code in about the same time: 47 minutes fast, 52 classic. The fast arm lost its six minutes in the fix pass. One extra full `pnpm test` run (10 minutes) was forced there by a folder limit, after a file split the fast reviewer asked for and the classic reviewer did not. The other 5 minutes were review items the classic arm had no equivalent of.

The comparison also undersold the fast track. The classic arm used the fast track's asks file (F1) for its words and had the rulings before it started. Against the eight classic scenario phases before it (`reports/ered-mithrin-phase-times.md`), both arms were faster: 138 and 132 minutes, against a median of 165. Most of that gain is F1, which both arms used.

Three causes explain the most minutes:

| Cause | Minutes | Procedure or setup |
| --- | --- | --- |
| Full-suite runs: four per arm, 8 to 13 minutes each, plus `test fast` or partial runs | about 50 per arm; the fast Build's two unrequested kinds of run cost 20 | procedure (both tracks) |
| F1 in the classic arm: task B took 35 minutes, against a historical median of 60 for that task | about 25 in the classic arm's favour | setup |
| The fix pass's second full run, forced by the 40-file folder limit after the `choice.ts` split | about 13 in the classic arm's favour (10 for the run, 3 for the split and fold) | setup (review variance) and a repo trap |

## What was measured

The orchestrator's transcript (session `session_0137UhqDiotgwcHzQpJ3iS4E`) shows each subagent's own Bash calls with timestamps. That is where every test-run time below comes from. The command times were also measured again on this machine (4 cores, one command at a time), in scratch worktrees of each arm's final commit:

| Command | Time here | Time in the A/B |
| --- | --- | --- |
| `pnpm test` (678 files) | 8.3 min | 7.6 to 13 min (classic B and fix 7.6; fast Build 13; other runs 9.3 to 11) |
| `pnpm test fast` | 2.7 min | 3.3 to 4.1 min |
| `pnpm test scenario the-uruk-hai` | 34 s (fast), 36 s (classic) | 40 s |
| `pnpm test scenario the-uruk-hai --quick` | 28 s | about 30 s |
| `pnpm data check` | 15 s | 24 s |
| `pnpm lint`, `pnpm typecheck` | 6 s, 5 s | |
| the seed finder (`scripts/e2e/fixtures.ts the-uruk-hai`) | 44 s | 64 s |

A full run varies by up to 70% between containers and times of day. In one run that crossed Bash's 600-second limit, the agent moved it to the background and polled.

## Time split per arm

The task times are the orchestrator's (`docs/handover/ab-uruk-hai.md`, Time and tokens per task). Waits are the summed wall time of each test, check and seed command over about 20 seconds, from the transcript. Writing is the remainder: reading, editing and the short targeted `vitest run` calls between edits.

### Fast arm, 138 minutes

| Task | Minutes | Writing | Waiting on runs | What ran |
| --- | --- | --- | --- | --- |
| Read | 9 | 9 | 0 | lint, typecheck, `--quick --list` |
| Build | 46 | 21 | 25 | full `pnpm test` 1× (13 min, unrequested), `test fast` 2× (7.4 min, unrequested), `--quick` 7×, `data check` 2× |
| reading-judge | 2 | 2 | 0 | |
| Finish | 30 | 15 | 14 | the restart gap took 1 minute. Lost run: 9 min of edits, all kept in the tree. Resumed run: full `pnpm test` 1× (10.4 min), `test scenario` 1×, `--words` 3×, seeds 1×, `data check` 1× |
| Review | 9 | 9 | 0 | reviewer 8.3 min, ux 5.3 min, in parallel |
| Fix | 42 | 21 | 21 | full `pnpm test` 2× (10.3 and 9.3 min); the first failed on `scripts/checks/layout.test.ts` (`src/play/words: 41`) |
| **Total** | **138** | **77** (authoring 47, review 9, fixing 21) | **60** | 4 full runs, 2 `test fast` |

The restart cost the arm about 1 minute. The first Finish run's edits survived in the tree, and the resumed agent kept its context; it ran `git status` and went on. The resumed run's time on `data/cards/Nightmare.json` (three `data build` runs) came from the agent's own condition, not from the restart.

### Classic arm, 132 minutes

| Task | Minutes | Writing | Waiting on runs | What ran |
| --- | --- | --- | --- | --- |
| A: records and verbs | 63 | 39 | 24 | full `pnpm test` 2× (11 and 10 min; the second after fixing four failures), `--quick` 5×, `data check` 3× |
| B: words, goldens, flows | 35 | 13 | 22 | full `pnpm test` 1× (7.6 min), two partial `vitest run`s (`src/campaign` 7.6 min, goldens and replay 7.0 min), `test scenario` 3×, seed runs (some in the background) |
| Review | 8 | 8 | 0 | reviewer 7.7 min, ux 3.2 min |
| Fix | 25 | 16 | 9 | full `pnpm test` 1× (7.6 min; failed only on the stale docs index, not rerun), `docs index`, `data check` |
| **Total** | **132** | **76** (authoring 52, review 8, fixing 16) | **55** | 4 full runs, 2 partial runs |

Task B's split is the least certain: two of its long runs were backgrounded and may have overlapped with editing. Its writing time is 13 to 20 minutes.

### Side by side

| Part | Fast | Classic | Difference |
| --- | --- | --- | --- |
| Authoring (writing records, engine, tests, words, goldens) | 47 | 52 | fast 5 faster |
| Waiting on test runs | 60 | 55 | fast 5 slower |
| Review round | 9 | 8 | 1 |
| Fixing | 21 | 16 | fast 5 slower |
| Restart | 1 | 0 | 1 |
| **Total** | **138** | **132** | **6** |

Tokens follow the writing, not the waiting. The fast fix used 398K tokens in 41 minutes (9.6K a minute), and its 21 minutes of writing ran at the classic fix's rate (344K in 16 minutes of writing). The fast Finish ran at 20K a minute: its one agent carried the Read and Build context into every turn.

## The fix pass, file by file

`2bb78b0..09d7d8d` is 1,783 lines; `b455b44..72cc7a6` is 614. Most of the gap is code that moved without changing.

| Work | Fast fix (lines) | Classic fix (lines) | Who asked |
| --- | --- | --- | --- |
| Moved code: `src/play/words/choice.ts` split into `instruction.ts` (613), `src/rules/interpret/conditions.ts` into `search.ts` (103), `uruk-hai-verbs.test.ts` moved to the scenario folder (320), `src/play/words/pursuit.ts` folded (20) | about 1,056 | 0 | fast reviewer items 13 and 17 |
| Moved families: `soleAttacker` to attack, `cannotLeaveStaging` to encounter, with catalog entries | about 70 | 0 | fast reviewer item 15 |
| One `inPlayByCode` helper for three families | 0 | about 80 | classic reviewer block |
| Engine behaviour: Captive cleared off the captive zone and elimination (fast); rescue at the win, Skill boon (classic) | about 70 | about 70 | each arm's block or change |
| Table: pursuit dial with its limit, held dials, every Captive drawn, an engaged Grishnákh (fast also: the basic dial and `captivesUnder` that classic task B had built) | about 110, plus a 138-line table test | about 130, plus a 60-line store test | ux, both arms |
| Words: asks notes, owner on Captive rows, sheet rows | about 45 | about 85, plus a 60-line words test | ux, both arms |
| New behaviour tests for lines with none | about 200 | about 75 | reviewer, both arms |
| Renderer `Restrict` template | 28 | 0 | fast reviewer item 14 |
| Normalizer predicate (`scripts/data/normalize/cards.ts`, `src/catalog/scenario-data.ts`) | 27 | 0 | fast reviewer item 16 |
| `docs/INDEX.md` regenerated | 58 | 8 | |

Without the moved code and the index, the fast fix changed about 670 lines and the classic fix about 606. The real work was close: the fast fix wrote more test lines, and the classic fix more words and engine lines. The 17-minute gap is about 12 minutes of waiting: one extra full run of 9.3 minutes, and its first full run took 10.3 minutes against the classic arm's 7.6. The other 5 minutes are writing: the two splits, the family moves and the basic table work. This is the order of events in the fast fix:

1. From 00:55 to 01:14, the edits, in brief order (engine, words, normalizer, splits, tests, table, docs), with about 27 targeted `vitest run`s and five typecheck errors fixed along the way.
2. From 01:14 to 01:25, full run 1, which failed only on the 40-file limit. The `choice.ts` split had added `instruction.ts` to a folder already at 40, and the targeted runs never include `scripts/checks/layout.test.ts`.
3. The fix: `pursuit.ts` folded into `instruction.ts`.
4. From 01:26 to 01:36, full run 2, green.

`choice.ts` was at 499 lines at the base, 500 in both arms, and 500 on the classic branch at the end. The split was not forced by the fast arm's work. The fast reviewer asked for it, and the classic reviewer did not.

## The leads

| # | Lead (`docs/handover/ab-uruk-hai.md`, Leads the orchestrator saw) | Verdict | Minutes it explains |
| --- | --- | --- | --- |
| 1 | No table step in the fast procedure | Supported, but small. Classic task B built only a plain Pursuit dial and drew every Captive under To Isengard!: about 20 lines (`0c4f3ac..b455b44` under `src/play/readouts`, `src/screens/table`, `src/play/store`). Both fix passes then built about the same amount of table again, because both ux reviews asked for the limit, the held dials and the engaged Grishnákh. | 2 to 3 in the fix |
| 2 | Spec rows covered less than planned | Supported. The 17 rows cover the pursuit and zone lines. The header of `src/campaign/scenarios/the-uruk-hai/spec.test.ts` lists what a row cannot see: damage, a hand, a declared attacker or defender, the Responses offered. In this scenario, that is about half the lines. Finish wrote a 160-line verbs test anyway, and its header claimed two lines it did not cover. The fix then wrote about 200 more test lines. In all, the fast arm wrote about 880 new card-test lines (45% of them in the fix); the classic arm wrote about 1,050 (6% in the fix). | 3 to 5 in the fix |
| 3 | The renderer misstated correct records | Supported. Both of the judge's `wrong` lines were template gaps: `ReturnToStaging` printed a pick as "engagedEnemies", and a Shadow's `self` was read as the shadow card. Four of its nine `ambiguous` lines were "the English cannot show it", which the orchestrator turned into "make the render say so". To do that, Finish wrote scenario prose into shared templates (`STAT_NOTE`, the `Restrict` advance text), and the fix took it out again. | 3 in Finish (inside the lost run), 3 in the fix |
| 4 | The pack is mostly drafts | Supported, but costs nothing. Drafts are 148 KB of the pack's 204 KB. Within the drafts, 34 KB of the 49 KB of rules text is repeated from draft to draft. But the author did not work from the pack. Read used it in 7 of 62 Bash calls and opened 11 source files. Build touched it in 0 of its calls and opened 68 source files. The pack did not replace the reading list; it was read once and then left. | 0 to 2 |
| 5 | Engine work dominates both arms | Supported for both arms equally. Engine lines were 463 against 426, and records 290 against 365. The historical phases land in the same ranges (engine 176 to 479, records 292 to 388). | none of the difference |
| 6 | `test scenario` runtime | Not supported as stated. `test scenario` takes 34 seconds, and `--quick` saves 6 seconds of that. The cost is the full `pnpm test`: four runs per arm, 36 to 43 minutes in all. | the largest cost in both arms, about 50 minutes each with partial runs; not part of the difference |
| 7 | The size limit | Supported, but the cause is review variance plus the interaction of two limits, not the fast procedure. The split was a review item (see the fix pass). The fold, and the second full run, came from the 40-file folder limit, which no targeted check runs. The classic fix hit the file-size test once too (`src/screens/table/view.tsx`, 508 against 505) and fixed it in a minute. | about 13 in the fix |

Leads the orchestrator did not list:

| Lead | Evidence | Minutes |
| --- | --- | --- |
| The fast Build ran suites its brief did not ask for | Both the Build brief and `.claude/agents/scenario-author.md` (Build) name lint, typecheck, `--quick` and the card smoke. The agent also ran a full `pnpm test` (13 minutes) and two `test fast` runs (7.4 minutes), polling each in 2-minute loops. A `sleep` was refused, and `Monitor` was not in its tools. | 20 |
| The classic arm used F1 and F4 | Classic task B wrote its words as an asks file: 129 words lines, against 567 to 1,011 in each of the last four classic phases. B took 35 minutes; in the eight phases before, B took 50 to 80 (median 60). | about 25 in the classic arm's favour |
| Suites ran slower in the fast arm's container hours | The same suite took 10 to 13 minutes in the fast arm and in classic A (night), and 7.6 minutes in classic B and fix (morning). It took 8.3 minutes here. | about 3 to 5 across the fast arm's four runs |
| Fix passes vary widely | The eight historical fix passes took 17 to 54 minutes (median 39). The classic arm's 25 was low, and the fast arm's 42 near the median. | the whole 6-minute gap is within that spread |
| Review variance decides fix work | The two reviewers flagged different things on near-identical structure: `choice.ts` at 500 in both, flagged in one. The family placement was flagged in the fast arm. The third helper copy was flagged in the classic arm. | about 15 of the fast fix |

## Procedure or setup

| Effect | Caused by | Direction | Minutes |
| --- | --- | --- | --- |
| F1 in the classic arm's task B | setup (`docs/handover/ab-uruk-hai.md`, What skews the comparison) | favours classic | about 25 |
| Rulings handed to the classic arm | setup | favours classic: the fast Read (9 minutes) is the price of finding R1 to R5, and classic A paid nothing | about 9 |
| The fix pass's second full run, after a split one reviewer asked for | setup (review variance) and the folder limit | favours classic | about 13 |
| Slower container hours for the fast arm's suites | setup | favours classic | about 3 to 5 |
| The restart | setup | favours classic | about 1 (the edits survived) |
| One agent resumed across three tasks | procedure as run (F5) | costs tokens: Finish ran at 20K tokens a minute, against about 10K for the other writing tasks. The minutes are unclear. | 0 to 3 |
| Unrequested suites in Build | the agent, against its brief | favours classic | 20, but classic A ran two full suites too (21 minutes), so this is a cost of both procedures |
| Late test and table work in the fix | procedure (F3 rows, no table step) | favours classic | about 5 to 8 |
| Render prose in shared templates | procedure (F2 as run) | favours classic | about 6 |

The setup costs that favour classic come to about 50 minutes. Without them the fast arm would have come in near 90 to 100 minutes against 132: the plan's two-thirds is 88. The procedure's own extra costs (late tests and table work, render rework, about 12 minutes) are smaller than its savings (the asks file, no scene file, rows in place of about 230 lines of hand tests, about 25 to 35 minutes). These are estimates from one run per arm. A 6-minute difference is well inside the run-to-run spread above, and so are 15 minutes.

The cross-check went the fast arm's way for reasons that belong to the procedure. The reading judge moved 143069:B:2 to the full reading, and the Read pass found `faq.additional-attacks` for 143031:A:2. The classic arm's one win (143070:B:3, the rescue) came from its own review, which could see ruling C1. Only the classic arm had C1.

## Proposals

Ranked by minutes saved per scenario. Each has the measure that would show it worked, read from the subagents' Bash timestamps as this report does.

| Rank | Change | Where | Minutes saved per scenario | Measure |
| --- | --- | --- | --- | --- |
| 1 | One full `pnpm test` per scenario, at the end of the fix task. Writing tasks end on `pnpm test fast`, `pnpm test scenario <id>` and `pnpm data check`, and say "no full suite" in the brief and the agent file. `test scenario` also runs the cheap repository checks that only the full suite runs today and that failed late in this A/B: `scripts/checks/layout.test.ts`, `scripts/docs/index.test.ts` and `scripts/checks/maestro.test.ts`. CI and the orchestrator's closing check stay as they are (`.claude/agents/orchestrator.md`, Closing). | `.claude/agents/orchestrator.md` (Implementer tasks), `.claude/agents/scenario-author.md` (Build, Finish), `docs/handover/fast-track.md` (Finish, The loop), `docs/handover/agent-brief.md` (Scenario procedure, step 2), `scripts/tools/test-scenario.ts` | 20 to 30 (three of four full runs at 8 to 13 minutes, less three `test fast` runs at about 3) | one full run per scenario in the transcript; waits under 20 minutes per arm; no failure that only the full run found |
| 2 | F1, the asks file, for every new scenario on either track. It is already in practice: classic task B chose it. | `docs/handover/agent-brief.md` (Scenario procedure, step 5) | about 25 against the pre-plan procedure | words lines per scenario under 200; the words-and-goldens task under 40 minutes |
| 3 | Split the files at their limits before the next scenario, not during a fix: `src/play/words/choice.ts` (499 at the base, 500 in both arms), `src/rules/interpret/conditions.ts` (499), and `src/screens/table/view.tsx` (505, listed in `scripts/checks/file-size.test.ts` at 505, so any added line fails). Give `src/play/words` room under the 40-file limit (the asks files are already a subfolder). | a `refactor` commit on `main` | 10 to 13 whenever a review asks for a split | no file-size or layout finding or failure in the next scenario |
| 4 | Card-spec rows that see what this scenario needed. Add `damageOn`, `handCount` and `drew`, `defender` and `attackersOf`, `refused` (a cancel offered and refused), a scenario counter (`pursuit`, in place of reading it through `questPoints`), `heldBy` (a card under or attached to a host), and a `seat` on layouts and expectations for two-handed rows. Add the acts `defend(with)`, `cancel` and `respond(code)`. Add a coverage check: each line a record names has a row or a test whose name starts with the line id, so a header like this scenario's false claim cannot pass. | `test/harness/card-spec.ts`, `test/harness/layout.ts` | 5 to 8 (the fix's 200 test lines become rows in Finish, and a review's "no behaviour test" findings drop) | under 3 "no behaviour test" findings in review; under 100 test lines in the fix; the share of lines covered by rows (17 of about 38 here) over two thirds |
| 5 | A Table step in Finish: for each tracker, zone or held card a record creates, a readout with its limit and its warm-up near the limit; a held dial per seat; the held card drawn under its host in every zone the host can be in; the owner on every row of a pick across seats. Point to `docs/handover/agent-brief.md` (Scenario procedure, step 4) for the rule. | `docs/handover/fast-track.md` (Finish), `.claude/agents/scenario-author.md` (Finish) | 3 to 5, and fewer ux findings | under 3 ux screen findings; no table item in the fix brief |
| 6 | The renderer reads every field it claims, and holds no scenario prose. A test gives each template a record using each field in its `read` list, and fails when the field does not change the English. Add a render snapshot of every playable scenario (`pnpm effects render --all`), so a shared-template change shows its diff on other scenarios at once. The judge reports a fourth status, `render-gap` (the record may be right; the English cannot show it), apart from `ambiguous` (two readings of the card). The orchestrator files render gaps for the renderer, not for the author's Finish. | `scripts/data/effects/render/`, `.claude/agents/reading-judge.md` (What you judge, Output) | about 6 | no `wrong` that is a render bug; no review finding on the renderer; `ambiguous` rows in the judge's output under 5 |
| 7 | A fresh `scenario-author` per task, handed a short note from the last task (verbs added, files touched, readings), instead of one resumed agent. Give writing agents `Monitor`, or tell them to poll a background run, so a full run past 600 seconds does not stall them. | `.claude/agents/orchestrator.md`, `docs/handover/fast-track.md` | 0 to 3 minutes; about 200K tokens | tokens per task (Finish under 400K); Finish time unchanged or lower |
| 8 | The classic procedure takes the reading judge after its records, and the FAQ check in its Readings list (every line with a matching `faq.*` span cited). Ask the rulings before the engine work, as the fast Read does, so the user's wait does not sit between the two writing tasks (classic waited 7 hours between A and B). | `docs/handover/agent-brief.md` (Scenario procedure, step 2), `.claude/agents/orchestrator.md` (Implementer tasks) | costs about 2 minutes; saves a later reading fix (here two lines the classic arm lost in the cross-check, one of which, 143031:A:2, would have needed an `ENGINE_VERSION` bump once found) | no cross-check or review "reading" finding against the procedure |
| 9 | Shrink the pack, or make it what Build reads. Drop the repeated rules spans from the drafts (34 KB), and add the engine files of the families the nearest records use, since Build read 68 source files and never the pack. | `scripts/tools/author-pack.ts` | 0 to 2 | the share of Build's reads that go to the pack |

The first three are independent of the track and together are worth more than the plan's whole two-thirds target. Proposals 4 to 7 are the fast track's own repairs. Proposal 8 is what the classic procedure should take from it.

## A second A/B

A second A/B is worth running only to measure what this one could not separate: the spec rows (F3) and the single author (F5). The parts that saved the most time (F1, F4, rulings first, the judge) are cheap to adopt on their own. The saving in proposal 1 dwarfs the difference between the tracks.

If the user runs one, on Helm's Deep (part 2 of The Two Towers, data built), the setup that keeps it fair is:

- **The same tools in both arms.** Proposals 1 to 3 land first, on `main`. Both briefs name F1, F4 and the judge, so the arms differ only in rows against hand tests and one author against fresh implementers.
- **Rulings found by both.** Both arms' readings passes run first. The user is asked once about the union, and both arms build with the same answers. Neither arm inherits the other's readings.
- **Restarts.** A task cut by a restart is rerun from its start in a clean worktree and timed afresh, or the lost minutes are counted in both arms.
- **Agents.** A fresh agent per task in both arms, or the same resumed agent in both.
- **Waits measured, not guessed.** Each arm reports writing and waiting from the subagent Bash timestamps, with full runs counted. The decision compares writing minutes, which the suite's container speed does not move.
- **One reviewer brief, and one fix filter.** A finding that moves code without changing it (a split, a family move) is fixed in a separate `refactor` task, timed apart, in both arms.
- **Two runs per arm, if the user can spend them.** One scenario per arm cannot tell apart differences under about 15 minutes: the historical fix passes alone spread over 37.

Without a second A/B, the next scenario on the hybrid (classic tasks, with proposals 1, 2, 3 and 8) can be measured against `reports/ered-mithrin-phase-times.md` and this report's tables. That is enough to show whether the waits fell.

## Reproducing the numbers

- Diff by area: the script in `docs/handover/ab-uruk-hai.md` (Reproducing the numbers), given a base and a head commit: `7137f44..d138a81` (fast Build), `d138a81..2c8daa2` (Finish), `2bb78b0..09d7d8d` (fast fix), `7137f44..0c4f3ac` (classic A), `0c4f3ac..b455b44` (B), `b455b44..72cc7a6` (classic fix). Historical phases use the commit ranges in `reports/ered-mithrin-phase-times.md`.
- Command times: each command run alone in a worktree of the arm's final commit after `pnpm install`.
- Run counts and waits: the subagents' Bash calls in the orchestrator's session, read with `list_events`.
- The pack: `pnpm scenario pack the-uruk-hai` in a worktree at `7137f44`.
