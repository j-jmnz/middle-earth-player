# Plan: a fast track for scenarios, A/B-tested against the classic track

## Context

A scenario phase costs about three and a half hours of agent time (`reports/ered-mithrin-phase-times.md`), and most official scenarios are still to come (README, Roadmap). This plan adds a second way to build a scenario beside the current one (`docs/handover/agent-brief.md`, Scenario procedure), and an A/B test that runs both on the same new scenario (user decision, 2026-11-07: the next new scenario, both arms run fresh). The measures behind it are in the commit that added this plan.

### Where a scenario's time goes

- **The records are the small part.** The authored records, the card judgement itself, are under a tenth of a scenario's diff. The new verbs and family code are about as much again.
- **Hand-written card tests are the largest part of task A.** Each test builds a table, does one action and asserts, and the same helpers are copied from file to file. A scenario writes several lines of test for each line of record.
- **Choice words are the largest part of task B and of the fix pass, and they grow with every scenario.** The generic words compose one instruction at a time, so each scenario writes code that recognises its own record shapes (`src/play/words/fate.ts`), then a gate test so those words do not leak into another game.
- **Card-reading errors are found late.** The review finds them, and a separate fix pass corrects them.
- **Rulings arrive mid-phase**, after the records task, and the session often restarts while it waits.
- **The inner loop is slow.** `pnpm test:scenario` runs the goldens and the reader check on every call.
- **The context is large.** Every agent reads the brief's list and the family manifests before it reads a card.

### What this plan does not change, and why

- **The closed record vocabulary stays.** It is cheap to write, and determinism, replay, coverage and the words test depend on it.
- **No per-card script escape hatch.** A one-off verb already costs one schema entry, one runner case and one test. The real cost of a new mechanic is engine semantics, which a script does not remove, and a script would bypass the words, record-route and verb-set checks.
- **No text parser from printed text to records** (MTG Arena, phase.rs, Ironsmith). It pays off on tens of thousands of tightly templated cards; this game's encounter text is less regular.
- **DragnCards automation is not a source.** It automates a few dozen scenario cards, mostly token bookkeeping.
- **The goldens stay.** They find engine bugs the unit tests miss.

### What other engines do that transfers

- Forge and XMage keep a card's text beside its implementation. XMage also regenerates rules text from the implementation and compares it with the printed text (`VerifyCardDataTest`).
- Netrunner (jinteki.net) and Arkham Horror (halogenandtoast/ArkhamHorror) keep per-card tests short with a terse harness, and describe a scenario's setup declaratively.
- Spellsource fuzzes every card with random mass play.
- phase.rs has a fresh-context agent audit what was written, and rejects a test that would still pass if the change were reverted.

### Expected gain

The fast track removes most of the per-scenario words code, the copied test boilerplate, the late readings and the mid-phase rulings wait. It does not shrink the engine work a new mechanic needs. The A/B measures the gain; the plan does not assume it.

## The fast track

Every part is additive. No existing scenario, golden, fixture, `src/rules/engine/version.ts` or `src/effects/open-lines.ts` changes, and no existing scenario moves onto the fast track during the trial. A scenario picks its track when it is scaffolded: `pnpm scenario:new <id> --track fast`. Without the flag, the skeletons are today's.

### F1. Choice words as data beside the record

- **A file per scenario, `src/play/words/asks/<scenario-id>.ts`, exports `ASKS`.** Each entry is keyed as the words allowlist is keyed: `<record id> @<instruction path> <verb | option id>` (`src/play/words/scenario-words.test.ts`, `test/harness/record-walk.ts`). An entry holds:
  - `note` and `labels` templates, with placeholders such as `{card}`, `{owner}`, `{n}` and named bindings;
  - `bind`, mapping each binding name to an existing `Amount` expression, read with `resolveAmount` (`src/rules/interpret/amounts.ts`), so a live "X of N" needs no new code;
  - optionally `why`, the reason the window opened;
  - optionally `caution: { when, text }`, a `Condition` read with the engine's condition reader (`src/rules/interpret/conditions.ts`), for the two-tap warning on an option that loses the game.
- **`src/play/words/asks.ts` reads them.** It comes first in `askWords` (`src/play/words/ask.ts`) and in the banner path. It finds the record by the frame's `effectId` (`src/rules/interpret/effect-frames.ts`), and the instruction's path by the walk `record-walk.ts` does. With no entry, today's chain runs unchanged.
- **`pnpm data:build` writes the barrel of asks files**, as `scripts/data/effects/barrel.ts` does for authored effects.
- **The words test, for a fast-track scenario, checks that:**
  - every Pick and Choose has an asks entry, or words that are neither bare nor the fallback;
  - every asks key names a real record path;
  - every template renders with no placeholder left;
  - `WORDS_DUMP=<id>` prints each rendered sentence, for checking against the Choice tray rules (`docs/design-system-table.md`, Choice tray).
