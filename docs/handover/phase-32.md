# Phase 32 handover (The Oath)

## Done
- Phase set active in STATUS.
- Engine vocabulary: Limit `oncePerCampaign` (usage.ts, families/campaign-used.ts), campaign verbs `PlaceToken`, `RecordTokens`, conditions `firstPlayer`, `tokens`, encounter verb `SearchCollection` (families/encounter-collection.ts), SearchMove `to: "engaged"`, AttachSelf `highestThreatCost`, table flag `encounterUncancelable` (families/encounter-cancel.ts), response window at endOfRound (triggers.ts), Actions of an encounter attachment used by the host's controller (actions.ts), travel cost check for "each player discards at random" (restrictions.ts), template "Setup. Attach to a hero."
- Records: `src/effects/authored/the-oath.ts`, `pool/TDoM.ts` (wired). `pnpm effects:open` lists no line for this scenario.

## In progress
- Tests for each new mechanic, scene `scripts/oath-scene.ts`.

## Next
- playable.ts + expectation edits, goldens (oath-game/oath-scene), campaign tests (Mirkwood Paths part 4, the-dark-of-mirkwood blank log), choice words, brief, Maestro, fixtures.

## Decisions
- Stalking Goblin's "your collection" = every card the game knows (the app tracks no collection): a copy of the Goblin Sniper is made when neither deck nor pile has one.
- The Oath's Response (printed "Response:", not Hall of Beorn's "Forced") is offered to the first player at the end of each round (optional).

## Lines still open
- none for this scenario (pnpm effects:open)
