# Handover: why the fast track was not faster on The Uruk-hai

The A/B of `docs/plans/scenario-fast-track.md` (The A/B: The Uruk-hai, both arms fresh) ran on 2026-11-07 and 2026-11-08. By the plan's Decision rule, the classic track is kept: the fast arm took 138 minutes against the classic arm's 132, and the rule asks for two thirds or less. The fast arm won the other two tests. This handover gives an analysis agent what it needs to explain the time result from the two branches and propose changes. The decision itself is the user's; the analysis proposes, it does not adopt.

The inputs that are not in git (the orchestrator's progress file, rulings file, blind-review tallies and the task briefs) are copied here and in `docs/handover/ab-uruk-hai-briefs.md`.

## What to read first

- `docs/plans/scenario-fast-track.md`: the plan (F1 to F6, The A/B, Decision). Its decisions stand; the analysis may propose changes to them for the user.
- `docs/handover/fast-track.md`: the fast procedure as it was run.
- `docs/handover/agent-brief.md`, Scenario procedure: the classic procedure as it was run.
- `.claude/agents/orchestrator.md` (Models, Implementer tasks, One review round), `.claude/agents/scenario-author.md`, `.claude/agents/reading-judge.md`, `.claude/agents/implementer.md`.
- `docs/plans/scenario-pipeline.md`, After each scenario phase: the measure each arm's last commit carries.
- `docs/handover/ab-uruk-hai-briefs.md`: every brief and follow-up message each arm's agents received, verbatim.

## The branches

Both arms start at `7137f44` on `ccr-dce79bf0-2c47oi` (the fast track built, The Two Towers data and campaign shell built). Neither is merged.

| Arm | Branch | Final commit | Commits after the base |
| --- | --- | --- | --- |
| Fast | `ab/the-uruk-hai-fast` | `0fc4de4` | `d138a81` records and verbs (Build), `2c8daa2` specs, asks, goldens, flows (Finish), `2bb78b0` drop the `.cache` link (orchestrator slip), `09d7d8d` review fixes, `0fc4de4` STATUS and measure |
| Classic | `ab/the-uruk-hai-classic` | `608af6f` | `0c4f3ac` records and verbs (task A), `b455b44` words, goldens, flows, boon traits (task B), `72cc7a6` review fixes, `608af6f` STATUS and measure |

`git log --format=%B -1 0fc4de4` and `git log --format=%B -1 608af6f` print each arm's `Pipeline measure:` block. Check out an arm with `git worktree add --detach <dir> <commit>`, then `pnpm install` and link `.cache` to the main checkout's (the scans; never commit the link: `.cache` is a directory pattern in `.gitignore`, a symlink slips past it).

## How each arm ran

Same machine (4 cores, one implementer at a time), same models: writers Sonnet (`implementer`, `scenario-author`), reviewers Opus (`reviewer`, `ux`, `reading-judge`). A coin toss ran the fast arm first. The briefs share two blocks (the scenario facts and the standing rules); the task parts differ by track. Neither brief names the other arm.

**Fast arm** (`docs/handover/fast-track.md`): one `scenario-author` agent run as three tasks by `SendMessage` to the same agent, so its context carried from Read to Build to Finish.

1. Read: `scenario:new --track fast`, `data:build`, `author:pack` (the pack was 204 KB, about 52K tokens, 23 drafts), a readings pass. Handed back 5 `needs-ruling` readings and 7 mechanics to add.
2. The orchestrator asked the user once (25 minutes of waiting, not counted).
3. Build: two new families (`pursuit`, `captives`), four smaller additions, the records, `effects:open`, `effects:render`.
4. `reading-judge` on the render: 2 `wrong` (both render misstatements of correct records), 9 `ambiguous`, 1 new ruling candidate.
5. Finish: the judge's lines, 17 spec rows, 4 asks entries, 9 goldens, the `hai-lost` fixture, both flows. A container restart stopped the first Finish run partway; the same agent was resumed on the surviving uncommitted tree.
6. Review round (reviewer and ux), then one fix task (implementer, fresh context).

**Classic arm** (`docs/handover/agent-brief.md`, Scenario procedure): fresh `implementer` agents.

1. Task A (records and verbs, steps 1 to 4): its brief carried the user's five rulings and the orchestrator's J1 from the start. Built an `uruk` family, the records and 53 hand-written card tests on a scene.
2. The orchestrator asked the user once about the 3 new `needs-ruling` readings (about 7 hours of waiting, not counted).
3. Task B (words, goldens, fixtures, flows, steps 5 and 6, and the new ruling C1): it chose an asks file (the fast track's F1) for the words, and built a Pursuit dial and the Captive drawing in this task.
4. Review round, then one fix task.

## The measures

### Time and tokens per task

Times are agent wall time from the progress file (start of the Agent call to its hand-back), not counting the user's wait for rulings. Tokens are the `subagent_tokens` of each Agent result; a resumed agent reports its own run.

| Fast task | Minutes | Tokens | Classic task | Minutes | Tokens |
| --- | --- | --- | --- | --- | --- |
| Read | 9 | 187,681 | A: records and verbs | 63 | 649,821 |
| Build | 46 | 465,512 | | | |
| reading-judge | 2 | 46,216 | | | |
| Finish | 30 (includes the restart; the lost run is not counted) | 611,917 | B: words, goldens, flows | 35 | 369,829 |
| Review (reviewer, ux) | 9 | 350,595 | Review (reviewer, ux) | 8 | 319,754 |
| Fix | 42 | 397,873 | Fix | 25 | 343,902 |
| **Total** | **138** | **2,059,794** | **Total** | **132** | **1,683,306** |

Grouped the same way: authoring (Read + Build + judge + Finish against A + B) is 87 minutes fast against 98 classic; the review round is 9 against 8; the fix pass is 42 against 25. The fix pass is where the fast arm lost the race.

Wall-clock timestamps (UTC): fast Read 22:54 to 23:03, Build 23:28 to 00:14, judge 00:14 to 00:16, Finish 00:16 to 00:46 (restart about 00:25), review 00:46 to 00:55, fix 00:55 to 01:37. Classic A 01:37 to 02:41, B 09:39 to 10:15, review 10:15 to 10:23, fix 10:23 to 10:48.

### Diff by area

Lines added plus deleted, `7137f44..` each final commit, from the script under Reproducing the numbers.

| Area | Fast | Classic |
| --- | --- | --- |
| records (`src/effects/authored/`) | 290 | 365 |
| engine (`src/rules`, `src/catalog`, not tests) | 463 | 426 |
| card tests (scenario, family and engine `*.test.ts`) | 785 | 1,017 |
| harness (`test/harness`, `test/scenarios`, `scripts/card-smoke`) | 21 | 167 |
| goldens (`golden.json`, `golden.test.ts`, `game.ts`, registry) | 181 | 202 |
| words (`src/play/words`, `src/play/choice`) | 660 | 129 |
| fixtures and flows | 69 | 95 |
| docs | 114 | 106 |
| generated (`data/`, `src/effects/generated`, open lines) | 54 | 74 |
| other (scripts, `src/play` readouts, `src/screens`, `src/campaign`) | 249 | 303 |
| **total** | **2,886** | **2,884** |

Build against fix pass: fast `7137f44..2bb78b0` about 1,100 lines, fix `2bb78b0..09d7d8d` 1,783 lines (it includes splitting `src/play/words/choice.ts` and `src/rules/interpret/conditions.ts` at the file-size limit, which moves code without changing it). Classic `7137f44..b455b44` 2,270 lines, fix `b455b44..72cc7a6` 614.

### Review findings

Each arm's own review round (blocks and changes; notes left out):

| Arm | reviewer | ux |
| --- | --- | --- |
| Fast | 2 blocks (one is the orchestrator's `.cache` link, not the arm's: a destroyed Captive kept its flag, so a seat with no heroes was never eliminated) and 9 changes (about ten lines with no behaviour test, two hollow tests, the `Restrict` render template misstating other scenarios, two conditions in the wrong family, two files at the size limit) | 0 blocks; 3 high and 4 medium changes: no pursuit readout, a second Captive not drawn two-handed, a Captive under an engaged Grishnákh not drawn, no Captive dial, no owner on Captive rows, pursuit choices without the current value, the Setup capture not saying what is lost |
| Classic | 1 block (a third copy of an in-play-by-code helper) and 5 changes (a rescued Captive never returned to its owner, so it could not take a Skill boon; a card misnamed in the brief by the orchestrator; a hollow cancel test; flow placeholders; a duplicated filter) | 2 blocks (a Captive under an engaged Grishnákh not drawn; "Deal 1 damage to it" with no number) and 7 changes (no owner on Captive dials and rows, the Setup capture's words, a one-row "Choose that hero", a one-row Pick for Grishnákh's damage, Isengard Uruk without its 3, a Pursuit dial without its limit) |

The blind review after both arms finished (same brief for each tree, arms named by a second coin toss: arm 1 is the fast arm). Blocks plus changes:

| Arm | Total | reviewer | ux | By class |
| --- | --- | --- | --- | --- |
| Arm 1 (fast) | 11 | 6 | 5 | test gap 4, words 3, screen 2, engine 1, reading 1 |
| Arm 2 (classic) | 12 | 9 | 3 | words 3, screen 3, test gap 3, engine 1, repetition 2 |

The fast arm's one "reading" is 143031:A:2: it deals the additional attack a new shadow card, as `faq.additional-attacks` says, while 18035:A:2 and the five records that copy it (18047, 19013:A:3, 19081, 19106, 19132) use `shadow: false`. Its own reading is right; the older records are not. Notable blind-review items: in the fast arm the "loses at 30" golden check never runs (it filters on a loss reason no game has), `EndQuestPhase` on 143030 and Strange Weariness after the quest phase are untested; in the classic arm the progress cap of the caves family now reads the pursuit tracker, and drawing held cards under engaged enemies also changes Carried Away (18074), untested.

### Cross-check

Each arm's `src/effects/authored/the-uruk-hai.ts` was run, translated to the other tree's verb and field names, against the other tree's scenario tests and spec rows. Naming failures are not counted. Three real disagreements, settled against the printed line:

| Line | Fast | Classic | Wrong |
| --- | --- | --- | --- |
| 143069:B:2 "Uglúk cannot leave the staging area or take damage." | `cannotLeaveStaging` bars every move out (`moveCard`), plus no engagement and no damage | only `cannotBeEngaged` and `cannotTakeDamage` | classic |
| 143031:A:2 "Attacking enemy makes an additional attack against you after this one." | a new shadow card is dealt (`faq.additional-attacks`) | copied 19081:A:2, `shadow: false` | classic |
| 143070:B:3 "they have rescued each Captive hero and won the game." | the Captives stay in the captive zone at the win (only the score counts them), so a rescued hero cannot take a Skill boon at the Resolution | `rescueCaptives` returns them to their owners before the Resolution | fast |

The fast arm's reading judge is what moved 143069:B:2 to the full reading; its Read pass found the FAQ for 143031.

### Rulings

- The fast arm's Read task asked 5 (R1 to R5); its judge raised 1 more (J1), settled by the orchestrator by analogy with R3, not user-confirmed.
- The classic arm received R1 to R5 and J1 in its first brief, and asked 3 new ones (C1 to C3). The fast arm read C2 and C3 the same way without asking; it never found C1 (the Skill boons' Trait also binds at the Resolution).
- The classic arm listed 3 more readings after the rulings were asked; they were not asked.

The rulings as given are in `docs/brief.md`, The Two Towers, on each arm's branch, and in the briefs file.

## What skews the comparison

Weigh each before blaming the procedure:

- **Rulings order.** The plan hands the first arm's rulings to the second (The A/B, Rulings). The classic arm therefore wrote its records knowing R1 to R5, and spent no reading time on them. The fast arm's Read task is partly the cost of finding them.
- **The second arm used the first part's tools.** Classic task B chose an asks file (F1) for its words and ran the encounter smoke (F4). The classic arm is not the pre-plan procedure.
- **The restart.** A container restart cut the fast arm's first Finish run; the time and tokens of the lost run are not in the table, and the resumed run re-read its state.
- **One agent across three tasks.** The fast arm resumed the same `scenario-author` agent for Build and Finish, so each turn carried the earlier tasks' context; the classic arm used fresh agents. This inflates the fast arm's tokens and may slow its turns.
- **The fix tasks differ in what they were asked.** The fast arm's fix brief held 18 items, among them the table readouts (a pursuit dial with a limit, held dials, every Captive drawn) that classic task B had already built before its review; the classic fix brief held 16, smaller ones.
- **One scenario, one run each.** A six-minute difference is within what one restart or one long test run moves.

## Leads the orchestrator saw (to test, not to take as found)

1. **The fast procedure has no step for the table.** `docs/handover/fast-track.md` (Finish) lists spec rows, asks, goldens and flows, but nothing for a zone or widget a card creates; `docs/handover/agent-brief.md` (Scenario procedure, step 4) has it. The fast arm built no pursuit readout and no Captive dial until its review found them, and the fix task built them: compare the fast fix diff (`2bb78b0..09d7d8d`, files under `src/play/readouts`, `src/screens/table`, `src/play/store`) with classic `b455b44`.
2. **Spec rows covered less than planned.** The Finish report says a row cannot see damage, a hand, a declared attacker or defender, a progress cap or a Response being used; most of this scenario's lines are of that kind, so the fast arm still wrote `verbs.test.ts` and family tests, and its review then asked for about ten more behaviour tests. See `test/harness/card-spec.ts` and the two arms' test files.
3. **The renderer misstated correct records.** Both `wrong` lines from the judge were render bugs (143067's pick and "this card" inside an after-attack step), and the review later found the `Restrict` template misstating other scenarios. Time spent fixing the renderer is in the fast arm's Finish and fix.
4. **The pack is mostly drafts.** 204 KB, of which the drafts both tracks read are most; the pack's own part was about 77 KB on The Fate of Wilderland (`docs/plans/scenario-fast-track.md`, F5; the F5 commit message). Check whether the Build task still read files beyond it.
5. **Engine work dominates both arms.** Both added the same mechanics (pursuit, Captives, a trait filter, a treachery bar, an engaged reveal, a sole-attacker test) at similar engine line counts (463 against 426). The plan expected the fast track not to shrink this (Expected gain).
6. **`test:scenario` runtime.** Both arms ran the full `pnpm test` (about 12 minutes on this machine) at least once per writing task; the fast arm ran it in Build, Finish and fix. Count full runs per task from the reports in the briefs file and the commit bodies.
7. **The size limit.** The fast fix had to split `choice.ts` (500 lines) and `conditions.ts` (499) before it could add to them, and fold `pursuit.ts` into another file to keep `src/play/words` at 40 files; the classic arm stayed under by adding less to those files.

## What the analysis should produce

A report to the user, as a new doc or a section the user names, that:

- splits each arm's 130-odd minutes into authoring, testing, waiting on test runs, reviewing and fixing, from the evidence (the agent reports in the briefs file give command results; the commit diffs give what each task wrote; re-running a step for timing is fine in a scratch worktree, never committed);
- says, for each lead above and any it finds, whether the evidence supports it and how many minutes it explains;
- separates what the procedure caused from what the A/B's setup caused (the skews above);
- proposes changes, each with the measure that would show it worked: to `docs/handover/fast-track.md`, `.claude/agents/scenario-author.md`, `.claude/agents/reading-judge.md`, the renderer, `test/harness/card-spec.ts`, the orchestration (fresh agents per task or not), and to the classic procedure where a fast-track part helped (the reading judge, the FAQ check at Read);
- names whether a second A/B on another scenario is worth running, and how to keep its setup fair (rulings order, tools available to both, restarts).

It does not change either arm's branch, merge either, or edit the plan or the agent files: the user decides (`docs/plans/scenario-fast-track.md`, Decision).

## Reproducing the numbers

The diff-by-area script (run from any checkout; it is not committed):

```python
import subprocess, sys, re
repo, base = sys.argv[1], sys.argv[2]
out = subprocess.run(["git", "-C", repo, "diff", "--numstat", base, "HEAD"], capture_output=True, text=True).stdout
def area(p):
    if p.startswith("src/effects/authored/"): return "records"
    if p.endswith("golden.json") or p.endswith("golden.test.ts") or re.match(r"test/scenarios/[^/]+/game\.ts", p) or "golden-registry" in p: return "goldens"
    if p.startswith("src/campaign/fixtures") or p.startswith(".maestro/") or p.startswith("scripts/e2e/"): return "fixtures and flows"
    if p.startswith("docs/") or p.endswith(".md"): return "docs"
    if p.startswith("src/play/words") or p.startswith("src/play/choice"): return "words"
    if p.startswith("test/harness/") or p.startswith("scripts/card-smoke/") or p.startswith("test/scenarios/"): return "harness"
    if p.endswith(".test.ts") and p.startswith(("src/rules", "src/catalog", "src/campaign/scenarios", "src/play/scenarios")): return "card tests"
    if p.startswith("src/rules/") or p.startswith("src/catalog/"): return "engine"
    if p.startswith(("src/effects/generated", "src/effects/open-lines", "data/")): return "generated"
    return "other"
totals = {}
for line in out.splitlines():
    added, deleted, path = line.split("\t")
    if added == "-": continue
    totals[area(path)] = totals.get(area(path), 0) + int(added) + int(deleted)
for k, v in sorted(totals.items()): print(f"{k}: {v}")
print("total:", sum(totals.values()))
```

`python3 areas.py <worktree at the arm's final commit> 7137f44`.

## Open after this handover

- The six older records with `shadow: false` on a printed additional attack (18035:A:2 and its copies) disagree with `faq.additional-attacks`; changing them moves older goldens and needs `ENGINE_VERSION`. Not changed.
- The fast branch does not rescue the Captives at the win (143070:B:3); the classic branch does.
- `hai-won` is not found on either branch.
- This handover is deleted when the analysis has reported and the user has decided (`.claude/rules/docs-standards.md`, Plans, phases and handovers).
