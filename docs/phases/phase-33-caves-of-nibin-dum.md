# Phase 33 — The Caves of Nibin-Dûm

Engine half depends on: phase 32's engine half
Phone half depends on: phase 32
Blocks: nothing

Plan: [docs/plans/mirkwood-paths.md](../plans/mirkwood-paths.md), "Phases 29–33" and "Notes for the orchestrator and the implementer agent".

**Review rule (user instruction, 2026-10-27):** one review round per phase. The main session runs `/reviewer` once on this phase's diff (and `/ux` once if `src/screens` or `src/play` changed), hands its blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that fix pass leaves open is recorded in this phase's `STATUS.md` note. This replaces "until `/reviewer` reports no blocks" for phases 27 to 33.

## Goal

`the-caves-of-nibin-dum` is playable as Mirkwood Paths part 5, as The Dark of Mirkwood part 2, and standalone. Its resolution writes the Ranger Sense carry-over.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `the-caves-of-nibin-dum`:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 27).
- `pnpm effects:draft the-caves-of-nibin-dum`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons and burdens below.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/the-caves-of-nibin-dum.ts`; boon and burden pool records in `src/effects/authored/pool/TDoM.ts`.
- Golden: `src/campaign/scenarios/the-caves-of-nibin-dum/golden.json` with `the-caves-of-nibin-dum/golden.test.ts`, `test/scenarios/the-caves-of-nibin-dum/scene.ts` and `test/scenarios/the-caves-of-nibin-dum/game.ts`: true solo and two-handed, a win and a loss.
- A campaign test checks that The Oath's pool and facts reach this scenario in both campaigns.
- Add `the-caves-of-nibin-dum` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Setup: each player adds "No Time to Waste!" to their hand after drawing their starting hand (after the mulligan).
- Shiny Distraction burden (41042).
- Resolution reads the highest final threat (below 40): Ranger Sense (41049) joins the deck now, and is written as carry-over (phase 28).
- "Remove from the game and from the Campaign Pool": a per-entry pool removal.
- Encounter sets and Easy removals from `tdom.setup-the-caves-of-nibin-dum`.

## E2E

`.maestro/scenarios/the-caves-of-nibin-dum/the-caves-of-nibin-dum.yaml` (a win completes the campaign and writes the carry-over) and `.maestro/scenarios/the-caves-of-nibin-dum/the-caves-of-nibin-dum-loss.yaml`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the resolution and unlocks the next part in both Mirkwood Paths and The Dark of Mirkwood (the last part: the campaign is complete); a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
