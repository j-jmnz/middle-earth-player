# Phase 14 — The Ring Goes South

Depends on: phase 13
Blocks: phase 15

## Goal

`the-ring-goes-south` is playable, including stage 4's second active location and the facedown Ring-bearer.

## Scenario

Booklet difficulty 6. Encounter set: The Ring Goes South only.

`pnpm data:build` writes `data/scenarios/<id>.json` when Hall of Beorn's counts and the quest card's Setup text agree with the DragnCards load list; read the cross-check report (`pnpm data:build -- --verbose`), resolve what it flags with a row in `data/overrides.json`, and add the scenario's `resolution` groups to the campaign file. Then `pnpm effects:draft <id>` and the `effect-author` agent. Assert the Normal deck size. Author the new effect records. Coverage includes every dealt ability.

## Stage 4

The quest card can have two active locations. Doors of Durin is immune to player card effects. An effect that targets "the active location" can target only the active location that is not Doors of Durin.

When revealed, as printed on stage 4A: make Doors of Durin the active location, add Watcher in the Water to the staging area, discard all tokens from the Ring-bearer, and place that hero and each attached card facedown under Watcher in the Water. While facedown under the Watcher, the hero and those attachments are still in play. No player controls them. Tokens on that hero are discarded when the quest card says to discard them.

The second active-location slot is shared scenario state, from phase 7. This phase is the first script that uses it. The widget renders only when the script declares it. Do not add a slot per seat.

Immune to player card effects: player cards do not affect that card and cannot choose it as a target.

## E2E

`.maestro/the-ring-goes-south.yaml` opens a seeded save on stage 4 and asserts the two active-location labels, including Doors of Durin. A resolution flow unlocks `journey-in-the-dark` on a win.

## Exit

Coverage is green. A person can reach stage 4 on the phone, see two active locations when the card says so, and see the Ring-bearer leave control without leaving play. A win unlocks `journey-in-the-dark`. A loss writes nothing.
