# Contributing

Contributions are released under the [MIT License](LICENSE) and add no game content (card text, art, rules text) beyond what the sources in `data/sources.json` provide. Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- Follow [README.md](README.md), Local setup, until `pnpm test` passes.
- For anything beyond a small fix, open an issue first to agree the approach.
- Report a wrong ruling or card with the "Rules or card bug" form, naming the card or rule and its printed source (card, booklet, Rules Reference or FAQ).
- Report security problems privately ([SECURITY.md](SECURITY.md)).

## Making a change

1. Fork and branch from `main`, named `<type>/<short-slug>` (`fix/staging-attacks`); see [.claude/rules/release-standards.md](./.claude/rules/release-standards.md), Branches.
2. Before pushing, run `pnpm data:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test`; CI (`.github/workflows/test.yml`) runs the same. While working, `pnpm test:changed` or `pnpm test:scenario <id>` are faster.
3. Commit subjects are `<type>: <summary>` with type `fix`, `feat`, `refactor`, `style` or `repo` ([.claude/rules/commit-standards.md](./.claude/rules/commit-standards.md)). The `commit-msg` hook that `pnpm install` sets up (`.githooks/`) enforces it; `pnpm commit:check "<subject>"` checks one by hand.
4. The pull request title uses the same format. Pull requests are squash-merged, so the title becomes the commit on `main` and a release-notes line: write it for a player. If players lose saved data or a feature, add a `Breaking: <what players lose>` line to the squash body. CI checks the title and every commit subject; the template lists the other checks.

## Releases

Only the release workflow cuts releases ([docs/releasing.md](docs/releasing.md), rules in [.claude/rules/release-standards.md](./.claude/rules/release-standards.md)). Don't bump a version or push a tag in a pull request.

## Conventions

- Code: [.claude/rules/code-standards.md](./.claude/rules/code-standards.md). Docs: [.claude/rules/docs-standards.md](./.claude/rules/docs-standards.md) (current state only; history is in git).
- Rules come from the printed sources. Cite the rule id from `data/rules/entries.json` in the implementing code. A rule change also updates [docs/brief.md](docs/brief.md). Source precedence: [.claude/rules/authority.md](./.claude/rules/authority.md).
- Edit `data/` by hand only in the hand-checked inputs (`data/printed/`, `data/rules/index.json`, `data/rules/columns.json`, `data/overrides.json`, `data/prebuilt-decks.json`, `data/starter-decks.json`). Otherwise change `scripts/data/` and run `pnpm data:build`.
- After changing effect records, run `pnpm effects:open`; after changing doc headings or doc citations, `pnpm docs:index`. Tests fail on stale output.
- Move files with `pnpm move`.
- Never commit `assets/catalog.db`, card scans, card pictures, PDFs, a filled `src/screens/images/scan-map.ts`, secrets or signing keys.
- Out of scope: playtest cards, accounts or a backend, online multiplayer, other card games. Full list in [docs/brief.md](docs/brief.md).

Adding a scenario: [docs/handover/agent-brief.md](docs/handover/agent-brief.md). Authoring effect records: [docs/plans/effect-authoring.md](docs/plans/effect-authoring.md). The Claude Code files in `.claude/` are not needed to contribute.
