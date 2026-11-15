# Contributing

Anything you contribute is released under the [MIT License](LICENSE). Contributions must not add game content (card text, art or rules text) beyond what the sources in `data/sources.json` already provide. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- Work through the Local setup section of [README.md](README.md) until `pnpm test` passes.
- For anything bigger than a small fix, open an issue first so the approach can be agreed before you write the code.
- If a ruling or a card behaves wrongly, report it with the "Rules or card bug" form. Name the card or rule and the printed source it comes from: the card, a booklet, the Rules Reference or the FAQ.
- Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

## Making a change

1. Fork the repository and branch from `main`. Name the branch `<type>/<short-slug>`, for example `fix/staging-attacks`. The Branches section of [.claude/rules/release-standards.md](./.claude/rules/release-standards.md) has the details.
2. Before you push, run `pnpm data check`, `pnpm lint`, `pnpm typecheck` and `pnpm test`. CI (`.github/workflows/test.yml`) runs the same checks. While you work, `pnpm test changed` or `pnpm test scenario <id>` give faster feedback; [docs/development.md](docs/development.md) lists every command.
3. Write commit subjects as `<type>: <summary>`, where the type is `fix`, `feat`, `refactor`, `style` or `repo` ([.claude/rules/commit-standards.md](./.claude/rules/commit-standards.md)). The `commit-msg` hook that `pnpm install` sets up (`.githooks/`) enforces this, and `pnpm commit:check "<subject>"` lets you check a subject by hand.
4. Give the pull request a title in the same format. Pull requests are squash-merged, so the title becomes the commit on `main` and a line in the release notes; write it for a player. If the change makes players lose saved data or a feature, add a `Breaking: <what players lose>` line to the squash commit's body. CI checks the title and every commit subject, and the pull request template lists the other checks.

## Releases

Releases are only ever cut by the release workflow ([docs/releasing.md](docs/releasing.md), with the rules in [.claude/rules/release-standards.md](./.claude/rules/release-standards.md)). Don't bump a version or push a tag in a pull request.

## Conventions

- Code follows [.claude/rules/code-standards.md](./.claude/rules/code-standards.md), and docs follow [.claude/rules/docs-standards.md](./.claude/rules/docs-standards.md). Docs describe the current state only; the history lives in git.
- Rules come from the printed sources. The code that implements a rule cites its id from `data/rules/entries.json`, and a rule change also updates [docs/brief.md](docs/brief.md). When sources disagree, [.claude/rules/authority.md](./.claude/rules/authority.md) says which one wins.
- The only files in `data/` you edit by hand are the hand-checked inputs: `data/printed/`, `data/rules/index.json`, `data/rules/columns.json`, `data/overrides.json`, `data/prebuilt-decks.json` and `data/starter-decks.json`. For anything else, change `scripts/data/` and run `pnpm data build`.
- After you change effect records, run `pnpm effects open`. After you change doc headings or doc citations, run `pnpm doc index`. The tests fail while either output is stale.
- Move files with `pnpm move`, which keeps every reference to them up to date.
- Never commit `assets/catalog.db`, card scans, card pictures, PDFs, a filled-in `src/screens/images/scan-map.ts`, secrets or signing keys.
- Playtest cards, accounts or a backend, online multiplayer and other card games are out of scope. [docs/brief.md](docs/brief.md) has the full list.

To add a scenario, follow [docs/agents/agent-brief.md](docs/agents/agent-brief.md). To write effect records, see [docs/agents/effect-authoring.md](docs/agents/effect-authoring.md). You don't need the Claude Code files in `.claude/` to contribute.
