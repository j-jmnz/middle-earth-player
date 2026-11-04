# Handover: review the scenario pipeline proposal from phase 47

This is for the agent that checks the pipeline proposals written after phase 47 (A Storm on Cobas Haven) before any of them is built. The work stays open until the user picks which steps to build. The commit that builds or drops the last chosen step deletes this file, or cuts it to the points still open (`.cursor/rules/docs-standards.mdc`, Plans, phases and handovers).

## The task

Test each proposal below against the code and the record of phase 47, then return a recommendation the user can decide on. The proposals came from the orchestrator that ran phase 47. Treat them as claims: confirm or refute each one, size it, and say what it misses.

- **Do not build anything.** Read the code, the git history and the docs; run commands and scratch scripts in the session scratchpad. Edit no files in the repository except this handover, and change the handover only if the user asks.
- The settled rules still bind every proposal (`docs/plans/scenario-pipeline.md`, What does not move): goldens and committed fixtures stay byte-identical, `src/rules/engine/version.ts` is unchanged, and the scans, ledger and rule spans stay the authority. A proposal that would break one of these is rejected, or rewritten so it does not.
- Do not reopen the decisions of `docs/plans/scenario-pipeline.md` sections A to F. Deciding where the proposals fit among its Next steps is part of the task.

## Read first

- `CLAUDE.md`, `.cursor/rules/authority.mdc`, `.cursor/rules/code-standards.mdc` (Checking a change), `.cursor/rules/docs-standards.mdc`.
- `docs/plans/scenario-pipeline.md`, all of it: what is built, "Where a scenario's cost is now", Next steps, After each scenario phase.
- `docs/plans/effect-authoring.md`: Templates and copied lines, Mechanic families, Readings the review catches.
- `.cursor/agents/orchestrator.md`, and `docs/phases/phase-12-knife-in-the-dark.md` (Scenario procedure).
- Phase 47's commits, `git log --format='%h %s%n%b' 12c0519..5b7fd2f`, on `origin/phase-47-cobas-haven` (the branch, if it is not yet merged), and its last commit's "Pipeline measure". `git log --grep "Pipeline measure"` gives phase 46's for comparison.
- `docs/phases/STATUS.md`: row 47 and the Cobas Haven items under Rules and engine.

## The evidence from phase 47

| Step | Wall time | Subagent tokens | Result |
| --- | --- | --- | --- |
| Scaffold (`scenario:new`, `data:build`) | 6 min | — | No hand edits. `test:changed` ran 257 of 497 files (199 s). |
| T1 towers, guarding | 21 min | 335k | 17 lines closed. 4 twin lines could not be copied. |
| T2 Flagship, Warships, stages, locations | 22 min | 370k | 22 lines closed. An invented rule id was caught only by the full suite. |
| T3 Skirmisher, two treacheries | 19 min | 327k | 4 lines, each a new mechanic. |
| T4 campaign card, Gavin, Send for Help | 16 min | 350k | Found 12 hidden lines; left 3 open; invented a second rule id. |
| T4b Send for Help's heavy lines (not planned) | 15 min | 241k | An added phase in `core/state.ts`. |
| T5 goldens, fixtures, flows, table | 39 min | 354k | 19 goldens; found no engine bug; 4 "coming soon" edits by hand. |
| Reviews (`reviewer` and `ux`, in parallel) | 14 and 7 min | 245k and 170k | 0 blocks. |
| Fix pass | 33 min | 429k | +886/−241 in 62 files, 24% of the build diff of +3,751/−84 in 94 files. |

What the review found, by class:

