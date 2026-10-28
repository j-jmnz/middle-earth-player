# Phase 31 handover (Escape from Dol Guldur)

## Done
- STATUS.md: phase 31 `active`.
- Families `objectives`, `prisoner`, `dungeon` (catalog + engine + tests), records for every line of the scenario (`src/effects/authored/escape-from-dol-guldur.ts`, `pool/RevCore.ts`), `escape-from-dol-guldur` in `PLAYABLE_SCENARIOS`, `open-lines.ts` regenerated.
- Scene/game scripts (`scripts/dol-guldur-scene.ts`, `dol-guldur-game.ts`), golden (`golden-dol-guldur.test.ts`, 12 games), campaign test, quest and encounter tests, family tests.
- Phone half in code: table views (guard beside objective, prisoner facedown in its player's play area with Mendor under it, Iron Shackles under the deck), words for choices, carry-over sentence on the Resolution view. `docs/brief.md` and `docs/architecture.md` updated.

## In progress
- E2E fixtures (`scripts/e2e-dol-guldur.ts`, wired in `scripts/e2e-fixtures.ts`), Maestro flows.

## Next
- STATUS.md note (do not mark completed), final verification list, delete this file.

## Decisions
- ENGINE_VERSION stays 10: every engine change is gated on a record that uses it (flags `guard`, `claimed`, `prisoner`, `deckAttached`).
- Test inputs edited for the next scenario: anduin-campaign (checklist choice for Appointed by Fate, 01134 loaded, the pool comparison leaves 01134 out), mirkwood-setup and campaign-log (the pool Mendor record is left out of the "without the record" cases), standalone (playable list).

## Lines still open
None for this scenario (`pnpm effects:open`).
