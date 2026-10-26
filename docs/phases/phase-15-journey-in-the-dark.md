# Phase 15 — Journey in the Dark

Engine half depends on: phase 14's engine half
Phone half depends on: phase 14
Blocks: phase 16

**State (2026-10-26):** not started. `journey-in-the-dark` is not in `src/campaign/playable.ts`; its printed lines are among those listed in `src/effects/open-lines.ts`. Records go in a scenario file in `src/effects/authored/` and new vocabulary in a family, as phases 13 and 14 did.

## Goal

`journey-in-the-dark` is playable. No new widget unless a card creates one. Follow the scenario procedure in phase 12.

## Cards

- Campaign card 142039 front, Setup: shuffle the burden treacheries Pursued by the Enemy and Shadow of Fear into the encounter deck. Add the burden objectives Grievous Wound (142088) and Overcome by Grief to the staging area. This is why 8b found these burdens counted by Hall of Beorn and absent from the load list. `data/cards` types Shadow of Fear (142085) and Overcome by Grief (142087) as `treasure` in the Breaking of the Fellowship set. Phase 8d's `campaignKind` and `burdenSet` fix that.
- Campaign card back: the first player chooses one burden treachery (Pursued by the Enemy or Shadow of Fear) and one burden objective (Grievous Wound or Overcome by Grief). If The Balrog (142044) is still in play, all four are earned instead. The condition is read from the final state.
- Stage 1A (142040) Setup: set The Balrog, The Great Bridge and Chamber of Mazarbul aside, out of play. Add Doom, Doom, Doom (142043) to the staging area with 10 damage on it. Each player adds 1 different location to the staging area. That is a per-seat search with a distinctness rule.
- 1B, Forced: after a player optionally engages an enemy, remove 1 damage from Doom, Doom, Doom.
- 2B (142041): if no enemies are in staging at the beginning of the quest phase, the first player reveals an additional card. The players cannot advance unless there are X resource tokens on this stage (X is the number of players times 3). Forced: after an enemy is defeated, place 1 resource token on this stage. Resource tokens on a quest card are a new token holder. Model them on the card instance, not as a seat pool.
- 3A (142042): each player reveals 1 card and removes 1 damage from Doom, Doom, Doom. 3B: at most 5 progress on this stage each round. The players cannot defeat it while The Great Bridge is in play. Defeating it wins.
- Booklet difficulty 8. Encounter set: Journey in the Dark only.

## E2E

`.maestro/journey-in-the-dark.yaml` opens a seeded save parked on this scenario's resolution. With The Balrog in play it asserts all four burdens are recorded. Without it, it asserts one choice per pair. A win unlocks `breaking-of-the-fellowship`. A loss leaves the log unchanged.

## Exit

The procedure's two halves. The resolution follows the Balrog condition. No control types damage, resources, threat, or progress.