| Class | Count | Already in the plan? |
| --- | --- | --- |
| Choice words that name no card, number or owner | 7 to 8 | Named in the plan, but no check exists. It recurs. |
| A new verb next to an existing one (duplication) | 3 | No |
| A hand-written file over 500 lines | 2 | Named in the plan; phase 46 had 1 |
| An engine bug in new core state, tested on the normal path only | 1 | No |
| A pick with a null source that applies player-card immunity | 1 | No |
| An untested loader (a regex over JSON) | 1 | No |
| Readings an agent decided alone, needing a ruling | 8 | No |
| Hidden dealt cards (outside the review) | 12 lines | No |
| A stale Maestro "coming soon" flow from phase 46 | 1 | Next step 5, in effect |

Other friction the agents reported:
- `effects:draft` leaves stale drafts behind.
- The draft does not show which Setup sentences the piles already carry out.
- `copyLine` cannot copy from another scenario's file.
- `resolveRecords` stops at Response windows and skips Action conditions.
- `card-smoke` takes codes separated by spaces, `effects:draft` takes them separated by commas.
- The scaffold's `game.ts` has no ship stats for sea scenarios.
- `test:changed` pulls in 50 to 80% of the suite after each task.
- A record in `runsInFrame` is visible only as a moved golden.
- The handover called the Gavin XP spend "new", but it had existed since phase 38. It listed 2 "coming soon" places where there were 4.
- The deferred hooks of plan D (condition, pick) never moved, although every task edited the core switches.

## The proposals to check

Each proposal has a claim to verify and the files to look at.

1. **Catch review findings during the build.**
   - **1a. `pnpm words:dump <scenario>`.** It prints every Pick, Choose and branch sentence a scenario's records produce. Check: can it reuse `pickWords` and `branchWords` (`src/play/words/`) and the sheet builder (`src/play/choice/sheets.ts`) without a game, or does it need one?
   - **1b. A wording check in the words tests.** It fails on an unresolved referent ("it", "the objective", "this card", a bare "Choose a player.") and on a new verb option that falls to default wording, as `delayedWords` in `src/play/cards/card-effects.ts` did. Check: count the false positives on the playable scenarios today.
   - **1c. A file-size check in `scripts/checks/`.** It fails on a hand-written file over 500 lines, with an allowlist for files already over. Check: how many files are over today, and is 500 the right line by `.cursor/rules/code-standards.mdc`?
   - **1d. "Extend, don't bend" in `docs/plans/effect-authoring.md`, plus a nearest-verbs list on each draft line.** Check: phase 47's three duplications were `makeEngagementChecks` beside `engagementStep`, `TakeSetAsideShip` beside `PutSetAsideInPlay`, and `AttachToShip` beside `AttachSelf`. Would a nearest-verbs list built by word overlap over `src/catalog/families/*.ts` have found each of them?
   - **1e. `pnpm scenario:lint <id>`.** It joins 1a to 1c, the record-route check, the rule-citation test and the unreached-records list. Check: does it overlap with `pnpm test:scenario`, and should it be part of it?
   - **Claim:** these would cut the fix pass by about half. Check this against phase 46's and phase 47's review findings.
2. **Make coverage trustworthy.**
   - **2a. A hidden-card check.** Every card a `*.campaign-setup-*` rule span or a campaign card's Setup names must be among the scenario's dealt codes. `scripts/data/normalize/campaign-text.ts` now reads the span, but nothing pins the general rule. Check the other campaigns' setup spans.
   - **2b. `effects:draft` clears the scenario's stale drafts** before it writes.
   - **2c. The copy check normalizes `{self}` the way `scripts/data/effects/generate.ts` does** (`copyMismatch`, `src/effects/copies.test.ts`, `src/effects/authored/reprint.ts`). The draft also groups twins inside one batch (Next step 4). Check: how many open lines on 12161 and the other cards of phase 48 would this cover?
   - **2d. A template for the bare "Guarded." keyword**, writing a `GuardObjective` record. `data:build --verbose` lists "Guarded x9" among unknown keywords. Check: would a template take any authored record's id (`unreadBefore`, `REPLACES`)?
   - **2e. The draft marks the Setup sentences the scenario's piles already carry out.**
