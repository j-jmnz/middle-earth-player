# Phase 14 — The Ring Goes South

Engine half depends on: phase 13's engine half
Phone half depends on: phase 13
Blocks: phase 15

**State (2026-10-26):** engine half done and merged (the `south` family; records in `src/effects/authored/the-ring-goes-south.ts`; `the-ring-goes-south` is in `src/campaign/playable.ts`). `/reviewer` and `/ux` have not run. The phone half is built and unit-tested; the phone checks, the four Maestro runs and their fixtures are open.

## Goal

`the-ring-goes-south` is playable, including the campaign boons, stage 1B's four face-up cards, stage 4's second active location, and the facedown Ring-bearer. Follow the scenario procedure in phase 12.

## Cards

Hall of Beorn's text for the campaign card 142019 is a copy of stage 1A/1B. Use the ledger, read from the scan in phase 8c.

- Campaign card front, Setup: each player may change hero cards without the +1 threat penalty. The players have earned Sting (142011), Mithril Shirt (142012), Glamdring (142013) and Andúril (142014). Each player chooses one and adds it to their hand. Any left unchosen are shuffled into the first player's deck. The briefing offers the free hero change. The checklist step for hero changes reads the waiver from this record.
- Campaign card back: if Lust for the Ring is attached to a hero, the players have earned that burden.
- Stage 1A (142020) Setup: set Lust for the Ring, Redhorn Pass, Doors of Durin and Watcher in the Water aside, out of play.
- 1B, Forced at the end of the planning phase: each player places the top card of their deck face up, in player order, until there are 4 face-up cards. The first player assigns them: one played for 0, one to its owner's hand, one discarded, one shuffled into its owner's deck. Then either shuffle Lust for the Ring into the encounter deck or raise each player's threat by 5. Advance to stage 2. This needs an "assign each of N cards to a distinct outcome" choice. Add it as one verb.
- 2A (142021): make Redhorn Pass the active location. The first player reveals cards until there is at least X threat in staging, where X is twice the number of players.
- 3B (142022) and 4B (142023): the players must travel if able. Forced: after an enemy engages a player, place 1 damage on the active location (3B) or on each active location (4B).
- 4A: make Doors of Durin the active location, add Watcher in the Water to staging, discard all tokens from the Ring-bearer, and place it and each attached card facedown under Watcher in the Water. While there, the hero and its attachments are in play and controlled by nobody.
- 4B: there can be 2 active locations. If Doors of Durin is explored, the players win.
- Doors of Durin is immune to player card effects. An effect that targets "the active location" can target only the one that is not Doors of Durin.
- Booklet difficulty 6. Encounter set: The Ring Goes South only.

The second active-location slot is shared scenario state from phase 7. This is the first scenario that opens it.

## E2E

`.maestro/the-ring-goes-south.yaml` opens a seeded save on stage 4 and asserts the two active-location labels, including Doors of Durin. A briefing flow asserts the free hero change is offered without the penalty line. A resolution flow unlocks `journey-in-the-dark` on a win.

## Exit

The procedure's two halves. A person can reach stage 4 on the phone, see two active locations, and see the Ring-bearer leave control without leaving play. A win records Lust for the Ring only when it is attached.

Written, 2026-10-26 (cloud session, none has run): `.maestro/the-ring-goes-south.yaml` (stage 4: the active locations and the held Ring-bearer, then kill and relaunch), `-briefing.yaml` (the waiver line, the four boons, no penalty to accept), `-win.yaml` (the Resolution asks nothing and unlocks `journey-in-the-dark`) and `-loss.yaml` (Defeat writes nothing). **Open:** their fixtures `south-start`, `south-stage-4`, `south-won` and `south-lost` are not committed, for the reason phase 13 gives for the Ford fixtures. The decisions of the engine half are in `docs/brief.md` (The Ring Goes South, stage 4 and the damage on locations).
