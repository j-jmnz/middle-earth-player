# Phase 7 — Round engine

Depends on: phase 2
Blocks: phase 8
Can run beside: phases 3 through 6, and phase 17

## Goal

The core round as a pure TypeScript reducer in `src/rules`, tested in Vitest. No React, no pixels, no card-specific effect records. Tests use in-memory card stats. They do not fetch RingsDB.

## State

Model two seats from this slice, even when every assertion is true solo. `seatCount` is 1 or 2.

Each seat: threat, deck, hand, discard, heroes, play area, engaged enemies. Also the per-seat staging area and quest stage used later by Breaking of the Fellowship. Shared until a script says otherwise: staging area, active location, a second active-location slot that stays unused until a script opens it, quest deck and current stage, encounter deck and discard, victory display, set aside, removed from the game. The second active-location slot is shared scenario state. It is not a field on the seat.

A card instance has: instance id, catalog code, zone, exhausted, damage, progress, resources, host, attachment ids, committed to the quest, shadow card id if it is an enemy, face, controller. Control is not the same thing as in play.

Willpower and damage read a modifier list. Leave the list empty in this phase. Do not fork combat math for a later constant.

Reducer updates keep the same object references for zones that did not change. A threat change does not replace the hand slice. Do not use Drizzle `useLiveQuery` for scenario state.

## Round

Name the steps in words. Beginning and end of round are real steps.

Setup order is the one recorded in phase 0: player Setup before the opening hand, encounter Setup before the quest card's Setup, then the quest script.

1. Resource. Each hero gains one resource of its own sphere. Seats draw one card in seat order. Player actions.
2. Planning. Play allies, attachments, and events.
3. Quest. Commit, then staging, then resolution. Saga staging reveals one encounter card per seat and resolves it before the next seat. Surge reveals another for that same seat. Doomed X raises every seat's threat. Peril: the other seats cannot act or trigger responses while that card's staging resolves.
4. Travel.
5. Encounter. Optional engagement, then repeated engagement checks until none qualify.
6. Combat. Deal a shadow card face down to each engaged enemy. Reveal a shadow when that enemy attacks. Resolve every enemy attack in seat order, then resolve every player attack in seat order.
7. Refresh. Ready exhausted cards. Raise each seat's threat by 1. Pass the first-player token.

Quest resolution uses staging threat only. Progress goes on the active location first. An undefended attack places the attack value. A defended attack places `max(0, attack − defense)` after the modifier list. Toughness X then reduces what is placed, for enemies. Indestructible enemies are not destroyed. A character at damage equal to its hit points is destroyed.

Threat 50 eliminates that seat. A seat with no heroes in play is eliminated. If no seat remains, the players lose. The One Ring leaving play loses the game.

Keywords that live in `src/rules`, not in a card file: surge, doomed, peril, archery, immune to player card effects, indestructible, toughness, permanent, setup, victory, sentinel, ranged. Hide is a framework frame. Implement the frame's hook in phase 8. Archery totals X at the start of combat. The player distributes that total. Defense does not block it.

The window stack is part of this phase. A test pushes a nested frame with a fixture instruction, not a real card, and shows the nested frame pops before the parent continues. Hide, the Hide action window, and the Hide fixture numbers stay in phase 8.

## Intents

The reducer accepts an effect list argument. It does not import `src/effects`. Tests may pass an empty list.

`legalIntents(state)` is the only set the UI will be allowed to render. It runs when the window changes, not per pixel. It does not build the cross product of every card and every target up front. Player intents include keep or mulligan, commit, play a card, trigger, pass, travel or decline, optionally engage or decline, declare a defender or leave the attack undefended, declare attackers, distribute a fixed total, choose a resolution option.

`Draw`, `GainResources`, `PayCost`, `DealDamage`, and the other framework verbs ignore amounts supplied by the caller. Paying a cost removes exactly the printed cost from legal spheres. Wrong sphere, overpay, and underpay are rejected with a reason.

An intent outside the current window is rejected. There is no damage stepper, resource stepper, threat dial, or phase scrubber.

Undo stores the intent log and the engine steps that followed, and rebuilds state, with a snapshot at each phase boundary. Restoring that snapshot and replaying the intents yields the same state and the same seed cursor.

The interpreter and the reducer are pure. Shuffles advance the seed cursor stored on the scenario. No clock, no network, no `Math.random`. Tests pass a fixed seed. Production and e2e do too. A relaunch continues the same sequence.

`src/rules` still imports nothing from React Native, Expo, `src/play`, `src/screens`, or `src/effects`. It may import `src/catalog`.

## Exit

`vitest` is green in Node. Covered at least: mulligan, one resource and one draw, exact cost, quest progress on an active location, engagement loop, surge on the revealing seat, toughness, destruction as a consequence of damage, rejection of a caller-supplied damage, threat, or progress number, a nested window that pops before its parent continues, and an undo that restores a phase-boundary snapshot with a matching seed cursor. Enemy attacks resolve as one group, in seat order, before any player attack. No table component exists. No test fetches RingsDB.
