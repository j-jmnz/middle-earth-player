# Contributing

Thanks for helping. This is a fan-made project: by contributing you agree that your code and docs are released under the [MIT License](LICENSE), and that you add no game content (card text, art, rules text) beyond what the sources in `data/sources.json` already provide. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- Read [README.md](README.md), Local setup, and get `pnpm test` green on a fresh clone.
- For anything larger than a small fix, open an issue first so the approach can be agreed before you write it.
- Report a wrong ruling or a card that plays wrongly with the "Rules or card bug" issue form. Name the card or rule and the printed source (the card, the booklet, the Rules Reference or the FAQ), not memory.
- Report a security problem privately, as [SECURITY.md](SECURITY.md) says, not in a public issue.

## Making a change

1. Fork the repo and branch from `main`.
2. Before you push, run `pnpm data:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test`. CI (`.github/workflows/test.yml`) runs the same checks on every push and pull request. While you work, `pnpm test:changed` or `pnpm test:scenario <id>` give quicker feedback.
3. Write each commit message as [.claude/rules/commit-standards.md](./.claude/rules/commit-standards.md) says: `<type>: <summary>`, with type `fix`, `feat`, `refactor`, `style` or `repo`. `pnpm commit:check "<subject>"` checks a subject.
4. Open a pull request whose title follows the same format, and say what changed and why. Pull requests are squash-merged, so the title becomes the commit on `main`. CI checks the title and every commit subject; the pull request template lists the other checks.

## Conventions

- Code follows [.claude/rules/code-standards.md](./.claude/rules/code-standards.md). Docs follow [.claude/rules/docs-standards.md](./.claude/rules/docs-standards.md): they describe the current state, and history stays in git.
- Rules come from the printed sources, not memory. Cite the rule id from `data/rules/entries.json` in the code that implements it. A rule change also updates [docs/brief.md](docs/brief.md). Which source wins when two disagree is set in [.claude/rules/authority.md](./.claude/rules/authority.md).
- Don't edit `data/` by hand except for the hand-checked inputs (`data/printed/`, `data/rules/index.json`, `data/rules/columns.json`, `data/overrides.json`, `data/prebuilt-decks.json`, `data/starter-decks.json`). Change the build in `scripts/data/` and run `pnpm data:build`.
- After adding or changing effect records, run `pnpm effects:open`. After changing doc headings or doc citations in code, run `pnpm docs:index`. Tests fail when either output is stale.
- Use `pnpm move` to move files.
- Never commit `assets/catalog.db`, card scans, card pictures, PDFs, a filled `src/screens/images/scan-map.ts`, or any secret or signing key.
- Out of scope: playtest cards, accounts or a backend, online multiplayer, and support for other card games. [docs/brief.md](docs/brief.md) has the full list of non-goals.

Adding a scenario follows the procedure in [docs/handover/agent-brief.md](docs/handover/agent-brief.md), and authoring effect records follows [docs/plans/effect-authoring.md](docs/plans/effect-authoring.md). The repo also contains Claude Code agent definitions and rules in `.claude/`; you don't need them to contribute.
