# Brief for a mechanic-family agent

Repository: middle-earth-lcg, a TypeScript/Expo app for The Lord of the Rings: The Card Game with an offline, deterministic
rules engine (`src/rules`) that runs effect records (`src/effects`) written in a Zod vocabulary (`src/catalog/effect-schema*.ts`).

The user's directive (2026-10-26): every deck-legal player card must be fully playable, meaning its printed text is
automated by effect records the engine runs. About 660 printed lines are still open (no record owns them), mostly because
the engine lacks the mechanic. They are split into mechanic families. You own one family: add the engine support it needs
and write the effect records for its lines. Ten other agents work on the other families at the same time.

## Setup

- You are in your own git worktree. `git log -1 --format=%h` must be `d2f8a7a` (or a descendant). If not, run
  `git reset --hard d2f8a7a`.
- If `node_modules` is missing, run `pnpm install --frozen-lockfile --offline` (without `--offline` if that fails).
- Read first: `CLAUDE.md`, `docs/plans/effect-authoring.md` (the cookbook; its "Mechanic families" section describes the files
  you own), `docs/architecture.md`, and the schema files `src/catalog/effect-schema*.ts`. Skim `src/rules/interpret.ts`,
  `src/rules/effect-frames.ts`, `src/rules/triggers.ts`, `src/rules/responses.ts`, `src/rules/usage.ts` to see how records run.
- Card text: `pnpm effects:draft <code> <code> ...` writes `.agent/drafts/<code>.md` per card (printed lines, every printing's
  text, DragnCards' automation as a hint, related rules text, vocabulary, nearest records). Never rely on memory for card
  text or rules.
- Rules text: `pnpm data:query "select id, title, text from rules where text like '%engag%'"`. Rule ids you cite in code or
  tests must exist in `data/rules/entries.json`.
- Repo rules: `data/` is the source of truth; never hand-edit generated files (`src/effects/generated/*`, `data/cards`,
  `data/scenarios`, ...); no network. Do not commit `assets/catalog.db` or anything under `.agent/`.

## Files you own (edit freely)

- `src/catalog/families/<F>.ts`: `VERBS` (zod `z.strictObject({ verb: z.literal("..."), ..., ...when })`, `when` from
  `../effect-schema-conditions.ts`), `TRIGGERS` (event names), `FLAGS` (stat flags `ModifyStat` can set). Keep the
  `as const`. They are spread into the verb union, the trigger enum and the stat enum.
- `src/rules/families/<F>.ts`: `run()` resolves your verbs (`runInstruction` asks the families first; return null for verbs
  that are not yours). Put engine behavior in `src/rules/families/<F>.ts` and helper modules `src/rules/families/<F>-*.ts`.
- `src/rules/families/<F>.test.ts` (and more test files if needed): vitest tests for each engine behavior you add, naming
  the rule ids they implement. Look at `src/rules/general-effects.test.ts` for a compact table setup.
- `src/effects/authored/families/<F>.ts`: your records (`RECORDS`, `REPLACES`).

## Shared files

`src/rules/*.ts`, `src/catalog/effect-schema*.ts`, `src/play/*`, `scripts/*` are shared with the other agents, who will edit
them too; the main session merges every family afterwards. Keep your edits there minimal and surgical: a hook call into
your family module, an optional field, a new case, a new event emitted. Do not reformat, reorder, rename or move code in
shared files. Do not edit other families' files. Do not edit `src/effects/authored/pool/*.ts` except to fix a record that is
wrong for a line in your list (say so in the report). Keep every file under about 500 lines; split by behavior if needed.

Record ids are `<code>:<timing>:<n>` and must be unique across all records: check `grep -rn '"<code>:' src/effects` and take
the next free n for that code and timing. Line ids are `<code>:<side>:<n>` as in your list. A card's other lines may
already have records in `src/effects/authored/pool/<PACK>.ts` or `src/effects/generated/*`; read them, they may need to
work together with yours.

## Approach

1. Draft bundles for your cards; read them.
2. Group your lines by the mechanic they need. For each mechanic, design the smallest general vocabulary (verb, trigger,
   flag, condition kind, pick field, amount expression, cost kind) that expresses it for every card that needs it,
   implement it in the engine following the Rules Reference text in `data/rules`, test it, then write the records.
3. Prefer general vocabulary over card-specific code, and existing verbs and patterns where they fit (the cookbook lists
   them). Every new schema field or verb carries a one-line comment saying what the engine does with it.
4. The engine supports 1 to 4 seats. "Choose a player", control changes and "each player" must work with several seats.
5. Choices: the reducer never takes a number or a card the engine did not offer; choices are frames with options (see
   `Pick`, `Choose`, effect-frames.ts). If you add a verb that can appear inside a `Choose` option, give it words in
   `src/play/choice-words.ts` (`instructionWords`): a test checks every branch reads as a sentence.
6. A line may stay open only if it is genuinely impossible to express in this engine; report it with the reason.

## Checkpoints (API usage limits can stop you mid-task)

- Keep a handover file at `docs/handover/<F>.md`: what is done, what is in progress, design decisions, next steps, and the
  lines still open, enough for a fresh agent to continue.
- After each meaningful step (a mechanic implemented with its tests passing, a batch of records written), commit on your
  worktree branch with a `WIP <F>: ...` message (restore `src/effects/open-lines.ts` first), handover file included. If
  you sense you are running long, checkpoint first. Your final commit deletes `docs/handover/<F>.md`; the main session
  squashes your branch when merging.

## Checks before committing

Other agents share this 4-core machine: use generous timeouts, run targeted test files while developing and the full
suite once at the end, and never kill processes you did not start (no `pkill`).

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm effects:open`, then `pnpm vitest run scripts/effect-coverage.test.ts src/effects src/rules/families`
- `node --experimental-strip-types scripts/card-smoke.ts <codes>` for every card you wrote records for: no problems reported.
- Full `pnpm test` once at the end (about 10 minutes). Golden snapshots in `src/campaign/golden` (scenario 1 and 2 games)
  must not change. If your change alters them, find out why; fix it unless it is a genuine bug fix, and then explain it.

## Commit

- Before committing, restore the burn-down list: `git checkout src/effects/open-lines.ts` (the main session regenerates
  it after merging every family).
- Commit on your worktree branch with a message describing the mechanics added. End the message with exactly these lines:

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TPVuhJPp87LWJjrLWDF7c7

- Do not push. Do not put model names in the commit.

## Report (your final message)

- Commit hash(es).
- Mechanics added: verb, trigger, flag and field names, and each engine file touched with one line on why.
- Lines now covered (count) and lines left open, each with the reason.
- Shared files you edited and exactly what changed in each (the merge is checked against this).
- Anything you found broken outside your family.
