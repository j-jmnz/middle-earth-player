# The fast track: building a scenario with one author

The procedure for a scenario scaffolded with `pnpm scenario:new <id> --track fast`. It parallels `docs/handover/agent-brief.md` (Scenario procedure) and points to the doc that owns each rule; read those sections, not this page's summary of them. `.claude/agents/scenario-author.md` is the agent that follows it, `.claude/agents/orchestrator.md` the session that runs the tasks. `docs/plans/scenario-fast-track.md` says why each part exists.

A subagent cannot start agents, so the orchestrator runs the author as three tasks and the `reading-judge` between the second and the third:

1. **Read.** Scaffold, pack, drafts, a readings pass. Hands back the readings that need a ruling, before any engine work.
2. **Build.** Verbs and records with the rulings applied, then `pnpm effects:render`. Hands back the render.
3. **Finish.** Fixes every line the judge called `wrong`, then the spec rows, the asks and the goldens.

## Read

- **Scaffold.** `pnpm scenario:new <id> --track fast --dry-run`, then without `--dry-run`. The fast skeleton has no scene file: its game, golden and campaign tests read `data/scenarios/<id>.json`, the card tests are spec rows (`src/campaign/scenarios/<id>/spec.test.ts`) and the choice words are an asks file (`src/play/words/asks/<id>.ts`). The registry lines are the classic track's (`docs/handover/agent-brief.md`, Approach, step 7). Then `pnpm data:build`, which adds the authored file and the asks file to their barrels.
- **Pack.** `pnpm author:pack <id>` runs `pnpm effects:draft <id>` and writes `.agent/pack/<id>.md`: the vocabulary, the schema entries of the verbs the drafts' nearest records use, the cookbook sections those records need and the drafts. Read it in place of the brief's reading list (`docs/handover/agent-brief.md`, Setup). Read a file beyond it only when a verb's fields or a rule are in question.
- **Data and rules.** The scenario's data cross-check, a scan the author cannot read and the rule sources are `docs/handover/agent-brief.md` (Scenario procedure, step 1); the authority order is `.claude/rules/authority.md`. Rule text comes from `pnpm data:query`, never from memory.
- **Readings.** Read every draft's line against `docs/plans/effect-authoring.md` (Readings the review catches), group the lines by mechanic, and list each line that can be read more than one way: the line, the reading taken, the alternative, a citation (a ledger line or a rule span) and a status `literal`, `span-settled` or `needs-ruling` (`.claude/agents/orchestrator.md`, Implementer tasks).
- **Hand-back.** The readings list and the mechanics that need a new verb, trigger or flag. No engine code and no records yet. The orchestrator asks the user once about the `needs-ruling` readings; rulings go to `docs/brief.md`, the other readings to Open items in `docs/phases/STATUS.md`.

## Build

- **Mechanics.** A new mechanic is a verb, trigger or flag in a family, with its engine and its own test (`docs/plans/effect-authoring.md`, Mechanic families: engine and records together; `docs/handover/agent-brief.md`, Scenario procedure, step 3).
- **Records.** `src/effects/authored/<id>.ts`, a repeated sentence as a template and a line printed the same as another card's as a copy (`docs/plans/effect-authoring.md`, Templates and copied lines). The rulings the orchestrator hands over are applied as given. `pnpm effects:open` after the records; the scenario goes in `PLAYABLE_SCENARIOS` (`src/campaign/playable.ts`) once none of its lines is open.
- **Render.** `pnpm effects:render <id> --out .agent/render/<id>.md` (`scripts/data/effects/render.ts`) prints each ledger line with its records as English. A piece printed as `[json ...]` or `[also {...}]` has no template yet: read it as the record says.
- **Hand-back.** The render's path, the verbs added, the lines still open. The orchestrator then runs `reading-judge` on the render and the ledger, with a fresh context.

## Finish

- **Fix the wrongs.** Every line the judge called `wrong` is fixed in the records and rendered again; an `ambiguous` line that is a real choice goes back to the orchestrator.
- **Spec rows.** One row for each record whose behaviour needs a game moment, in `spec.test.ts` (`test/harness/card-spec.ts` says the row's shape and runs it again with its line's records removed, failing a row that still passes). A full test file is for a new verb (a family test) or a multi-step mechanic a row cannot express; each of its tests starts its title with the line id it covers. `scripts/checks/spec-coverage.test.ts` (run by `pnpm test:scenario`) fails a line the records name that has neither a row nor such a test, and a test file whose header claims a line it does not test.
- **Asks.** An entry for each Pick and Choose in `src/play/words/asks/<id>.ts` (`src/play/words/asks.ts` says the key and the template fields), checked with `pnpm test:scenario <id> --words` against `docs/design-system-table.md` (Choice tray): each sentence names its number, side and owner. No gate test: an entry is keyed by its record.
- **Goldens, fixtures and flows.** The golden, the seed finder and the Maestro flows as `docs/handover/agent-brief.md` (Scenario procedure, step 5) says, on the shared kit; list the goldens in `test/harness/golden-registry.ts`. A rule change that can move a replayed game bumps `ENGINE_VERSION` (`.claude/agents/implementer.md`).
- **The loop.** `pnpm test:scenario <id> --quick` while working: it skips the goldens and the reader check. `pnpm test:scenario <id>` runs once before the hand-back.
- **Gates.** `pnpm lint`, `pnpm typecheck`, the full `pnpm test` once at the end, and `pnpm data:check` (`.claude/rules/code-standards.md`, Checking a change). The report is the one in `docs/handover/agent-brief.md` (Report).

## Review

The review round is `.claude/agents/orchestrator.md` (One review round), the same for both tracks.
