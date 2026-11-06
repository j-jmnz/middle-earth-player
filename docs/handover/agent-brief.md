# Brief for a mechanic-family or scenario agent

Repository: middle-earth-lcg, a TypeScript/Expo app for The Lord of the Rings: The Card Game with an offline, deterministic
rules engine (`src/rules`) that runs effect records (`src/effects`) written in a Zod vocabulary (`src/catalog/effect-schema*.ts`
and `src/catalog/families/`).

Every deck-legal player card and every card a playable scenario deals is automated by effect records the engine runs
(user directive, 2026-10-26). The lines still without a record are listed in `src/effects/open-lines.ts` (`pnpm effects:open`
rewrites it). The Messenger of the King cards are out of scope (`outOfScope` in `data/overrides.json`). This brief is reused for
each assignment: you own one **family** (the engine support one mechanic needs, and the records for its lines) or one
**scenario phase** (the records of the scenario's cards, plus the engine support they lack, which is a new family when it is a
new mechanic). Other agents may work on other assignments at the same time. Below, `<F>` is your family or scenario id and
`<BASE>` the integration branch the main session names in your task.

The families that exist are listed in `src/catalog/families/index.ts`. A scenario's own records are in
`src/effects/authored/<scenario-id>.ts` (`fellowship-of-the-ring.ts` for scenarios 1 and 2); families used only by scenario
cards have no file under `src/effects/authored/families/`.

## Setup

- You are in your own git worktree. Start from the base: `git fetch origin <BASE> && git checkout -B wip-<F> origin/<BASE>`.
  Your base commit is the tip of `<BASE>` at that moment; `git log -1 --format=%h` says which.
