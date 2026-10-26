# Handover: automating every player card (main session)

User directives (2026-10-26):
- Make every deck-legal player card fully playable, using whatever resources are needed.
- Leave the Messenger of the King cards out (pack MotKA and contract 22134: `outOfScope` in `data/overrides.json`).
- When the work is done, merge to `main` without waiting for confirmation, and answer open questions without asking.
- Every agent spawned for this work runs on Sonnet 5.5 (`model: "sonnet"` in the Agent call).
- Extra branches on GitHub are fine. Before usage limits stop work, every agent and the main session write a handover and
  commit (and push) so no progress is lost.

## State (2026-10-26, 12:30 UTC; all agents stopped by the user)

- Main branch for this work: `ccr-a8ef8247-8087n8` (pushed). `src/effects/open-lines.ts` lists the printed lines no
  record owns yet (`pnpm effects:open` rewrites it): 833 before the mechanic families, **496** now.
- Merged into the branch: the **encounter**, **costs**, **quest** and **defense** families, plus the MotK exclusion. Full
  `pnpm test`, `pnpm lint`, `tsc` and `pnpm data:check` were green at the last merge.
- The remaining lines are split into mechanic families (docs/plans/effect-authoring.md, "Mechanic families"). Each family
  owns `src/catalog/families/<F>.ts`, `src/rules/families/<F>*.ts` and `src/effects/authored/families/<F>.ts`.
- The agent brief is `docs/handover/agent-brief.md`; each unmerged family's line list as assigned is
  `docs/handover/families/<F>.txt` (some lines may be closed since: check `src/effects/open-lines.ts`).

## Resumed session (2026-10-26, session_01Ei8sWpP1Wh3AbvNb34oiyN)

Fresh Sonnet agents (worktrees) are finishing attachments, play, attack and deck from their `wip/<F>` branches, with the
brief plus an addendum (push to `wip/<F>`, this session's attribution lines). The main session merges each as it reports.

## Families in progress (stopped at about 12:25 UTC)

Each pushed its work to `wip/<F>` on GitHub; its own handover is `docs/handover/<F>.md` there (a copy is next to this file).
The last commit on attack and deck is the main session's save of uncommitted work at the usage-limit stop: unreviewed, may
not compile.

| Family | Branch head | Base | State | Next |
|---|---|---|---|---|
| attack | `wip/attack` 3141b63 | 02f9ba6 | Engine, records for 42 lines (39 + 3 the defense family left), tests | Finish the attack-flow helper for events that open attack windows; checks; final commit |
| play | `wip/play` 84f0d42 | 02f9ba6 | Engine, 34 of 35 lines, 35 tests, goldens unchanged | Full test, final commit (06036:A:2 Trained for War stays open: no Battle rules span) |
| attachments | `wip/attachments` b7c85c5 | 6fa8029 | Engine, records for all 45 lines, 28 tests, full suite green after two fixes | Re-run full suite, card-smoke, coverage; final commit |
| deck | `wip/deck` 6795de4 | 6fa8029 | Schema, picks, Choose `different`, discard events from costs; engine modules partly written | deck.ts run(), deck-moves/each/play, records, words, tests (see its handover) |

To continue a family in a new session, see `docs/handover/RESUME.md` (the prompt for a new chat).

## Families not started

- **sidequests**: player side quests, contracts, encounter-keyword player cards, the victory display
  (`docs/handover/families/sidequests.txt`; 22134 is now out of scope).
- **misc**: constants and responses no other family takes, the saga heroes, The One Ring and Master cards
  (`docs/handover/families/misc.txt`).
Start each from the current branch head (not d2f8a7a), with the brief.

## Merging a family

1. Squash its branch onto this one (`git diff <base>..wip/<F> | git apply -3`, or cherry-pick each commit), then delete
   `docs/handover/<F>.md`.
2. Conflicts are mostly additive (enum members, pick fields, condition kinds, word cases): keep both sides.
3. The same verb, condition kind, trigger or flag added by two families must end up as one definition; convert the other
   family's records and tests. Seen so far: ChooseX, SpendResources, TravelTo, the `resources` condition. Expected next:
   - `optionallyEngaged` trigger and `notHost` pick field: attack and quest (quest's are merged).
   - `changedControl` trigger: play and defense (defense's is merged). `activeExplored` trigger: play and quest (quest's
     is merged; both emit it from keywords.ts destroyCard).
   - `PutIntoPlay`: play and deck. `DeclareAttack`: attack and attachments. `endOfAttack` Delay: attack.
   A duplicated verb or condition kind fails at load ("Duplicate discriminator value"); `src/catalog/families/families.test.ts`
   catches duplicated triggers and flags; `src/effects/effects.test.ts` catches duplicated record ids.
4. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm effects:open`, full `pnpm test` (goldens must not change), commit the
   regenerated open lines, push.

## Known follow-ups (found by family agents)

- An event Action record's `cost` is not paid when the event is played via PlayCard.
- `announceLeftPlay` does not set `explored`, so `subjectExplored` never holds on a location's `leftPlay`.
- Refresh Action records check phase "Refresh", but the 7.4 action window runs in phase "End of round".
- `resolveQuest` clears `committed` before `questSucceeded` is announced: 12037:response:1 and 22110:response:1 should hear
  `questedSuccessfully` instead.
- Dúnedain Remedy has two records for one line (`played` and `enteredPlay`): use the costs family's `attached` trigger.
- Cancel payments (`applyCancel`) are not noted as spent (Tighten Our Belts).
- Rules spans missing from data/rules: Battle/Siege keywords, Guarded on player cards, Trap; get them with
  `pnpm data:sync rules` from an online Rules Reference and record the source (CLAUDE.md).
- docs/plans/effect-authoring.md "Not expressible yet" is out of date: update it once every family is merged.

## After the families

1. Scenarios 3 to 6 (Flight to the Ford 141xxx, The Ring Goes South / Journey in the Dark / Breaking of the Fellowship
   142xxx): their encounter and campaign cards still have open lines (`docs/handover/families/scenario-141.txt`,
   `scenario-142.txt`); `src/campaign/playable.ts` lists playable scenarios. Flight to the Ford needs the Ring-bearer's
   life and a burden deck.
2. A second pass on lines families left open; update the cookbook and `docs/phases/STATUS.md`.
3. Delete `docs/handover/`, then merge `ccr-a8ef8247-8087n8` into `main` and push (the user asked for this without
   confirmation).
