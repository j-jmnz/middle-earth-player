# Plan: cheaper scenarios, same engine

## Context

Adding a scenario costs far more than the scenario's own judgement: reading its cards, writing records for lines no other card shares, choosing its intents and expectations. The rest is repeated by hand each time:

- **Effects.** The scenario templates (`scripts/data/effects/*-templates.ts`) own almost only Fellowship lines; every later scenario's lines are authored. Many authored lines share their text, once normalized, with a line already owned on another card, and are still written again. `pnpm effects:draft` ranks "similar" records by word overlap with the whole card, so it misses a line that is word for word another card's line.
- **Tests and fixtures.** Each scenario folder copies most of its scene, game, golden test, campaign test, seed finder and Maestro flows from the previous scenario and renames them.
- **Registration.** `src/effects/index.ts`, `src/campaign/fixtures.ts`, the list repeated in `src/campaign/standalone.test.ts`, `scripts/e2e/fixtures.ts`, the per-scenario block of `src/campaign/fixtures.test.ts` and the campaign order in `src/campaign/path.test.ts` are kept by hand. `causes.test.ts` and `replay.test.ts` do not read every scenario's goldens.
- **Families.** A family is listed by hand in three index files, and the core calls family internals by name (the settle chain in `src/rules/engine/machine.ts`, conditions, picks, travel). Nothing checks that a declared verb has a runner; a missing one fails at run time as an unimplemented instruction.
- **Data.** The printed-text ledger is typed whole by hand. Most `scenarioPiles` overrides quote a Setup sentence the Setup parser already reads. `XP_ROWS` in `src/campaign/xp.ts` copies the MEC111 log sheet into code.

The goal is a smaller diff per scenario, with the same engine.

## What does not move

Every section keeps these. A task that cannot keep one stops and reports.

- Every `golden.json` and every committed fixture is byte-identical. `src/rules/engine/version.ts` is unchanged.
- `src/effects/open-lines.ts` is unchanged, except in section A, where only lines of the scenarios not yet playable may close.
- A generated record that takes over an authored one has the same id and is deep-equal to it. Any other overlap is narrowed or listed in `REPLACES` with its reason.
- The scans, the ledger and the rule spans stay the authority (`.cursor/rules/authority.mdc`). Nothing seeded or copied ships unread.
- Seeds, intents and policies stay as they are. A shared helper may move code; it may not change what a game does.

## A. Effects: draft better, template the repeats, copy identical lines

1. `scripts/data/effects/draft.ts`
   - For each open line, first look for a ledger line elsewhere with the same text, normalized as `scripts/data/effects/generate.ts` normalizes it (the card's name as `{self}`, numbers kept). Print the records that own it, verbatim.
   - Otherwise list the nearest records for that line, not for the whole card.
   - Print the id the record should take, from the numbering `generate.ts` uses.
   - Write the vocabulary list once, to a shared file under `.agent/drafts/`, and link it from each draft instead of repeating it.
2. **Copying a line's records.** Generalize `src/effects/authored/reprint.ts` so a card can take the records of another card's line with identical ledger text, rekeyed to its own line ids and numbering. Then move the hand-numbered builders (`eliminated`, `lostIsland`, the Campaign Expansion reprint pairs) onto it.
3. **Constant-line numbering stays.** `generate.ts` reserves a number for a labelled line no template reads, but not for an unlabelled constant line; reserving one would renumber generated player-pool and Fellowship records. A new constant template that takes an authored record's id fails `scripts/checks/effect-coverage.test.ts` (the replacements must equal `REPLACES`), so the migration check (item 5) finds it.
4. **Templates for sentences that repeat across scenarios**, in this order:
   - Campaign-card XP bullets: N XP for each surviving player; −N XP if Ominous Fate is in the victory display; N XP if a named card is in the victory display; each surviving player's threat is N or less. Settle on one record shape for "is in the victory display" first.
   - Shadow "Attacking enemy gets +N Attack (+M instead if …)" for the conditions the authored records already use, and a Shadow line of several sentences read sentence by sentence.
   - "Cannot have [player card] attachments." (settle on one shape first).
   - "If ~ leaves play, the players lose", "If ~ is destroyed, its controller is eliminated", "When ~ leaves play, remove it from the game".
   - Travel costs: reveal the top card of the encounter deck; search the encounter deck and discard pile for a Trait enemy; exhaust a named card.
   - "While ~ is in the staging area, it gains: "…"": unwrap the quote, read the inner sentence with the existing templates, and add the `sourceIn` condition.
5. **Migration check.** A test or script under `scripts/checks/` lists every authored record whose id and lines a template now writes. An authored record is deleted only when the generated record is deep-equal to it.

Exit: the plan's checks (Verification), the migration check clean, and `node --experimental-strip-types scripts/card-smoke/run.ts --all` green.

## B. One registry for scenarios, fixtures and goldens

- `src/campaign/fixtures/` gets one const registry of `{ scenarioId, names }`. `FixtureName`, `FIXTURE_NAMES` and `STORED` in `src/campaign/fixtures.ts` derive from it. So do the writers in `scripts/e2e/fixtures.ts`, in the campaign's order from `data/campaigns/<id>.json`, and one `describe.each` in `src/campaign/fixtures.test.ts`. The comment lists of fixture names in `src/screens/routes/e2e/[fixture].tsx` point to the registry instead.
- `pnpm data:build` writes the barrel of authored effect files (Metro cannot glob). `src/effects/index.ts` imports it. The coverage test fails when the barrel is stale.
- `src/campaign/standalone.test.ts` stops repeating `PLAYABLE_SCENARIOS`; `scripts/checks/effect-coverage.test.ts` keeps the list honest. `src/campaign/path.test.ts` reads the campaign order from `data/campaigns`.
- A golden registry lists every scenario's goldens. `causes.test.ts` and `replay.test.ts` read it, so every scenario's games are checked there.

Exit: the plan's checks (Verification). Adding a fixture name is one registry line.

## C. A shared scenario kit and `pnpm scenario:new`

- Move the scene helpers repeated across the Dream-chaser scenes into `test/harness/`: id lookups, `answer`, `finish`, `resolveRecords`, the fight helper, the phase, mode and window mapping, the stand-in cards and the filler effects. No scene imports another scenario's scene.
- `test/harness/game-kit.ts` gets a campaign game factory: world, plan, start, the earlier parts' log (from the campaign order and the earlier part's golden), and `playGolden`. A scenario passes its id, extra codes, intent policy and goldens.
- A golden suite helper holds the snapshot test, the cause test, the won loop (XP, the next part on the campaign path) and the lost loop. A scenario passes its opening assertions, its expected XP and its own checks.
- `scripts/e2e/seed-kit.ts` gets `play`, `firstSeed` and the earlier part's won log.
- Maestro: one win subflow and one loss subflow under `.maestro/`, run with `runFlow` and `env` (the fixture, the scenario id, an optional choice id). Each scenario's flows call them and keep their own extra assertions.
- `pnpm scenario:new <scenario-id>` (with `--dry-run`) writes the skeletons and the registry entries: the scene with its codes read from `data/scenarios/<id>.json`, the game, the golden test, the campaign test, the seed finder, both Maestro flows, `src/effects/authored/<id>.ts`, and the line in the fixture registry. It refuses an id that is not in `data/scenarios`.
- Move every existing scenario onto the kit, one campaign at a time, with the goldens byte-identical after each step.
- `docs/handover/agent-brief.md`, `docs/phases/phase-12-knife-in-the-dark.md` (Scenario procedure), the phase files 46 to 48 and `.claude/agents/effect-author.md` name the scaffold and the kit. The family list in the effect-author file points to `src/catalog/families/index.ts` instead of copying it.

