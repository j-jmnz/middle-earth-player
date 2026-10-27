# Phase 28 handover (delete in the final commit)

## Done
- Registry: `src/screens/campaign-data.ts` (campaigns, scenarios, BOXES, boxOf, campaignOfScenario, scenarioName, bookletParams reads `bookletId`), test in campaign-data.test.ts.
- `cards.campaign_id` from `PACK_CAMPAIGN` (campaign-defs.ts, derived from PRODUCTS); a card printed in Core gets none; test in build-catalog.test.ts.
- Screens: StartPanel per playable campaign (`start-fellowship` kept, others `start-<id>`, `seats-<id>-<n>`), Scenarios tab per box (`box-<id>`), standalone briefing takes campaign from the scenario's box, no FELLOWSHIP_ID fallbacks left in screens.

## In progress: setup verbs + log (code landed: family campaign, checklist, start, carry-over, log fields; TESTS for them still to write; ENGINE_VERSION bump pending)
- Setup verbs.

## Next
Setup verbs (start.ts/checklist.ts), log (multi-copy pool, facts, carry-over), booklets, brief, Maestro flows, STATUS.

## Decisions
- A "box" (Fellowship / Revised Core / The Dark of Mirkwood) is hand-written in campaign-data.ts BOXES; its campaignId gives the standalone flags.
- Mirkwood campaigns stay `playable: false` in index.json (phase 29 makes them playable), so only the Fellowship start panel shows until then.