3. **A readings ledger per scenario.** Each entry holds the line, the reading taken, the alternative, a citation, and a status (`literal`, `span-settled` or `needs-ruling`). Agents append to it, the reviewer checks each entry against the code, and rulings are asked of the user at mid-phase.
   - Check: where should it live (`data/`, `docs/`, beside the authored file)? Does it duplicate `docs/brief.md` or `STATUS.md`?
4. **Records no golden reaches.** `test:scenario` lists them (Next step 3).
   - The kit gains a `shipStats` option. `resolveRecords` passes Response windows and Action conditions.
   - New core state is tested at its boundaries (the end of a phase, save and load, undo), not only on the normal path.
   - Check: can "a golden resolved this record" be read from the step logs the goldens already keep?
5. **Seams in the core.** The proposal is to build the condition and pick registries now (plan D's hooks), rather than wait for "when the family is next changed".
   - It adds hooks for attack legality and for whether a cost can be paid, and one exhaust event at the core's exhaust site (which would remove the `shipExhausted` sweep in `src/rules/families/sea/water.ts`).
   - It turns verb lists into schema flags (Next step 1).
   - Check: count the core edits per phase that these would have removed (phases 46 and 47), and estimate the work with the goldens byte-identical.
6. **Verification and test tiers.**
   - **6a.** `scripts/data/rules.test.ts` runs inside `test:scenario`.
   - **6b.** Import the registries and schema barrels narrowly, so `test:changed` stops selecting most of the suite. Check: which imports pull it in? Measure it on one task's diff.
   - **6c.** The "now playable" check in `scripts/checks/effect-coverage.test.ts` warns until the goldens exist.
   - **6d.** The previous part's "coming soon" expectation is worked out from `src/campaign/playable.ts` (Next step 5). That is 4 places: two tests of The Drowned Ruins, `src/campaign/dream-chaser-xp.test.ts`, and the previous part's Maestro flow.
   - **6e.** One separator for codes across the commands, and the encounter-card smoke (Next step 2).
7. **Orchestration.**
   - A handover author's grep checklist: `xp.ts`, "coming soon" across tests and `.maestro`, and 2a.
   - The briefs' "what earlier tasks added" section is generated from the catalog diff.
   - Task 5 is split into goldens and policy, then table words, with a words review of the 1a dump between them.
   - Check: does any of this belong in `.cursor/agents/orchestrator.md` or the scenario procedure, rather than the plan?

The proposal's order before phase 48:
1. The cheap checks: 1a, 1c, 2a, 2b, the `{self}` part of 2c, 6a, and the separator part of 6e.
2. The readings ledger (3).
3. The condition and pick registries and the verb-list flags (5).
4. 1b, 1e, 4, 6c, 6d.
5. Later: 2e, 6b, the win finder.

The projected effect on phase 48: a fix pass of about 15 minutes instead of 33, no hidden-card task, and rulings collected at mid-phase.

## What to hand back

A report for the user, in this order:

1. **Each proposal.** For each one:
   - confirmed, refuted or changed, with the file evidence;
   - its effort (S, M or L) and what it saves per scenario;
   - its risk to the goldens.
2. **What the proposal missed.** For example, phase 46's findings that phase 47 repeated, or costs the measure did not record.
3. **An ordered list of steps.** Each one is written to fit `docs/plans/scenario-pipeline.md`, Next steps ("Not built", what it does, its exit), and the ones to drop or merge with existing steps are named.
4. **What phase 48 needs first.** Phase 48 is The City of Corsairs (`docs/phases/phase-48-the-city-of-corsairs.md`). Which steps it needs before it starts, given that it also needs the user to rule on Stormcaller's card (`STATUS.md`, row 48) and on phase 47's seven readings.

Run the subagents on the models `.cursor/agents/orchestrator.md` (Models) names: Sonnet for helpers. Name the model on every call.
