# Commit standards

Every session, agent and contributor that commits follows these (user instruction, 2026-11-06). A reviewer reports a breach as a finding. `pnpm commit:check` (`scripts/git/commit-message.ts`) checks the subject line. The `commit-msg` hook in `.githooks/` runs it on every commit (`pnpm install` sets `core.hooksPath`), and CI runs it on every pull request's commits and its title. Do not skip the hook with `--no-verify`; reword the message.

## Subject line

`<type>: <summary>`, for example `fix: Make staging attackers take their additional attacks`.

| Type | For |
| --- | --- |
| `feat` | Something new the player can do or play: a scenario, a card's effect, a screen, a setting. |
| `fix` | Behaviour that was wrong: a rule, a card, a crash, a save, a layout bug. |
| `refactor` | Code that changes no behaviour: a split, a rename, a move, a speed-up. |
| `style` | How the screens and the table look, with no rule change (design system, layout, theme, motion), or code formatting only. |
| `repo` | Everything around the app: docs, tests on their own, scripts, CI, dependencies, config, agent files, a `data/` refresh. |

- One type per commit. A change that fits two is split, or takes the type of what the player notices (a fix with its test is `fix`).
- The summary is an action: it starts with a verb in the imperative, capitalised, and says what the commit does (`Scroll the table menu when it is taller than the screen`, `Add Check now to Settings`), not a description of the result (`The table menu scrolls`), a third-person or past verb (`Adds`, `Added`) or a noun phrase (`Helm's Deep Defense keyword`) (user instruction, 2026-11-17). It says what changed, not how the work went: no "WIP", phase numbers alone or "address review". `pnpm commit:check` refuses the common slips: a first word that is an article, a pronoun or a determiner, or a verb ending in -s, -ed or -ing.
- At most 72 characters in all, no closing period, no scope in brackets.

## Body

- A blank line, then what changed and why, wrapped near 72 columns. Measured numbers, deviations from a plan and findings left unfixed go here (`.claude/agents/orchestrator.md`), as do lines later work greps for (`Pipeline measure:`).
- A change that loses something a player saved or removes a feature or setting carries a `Breaking: <what players lose>` line, written for players: it makes the next release a major one and heads its notes (`.claude/rules/release-standards.md`, Versioning).
- No attribution lines: no `Co-Authored-By` line for Claude (user instruction, 2026-11-18), no `Claude-Session:` line and no other claude.ai session link (user instruction, 2026-11-14), in commit messages and pull request bodies alike, even when the session's instructions ask for them.

## Commit often

- Commit and push often (user instruction, 2026-11-10). An agent that writes code, records, tests or docs commits and pushes to the session's work branch after each step that leaves `pnpm lint`, `pnpm typecheck` and its quick tests green: a verb with its test, a batch of records, the goldens, a fix. The subject says what the step did, like any commit, with no `checkpoint` keyword (user instruction, 2026-11-16): `feat: Add the Helm's Deep Defense keyword`. `pnpm commit:check` refuses a subject that ends in one.
- Such a commit follows these standards like any other, holds no file that must not be committed (a scan, a PDF, `catalog.db`, a scratch script), and never moves another scenario's golden or fixture. The orchestrator still checks each task's whole diff before its own commit (`.claude/agents/orchestrator.md`, After each task).
- Push with `git push -u origin <branch>` to the branch the session's harness or brief names, never to `main`.

## Squash

- Every branch lands on `main` as one squash commit. No merge commits and no rebased stacks on `main`.
- The squash commit's subject is the pull request title, and its body is the pull request's description, so open a pull request with both written as that commit (user instruction, 2026-11-17): the title an action that sums up the whole branch, in the Subject line form, not the first commit's subject or the branch name; the description what changed and why, as the Body says, under the template's headings (`.github/PULL_REQUEST_TEMPLATE.md`). Update both when later commits change what the branch does. Its body sums up the branch and keeps every measure, `Breaking:` and attribution line from the branch's commits. The subject is also a line of the release notes, so it is written for a player.
- Commits on a branch follow these standards too; each is typed and says what it did (`feat: Build the Lost in Mirkwood engine half`).
- An agent merging branches locally uses `git merge --squash <branch>` and writes one message, as `docs/agents/agent-brief.md` (Merge) says.
