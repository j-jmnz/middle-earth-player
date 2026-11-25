# Cycle procedure

How an orchestrator builds a whole cycle or box of scenarios (user instruction, 2026-11-25). It runs the Scenario procedure of `docs/agents/agent-brief.md` once for each scenario and adds what a cycle needs around it. The orchestrator's own rules, with the model of each agent, are in `.claude/agents/orchestrator.md`.

## Plan the cycle

Before any scenario, the orchestrator writes `.agent/handoff/cycle-plan.md` (not committed) and gives it to the user in its first report. It does not wait for an answer.

- **What exists.** Which of the cycle's scenarios, encounter sets, player cards and campaign cards are in `data/`, from `data/scenarios/`, `src/campaign/playable.ts` and `scripts/data/cycle-defs.ts`.
- **The order.** The cycle's own order. A later part reads the earlier part's final state.
- **One family for the cycle.** The cycle's verbs, triggers and flags go in one mechanic family of its own. For each scenario the plan names its new system (hidden cards, a controlled location, a second active location) and the hook that the system needs in shared engine code. A shared mechanic is built once, in the first scenario that needs it.
- **Shared reading changes.** A reading that changes what the cards of other scenarios do is not part of a scenario. It lands as its own pull request, with its own review, before the scenario that needs it.
- **User rulings.** `pnpm doc rulings "<words>"` for the cycle's cards and mechanics. Each goes into the briefs that touch it.
- **Risks.** Mechanics the engine lacks, scans that may be hard to read, scenarios that need a new table widget.
- **Open items.** The cycle creates no issue and adds no checklist line (`.claude/rules/docs-standards.md`, `docs/phases/STATUS.md`). An item the run finds is fixed in the task that finds it, or in the cycle's fix task before the pull request.
- **Fan-made.** The publisher is declared with a licence (`docs/brief.md`, Fan-made content), or the orchestrator stops and asks the user.
- **Nightmare decks** are not part of the run. They are a closing pass that starts when the user asks.

## Data, once for the cycle

One `implementer` task on `repo/<cycle-slug>-data`, with its own pull request, merged before the first scenario starts.

- `pnpm data sync` for the cycle's sources, `pnpm data build`, then `pnpm data sync scans pictures`. Quest card backs need a picture too.
- The cycle's booklet and inserts as rule spans, and its errata as errata spans. A keyword of the booklet that every scenario needs is built here.
- `pnpm data ledger-seed <scenario-id>` for each scenario and for the cycle's player cards, then each line read against its scan with `readBy` set.
- Exit: `pnpm data check`, `pnpm test fast`, `pnpm lint`, `pnpm typecheck`.

## Design of a new system

The Read task of a scenario whose plan names a new system hands back the system's design with its mechanics, and the orchestrator checks it before it briefs the Build. No code exists yet, so a wrong design costs minutes.

The design names: the verbs, triggers and flags, each in the cycle's family; every line that the system adds to shared engine code (`src/rules` and `src/catalog` outside the family folders), as one call into a family hook that does nothing unless a flag of the cycle is held; the cards of other scenarios that the hook can reach; and the files at the file-size limit that it must not grow (`scripts/checks/file-size.test.ts`). A general guard in shared code, or a condition on a fact that only one scenario has, goes back to the Read task.

`scripts/checks/shared-engine.test.ts` holds the same rule on the finished branch: the lines a branch adds to shared engine code stay at or under its limit unless a commit that adds them gives the reason after `Shared engine:`.

## What each task is held to

Beyond what the Scenario procedure says:

- **Build.** A function that sets a card aside is listed in `scripts/checks/set-aside-sites.ts`.
- **Judge.** A CHECK with no row is a defect of the judge's output: it goes back.
- **Tests.** Each line is tested on its real moment (`docs/agents/card-audit.md`, Tests from the printed line).
- **Words.** Every choice names its result, from the first scenario on.
- **Games.** Where the simple test player cannot win, the task writes a policy for the scenario. Its moments for the new table widgets follow the Scenario procedure (`docs/agents/agent-brief.md`, Scenario procedure, Games task). A state only a played game reaches is shot with `pnpm browser shot --fixture <name> --at <n>`. The report names each new screen that was checked by tests only.
- **Review.** One round on the scenario's whole diff from its base. The brief asks the reviewer to look hardest at the cards of other scenarios that a shared change reaches, an offer and a refusal that disagree, an ability that is now withheld wrongly, and the stated cause of each moved saved game.
- **Fix.** A fix that changes shared engine code gets its second review (`.claude/agents/orchestrator.md`, One review round).
- **Times.** Every brief of a writing task asks for its times from `pnpm scenario time` (`docs/agents/agent-brief.md`, Measure), not an estimate.

