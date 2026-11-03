# Phase 12 — A Knife in the Dark

Engine half depends on: phases 8d and 9. It can run beside phases 10 and 11.
Phone half depends on: phase 11
Blocks: phase 13

**State (2026-10-26):** engine half done and reviewed; phone half built; phone checks and Maestro runs open; the won flow stays open (no genuine win found; user-accepted). The procedure's verbs now live in mechanic families (`src/catalog/families/<family>.ts`, `src/rules/families/<family>/`, `src/effects/authored/families/<family>.ts`); the scenario's own records are in `src/effects/authored/fellowship-of-the-ring.ts`.

## Goal

`a-knife-in-the-dark` is playable on the phone. One scenario in this change. Do not start phase 13's engine half until this scenario's coverage is green.

## Scenario procedure

This procedure is the same for phases 12 to 16. Each phase file names only what its own cards add.

1. `data/scenarios/<id>.json` already exists (phase 8d). Re-read its cross-check report with `pnpm data:build -- --verbose`. Every card it deals has a ledger entry (phase 8c). A scan the agent cannot read is a question for the user, not a guess.
2. `pnpm effects:draft <id>`, then the `effect-author` agent, until ownership coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution.
3. Reuse the keyword framework and the verbs. A new verb is engine work in the mechanic family it belongs to (`src/catalog/families/<family>.ts` for the schema, `src/rules/families/<family>/` for the engine), cites a ledger line or a rule span, and gets its own test.
4. A zone or widget exists only when a setup record or a card line creates it. Cite the line in `docs/brief.md`.
5. Add a golden: an auto-player game on fixed seeds, true solo and two-handed, through a win and through a loss. The phase 8d cause test covers it.
6. The campaign test from phase 8d continues: the previous scenario's earned pool cards reach this scenario through the Campaign Setup Checklist.

**Engine half exit:** coverage and the goldens are green in Node. A win runs this campaign card's resolution and unlocks the next scenario. A loss writes nothing.

**Phone half exit:** a person can win and lose the scenario on the phone. The log matches the engine. No control types damage, resources, threat, progress, or life.

## Cards

- Campaign card 141044. Front: "You are playing Campaign Mode." Back: starting with the first player, each player may choose one of Tireless Ranger (141018), Skilled Healer (141019), Valiant Warrior (141020) and Noble Hero (141021) and attach it to a hero they control. All four are Permanent, with `Setup: Attach to a hero.` The resolution choice is per seat, may be declined, and records the hero on the log.
- Stage 1A (141025) Setup: set all copies of Ringwraith, The Witch-king, Midgewater and Weathertop aside, out of play. Add The Prancing Pony and Bill Ferny to the staging area. 1B: the players cannot advance while The Prancing Pony is in play (the source misspells it).
- Stage 2B (141026): Forced at the end of the round, either remove X progress (X is the number of players) or shuffle 1 out-of-play Ringwraith into the encounter deck. That is a first-player choice between two instructions.
- Stage 3B (141027): if there are no Nazgûl enemies in play, the players win.
- Sources disagree on the Ringwraith Easy count (4 against 2). Settle it from the printed Easy marks and record the override.
- Booklet difficulty 7. Encounter sets: A Knife in the Dark, Hunted, The Ring, The Nazgûl. The earned scenario 1 burden is shuffled in by the checklist.

The saga setup still runs: the first seat's chosen Ring-bearer, The One Ring, one Fellowship hero in play, no second Frodo.

## E2E

`.maestro/a-knife-in-the-dark.yaml`, tagged `scenario`, opens a seeded save parked on this scenario's resolution, gives one seat a boon on a named hero, relaunches, and finds the boon on that hero in the log with `flight-to-the-ford` unlocked. A loss flow leaves the log unchanged.

Open, 2026-10-25 (user-accepted): the won flow `.maestro/a-knife-in-the-dark.yaml` stays open because no genuine win was found. The loss flow `.maestro/a-knife-in-the-dark-loss.yaml` is written, but its fixture (`knife-lost`) is dealt from the log of scenario 1's won fixture, which is open too (phase 11, E2E): it is not committed, and its tests are skipped, until that win is found.

## Exit

Both halves above. The table gains no widget for this scenario.
