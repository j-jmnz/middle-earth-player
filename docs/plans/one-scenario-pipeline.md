# Plan: one scenario pipeline

## Context

The A/B on The Uruk-hai compared the fast track with the classic Scenario procedure. It is over, and there will be no more A/B tests (user decision, 2026-11-08). The two tracks merge into one pipeline that keeps the fastest parts of each. The evidence is in `reports/ab-uruk-hai-analysis.md`; what it concluded:

- **Waiting, not writing, took the time.** Each arm waited on test runs for about as long as it spent authoring: 60 minutes against 47 on the fast arm, 55 against 52 on the classic. Each arm ran the full `pnpm test` four times, at 8 to 13 minutes a run. `pnpm test:scenario` takes about half a minute, and `--quick` saves seconds.
- **The classic arm already used the fast track's biggest gain.** Its words-and-goldens task wrote its words as an asks file and took 35 minutes, against a median of 60 for the same task in the eight classic phases before it. Both arms beat those phases' median of 165 minutes.
- **The fix pass lost the race to one extra full run.** A reviewer asked for a split of `src/play/words/choice.ts`. The split pushed the folder over the 40-file limit (`scripts/checks/layout.test.ts`), which only the full suite runs.
- **The fast track's own parts paid off where they were used.** The reading judge and the Read pass's FAQ check won two of the three cross-check readings. The spec rows covered half the lines, and the review asked for tests on the rest. The renderer misstated two correct records, and the fix had to take scenario prose back out of its shared templates. The author pack was read once; Build read the source files instead.

Each track gives the merged pipeline these parts:

| From the fast track | From the classic procedure |
| --- | --- |
| A Read pass that asks the rulings before any engine work, with the FAQ check | The data cross-check (`docs/handover/agent-brief.md`, Scenario procedure, step 1) |
| `pnpm effects:render` and the `reading-judge` between records and tests | A new verb as family engine work with its own test (step 3) |
| Spec rows (`test/harness/card-spec.ts`) and no scene file | A zone or widget only when a card creates it, cited in `docs/brief.md` (step 4), now a Table step |
| The asks file for every choice's words | The campaign test continues the campaign (step 6) |
| The encounter smoke in `pnpm test:scenario` | A fresh agent for each task |

## Base and landing

- The work runs on a branch from `claude/uruk-hai-fast-track-analysis-nmnawq`. That branch carries `ccr-dce79bf0-2c47oi`: the Two Towers data and campaign shell, and the fast-track tools. None of them is on `main` yet.
- `orchestrator` runs the sections in order (`.claude/agents/orchestrator.md`): one implementer task per section, then one review round at the end.
- Each section is one commit, typed by `.claude/rules/commit-standards.md`. The branch lands on `main` squashed (`.claude/rules/release-standards.md`, Branches).

## Sections

### 1. Land The Uruk-hai

`feat`.

- **Bring in the fast arm.** Run `git merge --squash origin/ab/the-uruk-hai-fast`. Its base `7137f44` is an ancestor of this branch, and the branch since then has changed only docs. If `docs/INDEX.md` conflicts, regenerate it with `pnpm docs:index`.
- **Port two fixes from `origin/ab/the-uruk-hai-classic`** (commits `b455b44` and `72cc7a6`):
  - The Captives are rescued when the last stage is defeated, before the Resolution opens (143070:B:3). Each goes back among its owner's heroes, controlled again, with its text no longer blank. The score and the log (fallen heroes, hero lists) still read right.
  - User ruling C1: a Skill boon (143015 to 143018) attaches only to a hero with its trait, also at the Resolution (143071:B:1). This goes in the Resolution's hero pick (`src/rules/families/campaign/resolution.ts`, `src/rules/interpret/pick.ts`).
  - With both, the test that a seat whose only Warrior is its Captive wins and is offered Intimidation on that hero (`src/campaign/two-towers-resolution.test.ts` on the classic branch).
