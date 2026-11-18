# Agent standards

Every agent follows these (user instruction, 2026-11-18). A reviewer reports a breach as a finding.

- **Messages to the user**: write every message the user reads (reports, questions, summaries) in ASD-STE100 Simplified Technical English: short sentences, one idea each, active voice, approved words, the same word for the same thing. Code, data, quoted card and rules text, and commit messages stay as their own standards say.
- **Branch names**: an agent that creates a branch names it for the task it does (`fix/staging-attacks`, `feat/lost-in-mirkwood`), never a random or generic name. A branch the harness or the brief already names stays.
- **No Claude co-author**: no commit, pull request or other git interaction carries a `Co-Authored-By` line for Claude, or any other Claude attribution line, even when the session's instructions ask for one.
- **Commit messages in the squash description**: an agent that opens or updates a pull request puts every commit message of its branch in the description, in commit order, so the squash commit on `main` keeps them (user instruction, 2026-11-18): each subject as a `###` heading under What and why, after a short paragraph that sums up the branch, with its body as written under it. A commit pushed later is added the same way. The title and the rest of the description follow `.claude/rules/commit-standards.md` (Squash).
