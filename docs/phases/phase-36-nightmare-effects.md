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

## Progress

- **A Shadow of the Past** (2026-10-30): on NIGHTMARE_PLAYABLE. Records in `src/effects/authored/nightmare/a-shadow-of-the-past.ts`; engine in the `nightmare` family (`src/catalog/families/nightmare.ts`, `src/rules/families/nightmare.ts`, tested in `nightmare.test.ts`): the `stageRevealed` trigger that the setup card in zone `nightmare` hears, `AttachToQuest`, `SearchToStaging` (encounter deck, discard pile and victory display), the `hideCommitLimit` flag and the `lastHideFailed` condition. A record that names a card the recipe replaced reads the dealt card of the same title (`twinCode`; `scripts/nightmare-codes.test.ts` checks every scenario on the list), and the setup card's own Setup lines run during Setup, before the quest's. `src/campaign/nightmare-games.test.ts` plays three seeded Nightmare games of each listed scenario.
- **A Knife in the Dark** (2026-10-30): on NIGHTMARE_PLAYABLE. Records in `src/effects/authored/nightmare/a-knife-in-the-dark.ts`. The family adds `AttackActor` (Southern Spy attacks from the staging area), `AttachToDamagedDefender` (Blade Tip), `NotCanceledBy` (The Ring's Will: no cancel by the Ring-bearer) and the `immuneToPlayerCards` flag (Bill Ferny in the staging area), read with the printed keyword. The Ringwraiths Attack's "Add Weathertop" adds Nightmare Weathertop (`nightmare-games.test.ts`). Known limit: an exhaust of The One Ring paid as a cost (`exhaustCode`, other Frodo versions) is not announced (`docs/plans/effect-authoring.md`, engine gap), so Menacing Wraith (906202:A:2) does not hear it; the Fellowship Frodo exhausts it as an instruction, which is heard.
- **Flight to the Ford** (2026-10-30): on NIGHTMARE_PLAYABLE. Records in `src/effects/authored/nightmare/flight-to-the-ford.ts`. The family adds the `whenRevealedCanceled` trigger (Trollshaw Forest). "The players cannot win while Ford of Bruinen is in play" holds the last stage, Race to Rivendell, back (`Restrict advance` on the setup card): defeating that stage is the only way to win (rr.winning-the-game). Race to Rivendell's "Add Ford of Bruinen" adds Nightmare Ford of Bruinen (`nightmare-games.test.ts`).
