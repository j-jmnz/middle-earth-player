# Handover: automating every player card (main session)

User directive (2026-10-26): make every deck-legal player card fully playable, using whatever resources are needed; when
the work is done, merge to `main` without waiting for confirmation, and answer open questions without asking. If usage
limits loom, agents and the main session write handover files and commit so progress is not lost.

## Where things stand

- Branch `ccr-a8ef8247-8087n8` (pushed). `src/effects/open-lines.ts` lists the printed lines no record owns yet
  (`pnpm effects:open` rewrites it): 833 before the mechanic families, 610 after four of them.
- The remaining lines were split into 11 mechanic families (docs/plans/effect-authoring.md, "Mechanic families"). Each
  family owns `src/catalog/families/<F>.ts`, `src/rules/families/<F>*.ts` and `src/effects/authored/families/<F>.ts`.
- Merged into the branch: encounter, costs, quest, defense.
- In progress in agent worktrees under `.claude/worktrees` (local branches `worktree-agent-*`, not pushed): attack, play,
  attachments, deck. Not started: sidequests, misc (incl. saga heroes and One Ring cards), motk (Messenger of the King
  heroes, codes 99<ally code>).
- Family line lists and the agent brief are regenerated from `src/effects/open-lines.ts` plus the card text (the main
  session wrote them to its scratchpad; regenerate if lost: group open lines by mechanic).

## Merging a family

1. Squash its worktree branch onto this branch (cherry-pick or `git diff <base>..<branch> | git apply -3`), drop
   `docs/handover/<F>.md`.
2. Conflicts are mostly additive (enum members, pick fields, condition kinds, word cases): keep both sides.
3. Watch for the same verb or condition name added by two families (seen: ChooseX, SpendResources, TravelTo, the
   `resources` condition): keep one definition and convert the other family's records and tests. A duplicated verb or
   condition kind fails at load ("Duplicate discriminator value"); `src/catalog/families/families.test.ts` catches
   duplicated triggers and flags. Check record ids are unique (src/effects/effects.test.ts).
4. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm effects:open`, full `pnpm test`; commit the regenerated open lines; push.

## Known follow-ups (found by family agents)

- An event Action record's `cost` is not paid when the event is played via PlayCard.
- `announceLeftPlay` does not set `explored`, so `subjectExplored` never holds on a location's `leftPlay`.
- Refresh Action records check phase "Refresh", but the 7.4 action window runs in phase "End of round".
- `resolveQuest` clears `committed` before `questSucceeded` is announced: 12037:response:1 and 22110:response:1 should
  hear `questedSuccessfully` (quest family) instead.
- Dúnedain Remedy has two records for one line (`played` and `enteredPlay`): use the costs family's `attached` trigger.
- Cancel payments (`applyCancel`) are not noted as spent (Tighten Our Belts).
- docs/plans/effect-authoring.md "Not expressible yet" is out of date: update it once every family is merged.

## After the families

- Scenarios 3 to 6 (Flight to the Ford 141xxx, The Ring Goes South / Journey in the Dark / Breaking of the Fellowship
  142xxx): encounter cards and campaign cards still have open lines; `src/campaign/playable.ts` lists playable scenarios.
- Second pass on lines families left open; then update the cookbook, `docs/phases/STATUS.md`, and merge to `main`.
