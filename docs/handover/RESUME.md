# Prompt to resume the work in a new chat

Paste everything below the line into a new Claude Code session on the `j-jmnz/middle-earth-lcg` repository.

---

Continue automating every player card in this repository. The previous session stopped on purpose; all its work is pushed.

**Start here**
1. `git fetch origin && git checkout ccr-a8ef8247-8087n8 && git pull origin ccr-a8ef8247-8087n8`. Work and push on this
   branch (`git push -u origin ccr-a8ef8247-8087n8`).
2. Read `CLAUDE.md` and `.cursor/rules/authority.mdc` (repo rules), then `docs/handover/main.md` (state, merge procedure,
   known follow-ups), `docs/plans/effect-authoring.md` (the effect-record cookbook, "Mechanic families" section), and
   `docs/handover/agent-brief.md` (the brief each family agent follows).

**Standing decisions from the user (2026-10-26). Follow them without asking again**
- Every deck-legal player card must be fully playable: its printed text automated by effect records the engine runs. Use
  whatever resources are needed. `src/effects/open-lines.ts` is the burn-down list (`pnpm effects:open` rewrites it); it is
  meant to reach empty, apart from lines that are genuinely impossible (record why).
- Leave the Messenger of the King cards out (pack MotKA and contract 22134; already excluded via `outOfScope` in
  `data/overrides.json`).
- Extra branches on GitHub are fine (family work goes to `wip/<family>`).
- Before a usage limit can stop work, every agent and the main session update their handover file and commit and push, so
  no progress is lost. Agents checkpoint (`WIP <family>: ...` commits, pushed to `wip/<family>`) after every meaningful step.
  Run at most 4 agents at a time: more than that exhausted the usage limit twice.
- If a question comes up, answer it yourself and record the decision. When everything is done, merge
  `ccr-a8ef8247-8087n8` into `main` and push, without waiting for confirmation.
- No model names in commits. End commit messages with the attribution lines your environment gives you.

**Work, in order**
1. Finish the four families that were in progress. Each has its work on `wip/<family>` and its own handover at
   `docs/handover/<family>.md` (on that branch; copies are on the main branch):
   - attachments (`wip/attachments`): done apart from the final checks and commit.
   - play (`wip/play`): 34 of 35 lines; final full test and commit left.
   - attack (`wip/attack`): records and tests written; one helper in `attack-flow.ts` unfinished; last commit unreviewed.
   - deck (`wip/deck`): schema and part of the engine; records, words and tests left; last commit unreviewed.
   For each, start a fresh agent (general-purpose, `isolation: "worktree"`) with the agent brief, telling it to
   `git fetch origin wip/<family> && git checkout -B wip-<family> origin/wip/<family>` in its worktree first, read its
   handover, check `pnpm exec tsc --noEmit`, finish, keep pushing `wip/<family>`, and report.
2. Merge each finished family onto `ccr-a8ef8247-8087n8` as `docs/handover/main.md` says ("Merging a family"):
   - squash the branch;
   - keep both sides of additive conflicts;
   - reduce names two families both added to one definition (the expected clashes are listed there);
   - run `tsc`, `pnpm lint`, `pnpm effects:open` and the full `pnpm test` (goldens must not change);
   - commit the regenerated open lines and push.
3. Start the two families not yet begun, from the current branch head: **sidequests** and **misc**. Their line lists are in
   `docs/handover/families/`; drop the lines no longer in `src/effects/open-lines.ts`. Merge them the same way.
4. Fix the known follow-ups listed in `docs/handover/main.md`.
5. Scenarios 3 to 6 (Flight to the Ford; The Ring Goes South; Journey in the Dark; Breaking of the Fellowship):
   - write records for their encounter and campaign cards (`docs/handover/families/scenario-141.txt`,
     `scenario-142.txt`, filtered by the open lines);
   - add the mechanics they need (for example the Ring-bearer's life and the burden deck);
   - add each finished scenario to `src/campaign/playable.ts`.
6. Run a second pass on any line left open, then update the cookbook's "Not expressible yet" section and
   `docs/phases/STATUS.md`. A cloud session has no phone checks, so say they stay open.
7. Delete `docs/handover/`, run the full checks, merge into `main`, and push.
