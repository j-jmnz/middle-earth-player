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
- Spawn every agent on Sonnet 5.5: pass `model: "sonnet"` in each Agent call.
- If a question comes up, answer it yourself and record the decision. When everything is done, merge
  `ccr-a8ef8247-8087n8` into `main` and push, without waiting for confirmation.
- No model names in commits. End commit messages with the attribution lines your environment gives you.

**Work, in order** (steps 1 to 4 of the original plan and scenarios 3 and 4 are done; see `docs/handover/main.md`)
1. Phase 15 (Journey in the Dark), then phase 16 (Breaking of the Fellowship): one `implementer` agent each
   (`model: "sonnet"`, `isolation: "worktree"`), based on this branch, pushing to `wip/phase-15` / `wip/phase-16`, the
   same way phases 13 and 14 were done. Merge each as `docs/handover/main.md` says ("Merging a family").
2. Fix the phase 13 review findings listed in `docs/handover/main.md`; run `reviewer` on phases 14 to 16.
3. Run a second pass on any line left open, then update the cookbook's "Not expressible yet" section and
   `docs/phases/STATUS.md`. A cloud session has no phone checks, so say they stay open.
4. Delete `docs/handover/`, run the full checks, merge into `main`, and push.