- **No gate tests.** An entry is keyed by its record, so it cannot leak into another scenario.
- **Docs:** `docs/design-system-table.md` (Choice tray) and `docs/architecture.md` (Screens) each say what an asks entry is.

### F2. Each record rendered as English and read fresh

- **`pnpm effects:render <scenario-id | codes>` (`scripts/data/effects/render.ts`)** prints each record as plain English beside the ledger lines it names.
  - There is one small template per verb, condition, trigger, timing, pick field and amount. Anything without one prints as compact JSON, so the renderer can grow a verb at a time.
  - It reuses the phrase builders in `src/play/words/choice.ts` where they fit.
  - It is a reading aid, not an exact-match gate.
- **A new agent, `.claude/agents/reading-judge.md`, runs on Opus with a fresh context and reads only.**
  - It is given the render, the ledger, `docs/plans/effect-authoring.md` (Readings the review catches) and the rule spans the records cite.
  - It returns `ok`, `wrong` (naming the clause) or `ambiguous` for each line, and lists the readings that need a ruling.
  - It runs as soon as the records are written, before tests or goldens. The author fixes every `wrong` before going on.

### F3. Card behaviour as spec rows

- **`test/harness/card-spec.ts` provides `cardSpecs(scenarioId, rows)`.** A row is `{ line, layout, act, expect }`:
  - `layout`: cards by zone and seat, with tokens;
  - `act`: `resolve(code, timing)`, `quest(success | fail)`, `attack(enemy)`, `reveal(code)`, `travel(code)`, `endRound` or `answer(id)`;
  - `expect`: `stat`, `flag`, `zone`, `progressOn`, `resourcesOn`, `lost`, `won`, `frame` or `offers`.
- **It is built on `test/harness/scene-kit.ts`** (`resolveRecords`, `answer`, `finish`, the fight helper) and the families' fixture helpers.
- **A generic `tableFromLayout` in `scene-kit.ts` reads the scenario's codes from `data/scenarios/<id>.json`**, so a fast-track scenario has no `scene.ts`. Scenario zones (a quest deck, a second deck, attachments, committed characters) are builder options.
- **A row must fail when its record is gone.** `cardSpecs` runs each row a second time with the records of the row's line removed, and fails a row that still passes.
- **What a fast-track scenario tests:**
  - one row for each record whose behaviour needs a game moment;
  - full test files only for new verbs (family tests, as today) and for multi-step mechanics a row cannot express.

### F4. Encounter-card smoke

This replaces next step 4 of `docs/plans/scenario-pipeline.md` (Next steps).

- **`scripts/card-smoke/encounter.ts` plays every encounter-side card in a seeded scene.** It:
  - reveals each encounter card the scenario deals;
  - resolves each card's Shadow in an attack;
  - travels to each location;
  - runs each quest card's Setup.

  It reports any throw, refusal or stall, as `scripts/card-smoke/run.ts` does for player cards.
- **It also plays a few dozen seeded games with random legal intents.** Each game must end without a throw or a stall, and must replay to the same state.
- **`pnpm test:scenario` runs it on both tracks.**

### F5. One author, a small context pack, rulings first, a quick loop

- **A new agent, `.claude/agents/scenario-author.md`, runs on Sonnet (`.claude/agents/orchestrator.md`, Models).** One agent file covers the whole scenario. A subagent cannot start agents of its own, so the orchestrator runs it as three tasks and runs the reading judge between them:
  1. **Read.** Scaffold, drafts and a readings pass. It hands back every reading that needs a ruling, before any engine work, and the orchestrator asks the user once.
  2. **Build.** Verbs and records with the rulings applied, then `pnpm effects:render`. The orchestrator then runs `reading-judge` on the render.
  3. **Finish.** It fixes every line the judge called `wrong`, then writes the spec rows, the asks and the goldens.
- **The review round is the one `.claude/agents/orchestrator.md` describes (One review round)**, so the A/B compares like with like.
- **`pnpm author:pack <scenario-id>` (`scripts/tools/author-pack.ts`) writes `.agent/pack/<id>.md`, which is not committed.** It holds:
  - the vocabulary file;
  - the family manifests that the drafts' nearest records use;
  - the sections of `docs/plans/effect-authoring.md` those verbs need;
  - the drafts.

  The fast-track brief reads the pack in place of the full list.
- **`pnpm test:scenario <id> --quick` skips the goldens and the reader check while authoring.** The full `test:scenario` runs once before the hand-back.
- **`docs/handover/fast-track.md` is the procedure**, one page that points to the docs that own each rule. `docs/handover/agent-brief.md` points to it in one line.

### F6. A search player for the goldens

Not built. Build it only if the A/B shows that the goldens' intent policy is a large part of the fast arm's time.