- If `node_modules` is missing, run `pnpm install --frozen-lockfile --offline` (without `--offline` if that fails).
- Find docs through `docs/INDEX.md` and read sections (`pnpm docs:section <file> "<heading>"`), not whole files.
- Read first: `CLAUDE.md`, `.claude/rules/authority.md`, `.claude/rules/code-standards.md`, `.claude/rules/docs-standards.md`, `docs/plans/effect-authoring.md` (the cookbook; its "Mechanic
  families" section describes the files you own), `docs/architecture.md`, the phase file for a scenario phase
  (`docs/phases/phase-NN-*.md`) and `docs/phases/STATUS.md`, and the schema files `src/catalog/effect-schema*.ts`. Skim
  `src/rules/interpret/interpret.ts`, `src/rules/interpret/effect-frames.ts`, `src/rules/windows/triggers.ts`, `src/rules/windows/responses.ts` and
  `src/rules/player/usage.ts` to see how records run.
- Card text: `pnpm effects:draft <scenario-id | pack | code,code,...>` writes `.agent/drafts/<code>.md` per card (printed lines,
  every printing's text, DragnCards' automation as a hint, related rules text, vocabulary, nearest records). Never rely on
  memory for card text or rules.
- Rules text: `pnpm data:query "select id, title, text from rules where text like '%engag%'"`. Rule ids you cite in code or
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
  `src/effects/authored/<scenario-id>.ts` (`AUTHORED_EFFECTS`, `AUTHORED_REPLACES`) for a scenario.
- A new family is wired in at three places, each one line: `src/catalog/families/index.ts` (`CATALOG_FAMILIES`), `src/rules/families/index.ts`
  (`RULES_FAMILIES`) and `src/effects/authored/families/index.ts` (when it has records there). `src/catalog/families/families.test.ts`
  fails if two families add the same trigger or flag; `src/rules/interpret/family-manifest.test.ts` fails if a declared verb has no runner or a runner answers an undeclared one. A scenario's file `src/effects/authored/<scenario-id>.ts` is picked up by
  `pnpm data:build`, which writes the barrel `src/effects/generated/authored.ts` (`scripts/data/effects/barrel.ts`); the coverage test fails while it is stale.

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
4. The engine supports 1 to 4 seats. "Choose a player", control changes and "each player" must work with several seats.
5. Choices: the reducer never takes a number or a card the engine did not offer; choices are frames with options (see
   `Pick`, `Choose`, `effect-frames.ts`). If you add a verb that can appear inside a `Choose` option, give it words in
   `src/play/words/choice.ts` (`instructionWords`): a test checks every branch reads as a sentence.
6. A line may stay open only if it is genuinely impossible to express in this engine; report it with the reason.
7. A scenario phase starts with `pnpm scenario:new <scenario-id>`: it writes the scene, the game, the golden test, the campaign test, the seed finder, both Maestro flows, `src/effects/authored/<scenario-id>.ts` and the empty fixture file, and adds the registry lines (the fixtures in `src/campaign/fixtures/registry.ts`, `src/campaign/fixtures.ts` and `scripts/e2e/fixtures.ts`; the golden registry's two lines as comments). Then `pnpm data:build` (the authored-file barrel), `pnpm effects:draft <scenario-id>` and the `effect-author` agent. Fill the skeletons from the shared kit, keeping only what is the scenario's own: `test/harness/scene-kit.ts` (scene helpers), `game-kit.ts` (the campaign game and its goldens), `golden-suite.ts` (the golden test's loops), `scripts/e2e/seed-kit.ts` (the seed finder) and the Maestro subflows in `.maestro/subflows/`. The skeletons keep the suite green (the golden suite is skipped and the campaign test has todos), so the golden test is finished by turning `describe.skip` into `describe`, running it to write `golden.json`, and uncommenting the golden registry's two lines in `test/harness/golden-registry.ts` (`src/campaign/causes.test.ts` and `src/campaign/replay.test.ts` read it, and its test fails on a `golden.json` that is not listed). The scenario also goes in `PLAYABLE_SCENARIOS` (`src/campaign/playable.ts`) once none of its lines is open. `src/campaign/scenarios/the-ring-goes-south/golden.test.ts` and `golden.json` are the pattern for a golden.

## Scenario procedure

Every scenario phase follows it. A phase file names only what its own cards add.

1. `data/scenarios/<id>.json` is built by `pnpm data:build`; re-read its cross-check report with `pnpm data:build -- --verbose`. Every card it deals has a ledger entry. A scan the agent cannot read is a question for the user, not a guess.
2. `pnpm scenario:new <id>` writes the skeletons and the registry lines (Approach, step 7, lists them). `pnpm data:build` rewrites the barrel of authored effect files, then `pnpm effects:draft <id>` and the `effect-author` agent, until ownership coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution. A task that writes records ends with a Readings list, and the orchestrator asks the user about the `needs-ruling` ones (`.claude/agents/orchestrator.md`, Implementer tasks). `pnpm test:scenario <id>` is the loop while authoring. The full `pnpm test` is the gate before a commit (and runs in CI).
3. Reuse the keyword framework and the verbs. A new verb is engine work in the mechanic family it belongs to (`src/catalog/families/<family>.ts` for the schema, `src/rules/families/<family>/` for the engine), cites a ledger line or a rule span, and gets its own test.
4. A zone or widget exists only when a setup record or a card line creates it. Cite the line in `docs/brief.md`.
5. Fill the skeletons on the shared kit (`test/harness/scene-kit.ts`, `game-kit.ts`, `golden-suite.ts`, `scripts/e2e/seed-kit.ts`, `.maestro/subflows/`): a golden of auto-player games on fixed seeds, true solo and two-handed, through a win and through a loss, listed in `test/harness/golden-registry.ts`. `src/campaign/causes.test.ts` covers it. `pnpm test:scenario <id> --words` runs the words test (`src/play/words/scenario-words.test.ts`) before the goldens: check each sentence against `docs/design-system-table.md`, Choice tray (each sentence names its number, side and owner).
6. The scenario's campaign test continues the campaign: the previous scenario's earned pool cards reach this scenario through the Campaign Setup Checklist.

**Engine half exit:** coverage and the goldens are green in Node. A win runs this campaign card's resolution and unlocks the next scenario. A loss writes nothing.

**Screen half exit:** the scenario's words and widgets are written and tested, its Maestro win and loss flows are written, and no control types damage, resources, threat, progress, or life. Phone checks are not tracked.

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
- `pnpm effects:open`, then `pnpm vitest run scripts/checks/effect-coverage.test.ts src/effects src/rules/families`
- `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` for every card you wrote records for: no problems reported.
- `pnpm data:check` if you touched anything under `data/` or `scripts/data/`.
- `pnpm test:scenario <scenario-id>` while authoring (the scenario's tests, its goldens, the coverage checks and the card smoke on its player cards).
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
- Commit on your worktree branch with a message that follows `.claude/rules/commit-standards.md` and describes the mechanics added. End the message with exactly the attribution
  lines your session's instructions give (`Co-Authored-By` and `Claude-Session`). Do not put model names elsewhere in the message.
- Push to `wip/<F>` as above. Do not push to `<BASE>` or `main`.

## Report (your final message)

- Commit hash(es).
- Mechanics added: verb, trigger, flag and field names, and each engine file touched with one line on why.
- Lines now covered (count) and lines left open, each with the reason.
- Shared files you edited and exactly what changed in each (the merge is checked against this).
- Anything you found broken outside your assignment.
