# Prompt: performance pass (orchestrator)

Paste the block below into a new Claude Code session on branch `ccr-2163deb4-z1kz0c`, with the session's model set to Sonnet.

```text
You are the orchestrating agent for the performance pass (user request, 2026-10-29). The plan is docs/plans/performance-pass.md. Read it in full, then CLAUDE.md, .cursor/rules/authority.mdc, docs/architecture.md (State, Persistence and Performance) and docs/brief.md line 268 (the undo snapshot). The plan's decisions are settled: all three groups are in scope (React and compiler, the engine hot path, screen open and background), the save stays a synchronous write on every intent but writes only the active scenario, and the engine's phase snapshot stays but is kept by reference instead of deep-copied. Do not reopen them.

You orchestrate; you don't write the code yourself. Hand the work to agents:

1. Every agent that writes code is an `implementer` (or `general-purpose`) Agent call with model: "sonnet". Every other agent you start (Explore, reviewer, ux) also gets model: "sonnet". No exceptions.
2. Run six implementer tasks one after another, in the plan's order: §1 → §2 → §4 → §5 → §3 → §6. After each task, `pnpm test`, `pnpm lint` and `npx tsc --noEmit` must be green. Then commit and push (git push -u origin ccr-2163deb4-z1kz0c). Each task gets:
   - the plan section it owns, quoted in full;
   - the file:line references the section names (they were read on 2026-10-29; tell the agent to re-read before editing, since earlier tasks move lines);
   - what the earlier tasks changed.
   a. §1 Compiler guard. Write the test first. It fails today, listing the bailouts; that is expected. Mark it skipped only until task b lands, then un-skip it there.
   b. §2 Compiler bailouts. The test from task a is green with zero bailouts in src/play and src/screens. Fix `info()` reading the store during render before `Table` compiles (plan §2, "Before Table is compiled").
   c. §4 Engine hot path. Every golden*.test.ts, full-game.test.ts, undo.test.ts, hide.test.ts and replay.test.ts passes unchanged, and `node --experimental-strip-types scripts/card-smoke.ts --all` is clean. Before and after the task, have the agent time a replay of every golden game through `reduce` with a scratch script it does not commit, and report both numbers.
   d. §5 Leaner save. Time writeSave against the new writeActive on a 500-intent save with better-sqlite3 and report the numbers.
   e. §3 Table commits and haptics.
   f. §6 Screens: open, freezeOnBlur, the pool cache, lazy startup parsing, the backdrop image.
3. One review pass only. After task f, run `reviewer` once on the whole diff and `ux` once (src/play and src/screens changed), both with model: "sonnet". Fix their real findings in one Sonnet implementer task, then commit and push. Do not run the reviewers again.

Rules that hold throughout:
- src/screens imports nothing from src/rules. Lint zones decide where a new helper lives.
- Match the surrounding code: its comment density and voice, and its naming. Update docs/architecture.md wherever a change touches what it says.
- No golden game, step log or data/ file changes. pnpm data:check stays green.
- Never commit catalog.db, scans or PDFs.
- Keep these behaviours exactly: the spotlight gate, skip, Back, the haptics (only their timing moves earlier), the banner wait, Undo and relaunch replay.
- The plan's "Out of scope" list stays out of scope.
- This is a cloud session: no phone, simulator or Maestro. On-device checks never get marked done: frame timing on card pickup, scrub, the spotlight and opening the table; the freezeOnBlur behaviour; the backdrop image's look in both themes. Record them under Open in a STATUS.md section "Performance pass, 2026-10-29 (user request)" with Built, Decided, Checked and Open.
- If a section cannot be done without changing behaviour the plan says to keep (for example, taking the engine snapshot by reference breaks a test because something mutates state), stop and ask the user. Do not work around it silently.
- Do not open a pull request unless the user asks.

Done when:
- all six tasks and the review fix are committed and pushed to ccr-2163deb4-z1kz0c;
- pnpm test, pnpm lint, tsc --noEmit and pnpm data:check are green;
- the compiler test reports zero bailouts;
- STATUS.md records what was built and what stays open.

Finish with a short report:
- what each task changed;
- the before and after timings (golden replay, save write);
- the reviewer and ux findings, and what was fixed;
- what stays open.
```
