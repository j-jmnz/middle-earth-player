# Phase 30 — Journey Along the Anduin

Engine half depends on: phase 29's engine half
Phone half depends on: phase 29
Blocks: phase 31

Plan: [docs/plans/mirkwood-paths.md](../plans/mirkwood-paths.md), "Phases 29–33" and "Notes for the orchestrator and the implementer agent".

**Review rule (user instruction, 2026-10-27):** one review round per phase. The main session runs `/reviewer` once on this phase's diff (and `/ux` once if `src/screens` or `src/play` changed), hands its blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that fix pass leaves open is recorded in this phase's `STATUS.md` note. This replaces "until `/reviewer` reports no blocks" for phases 27 to 33.

## Goal

`journey-along-the-anduin`, Mirkwood Paths part 2, is playable in campaign and standalone.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `journey-along-the-anduin`:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 27).
- `pnpm effects:draft journey-along-the-anduin`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons and burdens below.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>*.ts`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/journey-along-the-anduin.ts`; boon and burden pool records in `src/effects/authored/pool/RevCore.ts`.
- Golden: `src/campaign/golden/journey-along-the-anduin.json` with `golden-anduin.test.ts`, `scripts/anduin-scene.ts` and `scripts/anduin-game.ts`: true solo and two-handed, a win and a loss.
- A campaign test checks that Passage Through Mirkwood's earned pool reaches this scenario through the Campaign Setup Checklist.
- Add `journey-along-the-anduin` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Setup: each player reveals 1 card.
- Hill Troll (01082): excess combat damage goes to threat (the ledger line says how).
- Stage rules: no engagement checks; skip the staging step; the players win when no enemies are in play; search for a Hill Troll if none is in play.
- Campaign card 01130: Valor and Scarred are set aside and attached when their triggers occur. The resolution picks the prisoner: the hero with the most damage, a random tie, written as the log's `prisoner` fact (phase 28).
- Smaller lines: Banks of the Anduin, Wargs, Wolf Rider, Enchanted Stream.
- Encounter sets and Easy removals from `ltp.setup-journey-along-the-anduin` and the `easy-mode` spans.

## E2E

`.maestro/journey-along-the-anduin.yaml` (a win records the prisoner and unlocks `escape-from-dol-guldur`) and `.maestro/journey-along-the-anduin-loss.yaml`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the resolution and unlocks the next part in Mirkwood Paths; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