It is a generic beam search over legal intents, built on `test/harness/auto-player.ts` and scored on threat, progress, hero health and stage. It would replace the per-scenario policy in `game.ts` and find the won fixtures (`docs/phases/STATUS.md`, Fixtures and Maestro). It is also next step 5 of `docs/plans/scenario-pipeline.md` (Next steps).

## Order

**Build the fast track.** Each step runs with `orchestrator` and one review round (`.claude/agents/orchestrator.md`, One review round).

1. **F4.** Both arms use it, and it depends on nothing else.
2. **F3.** Prove it with a scratch test, not committed, that writes rows for ten lines of `the-fate-of-wilderland` and shows the record-removed run failing.
3. **F2.** Prove it by rendering `the-fate-of-wilderland`, putting one of its review-found misreadings back in a scratch copy, and showing the judge flag it.
4. **F1.** Prove it with scratch asks for three of `the-fate-of-wilderland`'s choices that render the sentences `src/play/choice/fate-sheets.test.ts` pins.
5. **F5.** `scenario:new --track fast`, `author:pack`, `test:scenario --quick`, the two agent files and `docs/handover/fast-track.md`.

**Shared prerequisite.** The Two Towers data and campaign shell, on the classic procedure. No plan for them exists yet:

1. A planning task writes `docs/plans/the-two-towers.md`, with a data phase and a campaign-shell phase. The analogues are the Ered Mithrin and Dream-chaser data and shell phases (`git show 86279f3^:docs/phases/done/phase-49-ered-mithrin-data.md`, and `phase-50-ered-mithrin-campaign-shell.md`, `phase-37-dream-chaser-data.md` and `phase-38-dream-chaser-campaign-shell.md` from the same commit). The Two Towers continues the Fellowship of the Ring saga campaign (`docs/brief.md`, Campaign), so the shell carries the Fellowship log over. The user approves the plan before any of it is built.
2. The data phase. It ends with:
   - the ledger read from the scans;
   - `data/scenarios/the-uruk-hai.json` and the other Two Towers scenarios;
   - the campaign cards;
   - the campaign entry in `data/campaigns`.
3. The campaign-shell phase.

**Then run the A/B.**

## The A/B: The Uruk-hai, both arms fresh

### Arms

- Both arms start from the same commit: the one after the fast track and the Two Towers data and shell, on `main` if they are merged by then, and on their work branch otherwise.
- **Classic arm:** branch `ab/the-uruk-hai-classic`, run by `orchestrator` on the Scenario procedure.
- **Fast arm:** branch `ab/the-uruk-hai-fast`, run by `orchestrator` as the three `scenario-author` tasks of F5, on `docs/handover/fast-track.md`.
- The same models write and review in both.
- The arms run one after the other, not side by side, so that machine load does not skew the times. A coin toss picks the first arm, and the result is recorded.

### Rulings

The first arm's rulings go to the user once. The answers are written to `.agent/ab/rulings.md` and handed to the second arm, so the user's wait and any difference in rulings stay out of the comparison.

### Measures

Each arm's last commit has a `Pipeline measure:` block (`docs/plans/scenario-pipeline.md`, After each scenario phase), plus:

- the agent tokens;
- the diff lines by area: records, engine, card tests, harness, goldens, words, fixtures and flows, docs.

### Blind review

One extra `reviewer` and one extra `ux` read each arm's final tree. Both get the same brief, with the arms named "arm 1" and "arm 2". Their findings are counted by class: reading, engine, test gap, words, file size, screen.

### Cross-check

Each arm's `src/effects/authored/the-uruk-hai.ts` is run against the other arm's tests and spec rows. Every disagreement is settled against the printed line, and counts against the arm that read it wrong.

### Decision

**Adopt the fast track** as the way to build later scenarios if all three hold:

- its time is at most two thirds of the classic arm's;
- the blind review finds no more real findings in it;
- it loses no more cross-check disagreements.

**Otherwise keep the classic track**, with only the parts whose own measures helped.

**Only the better arm merges** to `main`. The other branch stays on the remote. The numbers and the decision go in the merge commit and the report to the user.

## Verification

### After each build step

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm data:check` and `pnpm docs:index` all pass.
- `git diff --stat main` shows no change to:
  - `src/campaign/scenarios/*/golden.json`;
  - `src/campaign/fixtures/*.json`;
  - `src/rules/engine/version.ts`;
  - `src/effects/open-lines.ts`.
- The step's scratch proof (Order) holds.
- Once F4 is built, the encounter smoke is green on every playable scenario.
- `pnpm scenario:new the-uruk-hai --track fast --dry-run` lists the fast skeleton. Without `--track`, it lists today's files.

### The A/B

- Both arms end with `pnpm test`, `lint`, `typecheck` and `data:check` green.
- Both arms end with coverage and their goldens green.
- Then the measures, the blind review and the cross-check are reported to the user.
