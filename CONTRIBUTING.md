# Contributing

Anything you contribute is released under the [MIT License](LICENSE). Contributions must not add game content (card text, art or rules text) beyond what the sources in `data/sources.json` already provide. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

You need Node 22.18 or later and pnpm 10.34.1 (`corepack enable` installs the pinned version). `poppler` is optional: it renders the campaign, boon and burden cards from FFG's PDFs, and without it those cards fall back to their scans.

```bash
git clone https://github.com/j-jmnz/middle-earth-player.git
cd middle-earth-player
pnpm install
pnpm test        # no network or prebuilt database needed
pnpm web         # opens the app in a browser; narrow the window to phone width
pnpm desktop dev # opens the app in the Electron desktop shell
```

[docs/development.md](docs/development.md) covers phone builds and every `pnpm` command.

## Before you start

- Work through Local setup until `pnpm test` passes.
- For anything bigger than a small fix, open an issue first so the approach can be agreed before you write the code.
- If a ruling or a card behaves wrongly, report it with the "Rules or card bug" form. Name the card or rule and the printed source it comes from: the card, a booklet, the Rules Reference or the FAQ.
- Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

## Making a change

1. Fork the repository and branch from `main`. Name the branch `<type>/<short-slug>`, for example `fix/staging-attacks`. The Branches section of [.claude/rules/release-standards.md](./.claude/rules/release-standards.md) has the details.
2. Add tests with the change: a new feature, card effect or rule gets tests in the automated suite (`pnpm test`), and a bug fix gets a test that fails without it.
3. Before you push, run `pnpm data check`, `pnpm lint`, `pnpm typecheck` and `pnpm test`. CI (`.github/workflows/test.yml`) runs the same checks. While you work, `pnpm test changed` or `pnpm test scenario <id>` give faster feedback; [docs/development.md](docs/development.md) lists every command.
4. Write commit subjects as `<type>: <summary>`, where the type is `fix`, `feat`, `refactor`, `style` or `repo` and the summary is an action that starts with an imperative verb (`fix: Scroll the table menu when it is taller than the screen`) ([.claude/rules/commit-standards.md](./.claude/rules/commit-standards.md)). The `commit-msg` hook that `pnpm install` sets up (`.githooks/`) enforces this, and `pnpm commit:check "<subject>"` lets you check a subject by hand.
5. Give the pull request a title in the same format, summing up the whole branch, and a description that reads as that commit's body. Pull requests are squash-merged, so the title becomes the commit on `main` and a line in the release notes, and the description its body; write the title for a player. If the change makes players lose saved data or a feature, add a `Breaking: <what players lose>` line to the squash commit's body. CI checks the title and every commit subject, and the pull request template lists the other checks.

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

## Project structure

- `data/` holds the card, scenario and rules data. It is committed and built offline from snapshots in `data/raw/`, and `data/sources.json` pins every source.
- `data/printed/` records the lines printed on each card, read from its scan. This is the card text the app uses.
- Each printed line is implemented by an effect record, generated in `src/effects/generated/` or hand-written in `src/effects/authored/`. A scenario becomes playable once every line it deals has a record.
- `src/rules/` is the rules engine: a pure reducer, split by mechanic family.
- `desktop/` is the Electron shell that packs the web build into the Windows, macOS and Linux apps.
- When sources disagree, [.claude/rules/authority.md](./.claude/rules/authority.md) says which one wins.

The stack is Expo SDK 58, Expo Router, Skia, Reanimated, NativeWind, SQLite with Drizzle, Zustand and Zod, with Electron for the desktop app. [docs/architecture.md](docs/architecture.md) goes into detail.

To add a scenario, follow [docs/agents/agent-brief.md](docs/agents/agent-brief.md). To write effect records, see [docs/agents/effect-authoring.md](docs/agents/effect-authoring.md).

## Documentation

- [docs/brief.md](docs/brief.md) records the product decisions and the rules as implemented.
- [docs/architecture.md](docs/architecture.md) covers the code layout, state, the engine and the tests.
- [docs/development.md](docs/development.md) covers running the app, the test flows and the commands.
- [docs/design-system.md](docs/design-system.md) and [docs/design-system-table.md](docs/design-system-table.md) describe the screens and the game table.
- [docs/releasing.md](docs/releasing.md) walks through the release pipeline.
- [docs/INDEX.md](docs/INDEX.md) is a generated index of every doc, section by section.

## AI-assisted development

Claude (Anthropic) writes most of the code, tests and docs in Claude Code. The maintainer directs that work: they set the product and its rules and decide what lands on `main`. Commits written this way name Claude as the author or in a `Co-Authored-By` line. The instructions the agents follow are in `CLAUDE.md`, `.claude/rules/` and `.claude/agents/`; you don't need them to contribute.

Nothing lands until CI passes the tests, lint, the type check and the data check. Rules come from the printed cards and booklets, and the engine code cites the id of each rule it implements.
