# Brief for a mechanic-family or scenario agent

Repository: middle-earth-lcg, a TypeScript/Expo app for The Lord of the Rings: The Card Game with an offline, deterministic
rules engine (`src/rules`) that runs effect records (`src/effects`) written in a Zod vocabulary (`src/catalog/effect-schema*.ts`
and `src/catalog/families/`).

The user's directive (2026-10-26): every deck-legal player card is fully playable, meaning its printed text is automated by
effect records the engine runs, and every scenario of the Fellowship box follows (phases 13 to 16). The lines still without a
record are listed in `src/effects/open-lines.ts` (`pnpm effects:open` rewrites it; 100 at the last merge: 98 for scenarios 5 and 6,
cards 142040 to 142090, and `21072:B:1-2`, Smeagol's Gollum side). The Messenger of the King cards are out of scope
(`outOfScope` in `data/overrides.json`). This brief is reused for each new assignment: you own one **family** (the engine
support one mechanic needs, and the records for its lines) or one **scenario phase** (phases 15 and 16: the records of the
scenario's cards, plus the engine support they lack, which is a new family when it is a new mechanic). Other agents may work
on other assignments at the same time. Below, `<F>` is your family or scenario id and `<BASE>` the integration branch the
main session names in your task (at the time of writing `ccr-a8ef8247-8087n8`).

Families that exist (`src/catalog/families/index.ts` is the list): encounter, costs, quest, defense, attachments, attack, play,
deck, sidequests, misc, burden (phase 13: the Ring-bearer's life, the burden deck, the campaign zone), south (phase 14: a
second active location, the captive Ring-bearer, the Watcher). A scenario's own records are in
`src/effects/authored/<scenario-id>.ts` (`fellowship-of-the-ring.ts` for scenarios 1 and 2, `flight-to-the-ford.ts`,
`the-ring-goes-south.ts`); the burden and south families have no file under `src/effects/authored/families/`.

## Setup

- You are in your own git worktree. Start from the base: `git fetch origin <BASE> && git checkout -B wip-<F> origin/<BASE>`.
  Your base commit is the tip of `<BASE>` at that moment; `git log -1 --format=%h` says which.
- If `node_modules` is missing, run `pnpm install --frozen-lockfile --offline` (without `--offline` if that fails).
- Read first: `CLAUDE.md`, `.cursor/rules/authority.mdc`, `docs/plans/effect-authoring.md` (the cookbook; its "Mechanic
  families" section describes the files you own), `docs/architecture.md`, the phase file for a scenario phase
  (`docs/phases/phase-NN-*.md`) and `docs/phases/STATUS.md`, and the schema files `src/catalog/effect-schema*.ts`. Skim
  `src/rules/interpret.ts`, `src/rules/effect-frames.ts`, `src/rules/triggers.ts`, `src/rules/responses.ts` and
  `src/rules/usage.ts` to see how records run.
- Card text: `pnpm effects:draft <scenario-id | pack | code,code,...>` writes `.agent/drafts/<code>.md` per card (printed lines,
  every printing's text, DragnCards' automation as a hint, related rules text, vocabulary, nearest records). Never rely on
  memory for card text or rules.
- Rules text: `pnpm data:query "select id, title, text from rules where text like '%engag%'"`. Rule ids you cite in code or
  tests must exist in `data/rules/entries.json`.
- Repo rules: `data/` is the source of truth; never hand-edit generated files (`src/effects/generated/*`, `data/cards`,
  `data/scenarios`, `assets/icons`, ...); no network. Do not commit `assets/catalog.db` or anything under `.agent/`.

## Files you own (edit freely)

- `src/catalog/families/<F>.ts`: `VERBS` (zod `z.strictObject({ verb: z.literal("..."), ..., ...when })`, `when` from
  `../effect-schema-conditions.ts`), `TRIGGERS` (event names), `FLAGS` (stat flags `ModifyStat` can set). Keep the
  `as const`. They are spread into the verb union, the trigger enum and the stat enum. Every verb carries a comment saying
  what the engine does with it.
- `src/rules/families/<F>.ts`: `run()` resolves your verbs (`runFamilyVerb` in `src/rules/families/index.ts` asks the
  families in turn; return null for verbs that are not yours). Engine behavior goes in `src/rules/families/<F>.ts` and helper
  modules `src/rules/families/<F>-*.ts`.
- `src/rules/families/<F>.test.ts` (and more test files if needed): vitest tests for each engine behavior you add, naming
  the rule ids they implement. `src/rules/general-effects.test.ts` and the `<F>-fixture.ts` helpers of the existing families
  show a compact table setup.
- Your records: `src/effects/authored/families/<F>.ts` (`RECORDS`, `REPLACES`) for a family, or
  `src/effects/authored/<scenario-id>.ts` (`AUTHORED_EFFECTS`, `AUTHORED_REPLACES`) for a scenario.
- A new family is wired in at four places, each one line: `src/catalog/families/index.ts`, `src/rules/families/index.ts`
  (its `RUNNERS`), `src/effects/authored/families/index.ts` (when it has records there), and for a new scenario file
  `src/effects/index.ts`. `src/catalog/families/families.test.ts` fails if two families add the same trigger or flag.

## Shared files

`src/rules/*.ts`, `src/catalog/effect-schema*.ts`, `src/play/*`, `scripts/*` are shared with the other agents, who may edit
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
   `src/play/choice-words.ts` (`instructionWords`): a test checks every branch reads as a sentence.
6. A line may stay open only if it is genuinely impossible to express in this engine; report it with the reason.
7. A scenario phase also adds the scenario to `PLAYABLE_SCENARIOS` (`src/campaign/playable.ts`) once none of its lines is open,
   pins a whole game in a golden (`src/campaign/golden-south.test.ts` and `src/campaign/golden/the-ring-goes-south.json` are
   the pattern), and leaves its phone half open in `docs/phases/STATUS.md` when you have no phone.

## Checkpoints (API usage limits can stop you mid-task)

- Keep a handover file at `docs/handover/<F>.md`: what is done, what is in progress, design decisions, next steps, and the
  lines still open, enough for a fresh agent to continue.
- After each meaningful step (a mechanic implemented with its tests passing, a batch of records written), commit on your
  worktree branch with a `WIP <F>: ...` message (restore `src/effects/open-lines.ts` first), handover file included. If
  you sense you are running long, checkpoint first. Then push the worktree branch to GitHub (the user allows extra
  branches): `git push -u origin HEAD:refs/heads/wip/<F>`, retrying on network errors (2s, 4s, 8s, 16s). Never push to
  `<BASE>` or `main`. Your final commit deletes `docs/handover/<F>.md`.

## Checks before committing

Other agents share this 4-core machine: use generous timeouts, run targeted test files while developing and the full
suite once at the end, and never kill processes you did not start (no `pkill`).

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm effects:open`, then `pnpm vitest run scripts/effect-coverage.test.ts src/effects src/rules/families`
- `node --experimental-strip-types scripts/card-smoke.ts <codes>` for every card you wrote records for: no problems reported.
- `pnpm data:check` if you touched anything under `data/` or `scripts/data/`.
- Full `pnpm test` once at the end (about 10 minutes). The golden snapshots in `src/campaign/golden` (the scenario games and the
  starter decks) must not change. If your change alters them, find out why; fix it unless it is a genuine bug fix, and then
  explain it. A rule change that can move a replayed game bumps `ENGINE_VERSION` (`src/rules/version.ts`, 6 at the time of
  writing) and the saves' fixtures are rewritten with `scripts/e2e-fixtures.ts` when `src/campaign/fixtures.test.ts` says so.

## Merge

The main session squashes each branch into `<BASE>`, regenerates `src/effects/open-lines.ts` after the last merge, and
reduces duplicates between branches (two definitions of one helper become one). Expect it to merge in the order it chooses,
so: keep shared-file edits small so they apply cleanly in any order; do not depend on another assignment's unmerged code;
say in your report exactly what you changed in each shared file, so the merge can be checked against it.

## Commit

- Before committing, restore the burn-down list: `git checkout src/effects/open-lines.ts` (the main session regenerates it).
- Commit on your worktree branch with a message describing the mechanics added. End the message with exactly the attribution
  lines your session's instructions give (`Co-Authored-By` and `Claude-Session`). Do not put model names elsewhere in the message.
- Push to `wip/<F>` as above. Do not push to `<BASE>` or `main`.

## Report (your final message)

- Commit hash(es).
- Mechanics added: verb, trigger, flag and field names, and each engine file touched with one line on why.
- Lines now covered (count) and lines left open, each with the reason.
- Shared files you edited and exactly what changed in each (the merge is checked against this).
- Anything you found broken outside your assignment.