How many agents work at one time is in `docs/agents/card-audit.md` (Running it). A container restart loses a run that is not pushed, so each agent writes its hand-off note before a long run.

## Land each scenario

Before a scenario's pull request, on its final tree:

- `pnpm test encounter <id> --minutes=15`, alone. A scenario in which the soak's player won no game is named in the report.
- The full exit, then `pnpm game moved origin/main`. That command lists only saved games whose file was written again; one that would move and was not shows as a failure in the test run. Each moved game of an older scenario has its block in a commit body and the same result as before.
- `pnpm commit:check --range origin/main..HEAD`.
- The readings are in the scenario's file, each with its mark and source.

The orchestrator opens the pull request, subscribes to it and fixes a failed check. It does not merge. When `main` moved and the pull request is not mergeable, it merges `main` in, waits for CI and tells the user. After such a merge a fixture can refuse an intent, because the engine offers no ability that changes nothing: find the intent with `pnpm game show <fixture> --legal`, prove from the printed line that it did nothing, and write the file again with the cause in the commit body.

## Working ahead on a stacked branch

The orchestrator does not wait for the user's merge. When the pull request of scenario N is open and green, scenario N+1 starts on a branch that starts from the branch of N.

- At most two scenarios ahead of `main`, and one when another cycle runs. The data pull request is never stacked.
- The stacked pull request has `main` as its base. Its description says first which pull request it starts from. Until that one merges, the description holds its commit messages too, under its number; after the merge of `main` below, only its own.
- A change to scenario N after N+1 started is made on the branch of N and merged into the branch of N+1, never rebased. If it moved a saved game of N, the Games exit of N+1 runs again.
- When the pull request of N merges, `main` holds its files in one new commit. If `git diff --quiet origin/main <branch of N>` exits 0, merge with `git merge -s ours origin/main`: the branch of N+1 already holds everything. If it differs, merge normally; for a file in conflict keep the copy of N+1 where `main`'s copy equals the copy of N, and merge both sides by hand where it does not. A saved-game file always takes the game of `main`.
- `-s ours` discards the other side. It is never used without that check.

## Two cycles at one time

Two sessions share only `main`. The user names the shared engine code that each cycle owns; a session reports a fault in the other's code and does not change it, and it stops before a change to shared code that neither owns.

- The second cycle's data phase starts when the first one's data pull request is merged.
- Before each pull request and after each merge of the other cycle, a session merges `main` and runs the Games exit of each of its scenarios that is not merged. A saved game that moved because of the other cycle is written again, with its result proved and the other cycle's commit named as the cause.
- Generated files conflict on every merge. Take either side and make them again: `pnpm data build`, `pnpm effects open`, `pnpm assets catalog`, `pnpm effects render --all --out scripts/data/effects/render/snapshots`, `pnpm doc index`. In `src/campaign/playable.ts`, the registries and the engine notes of `src/rules/engine/version.ts`, keep both sides' entries.
- The session that ends first sends the other a note of what it changed that reaches it.

## Close the cycle

- A soak over all the cycle's scenarios: `pnpm test encounter <ids> --minutes=15`, alone.
- The coverage checks: `scripts/checks/line-coverage.test.ts`, `record-readings.test.ts`, `rulings.test.ts` and `scripts/data/errata.test.ts`. No exception list grew without a reason beside each entry.
- **The audit sample.** Two scenarios of the cycle, an early one and a late one with a new system, are audited as `docs/agents/card-audit.md` says, by test writers that did not build them and do not read their tests. The faults found for each scenario are the cycle's fault rate: it goes in the final report and in the body of the commit that fixes them, after `Measure:`.
- The measures: `pnpm scenario measures <ids>` puts every scenario's `Pipeline measure:` line side by side. For each finding class that came up more than once, add a check, a template or a line in Readings the review catches (`docs/agents/effect-authoring.md`).

## When the orchestrator asks the user

Only for these; everything else it decides and reports.

- A scan cannot be read.
- A fix must change a behaviour that a user ruling settled.
- A fan-made publisher has no recorded licence.
- A scenario cannot be made playable without a change to behaviour that players of other scenarios see.
- The change is in code that another cycle owns, or in a file that a rule or a hook protects from agents. It reports the line it would change and does not build around it in silence.
