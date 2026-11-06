# Phase 51 — Wilderland mechanics family

Depends on: phase 50
Blocks: phase 51b

Plan: [docs/plans/done/ered-mithrin.md](../plans/done/ered-mithrin.md), "Phase 51: Wilderland mechanics family" and "Notes for the orchestrator". Analogue: [phase 39](done/phase-39-sea-mechanics-family.md).

## Goal

The Caves-deck, guarded-treasure, second-deck and Discover vocabulary that several Ered Mithrin scenarios share exists as a mechanic family, each verb tested. Nothing is built for one scenario's card; no scenario is playable yet.

## Procedure

New files `src/catalog/families/wilderland.ts` (schema) and `src/rules/families/wilderland/` (engine), listed in `src/catalog/families/index.ts`. Each verb cites an `emce.*` span and has a test next to it (`docs/plans/effect-authoring.md`, Mechanic families). Generalize Dream-chaser's deck-zone code instead of copying it. Re-read each existing piece before use: `src/rules/families/uncharted/zone.ts`, `sea/corsair.ts`, `objectives`.

- **Caves deck and Deep** (`emce.caves-deck`, `emce.deep`), used in 3, 4 and 8:
  - The Caves deck is a pile zone (reuse `uncharted/zone.ts`).
  - After travel to a Deep location, discard it; the top Caves card becomes the active location.
  - With the Caves deck empty, Deep is ignored.
  - "Ignore the deep keyword" is a scenario-level switch that campaign cards set.
- **Guarded (enemy/location)** for encounter objectives and treasures (`emce.guarded-x`, `wor.guarded-x`):
  - Discard until a card of that type comes up; reshuffle if the deck runs out.
  - Read the existing `objectives` family first; extend it, do not fork it.
- **Second encounter decks with their own discard** (Evil Creatures in 1; Spiders and Orcs in 2; `emce.evil-creatures-deck`): generalize `sea/corsair.ts` into a named-deck helper.
  - An Evil Creatures enemy leaving play goes to its own discard pile, even with Victory.
  - An empty deck reshuffles its discard.
- **Discover X and Loot** (`emce.discover`, `emce.loot`), used in 7 and switched off in 8 and 9:
  - On activation, look at the top X cards (reshuffling the discard if short), attach 1 Loot as guarded, reveal 1 random Hazard and discard the rest.
  - Loot revealed any other way is discarded, and another card is revealed.
- **Immune and Indestructible** (`emce.immune`, `emce.indestructible`) read against the existing keywords. A gap is a family fix with a test, not a bend of an existing verb.

The wording of each rule comes from the pinned MEC115 PDF (`pnpm data:query`), never from memory.

## E2E

None until a scenario phase uses the family.

## Exit

The family tests green; `src/catalog/families/index.ts` lists the family; no scenario is playable yet. Every other campaign's golden passes without edits; `ENGINE_VERSION` is bumped only if a replayed game can move. One review round (`.cursor/agents/orchestrator.md`, "One review round").
