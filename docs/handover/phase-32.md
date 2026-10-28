# Phase 32 handover (The Oath)

## Done
- Phase active in STATUS (note written). Engine, records, goldens, campaign tests, playable, phone half (words, tokens widget, log rows, fixtures, Maestro) all committed and pushed.
- Brief and architecture updated; ENGINE_VERSION stays 10.

## In progress
- Final verification run (data:build/check, tsc, lint, full test, card-smoke, catalog:build, booklets:pack) and the final report.

## Next
- Delete this file in the final commit; the main session runs the one review round.

## Decisions
- Stalking Goblin's "collection" = every card the game knows.
- 41050:A:3 is the printed Response (optional), offered to the first player at the end of each round.
- `dol-guldur-campaign.test.ts`: input edit only (Adaptation answers and cards), no expectation moved.

## Lines still open
- none for this scenario (pnpm effects:open)
