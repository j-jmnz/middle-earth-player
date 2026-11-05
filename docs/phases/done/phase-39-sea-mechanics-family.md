# Phase 39 — Sea mechanics family

Depends on: phase 38
Blocks: phase 40

Plan: [docs/plans/done/dream-chaser.md](../../plans/done/dream-chaser.md), "Phase 39 - Sea mechanics family" and "Notes for the orchestrator and the implementer agent".

## Goal

The ship, heading, sailing and Corsair-deck vocabulary that scenarios 1, 3, 4, 5, 8 and 9 share exists as a mechanic family, each verb tested. Nothing is built for one scenario's card; no scenario is playable yet.

## Procedure

New files `src/catalog/families/sea.ts` (schema) and `src/rules/families/sea/` (engine), listed in `src/catalog/families/index.ts`. Each verb cites a `dcce.*` span or a ledger line and has a test next to it (`docs/plans/effect-authoring.md`, Mechanic families):

- **Ships** (`dcce.ship-enemies`, `dcce.ship-objectives`): who attacks and defends whom; the defender and attacker pickers, the legal-intent check and the refusal reason read the type.
- **Fleet** (`dcce.prepare-your-fleet`): the seat picker and briefing show the choice; no control types a stat.
- **Heading** (`dcce.heading`): on-course and off-course, the shift, the predicates.
- **Sailing and Sailing tests** (`dcce.sailing`, `dcce.sailing-tests`): the quest-phase step, with the success symbols from the ledger.
- **Corsair deck** (`dcce.corsair-deck`): a second deck and discard pile, the preparation, the reshuffle.
- **Boarding X** (`dcce.boarding`).
- **The Stormcaller Elite** (`dcce.stormcaller-elite`).
- **Archery X, Immune, Last Player, Indestructible** read against the existing keywords; a gap is a family fix with a test, not a bend of an existing verb.

## E2E

None until a scenario phase uses the family.

## Exit

The family tests green; `src/catalog/families/index.ts` lists the family; no scenario is playable yet. Every Fellowship and Mirkwood golden passes without edits; `ENGINE_VERSION` is bumped only if a replayed game can move. One review round (`.cursor/agents/orchestrator.md`, "One review round").
