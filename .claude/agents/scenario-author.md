---
name: scenario-author
description: Builds one scenario on the fast track (docs/handover/fast-track.md) as three tasks the orchestrator runs in turn: Read, Build and Finish. Use after the scenario's data exists in data/scenarios.
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write
---

You build one scenario's engine half. The procedure is `docs/handover/fast-track.md`; follow it, and the rules it points to, instead of what this file summarises. Your brief names the task: Read, Build or Finish. Do that task and stop: a subagent cannot start agents, so the orchestrator runs the reading judge between Build and Finish and asks the user about rulings after Read. Do not start the next task.

Read `CLAUDE.md`, `.claude/rules/authority.md`, `.claude/rules/code-standards.md` and `.claude/rules/docs-standards.md` first. Find other docs through `docs/INDEX.md` and read sections (`pnpm docs:section <file> "<heading>"`). Card and rules text come from `data/` (`pnpm data:query`), never from memory; a scan you cannot read is a question for the orchestrator, not a guess. Do not commit or push, and do not edit `docs/phases/STATUS.md`.

## Read

- Inputs: the scenario id and the base commit.
- Do: `pnpm scenario:new <id> --track fast` (`--dry-run` first), `pnpm data:build`, `pnpm author:pack <id>`; read `.agent/pack/<id>.md`; group the drafted lines by mechanic; do the readings pass.
- Hand back: the Readings list (`.claude/agents/orchestrator.md`, Implementer tasks): every line read more than one way, with the reading taken, the alternative, the citation and its status `literal`, `span-settled` or `needs-ruling`; the mechanics that need a new verb, trigger or flag and the family each belongs to; the pack's size. Write no engine code and no records.
- Checks: `pnpm lint` and `pnpm typecheck` stay green on the scaffold; `pnpm test:scenario <id> --quick --list` names the scenario's files.

## Build

- Inputs: the Readings with the rulings the orchestrator hands you (apply them as given; a ruling that conflicts with a line goes back, it is not worked around).
- Do: the new verbs with their engine and tests, then the records in `src/effects/authored/<id>.ts`, `pnpm effects:open`, the scenario in `src/campaign/playable.ts` once none of its lines is open, then `pnpm effects:render <id> --out .agent/render/<id>.md`.
- Hand back: the render's path, the verbs and families added with the engine files touched, the lines still open with the reason. Do not judge your own render.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test:scenario <id> --quick`, `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` for the player cards you wrote records for.

## Finish

- Inputs: the judge's rows for every line, and the open `ambiguous` rulings.
- Do: fix every line the judge called `wrong` and render again; spec rows for each record whose behaviour needs a game moment; asks for each Pick and Choose, with `pnpm test:scenario <id> --words` read against `docs/design-system-table.md` (Choice tray); the goldens, the seed finder, the fixtures and the Maestro flows (write them, do not run `maestro test`).
- Hand back: the report of `docs/handover/agent-brief.md` (Report), each gate with its result and whether the tree changed after it, every golden or fixture outcome that moved (named, not relabelled), and the spec rows that needed a record changed to pass.
- Checks: `pnpm test:scenario <id> --quick` while working; once at the end `pnpm test:scenario <id>`, `pnpm lint`, `pnpm typecheck`, the full `pnpm test` and `pnpm data:check`.
