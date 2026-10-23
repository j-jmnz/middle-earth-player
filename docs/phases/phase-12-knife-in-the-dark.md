# Phase 12 — A Knife in the Dark

Depends on: phase 11
Blocks: phase 13

## Goal

`a-knife-in-the-dark` is playable on the phone. One scenario in this change. Do not start phase 13 until this coverage test is green.

## Scenario

Booklet difficulty 7. Encounter sets: A Knife in the Dark, Hunted, The Ring, The Nazgûl.

The shared saga setup still runs: the first seat's chosen Ring-bearer, The One Ring, one Fellowship hero in play, no second Frodo. Do not ask the player to remember the booklet.

Card-by-card setup is printed on the quest cards. Read those cards and the booklet together. Hall of Beorn is a reading aid. The quest card wins. Freeze a fixture of codes and counts. No card text in the fixture. The build fails if a code is missing from the catalog. Assert the Normal deck size you counted.

Author the effect records this scenario adds. Reuse the keyword framework. A dealt card with a printed ability and no effect id fails coverage. The scenario stays unplayable until that test is green.

No new widget. Hide, the life tracker, the burden deck, a second active location, and per-seat staging stay hidden unless this scenario's own cards declare them. If a quest card does declare one, implement that declaration here and cite the card in `docs/brief.md`.

The path marks this node current only after scenario 1 is won. A loss writes nothing. A win runs this scenario's own resolution, then unlocks `flight-to-the-ford`. Replaying does not grant the reward again unless the script says so.

## E2E

`.maestro/a-knife-in-the-dark.yaml`, tagged `scenario`, opens a seeded save parked on this scenario's resolution, chooses a legal option, relaunches, and finds `flight-to-the-ford` unlocked. A loss flow leaves the log unchanged.

## Exit

Coverage is green for this scenario's dealt cards. A person can win and lose it on the phone. The log matches the script. The table does not gain a control that types a number.
