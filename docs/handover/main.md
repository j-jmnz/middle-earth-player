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

- attachments, attack, play and deck are merged (squashed, duplicates reduced: see the four merge commits). Full suite green
  (2144 tests), goldens unchanged. Open lines: **333** (sidequests 85, misc 74, scenario-141 34, scenario-142 138,
  06036:A:2 Battle keyword, 145005:A:1 Imrahil ally-to-hero type change).
- Running agents (Sonnet, worktrees), each pushing to its branch: sidequests (`wip/sidequests`), misc (`wip/misc`), rules
  spans for Battle/Siege, Guarded player cards and Trap (`wip/rules`), phase 13 Flight to the Ford (`wip/phase-13`).
  Their briefs: the agent brief plus an addendum (base = this branch head, push to wip/<F>, this session's attribution).
- New follow-up from the deck merge: PutIntoPlay of an attachment (families/deck-moves.ts putAttachmentIntoPlay) and the
  attachments family's PutAttachmentIntoPlay verb overlap; only the latter applies Guarded. Make them one.

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

## Known follow-ups

Done on this branch (commit "Fix known follow-ups"): event Action costs (none exist), explored leftPlay, the Refresh window,
Mirkwood Explorer's questedSuccessfully, Dunedain Remedy's attached trigger, cancel payments spent. Rules spans for
Battle/Siege/Archery/Guarded (X) are in data/rules (hon.*, wor.*); Trap has no official rule (card text only).
Merged: leftovers (Battle/Siege + 06036:A:2, Imrahil 145005:A:1 via cardTypeOf/heroType, one PutIntoPlay path for
attachments with Guarded per wor.guarded-x) and phase 13 (Flight to the Ford playable; burden family). Open lines: 296.
Running: sidequests, misc, phase 14 (wip/phase-14), reviewer on phase 13 (3198cf0). Next: phases 15, 16 in order.
Left for the end: the cookbook's "Not expressible yet" section, STATUS.md.

## After the families

1. Scenarios 3 to 6 (Flight to the Ford 141xxx, The Ring Goes South / Journey in the Dark / Breaking of the Fellowship
   142xxx): their encounter and campaign cards still have open lines (`docs/handover/families/scenario-141.txt`,
   `scenario-142.txt`); `src/campaign/playable.ts` lists playable scenarios. Flight to the Ford needs the Ring-bearer's
   life and a burden deck.
2. A second pass on lines families left open; update the cookbook and `docs/phases/STATUS.md`.
3. Delete `docs/handover/`, then merge `ccr-a8ef8247-8087n8` into `main` and push (the user asked for this without
   confirmation).
