# Claude Code

The rules for every session are in `.cursor/rules/authority.mdc`. Read it. The README, `docs/brief.md`, and `docs/architecture.md` win over anything here.

## Data

`data/` is committed and is the only thing tests and agents read for cards, scenarios and rules text. Sources are listed in `data/sources.json`.

- `pnpm data:sync [ringsdb|hallofbeorn|dragncards|rules|scans]` is the only command that uses the network. It refreshes `data/raw/`, `.cache/pdf/` and `.cache/scans/` (card scans, never committed; the ledger pins each by sha256).
- `data/printed/<campaign>.json` is the printed-text ledger: the lines on each card side, read from its scan. The build uses it in place of Hall of Beorn text. An effect record names the ledger lines it implements (`lines`).
- `data/rules/index.json` is the hand-checked list of rule spans (exact `from` and `to` quotes per page column); `data/rules/columns.json` holds the per-document column boxes. `data/rules/entries.json` is built from them.
- `pnpm data:build` is offline and deterministic: raw to `data/cards`, `data/scenarios`, `data/campaigns`, `data/rules`, and `src/effects/generated`. `pnpm data:build -- --verbose` lists the scenarios whose cross-checks failed.
- `pnpm data:check` rebuilds into a temporary directory and fails on any difference. CI runs it.
- `pnpm data:query "<sql>"` queries tables `cards`, `scenario_cards` and `rules` in memory. Rules text is `select id, title, text from rules where ...`.
- `pnpm effects:draft <scenario-id | starter-deck-id>` writes `.agent/drafts/<code>.md` for each printed ledger line no effect record owns. The `effect-author` agent turns a bundle into records in `src/effects/authored/`.

**Sources are online.** Any resource a task needs (rules PDFs, booklets, card scans, card text) comes from an online source, fetched through `pnpm data:sync` and recorded in `data/sources.json`. Query the PDF when a rule or card line is in question; do not ask for a physical card, do not rely on memory, and do not paste a PDF into the repo. (User instruction, 2026-10-24.)

## Commands

- `pnpm test` runs Vitest. `pnpm vitest run <file>` runs one file. No network and no prebuilt database are needed.
- `pnpm lint` checks import boundaries.
- `node --experimental-strip-types scripts/e2e-fixtures.ts` rewrites the Maestro save fixtures (`src/campaign/fixtures/`) when `fixtures.test.ts` says a fixture no longer reaches its moment. `--won` also searches for scenario 1's won game, which is open (`docs/phases/STATUS.md`).
- `pnpm catalog:build` writes `assets/catalog.db` and `src/catalog/version.ts` from `data/`. Do not commit `catalog.db`. Commit `version.ts` when it changes; a test checks it.

## Agents

`implementer`, `reviewer`, and `ux` in `.claude/agents` wrap the files in `.cursor/agents`. Edit the Cursor file to change an agent's behavior. After `implementer` reports a green exit, run `reviewer` on the diff, and `ux` as well when `src/screens` or `src/play` changed. `effect-author` is a Claude agent only.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies. A cloud session has no phone, simulator, or Maestro. Phone checks in a phase exit stay open. Say so in `docs/phases/STATUS.md` instead of marking them done.
