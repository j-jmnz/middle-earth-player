# Brief for a mechanic-family or scenario agent

Repository: middle-earth-player, a TypeScript/Expo app for The Lord of the Rings: The Card Game with an offline, deterministic
rules engine (`src/rules`) that runs effect records (`src/effects`) written in a Zod vocabulary (`src/catalog/effect-schema*.ts`
and `src/catalog/families/`).

Every deck-legal player card and every card a playable scenario deals is automated by effect records the engine runs
(user directive, 2026-10-26). The lines still without a record are listed in `src/effects/open-lines.ts` (`pnpm effects open`
rewrites it). The Messenger of the King cards are out of scope (`outOfScope` in `data/overrides.json`). This brief is reused for
each assignment: you own one **family** (the engine support one mechanic needs, and the records for its lines) or one
**scenario phase** (the records of the scenario's cards, plus the engine support they lack, which is a new family when it is a
new mechanic). Other agents may work on other assignments at the same time. Below, `<F>` is your family or scenario id and
`<BASE>` the integration branch the main session names in your task.

The families that exist are listed in `src/catalog/families/index.ts`. A scenario's own records are in
its authored file (`docs/architecture.md`, Effects); families used only by scenario
cards have no file under `src/effects/authored/families/`.

## Setup

- You are in your own git worktree. Start from the base: `git fetch origin <BASE> && git checkout -B wip-<F> origin/<BASE>`.
  Your base commit is the tip of `<BASE>` at that moment; `git log -1 --format=%h` says which.
