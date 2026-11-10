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
- The scans, the ledger and the rule spans stay the authority (`.claude/rules/authority.md`). Nothing seeded or copied ships unread.
- Seeds, intents and policies stay as they are. A shared helper may move code; it may not change what a game does.

## A. Effects: draft better, template the repeats, copy identical lines

1. `scripts/data/effects/draft.ts`
   - For each open line, first look for a ledger line elsewhere with the same text, normalized as `scripts/data/effects/generate.ts` normalizes it (the card's name as `{self}`, numbers kept). Print the records that own it, verbatim.
   - Otherwise list the nearest records for that line, not for the whole card.
   - Print the id the record should take, from the numbering `generate.ts` uses.
   - Write the vocabulary list once, to a shared file under `.agent/drafts/`, and link it from each draft instead of repeating it.
   - Clear the earlier drafts first (all but the vocabulary file), so a bundle holds only the batch asked for.
   - Group the batch's open lines whose text is the same once each card's own name is `{self}`: the draft names one line to write and the copies to take from it (`copyLine`, with the record ids).
   - For a twin owned in another file, print the `copyLine`, the id `withCopies` gives it and the `{ pool: ALIAS }` import (the file is the authored file that exports the twin's record, found by the record; a generated record needs no import; the alias is the file stem's first word that is not "the" or "a", or the whole stem when another file starts with the same word).
2. **Copying a line's records.** Generalize `src/effects/authored/reprint.ts` so a card can take the records of another card's line with identical ledger text, rekeyed to its own line ids and numbering. `src/effects/copies.test.ts` checks every copied pair and refuses a source that names its own card (`docs/plans/effect-authoring.md`, Templates and copied lines). Then move the hand-numbered builders (`eliminated`, `lostIsland`, the Campaign Expansion reprint pairs) onto it.
3. **Constant-line numbering stays.** `generate.ts` reserves a number for a labelled line no template reads, but not for an unlabelled constant line; reserving one would renumber generated player-pool and Fellowship records. A new constant template that takes an authored record's id fails `scripts/checks/effect-coverage.test.ts` (the replacements must equal `REPLACES`), so the migration check (item 5) finds it.
4. **Templates for sentences that repeat across scenarios**, in this order:
   - Campaign-card XP bullets: N XP for each surviving player; −N XP if Ominous Fate is in the victory display; N XP if a named card is in the victory display; each surviving player's threat is N or less. Settle on one record shape for "is in the victory display" first.
   - Shadow "Attacking enemy gets +N Attack (+M instead if …)" for the conditions the authored records already use, and a Shadow line of several sentences read sentence by sentence.
   - "Cannot have [player card] attachments." (settle on one shape first).
   - "If ~ leaves play, the players lose", "When ~ leaves play, remove it from the game".
   - Travel costs: reveal the top card of the encounter deck; search the encounter deck and discard pile for a Trait enemy; exhaust a named card.
   - A constant or triggered template reads a line only when no earlier unread line of that timing comes before it on the card (`unreadBefore` in the template context), so it never takes a number an authored record holds.
   - Stay authored: "If ~ is destroyed, its controller is eliminated" (the records' numbers skip slots a generated record would take) and "While ~ is in the staging area, it gains: "…"" (no template reads any of the quoted sentences).
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
- `test/harness/game-kit.ts` gets a campaign game factory: world, plan, start, the earlier parts' log (from the campaign order and the earlier part's golden), and `playGolden`. A scenario passes its id, extra codes, intent policy and goldens. A scenario with armed ships passes `shipStats` and `shipCodes` (the factory's `world()` applies them).
- `test/harness/next-part.ts` derives the next part's status ("current" or "soon") and the next step ("begin" or "soon") from `src/campaign/playable.ts` and the campaign order. The golden suite asserts them, so making a part playable edits no earlier part's test. `scripts/checks/maestro.test.ts` pins that a flow asserting a part as soon belongs to a part followed by one not playable.
- A golden suite helper holds the snapshot test, the cause test, the won loop (XP, the next part on the campaign path) and the lost loop. A scenario passes its opening assertions, its expected XP and its own checks.
- `scripts/e2e/seed-kit.ts` gets `play`, `firstSeed` and the earlier part's won log.
- Maestro: one win subflow and one loss subflow under `.maestro/`, run with `runFlow` and `env` (the fixture, the scenario id, an optional choice id). Each scenario's flows call them and keep their own extra assertions.
- `pnpm scenario:new <scenario-id>` (with `--dry-run`) writes the skeletons and the registry entries: the scene with its codes read from `data/scenarios/<id>.json`, the game, the golden test, the campaign test, the seed finder, both Maestro flows, `src/effects/authored/<id>.ts`, and the line in the fixture registry. It refuses an id that is not in `data/scenarios`.
- Move every existing scenario onto the kit, one campaign at a time, with the goldens byte-identical after each step.
- `docs/handover/agent-brief.md` (Approach, Scenario procedure) and `.claude/agents/effect-author.md` name the scaffold and the kit. The family list in the effect-author file points to `src/catalog/families/index.ts` instead of copying it.

Exit: the plan's checks (Verification), and `pnpm scenario:new the-drowned-ruins --dry-run` lists the files and the entries it would write.

## D. One manifest per family

Narrowed to what a new family needs (user decision, 2026-11-04):

- Each catalog family exports one manifest (verbs, triggers, flags), and each rules family exports one (its runner and hooks). One ordered list in each index collects them. The order is written in that list, so play stays deterministic. A new family is one file per side and one line in each list.
- The hooks are the places where the core now calls a family by name: settle, travel, pick, condition and amount. The core calls each hook through the ordered list. The settle chain in `src/rules/engine/machine.ts` moves behind the settle hook in this section; the other direct calls move behind their hooks when their family is next changed, with the goldens byte-identical each time.
- A test fails when a verb in `FAMILY_VERBS` has no runner, or a runner answers a verb no family declares.
- The verb allowlists are flags on each verb's schema entry: `src/catalog/verb-flags.ts` marks a schema entry with `setupRole` (`src/campaign/start.ts` deals the verb or resolves it after the quest card's Setup), `runsInFrame` (a Shadow runs the verb in a frame), `setupRuns` (a quest card's Setup runs it, at the top, in each player's turn or in each objective) and `collection` (the verb takes a hero or a card from the collection). `src/catalog/verb-sets.ts` reads the sets off the schema, `shadow.ts`, `quest/setup.ts` and `world.ts` use them, and `verb-sets.test.ts` pins them. A new simple verb is flagged in its family file.
- Not in this section: moving every direct family import behind hooks, and turning the card codes the core or the table reads by number (the Burn in `src/rules/interpret/search.ts`, Change of Plans in the settle loop, the torch and axe in `src/play/words/scenarios/aflame.ts`) into family flags.

Exit: the plan's checks (Verification).

## E. Data: seed what can be seeded

- `pnpm ledger:seed <scenario-id>` writes the missing ledger entries from the source text, with `readBy` empty and the pinned scan named. The coverage test refuses a card of a playable scenario whose ledger entry has no `readBy`. So every seeded line is still read against its scan before the scenario is playable.
- When a Setup clause the parser reads places a card that the load list put elsewhere, the build moves the card itself and reports the move in `--verbose`. Drop each `scenarioPiles` override that becomes redundant. Count and Easy overrides stay as they are.
- `XP_ROWS` moves into `data/campaigns/dream-chaser.json`, built from the MEC111 log sheet. `src/campaign/xp.ts` reads it there.
- `scripts/checks/box-dealt.test.ts` checks the box, per campaign: every card with text of a non-player type, or with a campaign kind, in the packs the campaign's scenarios draw from (Nightmare excluded) is dealt by a scenario or listed with a reason in its exception map. A listed card must be a real undealt card. It is in `COVERAGE_TESTS`.

Exit: the plan's checks (Verification), and `pnpm data:check` shows no difference except the moved XP rows.

## F. Faster feedback while authoring

- `pnpm test:scenario <scenario-id>` runs the scenario's tests, its goldens, the coverage and record-route checks, the file-size check, the rule-id check, every choice-words test, card-smoke on its player codes, the encounter smoke, and the pool, family and manifest tests when those changed. `--words` runs only the words test.
- `scripts/checks/file-size.test.ts` holds the size rule in `.claude/rules/code-standards.md`, Making a change, to every `.ts`/`.tsx` under `src`, `scripts` and `test` that is tracked or new and not ignored.
- `scripts/data/rules.test.ts` reads every rule-id prefix in `data/rules/entries.json`, so a rule id cited in code, docs or tests that names no span fails.
- `src/play/words/scenario-words.test.ts` reads the records of each playable and scaffolded scenario's dealt cards (`test/harness/record-walk.ts` walks them) and words each pick with `askWords` (`src/play/words/ask.ts`), the function the sheet calls, so the test reads the sentence the player reads. It fails on a bare "Choose a/an X." or a fallback sentence; an allowlist, keyed by record id and the instruction's path in the record, holds the cases left as they read, and fails on an entry no sentence needs. `WORDS_DUMP=<id>` prints every sentence.
- A scenario whose lines are all owned may wait outside `PLAYABLE_SCENARIOS` while its `golden.test.ts` exists and its `golden.json` does not, so the coverage test does not block the goldens task.
- `node --experimental-strip-types scripts/card-smoke/encounter.ts <scenario-id>... | --all` is the encounter-card smoke, and `pnpm test:scenario` runs it for every scenario on both tracks. On a table made from the scenario's own opening it:
  - reveals each encounter-side card the scenario deals (its piles, its Nightmare deck, the other side of a two-code card);
  - resolves each card's Shadow in an attack on a plain enemy, defended and undefended;
  - travels to each location (the Island Map's, never in the staging area, are left out);
  - runs each later quest card's Setup (the first one ran when the game was dealt);
  - then plays seeded games (`GAMES`, `scripts/card-smoke/encounter-games.ts`) with random legal intents, completed the way the table's sheets would, over stand-in heroes of five profiles (`HERO_STATS`) and one or two seats.

  It reports a throw, a refused intent, `state.failure`, a window that never closes, a game that does not end within its step and round caps, or one whose intents do not replay (`src/campaign/replay.ts`) to the same final state. It proves that the records run without breaking the game, not that they do what the card says. `scripts/card-smoke/encounter.test.ts` shows each report on a broken record; `--cards-only` and `--games-only` run one half, `--games=<n>` sets the count.
- `effects:draft` and `card-smoke/run.ts` take codes separated by commas or spaces (`scripts/codes.ts`, `splitCodes`).
- `scripts/checks/record-routes.test.ts` walks every record whose route the engine picks from a verb list: a quest card's Setup (`revealsPerPlayer`), a Shadow (`runsInFrame`) and a campaign card's Setup (the setup roles, the start and the checklist). It names a record that would be skipped or fail with "Unimplemented instruction".
- `scripts/e2e/fixtures.ts <scenario-id>` writes only that scenario's fixture file; the earlier parts' won games come from their committed files.

Not built: a search-based win finder for the missing won fixtures (`docs/phases/STATUS.md`, Fixtures and Maestro).

## Where a scenario's cost is now

Sections A to D and F are built (E waits for a new campaign or pack). What each stage still costs:

- **Scaffold and registration.** `pnpm scenario:new` writes every skeleton and registry line. Hand edits are still needed in two places:
  - The Setup answers a fixture needs: `SETUP_CHOICES` in `src/campaign/fixtures.test.ts`, and the `choices` in the seed finder and in `game.ts`.
- **Records.** The templates and copies leave only lines unique to the scenario. The scenario's records are now a small part of its diff.
  - `effects:draft` groups the batch's twins and prints the `pool` import for a twin owned in another file; an author still decides which of two similar lines is the same reading.
  - A coverage-tool bug shows up as scope growth partway through a phase: `dealtCodes` once skipped the cards' backs. `scripts/data/load-scenarios.test.ts` pins that fix.
- **Mechanics.** This is the largest build cost: a scenario with a new mechanic (a deck of two-sided cards, a choice of up to N options) pays for the whole mechanic.
  - Where no hook fits, the mechanic edits the core: a zone guard, a play check, a ready check.
  - A verb joins the quest card's Setup, the Shadow frame and the collection lists by a flag in its own family file (`src/catalog/verb-flags.ts`).
  - The core still calls some families by name outside the settle chain (the sea family's attack legality in `src/rules/engine/legal.ts` and `src/rules/combat/combat.ts`). Each moves behind a family hook when its family is next changed.
  - `scripts/checks/record-routes.test.ts` fails on a record that no route runs, except a Shadow verb that runs outside a frame but pushes effects: that is first played in a golden.
- **Goldens.** Filling the goldens is policy work on the kit. The goldens find engine bugs that unit tests miss.
  - A record that no golden reaches is found only by the reviewer. The fix pass then writes card tests for it.
  - The player-card smoke runs only player cards; the encounter smoke (`scripts/card-smoke/encounter.ts`, Faster feedback while authoring) plays each encounter card's When Revealed, Shadow, Travel and Setup before a golden does.
  - The box-wide check (`scripts/checks/box-dealt.test.ts`) finds a scenario's undealt card; the golden finds the rest.
- **Fixtures and Maestro.** With real decks the seed finder finds a loss but no win, so the win flow cannot run (`docs/phases/STATUS.md`, Fixtures and Maestro).
- **Review and fix.** The one fix pass is the largest single task of the phase. Its findings fall into classes the author can check before the review:
  - card readings (`docs/plans/effect-authoring.md`, Readings the review catches);
  - records with no test and no golden that reaches them;
  - a hand-written file past the size limit (`scripts/checks/file-size.test.ts` runs in `pnpm test:scenario`);
  - choice words that name no number, side or owner (`docs/design-system-table.md`, Choice tray). This is the largest fix-pass class. `pnpm test:scenario <id> --words` catches the bare and fallback sentences; the author checks each remaining sentence against Choice tray.

## Next steps

Ordered by what they save per scenario. A step that is built is deleted from this list, and its section above states what it does.

1. **Count the Setup answers.** Not built. Derive the number of Setup answers a fixture needs (`SETUP_CHOICES`, the seed finder's and `game.ts`'s `choices`) from the campaign card's Setup records, so `scenario:new` writes them. Exit: the skeletons of a scenario with a Setup choice need no hand edit for the count.
2. **Unreached records.** Not built.
   - A test-only recorder, installed by the golden suite, notes each record the goldens resolve (the step logs do not name records, and adding ids to steps would change `golden.json`).
   - `pnpm test:scenario` lists the scenario's records that no golden resolves.
   - Each one gets a card test, or a golden reaches it.
   - Exit: the list is empty or each entry has a card test.
3. **The draft marks the Setup sentences the piles already carry out.** Not built. For a campaign card's Setup, `effects:draft` marks each sentence that the scenario's `scenarioPiles` or the Setup parser already carries out, so the author writes no record for it. Exit: the draft of a scenario whose Setup the piles carry lists no such sentence as open.
4. **The win finder** (section F). Not built.
   - It is the search player: a beam search over legal intents, built on `test/harness/auto-player.ts` and scored on threat, progress, hero health and stage.
   - It replaces each scenario's policy in `game.ts`.
   - It is the only way the Dream-chaser win flows can run.
   - Exit: a won fixture for each scenario in `docs/phases/STATUS.md`, Fixtures and Maestro.

## After each scenario phase

- **Measure.** The phase's last commit message records these, after a line `Pipeline measure:`, so `git log --grep "Pipeline measure"` lists every run:
  - the open lines at the start (`pnpm effects:draft <scenario-id>`) and the lines templates and copies took;
  - the mechanics added, and the core files they edited outside a family;
  - the build diff and the fix-pass diff, in lines;
  - the review findings by class;
  - the fix-pass lines by area, with the words and the sheets apart from the rest;
  - the readings asked and the readings ruled (`.claude/agents/orchestrator.md`, Implementer tasks);
  - for each task, its full runs, its wait minutes and its writing minutes.
- **Feed back.** For each finding class that recurs, add a check, a template or a line in the author's readings to Next steps. Delete a step when it is built.

## Order

E waits until a new campaign or pack is added. The next steps run between scenario phases, one at a time, with the goldens byte-identical after each. Sections and steps run with `orchestrator`, one review round (`.claude/agents/orchestrator.md`, One review round).

## Verification

After each section:

- `pnpm data:build`, `pnpm data:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:index`.
- `git diff --stat` shows no change under `src/campaign/scenarios/*/golden.json` or `src/campaign/fixtures/*.json`, and none to `src/rules/engine/version.ts`.
- `pnpm effects:open` leaves `src/effects/open-lines.ts` as the section allows (What does not move).
