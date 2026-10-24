# Phase 16 — Breaking of the Fellowship

Depends on: phase 15
Blocks: nothing in the proof of concept

## Goal

`breaking-of-the-fellowship` is playable, including separate staging from stage 2B. This is the last scenario in the Fellowship box.

## Scenario

Booklet difficulty 7. Encounter set: Breaking of the Fellowship only.

`pnpm data:build` writes `data/scenarios/<id>.json` when Hall of Beorn's counts and the quest card's Setup text agree with the DragnCards load list; read the cross-check report (`pnpm data:build -- --verbose`), resolve what it flags with a row in `data/overrides.json`, and add the scenario's `resolution` groups to the campaign file. Then `pnpm effects:draft <id>` and the `effect-author` agent. Assert the Normal deck size. Author the new effect records. Coverage includes every dealt ability.

## Stage 2B

Each seat sets a staging area in front of itself and places its quest stage 3 there. Phases still resolve in seat order, starting with the first seat. True solo is one area. Do not delete the rule for solo.

After a seat commits to its own stage, it reveals its encounter card, then compares its own committed willpower with the threat in its own staging area. Progress goes on its stage, or its own threat rises by the difference. Another seat does not raise threat for that failure. Where this stage's text overrides the active-location rule, follow the card and cite it.

Engagement checks use only that seat's staging area. "At this stage" does not reach another seat's cards. Archery is totaled per stage, and only that seat assigns it. Cards that say "the staging area" or "the quest" mean that seat's. Seats may still affect each other through ordinary card effects that do not use those phrases.

If a seat is eliminated while stages are separate, that stage and the encounter cards at it are discarded.

The per-seat staging slot and quest stage have existed on the model since phase 7. This phase is the first script that fills them. The second staging area renders only when the script declares it.

## E2E

`.maestro/breaking-of-the-fellowship.yaml` opens a seeded true-solo save on stage 2B and asserts one staging area. A two-handed save asserts two. A win records the resolution. A loss writes nothing.

## Exit

Coverage is green. True solo and two-handed both run stage 2B on a phone. A win records this scenario's resolution. A loss writes nothing. Fellowship's six nodes can show won, in order, and only a won scenario has unlocked the next.

The next campaign is out of scope. It will be a new folder, `register()`, encounter rows, scripts, and effects, plus a catalog version bump. `user.db` stays. A later saga box fills remaining log rows from its own booklet. It does not get a new log type.