- If `node_modules` is missing, run `pnpm install --frozen-lockfile --offline` (without `--offline` if that fails).
- Find docs through `docs/INDEX.md` and read sections (`pnpm doc section <file> "<heading>"`), not whole files.
- Read first: `CLAUDE.md`, `.claude/rules/authority.md`, `.claude/rules/code-standards.md`, `.claude/rules/docs-standards.md`, `docs/agents/effect-authoring.md` (the cookbook; its "Mechanic
  families" section describes the files you own), `docs/architecture.md`, the phase file for a scenario phase
  (`docs/phases/phase-NN-*.md`) and `docs/phases/STATUS.md`, and the schema files `src/catalog/effect-schema*.ts`. Skim
  `src/rules/interpret/interpret.ts`, `src/rules/interpret/effect-frames.ts`, `src/rules/windows/triggers.ts`, `src/rules/windows/responses.ts` and
  `src/rules/player/usage.ts` to see how records run.
- Card text: `pnpm effects draft <scenario-id | pack | code,code,...>` writes `.agent/drafts/<code>.md` per card (printed lines,
  every printing's text, DragnCards' automation as a hint, related rules text, vocabulary, nearest records). Never rely on
  memory for card text or rules.
- Rules text: `pnpm data query "select id, title, text from rules where text like '%engag%'"`. Rule ids you cite in code or
  tests must exist in `data/rules/entries.json`.
- Repo rules: `data/` is the source of truth; never hand-edit generated files (`src/effects/generated/*`, `data/cards`,
  `data/scenarios`, `assets/icons`, ...); no network. Do not commit `assets/catalog.db` or anything under `.agent/`.

## Files you own (edit freely)

- `src/catalog/families/<F>.ts`: one `manifest` with `verbs` (zod `z.strictObject({ verb: z.literal("..."), ..., ...when })`, `when` from
  `../effect-schema-conditions.ts`), `triggers` (event names) and `flags` (stat flags `ModifyStat` can set). Keep the
  `as const`. The index builds the verb union, the trigger enum and the stat enum from the manifests. Every verb carries a comment saying
  what the engine does with it.
- `src/rules/families/<F>/index.ts`: a `manifest` with the `verbs` your `run()` answers and `run` (`runFamilyVerb` in `src/rules/families/index.ts` asks the
  families in turn; return null for verbs that are not yours). Engine behavior goes in `src/rules/families/<F>/index.ts` and helper
  modules beside it in `src/rules/families/<F>/`.
- `src/rules/families/<F>/index.test.ts` (and more test files if needed): vitest tests for each engine behavior you add, naming
  the rule ids they implement. `src/rules/interpret/general-effects.test.ts` and the `<F>/fixture.ts` helpers of the existing families
  show a compact table setup.
- Your records: `src/effects/authored/families/<F>.ts` (`RECORDS`, `REPLACES`) for a family, or
  the scenario's authored file (`AUTHORED_EFFECTS`, `AUTHORED_REPLACES`; `docs/architecture.md`, Effects) for a scenario.
- A new family is wired in at three places, each one line: `src/catalog/families/index.ts` (`CATALOG_FAMILIES`), `src/rules/families/index.ts`
  (`RULES_FAMILIES`) and `src/effects/authored/families/index.ts` (when it has records there). `src/catalog/families/families.test.ts`
  fails if two families add the same trigger or flag; `src/rules/interpret/family-manifest.test.ts` fails if a declared verb has no runner or a runner answers an undeclared one. A scenario's authored file is picked up by
  `pnpm data build`, which writes the barrel `src/effects/generated/authored.ts` (`scripts/data/effects/barrel.ts`); the coverage test fails while it is stale.

## Shared files

`src/rules/{core,engine,windows,interpret,combat,quest,setup,player}/`, `src/catalog/effect-schema*.ts`, `src/play/`, `scripts/` are shared with the other agents, who may edit
them too; the main session merges every branch afterwards. Keep your edits there minimal and surgical: a hook call into
your family module, an optional field, a new case, a new event emitted. Do not reformat, reorder, rename or move code in
shared files. Do not edit other families' files. Do not edit `src/effects/authored/pool/*.ts` except to fix a record that is
wrong for a line in your list (say so in the report). Keep every file under about 500 lines; split by behavior if needed.

Record ids are `<code>:<timing>:<n>` and must be unique across all records: check `grep -rn '"<code>:' src/effects` and take
the next free n for that code and timing. Line ids are `<code>:<side>:<n>` as in your list. A card's other lines may
already have records in `src/effects/authored/pool/<PACK>.ts` or `src/effects/generated/*`; read them, they may need to
work together with yours. A line that restates a rule the engine applies anyway is marked `inert` in the ledger
(`data/printed/`) with the rule id, not given a record.

## Approach

1. Draft bundles for your cards; read them.
2. Group your lines by the mechanic they need. For each mechanic, design the smallest general vocabulary (verb, trigger,
   flag, condition kind, pick field, amount expression, cost kind) that expresses it for every card that needs it,
   implement it in the engine following the Rules Reference text in `data/rules`, test it, then write the records.
3. Prefer general vocabulary over card-specific code, and existing verbs and patterns where they fit (the cookbook lists
   them). Check the other families' `VERBS` before adding one: a verb two families define fails to load.
4. The engine plays one or two seats (`seatCount: 1 | 2`, `docs/brief.md`, Product). "Choose a player", control changes and "each player" must work for both.
5. Choices: the reducer never takes a number or a card the engine did not offer; choices are frames with options (see
   `Pick`, `Choose`, `effect-frames.ts`). If you add a verb that can appear inside a `Choose` option, give it words in
   `src/play/words/instruction.ts` (`instructionWords`): a test checks every branch reads as a sentence.
6. A line may stay open only if it is genuinely impossible to express in this engine; report it with the reason.
7. A scenario phase follows the Scenario procedure below. Its skeleton is `pnpm scenario new <scenario-id>`: it writes the game (`test/scenarios/<id>/game.ts`), the golden test, the campaign test and the spec rows (`src/campaign/scenarios/<id>/`), the asks file (`src/play/words/asks/<id>.ts`), the seed finder, both Maestro flows, the authored effects file (`docs/architecture.md`, Effects) and the empty fixture file, and adds the registry lines (the fixtures in `src/campaign/fixtures/registry.ts`, `src/campaign/fixtures.ts` and `scripts/e2e/fixtures.ts`; the golden registry's two lines as comments). It writes no scene file: the game, the golden test and the campaign test read the scenario from `data/`. Fill the skeletons from the shared kit, keeping only what is the scenario's own: `test/harness/game-kit.ts` (the campaign game and its goldens), `golden-suite.ts` (the golden test's loops), `card-spec.ts` (the spec rows), `scripts/e2e/seed-kit.ts` (the seed finder) and the Maestro subflows in `.maestro/subflows/`. The skeletons keep the suite green (the golden suite is skipped and the campaign test has todos), so the golden test is finished by turning `describe.skip` into `describe`, running it to write `golden.json`, and uncommenting the golden registry's two lines in `test/harness/golden-registry.ts` (its test fails on a `golden.json` that is not listed). `src/campaign/scenarios/the-thing-in-the-depths/golden.test.ts` and `golden.json` are the pattern for a golden. A scenario of a cycle (Shadows of Mirkwood, `docs/brief.md`) is standalone only: the command writes the standalone game (`standaloneGame`), a golden test with `standalone: true`, `standalone.test.ts` in place of the campaign test, a seed finder of standalone fixtures (a `kind: "standalone"` registry entry) and flows on `.maestro/subflows/standalone-win.yaml` and `standalone-loss.yaml`; read "a win runs the campaign card's Resolution" in the exits below as "a win is scored and recorded in History".

## Scenario procedure

The one way to build a scenario. A subagent cannot start agents, so the orchestrator (`.claude/agents/orchestrator.md`, Implementer tasks) runs it as tasks, each a fresh `scenario-author` (`.claude/agents/scenario-author.md`) that does its one task and stops. A phase file names only what its own cards add.

1. **Read**, by a fresh `scenario-author`.
   - The data cross-check: `data/scenarios/<id>.json` is built by `pnpm data build`; re-read its report with `pnpm data build -- --verbose`. Every card it deals has a ledger entry. A scan the author cannot read is a question for the user, not a guess. Then `pnpm scenario new <id>` (`--dry-run` first), `pnpm data build` (it adds the authored file and the asks file to their barrels) and `pnpm scenario pack <id>`, which runs `pnpm effects draft <id>` and writes `.agent/pack/<id>.md`: the vocabulary, the schema entries the drafts' nearest records use, the cookbook sections they need, the rule spans and the drafts. Read it in place of Setup's reading list; read a file beyond it only when a verb's fields or a rule are in question. Rule text comes from `pnpm data query`, never from memory; the authority order is `.claude/rules/authority.md`.
   - A readings pass over every draft line, against `docs/agents/effect-authoring.md` (Readings the review catches), with each line's `faq.*` spans checked (`pnpm data query "select id, title, text from rules where id like 'faq.%' and text like '%<word>%'"`). Group the lines by mechanic.
   - **Open points are researched, not asked.** For every reading that `data/rules/` does not settle, and for any other open point about a card, a ruling or an effect, the author researches online in the order `.claude/rules/authority.md` (Open points) gives and marks each reading `researched` or `recommended`.
   - It hands back the Readings list (`.claude/agents/orchestrator.md`, Implementer tasks) and the mechanics that need a new verb, trigger or flag, each with its family. No engine code and no records. The orchestrator does not wait on the user: every reading is applied as researched or recommended. Each goes to `docs/brief.md` under its scenario, with its source URL or "agent recommendation", and each `recommended` reading, or one settled only by a community discussion, also goes to Open items in `docs/phases/STATUS.md` as not user-confirmed.
2. **Build**, by a fresh `scenario-author` handed the Read note and the rulings, applied as given (a ruling that conflicts with a line goes back, it is not worked around).
   - Verbs in their families, each with its own test: a new verb is engine work in the mechanic family it belongs to (`src/catalog/families/<family>.ts` for the schema, `src/rules/families/<family>/` for the engine), cites a ledger line or a rule span, and reuses the keyword framework and the existing verbs where they fit.
   - The records in the scenario's authored file (`docs/architecture.md`, Effects; `pnpm scenario new` writes it), a repeated sentence as a template and a line printed the same as another card's as a copy (`docs/agents/effect-authoring.md`, Templates and copied lines); `pnpm effects open`; the scenario in `PLAYABLE_SCENARIOS` (`src/campaign/playable.ts`) once none of its lines is open, until ownership coverage is green for every line of every dealt card, the campaign card's Setup and Resolution included.
   - Then the render, `pnpm effects render <id> --out .agent/render/<id>.md` (a piece printed as `[json ...]` or `[also {...}]` has no template yet), and the scenario's snapshot, `pnpm effects render --all --out scripts/data/effects/render/snapshots`, which `snapshots.test.ts` compares for every playable scenario.
3. **Judge.** The orchestrator runs `reading-judge` on the render and the ledger, with a fresh context. A `render-gap` row (`.claude/agents/reading-judge.md`) is filed as a renderer open item in `docs/phases/STATUS.md`, not sent to the author.
4. **Finish**, by a fresh `scenario-author` handed the Build note and the judge's rows. It writes:
   - fixes for every `wrong` line, rendered again; an `ambiguous` line that is a real choice is researched and settled as step 1 says (Open points are researched, not asked);
   - spec rows, one for each record whose behaviour needs a game moment, in `src/campaign/scenarios/<id>/spec.test.ts` (`test/harness/card-spec.ts` says the row's shape and runs it again with its line's records removed, failing a row that still passes), plus tests in the same folder for what a row cannot express: a full test file is for a new verb (a family test) or a multi-step mechanic, and each of its tests starts its title with the line id it covers. `scripts/checks/spec-coverage.test.ts` fails a line the records name that has neither a row nor such a test, and a test file whose header claims a line it does not test;
   - the asks file, an entry for each Pick and Choose in `src/play/words/asks/<id>.ts` (`src/play/words/asks.ts` says the key and the template fields; an entry is keyed by its record, so there is no gate test), checked with `pnpm test scenario <id> --words` against `docs/design-system-table.md` (Choice tray): each sentence names its number, side and owner;
   - the goldens, the seed finder, the fixtures, the Maestro flows and the campaign test, on the shared kit: a golden of auto-player games on fixed seeds, true solo and two-handed, through a win and through a loss, listed in `test/harness/golden-registry.ts`; the golden suite checks every golden's causes and replays one from its save. The Maestro flows are written, not run. The campaign test continues the campaign: the previous scenario's earned pool cards reach this scenario through the Campaign Setup Checklist, from the previous part's golden state read with `goldenState`. The goldens and every test around them stay within `.claude/rules/code-standards.md` (Test cost), which `scripts/checks/test-cost.test.ts` checks. A rule change that can move a replayed game bumps `ENGINE_VERSION` (`.claude/agents/implementer.md`);
   - the Table step, below.

   `pnpm test scenario <id> --quick` is the loop while working (it skips the goldens and the reader check); `pnpm test scenario <id>` runs once before the hand-back. The exit of every writing task is in `.claude/agents/orchestrator.md` (Implementer tasks).
5. **Review.** The round of `.claude/agents/orchestrator.md` (One review round).
6. **Fix**, by an `implementer`, ending with the one full `pnpm test` (`.claude/agents/orchestrator.md`, One review round).

**The Table step.** A zone or widget exists only when a setup record or a card line creates it: cite the line in `docs/brief.md`. For each tracker, zone or held card a record creates, the table has:
- a readout with its limit, which warms near the limit;
- a held dial for each seat;
- the held card drawn under its host in every zone the host can be in;
- the owner named on each row of a pick that spans seats.

Each is cited in `docs/brief.md`.

**The hand-off note** is `.agent/handoff/<id>.md`, not committed. It holds the verbs, flags and conditions added, the files touched and the Readings list. Each task's writer reads it first and appends its own part, so a fresh agent does not need the last one's context.

**Engine half exit:** coverage and the goldens are green in Node. A win runs this campaign card's resolution and unlocks the next scenario. A loss writes nothing.

**Screen half exit:** the scenario's words and widgets are written and tested, its Maestro win and loss flows are written, and no control types damage, resources, threat, progress, or life.

## Checkpoints (API usage limits can stop you mid-task)

- Keep a handover file at `docs/handover/<F>.md`: what is done, what is in progress, design decisions, next steps, and the
  lines still open, enough for a fresh agent to continue.
- After each meaningful step (a mechanic implemented with its tests passing, a batch of records written), commit on your
  worktree branch with a typed checkpoint message (`.claude/rules/commit-standards.md`, Squash; restore `src/effects/open-lines.ts` first), handover file included. If
  you sense you are running long, checkpoint first. Then push the worktree branch to GitHub (the user allows extra
  branches): `git push -u origin HEAD:refs/heads/wip/<F>`, retrying on network errors (2s, 4s, 8s, 16s). Never push to
  `<BASE>` or `main`. Your final commit deletes `docs/handover/<F>.md`.

## Checks before committing

Other agents share this 4-core machine: use generous timeouts, check as `.claude/rules/code-standards.md` (Checking a
change) says, and never kill processes you did not start (no `pkill`).

- `pnpm typecheck`
- `pnpm lint`
- `pnpm effects open`, then `pnpm vitest run scripts/checks/effect-coverage.test.ts src/effects src/rules/families`
- `pnpm test smoke <codes>` for every card you wrote records for: no problems reported.
- `pnpm data check` if you touched anything under `data/` or `scripts/data/`.
- `pnpm test scenario <scenario-id>` while authoring (the scenario's tests, its goldens, the coverage checks, the card smoke on its player cards and the encounter smoke).
- Full `pnpm test` once at the end (Scenario procedure). The golden snapshots (`src/campaign/scenarios/<scenario-id>/golden.json` for the scenario games, `src/campaign/starter/golden/` for the
  starter decks) must not change. If your change alters them, find out why; fix it unless it is a genuine bug fix, and then
  explain it. A rule change that can move a replayed game bumps `ENGINE_VERSION` (`src/rules/engine/version.ts`) and the saves' fixtures are rewritten with `scripts/e2e/fixtures.ts` when `src/campaign/fixtures.test.ts` says so.

## Merge

The main session squashes each branch into `<BASE>` (`git merge --squash`, one message per `.claude/rules/commit-standards.md`), regenerates `src/effects/open-lines.ts` after the last merge, and
reduces duplicates between branches (two definitions of one helper become one). Expect it to merge in the order it chooses,
so: keep shared-file edits small so they apply cleanly in any order; do not depend on another assignment's unmerged code;
say in your report exactly what you changed in each shared file, so the merge can be checked against it.

## Commit

- Before committing, restore the burn-down list: `git checkout src/effects/open-lines.ts` (the main session regenerates it).
- Commit on your worktree branch with a message that follows `.claude/rules/commit-standards.md` and describes the mechanics added. End the message with the attribution
  lines your session's instructions give, as `.claude/rules/commit-standards.md` (Body) says: `Co-Authored-By`, never a `Claude-Session` link. Do not put model names elsewhere in the message.
- Push to `wip/<F>` as above. Do not push to `<BASE>` or `main`.

## Report (your final message)

- Commit hash(es).
- Mechanics added: verb, trigger, flag and field names, and each engine file touched with one line on why.
- Lines now covered (count) and lines left open, each with the reason.
- Shared files you edited and exactly what changed in each (the merge is checked against this).
- Anything you found broken outside your assignment.