- **Rulings.** Write C1 to C3 into `docs/brief.md`, The Two Towers, as the classic branch words them.
- **What may move.** Only The Uruk-hai's own golden may move. No other scenario's golden, fixture or `data/` file does.
- **`docs/phases/STATUS.md`.**
  - Add a phase row for The Uruk-hai.
  - Delete the open line "The Uruk-hai: its quest card's captive step … not built".
  - Add these open items: `hai-won` not found; the six older records with `shadow: false` on a printed additional attack (18035:A:2 and its copies) against `faq.additional-attacks`; the readings the user has not confirmed (J1, and the score of a Captive whose owner was eliminated).
- **Measure.** The three cross-check lines of `reports/ab-uruk-hai-analysis.md` (143069:B:2, 143031:A:2, 143070:B:3) all read the printed way. `pnpm test:scenario the-uruk-hai` is green.

### 2. Room under the limits

`refactor`.

- After section 1, `src/play/words` holds 40 source files, and `src/screens/table/view.tsx` is at its cap in `scripts/checks/file-size.test.ts`.
- Move the per-scenario words modules of `src/play/words` (the files named for a scenario's mechanics, such as `fate.ts`) into a subfolder with `pnpm move`.
- Split `view.tsx` along its layout-planning hook, and delete its entry in the over-limit list.
- Split along behaviour any other hand-written file within 20 lines of 500 (`.claude/rules/code-standards.md`, Making a change).
- **Measure.** The next scenario meets no file-size or layout failure and no review finding of that class.

### 3. One full suite per scenario

`repo`.

- **`pnpm test:scenario` runs the checks that failed late.** Add `scripts/checks/layout.test.ts`, `scripts/docs/index.test.ts` and `scripts/checks/maestro.test.ts` to `COVERAGE_TESTS` in `scripts/tools/test-scenario.ts`, and update the pinned list in `scripts/tools/test-scenario.test.ts`. Each one only scans files.
- **Writing tasks end without a full run.** Each ends on `pnpm test:fast`, `pnpm test:scenario <id>`, `pnpm data:check`, `pnpm lint` and `pnpm typecheck`.
- **The fix task runs the one full `pnpm test`.** The Closing check in `.claude/agents/orchestrator.md` already accepts a green full run on the final tree.
- **Where the rule lives.** It is said once, in `.claude/agents/orchestrator.md` (Implementer tasks and After each task), and the agent files point to it.
- **Long runs.** A run that can pass Bash's ten-minute limit goes to the background and is polled. Give the writer agents `Monitor` in their tools where the harness allows it.
- **Measure.** On the next scenario, from the subagents' Bash timestamps:
  - the transcript shows one full run;
  - the waits come to under 20 minutes;
  - no failure is found only by the full run.

### 4. Spec rows that see more

`repo`.

- **New expectations** in `test/harness/card-spec.ts`:

  | Expectation | Reads |
  | --- | --- |
  | `damageOn` | `card.damage` |
  | `handCount` and `drew` | the seat's hand, and the draw steps |
  | `defender` and `attackersOf` | `declaredDefenders` (`src/rules/families/defense/defenders.ts`) and the strike's attackers; `Done` carries `fightEnemy`'s `during` state |
  | `refused` | a cancel step |
  | `counter` | a scenario value read through a named reader (pursuit, life) |
  | `heldBy` | a card in the captive zone and its host |

- **New acts:**
  - `defend(with)`, through `fightEnemy`'s defender option;
  - `respond(code)` and `cancel`, through `send` and `legalIntents` (`test/harness/scene-kit.ts`).
- **A `seat`** on the layout entries (`test/harness/layout.ts`) and on the expectations, so two-handed rows read the right player.
- **A coverage check.** Every line a scenario's records name has a row, or a test whose name starts with the line id. A test file's header can then not claim a line it does not test.
- **Tests and The Uruk-hai.** The new kinds are tested in `test/harness/card-spec.test.ts`. The Uruk-hai's `src/campaign/scenarios/the-uruk-hai/verbs.test.ts` cases move to rows where a row now fits them.
- **Measure.** On the next scenario, rows cover two thirds of its record lines or more, and the review finds fewer than 3 lines with no behaviour test.

### 5. Renderer and judge

`repo`.

- **Every template reads what it claims.** `scripts/data/effects/render/read-fields.test.ts` covers the verb templates today. Extend it to the condition, pick and amount templates.
- **`pnpm effects:render --all`** renders every playable scenario. A test compares each with a committed snapshot, so a shared-template change shows its diff on every scenario at once. Measure the snapshots' size first; above about 2 MB, commit a hash for each scenario and let `--all --out` write the text for the diff.
- **No scenario prose in a shared template.** A template's words come from the record's fields.
- **`.claude/agents/reading-judge.md` gets a fourth status, `render-gap`:** the record may be right, but the English cannot show it. It stays apart from `ambiguous`, which means two readings of the card. The orchestrator files a render gap as a renderer open item and does not send it to the author.
- **Measure.** On the next scenario:
  - the judge's `wrong` rows contain no render bug;
  - the review has no renderer finding;
  - fewer than 5 rows are `ambiguous`.

### 6. A smaller pack

`repo`.

- In `scripts/tools/author-pack.ts` (`renderPack`), take each draft's "Rules text that mentions its terms" spans out of the drafts. Print each span once, above them. The drafts repeat most of these spans; on The Uruk-hai that is 34 KB of 49 KB.
- After the cookbook, add a short list of the engine files of the families the drafts' nearest records use. The author reads those files rather than searching for them.
- Tests go in `scripts/tools/author-pack.test.ts`.
- **Measure.** The pack's size, and the share of the Build task's reads that go to the pack or to the files it lists.

### 7. The one pipeline

`repo`.

**The procedure.** Rewrite `docs/handover/agent-brief.md`, Scenario procedure, as the one way to build a scenario. Keep the headings Scenario procedure and Report: code and docs cite both. The steps:

1. **Read**, by a fresh `scenario-author`.
   - The data cross-check, `pnpm scenario:new <id>`, `pnpm data:build` and `pnpm author:pack <id>`.
   - A readings pass over every draft line, against `docs/plans/effect-authoring.md` (Readings the review catches), with each line's `faq.*` spans checked.
   - It hands back the Readings list and the mechanics that need a verb, trigger or flag. The orchestrator asks the user about the `needs-ruling` readings once, before any engine work.
2. **Build**, by a fresh `scenario-author` handed the Read note and the rulings.
   - Verbs in their families, each with its own test; the records; `pnpm effects:open`; the scenario in `src/campaign/playable.ts`.
   - Then `pnpm effects:render <id> --out .agent/render/<id>.md`.
3. **Judge.** The orchestrator runs `reading-judge` on the render.
4. **Finish**, by a fresh `scenario-author` handed the Build note and the judge's rows. It writes:
   - fixes for every `wrong` line;
   - spec rows, plus tests in `src/campaign/scenarios/<id>/` for what a row cannot express;
   - the asks file, checked with `pnpm test:scenario <id> --words` against `docs/design-system-table.md` (Choice tray);
   - the goldens, the seed finder, the fixtures, the Maestro flows and the campaign test;
   - the Table step, below.
5. **Review.** The round of `.claude/agents/orchestrator.md` (One review round).
6. **Fix**, by an `implementer`, ending with the one full suite (section 3).

**The Table step.** For each tracker, zone or held card a record creates, the table has:
- a readout with its limit, which warms near the limit;
- a held dial for each seat;
- the held card drawn under its host in every zone the host can be in;
- the owner named on each row of a pick that spans seats.

Each is cited in `docs/brief.md`, as step 4 says today.

**The hand-off note** is `.agent/handoff/<id>.md`, not committed. It holds the verbs, flags and conditions added, the files touched and the Readings list. Each task's writer reads it, so a fresh agent does not need the last one's context.

**`pnpm scenario:new` writes one skeleton**, the one `--track fast` writes today: spec rows and an asks file, no scene file.
- Remove `--track` and the `Track` type from `scripts/tools/scenario-new.ts` and `scripts/tools/scenario-new-files.ts`, and rewrite their tests in `scripts/tools/scenario-new.test.ts`.
- Existing scenarios keep their scene files and words modules.

**Agent files.**
- `.claude/agents/scenario-author.md`: one task per run, run fresh, reading the hand-off note.
- `.claude/agents/orchestrator.md`, Implementer tasks: the scenario tasks and the rule of section 3. Models is unchanged.

**`docs/plans/scenario-pipeline.md`.**
- After each scenario phase: the measure records, for each task, its full runs, its wait minutes and its writing minutes.
- Next steps, the win finder: it is the search player, a beam search over legal intents built on `test/harness/auto-player.ts`. It is scored on threat, progress, hero health and stage. It replaces each scenario's policy in `game.ts`.

**Measure.** On the next scenario, Helm's Deep, against `reports/ered-mithrin-phase-times.md` and the tables of `reports/ab-uruk-hai-analysis.md`:
- under 110 minutes of agent time;
- words under 200 lines;
- no reading lost in review against the printed card.

### 8. Cleanup: no more A/B

`repo`.

- **Delete:** `docs/plans/scenario-fast-track.md`, `docs/handover/fast-track.md`, `docs/handover/ab-uruk-hai.md` and `docs/handover/ab-uruk-hai-briefs.md`. `reports/ab-uruk-hai-analysis.md` stays as the evidence.
- **Point every citation of the deleted docs at the doc that owns the behaviour** (`docs/handover/agent-brief.md`, Scenario procedure; `.claude/agents/reading-judge.md`):
  - `scripts/data/effects/render.ts`;
  - `scripts/tools/author-pack.ts`;
  - `scripts/tools/scenario-new-files.ts`;
  - `scripts/tools/test-scenario.ts`.
- **Reword the lines that name a track:**
  - the comment in `src/play/words/asks.test.ts` that calls a scenario with an asks file "on the fast track";
  - in `CLAUDE.md`: the `scenario:new` command, the `author:pack` command and the agents paragraph;
  - the same rows of `README.md`;
  - the line of `docs/handover/agent-brief.md` that sends a fast-track scenario to `docs/handover/fast-track.md`.
- **`docs/phases/STATUS.md`:** a Standing decision, "One scenario pipeline; no more A/B tests (user decision, 2026-11-08)".
- **Branches.** Once section 1 has landed on `main`, the remote branches `ab/the-uruk-hai-fast` and `ab/the-uruk-hai-classic` are deleted, but only when the user confirms it in that session.
- **This plan** is deleted when its last section is done (`.claude/rules/docs-standards.md`, Plans, phases and handovers).
- **Done when:**
  - `git grep -n -i -E "fast track|fast-track|--track|ab-uruk-hai|classic track"` finds nothing outside `reports/`;
  - `pnpm docs:index` reports no unresolved citation.

## Verification

- **After each section:** `pnpm lint`, `pnpm typecheck` and `pnpm test:scenario the-uruk-hai`. After section 3, that run includes the layout, docs-index and Maestro checks.
- **After the last section:** the full `pnpm test` once, `pnpm data:check` and `pnpm docs:index`.
- **The skeleton:** `pnpm scenario:new helms-deep --dry-run` lists the one skeleton, with no scene file.
- **What must not move:** `git diff --stat` against the base shows no change to another scenario's `golden.json` or `src/campaign/fixtures/*.json`, to `src/rules/engine/version.ts`, or to `data/`, except the Two Towers files that section 1 brings in.
