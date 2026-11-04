# Phase 4 — Scenario 1 fixture

Depends on: phase 2
Blocks: phase 8
Can run beside: phases 3, 7, and 17

## Goal

A checked-in fixture for **A Shadow of the Past** (`a-shadow-of-the-past`), and a test that the Normal encounter deck built from it has the size you counted on the cards.

## Fixture

`fixtures/` holds codes and counts only. No card text, no scans, no RingsDB dumps.

Read the quest cards and the MEC109 booklet together. Hall of Beorn may be open as a reading aid. The quest card wins if they disagree. Do not generate the fixture from HTML, and do not fetch Hall of Beorn at runtime.

Encounter sets named by the booklet: A Shadow of the Past, Hunted, The Ring, The Black Riders. Difficulty in the booklet is 6. Confirm stage titles on the quest cards before writing them down. The titles seen on Hall of Beorn are Three is Company, A Shortcut to Mushrooms, and Escape to Buckland.

The build joins fixture codes to RingsDB rows and fails if a code is missing. The One Ring was not in the 29-record TBR payload used for the brief. If the live payload still has no row, add a named local record and say where it came from. Do not invent stats.

Lines to confirm on the quest card before freezing, currently taken from Hall of Beorn's campaign card: attach Mr. Underhill to the Ring-bearer; add Gandalf's Delay to staging; shuffle Gildor Inglorion and The Ring Draws Them into the encounter deck; set Bucklebury Ferry aside; one Black Rider in staging; Bag End is the active location. Adding that Black Rider is not a reveal.

Snapshot the dealt codes into the save at scenario start, so a later catalog rebuild cannot rewrite a game in progress. The snapshot field can land with the save schema. This phase's test only checks the fixture and the built deck size.

## Exit

The fixture is committed. A test asserts the Normal deck size you verified. Easy and Normal counts only. No Nightmare cards. No rules engine yet.
