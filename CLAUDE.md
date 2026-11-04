# Claude Code

The rules for every session are in `.cursor/rules/authority.mdc`. Read it. Any session or agent that changes code also reads `.cursor/rules/code-standards.mdc` and follows it; one that changes a doc, `docs/phases/STATUS.md` or an agent file follows `.cursor/rules/docs-standards.mdc` (current state only, no history logs). The README, `docs/brief.md`, and `docs/architecture.md` win over anything here.

Find docs through `docs/INDEX.md`: every file an agent reads, its size, the heading tree of the long ones with line ranges, and the sections each code area cites. Read a section, not a whole file: `pnpm docs:section <file> "<heading>"` (for example `pnpm docs:section brief "Core round"`). After changing a doc's headings or a doc citation in code, run `pnpm docs:index`; a test fails while the index is stale or a citation names no heading.

## Data

`data/` is committed and is the only thing tests and agents read for cards, scenarios and rules text. Sources are listed in `data/sources.json`.

- `pnpm data:sync [ringsdb|hallofbeorn|dragncards|rules|scans|pictures|icons]` is the only command that uses the network. It refreshes `data/raw/` and the uncommitted caches under `.cache/`: PDFs, card scans (pinned by sha256 in the ledger) and every card's picture, which `pnpm scans:pack` bundles so the app needs no network (picture sources, in order, are in `scripts/data/sources/pictures.ts`; shown only, never read for text). `scans` and `pictures` read `data/cards`, so a bare `data:sync` skips them: run `pnpm data:build`, then `pnpm data:sync scans pictures`. Adding cards (a campaign, a pack, a scenario) is not done until `pictures` has run on them: a card with no picture pin is bundled from its small scan, so its art and its scenario's scene look blurred next to the others. `scripts/data/sources/pictures.test.ts` fails on a card a built scenario deals without one; add a code to its exception list only when no picture source has the card. `rules` also packs the two booklet PDFs into `assets/booklets/`, gitignored (`pnpm booklets:pack` does only that).
- `data/printed/<campaign>.json` is the printed-text ledger: the lines on each card side, read from its scan. The build uses it in place of Hall of Beorn text. An effect record names the ledger lines it implements (`lines`).
- `data/rules/index.json` is the hand-checked list of rule spans (exact `from` and `to` quotes per page column); `data/rules/columns.json` holds the per-document column boxes. `data/rules/entries.json` is built from them.
- `data/prebuilt-decks.json` names the pre-built player decks: the Learn to Play's four core decks (`ltp.starter-decks`) and every decklist an official product prints (`decklist.*` spans, read from the product PDFs that `data:sync rules` pins). The build resolves each row through Hall of Beorn and writes `data/decks/prebuilt.json`; a printed misspelling is an alias with its reason, a wrong heading total a recorded misprint.
- Every script logs through `scripts/log.ts` to stderr; `--verbose` adds each request, file and stack, `--quiet` keeps warnings and errors, `LOG_LEVEL` sets either. A new script calls `runScript(tag, main)` and logs with the `Log` it is handed, not `console`.
- `pnpm data:build` is offline and deterministic: raw to `data/cards`, `data/scenarios`, `data/campaigns`, `data/rules`, `src/effects/generated`, and the game icons (`assets/icons`, `src/ui/icons`). `pnpm data:build -- --verbose` lists the scenarios whose cross-checks failed.
- `pnpm data:check` rebuilds into a temporary directory and fails on any difference. CI runs it.
- `pnpm data:query "<sql>"` queries tables `cards`, `scenario_cards` and `rules` in memory. Rules text is `select id, title, text from rules where ...`.
- `pnpm effects:draft <scenario-id | starter-deck-id | pack | code,code,...>` writes `.agent/drafts/<code>.md` (not committed) for each card with a printed ledger line no effect record owns. The `effect-author` agent turns a bundle into records in `src/effects/authored/`.
- `pnpm effects:open` rewrites `src/effects/open-lines.ts`, the printed lines no record owns. A test compares it, so run it after adding or changing records. `src/campaign/playable.ts` lists the scenarios whose lines are all covered.
- `node --experimental-strip-types scripts/card-smoke/run.ts <codes>` plays a seeded game with a player card's records and reports any throw, refusal or stall (`--all` runs every card).

**Sources are online.** Any resource a task needs (rules PDFs, booklets, card scans, card text) comes from an online source, fetched through `pnpm data:sync` and recorded in `data/sources.json`. Query the PDF when a rule or card line is in question; do not ask for a physical card, do not rely on memory, and do not paste a PDF into the repo. (User instruction, 2026-10-24.)

## Commands

- `pnpm test` runs Vitest. `pnpm vitest run <file>` runs one file. No network and no prebuilt database are needed.
- `pnpm test:changed` runs the tests that import a file changed since the last commit; `pnpm test:fast` runs everything but the slow files (`slowFiles` in `vitest.config.mts`). When to run which is `.cursor/rules/code-standards.mdc`, Checking a change.
- `pnpm lint` runs Oxlint (`.oxlintrc.json`): the import boundaries and the React and Expo rules.
- `pnpm typecheck` type-checks with tsrs (the Rust port of TypeScript 7). The `typescript` package stays for the editor and the tests that parse source.
- `pnpm move <old> <new>` (or `pnpm move <map.json>`, `--dry-run` first) moves tracked files and folders and rewrites every relative import and every root-written path in code, docs and configs that names them; a file's `.native` variants and its test go with it. It lists what it cannot follow (paths built at run time). Move files with it, not by hand.
- `node --experimental-strip-types scripts/e2e/fixtures.ts` rewrites the Maestro save fixtures (`src/campaign/fixtures/`) when `fixtures.test.ts` says a fixture no longer reaches its moment. `--won` also searches for scenario 1's won game, which is open (`docs/phases/STATUS.md`).
- `pnpm android:usb --device` runs the app on a phone plugged in by USB when the phone cannot reach Metro over the network (a VPN or isolated Wi-Fi shows a blank screen and `ConnectException` to the Mac's LAN address): it forwards port 8081 with `adb reverse` and points the app at `localhost`.
- `pnpm catalog:build` writes `assets/catalog.db` and `src/catalog/version.ts` from `data/`. Do not commit `catalog.db`. Commit `version.ts` when it changes; a test checks it.

## Agents

`implementer`, `reviewer`, `ux` and `orchestrator` in `.claude/agents` wrap the files in `.cursor/agents`. Edit the Cursor file to change an agent's behavior. `docs/handover/agent-brief.md` is the brief for an agent that owns one mechanic family (`docs/plans/effect-authoring.md`). After `implementer` reports a green exit, run `reviewer` on the diff, and `ux` as well when `src/screens` or `src/play` changed. `effect-author` is a Claude agent only. A plan with several sections is run by `orchestrator` (`.cursor/agents/orchestrator.md`): every agent that writes code runs on Sonnet, every review agent (`reviewer`, `ux`) on Opus, and there is one review round only.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies. A cloud session has no phone, simulator, or Maestro. Phone checks in a phase exit stay open. Say so in `docs/phases/STATUS.md` instead of marking them done.
