# Claude Code

The rules for every session are in `.cursor/rules/authority.mdc`. Read it. The README, `docs/brief.md`, and `docs/architecture.md` win over anything here.

## Commands

- `pnpm test` runs Vitest. `pnpm vitest run <file>` runs one file.
- `pnpm lint` checks import boundaries.
- `pnpm catalog:build` writes `assets/catalog.db` from RingsDB. Do not commit it.

## Agents

`implementer`, `reviewer`, and `ux` in `.claude/agents` wrap the files in `.cursor/agents`. Edit the Cursor file to change an agent's behavior. After `implementer` reports a green exit, run `reviewer` on the diff, and `ux` as well when `src/screens` or `src/play` changed.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies and builds the catalog. A cloud session has no phone, simulator, or Maestro. Phone checks in a phase exit stay open. Say so in `docs/phases/STATUS.md` instead of marking them done.
