# Phase 16 — Breaking of the Fellowship

Engine half depends on: phase 15's engine half
Phone half depends on: phase 15
Blocks: nothing in the proof of concept

## Goal

`breaking-of-the-fellowship` is playable, including the Ring-bearer leaving the game at stage 2A and a staging area per seat from stage 2B. This is the last scenario in the Fellowship box. Follow the scenario procedure in phase 12.

## Cards

- Campaign card 142060 front, Setup: starting with the first player, each player chooses 1 of Phial of Galadriel, Three Golden Hairs, Lórien Rope and Leaf-wrapped Lembas and attaches it to a hero they control. Those are earned. Shuffle Followed by Night (142089) and Ill Fate (142090) into the encounter deck. DragnCards stages all four boons. The card has each seat choose one.
- Campaign card back: if Fallen into Evil is attached to a hero, add that hero to the fallen heroes. The first player chooses Followed by Night or Ill Fate for the pool. Each player names a hero they control, other than the Ring-bearer or Aragorn, as a captive in the log. The card is Fallen Into Evil (142083), a treachery that attaches to a non-Fellowship hero. Names on campaign cards resolve to codes case-insensitively, through the ledger. The MEC109 printing differs from The Road Darkens on nine campaign and burden cards, so read the scan.
- Stage 1A (142061) Setup: set Frodo's Choice (142068), Seat of Seeing and Parth Galen aside, out of play. Add The Argonath and Sarn Gebir to the staging area. 1B: enemies get +2 defense and cannot be engaged. Skip the encounter phase. The players cannot advance while The Argonath is in play.
- 2A (142062): remove the Ring-bearer and each card attached to it from the game. The One Ring's text is blank while this resolves, so its loss line does not fire. Reduce each enemy's engagement cost to 0 until the end of the encounter phase. Skip the travel phase this round.
- 2B, Forced at the end of the refresh phase: shuffle Seat of Seeing and Frodo's Choice into the encounter discard pile, and place that pile on the bottom of the encounter deck. Starting with the first player, each player creates their own staging area and advances to a **different** stage 3A of their choice: Searching the Woods (142063), Guard the Hobbits (142064), The Seat of Amon Hen (142065) or Orc Hunting (142066). In player order, each player moves 1 encounter card from the shared staging area to theirs until none are left, then stage 2B is discarded.
- Each 3A, Forced: after stage 2B is discarded, if the total threat in this staging area is under 4, reveal 1 encounter card. Each 3B: if Frodo's Choice is not in play, progress that would be placed on this quest discards that many cards from the encounter deck instead. Forced: after Frodo's Choice is revealed at this stage, advance to 4A. Three of the four 3B add a Response.
- 4A (142067): add Parth Galen to the staging area. If it is your quest phase, end the phase without resolving the quest. 4B: reveal 1 additional card per player during the quest phase. Response: after an enemy is revealed at this stage, raise your threat by its threat to engage it, once per round per player at any stage. When this stage is defeated, the players win.
- Booklet difficulty 7. Encounter set: Breaking of the Fellowship only.

## Separate staging

Each seat's quest, staging, and resolution from stage 2B follow the MEC109 span on separate staging. After a seat commits to its own stage, it reveals for its own stage and compares its committed willpower with its own staging threat. Progress goes on its stage, or its own threat rises. Another seat does not raise threat for that failure. Engagement checks use only that seat's staging area. Cards that say "the staging area", "this stage" or "the quest" mean that seat's. Archery is totaled per stage. If a seat is eliminated while stages are separate, that stage and the encounter cards at it are discarded. Each seat has an active location of its own, and travels in player order to a location of its own staging area. True solo has one staging area and one 3A of the player's choice.

The per-seat staging slot and quest stage have existed on the model since phase 7. This is the first scenario that fills them. The second staging area renders only when the 2B record creates it.

## E2E

`.maestro/scenarios/breaking-of-the-fellowship/breaking-of-the-fellowship.yaml` opens a seeded true-solo save after stage 2B and asserts one staging area. A two-handed save asserts two, with two different stage 3 titles. A win records the burden choice and the captives. A loss writes nothing.

## Exit

The procedure's two halves. True solo and two-handed both run stage 2B on a phone. Fellowship's six nodes can show won, in order, and only a won scenario has unlocked the next.
