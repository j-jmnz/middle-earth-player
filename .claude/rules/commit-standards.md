# Commit standards

Every session, agent and contributor that commits follows these (user instruction, 2026-11-06). A reviewer reports a breach as a finding. `pnpm commit:check` (`scripts/git/commit-message.ts`) checks the subject line; CI runs it on every pull request's commits and its title.

## Subject line

`<type>: <summary>`, for example `fix: Staging attackers make their additional attacks`.

| Type | For |
| --- | --- |
| `feat` | Something new the player can do or play: a scenario, a card's effect, a screen, a setting. |
| `fix` | Behaviour that was wrong: a rule, a card, a crash, a save, a layout bug. |
| `refactor` | Code that changes no behaviour: a split, a rename, a move, a speed-up. |
| `style` | How the screens and the table look, with no rule change (design system, layout, theme, motion), or code formatting only. |
| `repo` | Everything around the app: docs, tests on their own, scripts, CI, dependencies, config, agent files, a `data/` refresh. |

- One type per commit. A change that fits two is split, or takes the type of what the player notices (a fix with its test is `fix`).
- The summary starts like a sentence and says what changed, not how the work went: no "WIP", phase numbers alone or "address review".
- At most 72 characters in all, no closing period, no scope in brackets.

## Body

- A blank line, then what changed and why, wrapped near 72 columns. Measured numbers, deviations from a plan and findings left unfixed go here (`.claude/agents/orchestrator.md`), as do lines later work greps for (`Pipeline measure:`).
- End with the attribution lines the session's instructions give, if any.

## Squash

- Every branch lands on `main` as one squash commit. No merge commits and no rebased stacks on `main`.
- The squash commit's subject is the pull request title, so the title follows Subject line. Its body sums up the branch and keeps every measure line and attribution line from the branch's commits.
- Commits on a branch follow these standards too; checkpoints are still typed (`feat: Lost in Mirkwood engine half, checkpoint`).
- An agent merging branches locally uses `git merge --squash <branch>` and writes one message, as `docs/handover/agent-brief.md` (Merge) says.
