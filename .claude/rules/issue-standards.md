# Issue standards

Every agent that works on a GitHub issue follows these, in this order (user instruction, 2026-11-21). A reviewer reports a breach as a finding. A task that only touches an issue on the side (it fixes one while doing other work) follows Finish.

## Pick it up

- Read the issue, its comments and the open pull requests. When an open pull request already works on the issue, continue on that branch and its pull request; do not start a second one.
- Read the attachments while they last. A Discord attachment link expires after about a day (`docs/discord-issues.md`, Issue updates). When a link no longer opens, work from the text and say so in the triage comment.
- One issue is one branch and one pull request. Issues with one cause share a branch, and its description names each of them.

## Label it first

- Label the issue before any branch, edit or test run. Use only the repository's existing labels, never a new one: `bug` for behaviour that is wrong (a crash, a save, a layout, a control), `rules` for a rule or a card the engine plays wrong, `enhancement` for something new, and `accessibility`, alone or beside another, for a barrier to a screen reader, a text size, contrast or motion settings. These are the labels the issue templates use (`.github/ISSUE_TEMPLATE`).
- The Discord bot files an issue with the label the reporter chose (`docs/discord-issues.md`, What it does). Check it against the report, and change it when it is wrong.
- Do not change the issue's title or text, assign it, or delete the hidden `<!-- discord issue:… -->` line at the end of its body.

## Triage comment

- Right after the label, comment with what the report is (the screen or the rule, and the kind of fault), the cause when it is already clear, else what will be checked, and the work branch, named for the task (`.claude/rules/agent-standards.md`).
- When the report does not say enough to find the fault and the code does not settle it, the comment says what is missing, and the agent tells the user. It does not guess a fix. A rules reading that `data/` does not settle is an open point (`.claude/rules/authority.md`, Open points), not a question for the reporter.

## Find the cause

- Reproduce the fault before the fix: `pnpm browser shot` or `pnpm browser run` for a screen, `pnpm game show` for a rule or a card, or a test that fails. When the web build cannot show it (a phone-only fault), find the cause in the code and say in the comment and the pull request that no phone checked it.
- The fix comes with a test that fails without it, where a test can hold it (`.github/PULL_REQUEST_TEMPLATE.md`, Checks).

## Progress comments

- Comment when the cause is found (the cause in a sentence or two, and the fix) and when the pull request is open (`.claude/rules/agent-standards.md`). Do not comment for each commit or test run, and do not paste command output.
- The Discord bot posts a comment's first 600 characters in the reporter's thread (`docs/discord-issues.md`, Issue updates). Write each comment for the reporter: ASD-STE100, the result first, code names in backticks only where they help.
- End every comment with the footer the session's instructions give for GitHub comments.
- When the work stops before a pull request (blocked, or no fault found), comment on what is still open and why.

## Finish

- The commit and the pull request name the issue as `Settles #<n>` when the branch finishes it and `Refs #<n>` when it does only part, each on its own line under What and why, never after a GitHub closing keyword (`Closes`, `Fixes`, `Resolves`); `pnpm commit:check` refuses those. The issue stays open at the merge: the release that ships it comments on it and closes a `Settles` issue (user instruction, 2026-11-20; `docs/releasing.md`, Issue comments). Do not close it by hand.
- Before the pull request opens, look through the open issues for others the work settles or refers to, and treat each as above: its labels, a `Settles` or `Refs` line, and a comment with a link to the pull request and one line on what it changes. A task with no related issue says so in its report and adds no issue line (user instruction, 2026-11-19).
- The report to the user names the issue, the label, the comments posted, the pull request and the checks, and says what no check could show.