Exit: the plan's checks (Verification), and `pnpm scenario:new the-drowned-ruins --dry-run` lists the files and the entries it would write.

## D. One manifest per family

- Each catalog family exports one manifest (verbs, triggers, flags), and each rules family exports one (its runner and hooks). The hooks are settle, travel, pick, condition and amount: the places where the core calls a family by name. One ordered list in each index collects them. The order is written in that list, so play stays deterministic.
- A test fails when a verb in `FAMILY_VERBS` has no runner, or a runner answers a verb no family declares.
- Move the core's direct family calls behind the hooks one file at a time, with the goldens byte-identical after each. Card codes the core or the table reads by number (the Burn in `src/rules/interpret/conditions.ts`, Change of Plans in the settle loop, the torch and axe in `src/play/words/aflame.ts`) become family flags where a printed line names the behaviour.
- The verb allowlists in `src/campaign/start.ts` become a flag on each verb's schema entry.

Exit: the plan's checks (Verification).

## E. Data: seed what can be seeded

- `pnpm ledger:seed <scenario-id>` writes the missing ledger entries from the source text, with `readBy` empty and the pinned scan named. The coverage test refuses a card of a playable scenario whose ledger entry has no `readBy`. So every seeded line is still read against its scan before the scenario is playable.
- When a Setup clause the parser reads places a card that the load list put elsewhere, the build moves the card itself and reports the move in `--verbose`. Drop each `scenarioPiles` override that becomes redundant. Count and Easy overrides stay as they are.
- `XP_ROWS` moves into `data/campaigns/dream-chaser.json`, built from the MEC111 log sheet. `src/campaign/xp.ts` reads it there.

Exit: the plan's checks (Verification), and `pnpm data:check` shows no difference except the moved XP rows.

## F. Faster feedback while authoring

- `pnpm test:scenario <scenario-id>` runs the scenario's test folders, its goldens, the coverage test and card-smoke on its player codes, and the pool and family tests when those changed. The full `pnpm test` stays the gate before a commit and in CI.

Not built: a search-based win finder for the missing won fixtures (`docs/phases/STATUS.md`, Fixtures and Maestro).

## Order

A, B and C come before phase 46 starts, so phase 46 is the first scenario built on them. D, E and F follow. Sections run one at a time with `orchestrator`, one review round (`.cursor/agents/orchestrator.md`, One review round).

## Verification

After each section:

- `pnpm data:build`, `pnpm data:check`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm docs:index`.
- `git diff --stat` shows no change under `src/campaign/scenarios/*/golden.json` or `src/campaign/fixtures/*.json`, and none to `src/rules/engine/version.ts`.
- `pnpm effects:open` leaves `src/effects/open-lines.ts` as the section allows (What does not move).
