# Phase 36 — Nightmare effects

Depends on: phase 35
Blocks: nothing

Plan: [docs/plans/done/nightmare-mode.md](../plans/done/nightmare-mode.md).

## Goal

Each playable scenario can be played on Nightmare. This phase is the per-scenario procedure of phases 29 to 33, applied to each scenario's Nightmare deck.

## Procedure, one scenario at a time

Order: A Shadow of the Past, A Knife in the Dark, Flight to the Ford, The Ring Goes South, Passage Through Mirkwood, Journey Along the Anduin, Escape from Dol Guldur.

1. The deck's ledger entries are in `data/printed/nightmare.json`, read from the pinned Drive pictures. Side B of the setup card is inert: the build applies it.
2. Run `pnpm effects:draft <code,…>` on the deck's codes, then the `effect-author` agent. Records go in `src/effects/authored/nightmare/<scenario-id>.ts`. A new verb goes in a mechanic family and has its own test.
3. Add the scenario to `NIGHTMARE_PLAYABLE`, then run `pnpm effects:open` and `node --experimental-strip-types scripts/card-smoke/run.ts <codes>`.

## Exit

- Coverage is green for every line of the deck and the setup card.
- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm data:check` are green.
- Phone check, open: one Nightmare game per scenario on a phone.

## Known limits

The engine is the `nightmare` family (`src/catalog/families/nightmare.ts`, `src/rules/families/nightmare/`); records are in `src/effects/authored/nightmare/<scenario-id>.ts`; `src/campaign/nightmare-games.test.ts` plays seeded games of each listed scenario.

- A Knife in the Dark: an exhaust of The One Ring paid as a cost (`exhaustCode`, other Frodo versions) is not announced, so Menacing Wraith (906202:A:2) does not hear it.
- Passage Through Mirkwood: Ungoliant's Spawn discards a character at 0 Willpower when its effect resolves, not again later in the phase.
- Journey Along the Anduin: A Flooded Ford's "gains doomed X" raises threat on reveal but is not announced as the doomed keyword; Troll Attack's shadow (900208:A:2) deals the Troll's Attack as damage to a hero of each other player without making an attack, and reads the Attack after its `endOfAttack` modifiers have expired.
- Escape from Dol Guldur: Torture Master captures the hero the attack was made against, not each of several defenders; with 3 or 4 players the logged prisoner swap (01131:A:3) may leave one player with two prisoners.
