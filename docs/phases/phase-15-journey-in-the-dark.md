# Phase 15 — Journey in the Dark

Depends on: phase 14
Blocks: phase 16

## Goal

`journey-in-the-dark` is playable. No new framework widget unless the quest card prints one.

## Scenario

Booklet difficulty 8. Encounter set: Journey in the Dark only.

`pnpm data:build` writes `data/scenarios/<id>.json` when Hall of Beorn's counts and the quest card's Setup text agree with the DragnCards load list; read the cross-check report (`pnpm data:build -- --verbose`), resolve what it flags with a row in `data/overrides.json`, and add the scenario's `resolution` groups to the campaign file. Then `pnpm effects:draft <id>` and the `effect-author` agent. Assert the Normal deck size. The quest card wins.

Author effect records for abilities this scenario adds. Reuse surge, doomed, peril, archery, immune, indestructible, toughness, setup, victory, sentinel, and ranged from `src/rules`. A dealt card with a printed ability and no effect id fails coverage.

If a quest card declares a second active location, a burden deck, the life tracker, Hide, or per-seat staging, implement that declaration and cite the card in `docs/brief.md`. Do not add the widget because a later scenario needs it.

Saga setup still applies: chosen Ring-bearer, The One Ring, one Fellowship hero, no second Frodo.

The path unlocks this node only after The Ring Goes South is won. A loss writes nothing and stays on this scenario. A win runs this scenario's resolution, then unlocks `breaking-of-the-fellowship`. A replay does not grant the reward again unless the script says so.

## E2E

`.maestro/journey-in-the-dark.yaml` opens a seeded save parked on this scenario's resolution. A win unlocks `breaking-of-the-fellowship`. A loss leaves the log unchanged.

## Exit

Coverage is green for this scenario's dealt cards. A person can win and lose it on the phone. The log matches the script. No control types damage, resources, threat, or progress.
