# Phase 36 — Nightmare effects

Depends on: phase 35
Blocks: nothing

Plan: [docs/plans/nightmare-mode.md](../plans/nightmare-mode.md).

## Goal

Each playable scenario can be played on Nightmare. This phase is the per-scenario procedure of phases 29 to 33, applied to each scenario's Nightmare deck.

## Procedure, one scenario at a time

Order: A Shadow of the Past, A Knife in the Dark, Flight to the Ford, The Ring Goes South, Passage Through Mirkwood, Journey Along the Anduin, Escape from Dol Guldur.

1. The deck's ledger entries are in `data/printed/nightmare.json`, read from the pinned Drive pictures. Side B of the setup card is inert: the build applies it.
2. Run `pnpm effects:draft <code,…>` on the deck's codes, then the `effect-author` agent. Records go in `src/effects/authored/nightmare/<scenario-id>.ts`. A new verb goes in a mechanic family and has its own test.
3. Add the scenario to `NIGHTMARE_PLAYABLE`, then run `pnpm effects:open` and `node --experimental-strip-types scripts/card-smoke.ts <codes>`.

## Exit

- Coverage is green for every line of the deck and the setup card.
- `pnpm test`, `pnpm lint`, `tsc` and `pnpm data:check` are green.
- Phone check, open: one Nightmare game per scenario on a phone.
