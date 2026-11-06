# Phase 29 — Passage Through Mirkwood

Engine half depends on: phase 28b
Phone half depends on: phase 28b
Blocks: phase 30

Plan: [docs/plans/done/mirkwood-paths.md](../plans/done/mirkwood-paths.md), "Phases 29–33" and "Notes for the orchestrator and the implementer agent".

## Goal

`passage-through-mirkwood`, Mirkwood Paths part 1, is playable in campaign and standalone.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `passage-through-mirkwood`:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 27).
- `pnpm effects:draft passage-through-mirkwood`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons and burdens below.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/passage-through-mirkwood.ts`; boon and burden pool records in `src/effects/authored/pool/RevCore.ts`.
- Golden: `src/campaign/scenarios/passage-through-mirkwood/golden.json` with `passage-through-mirkwood/golden.test.ts`, `test/scenarios/passage-through-mirkwood/scene.ts` and `test/scenarios/passage-through-mirkwood/game.ts`: true solo and two-handed, a win and a loss.
- A campaign test checks that a new Mirkwood Paths save deals this scenario first, with the Campaign Setup Checklist (no saga setup).
- Add `passage-through-mirkwood` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- **Branching quest.** Stage 3 has two B sides, 01121 and 01122: one is chosen at random and the other removed from the game. `advanceStage` in `src/rules/quest/quest.ts` is linear today; the branch is engine work, and the engine records a "stage reached" fact.
- Campaign card 01129: its resolution reads the stage-reached fact.
- Mendor (01135): an objective ally with `leavesPlayLoses` (the Gildor pattern).
- Mendor's Support boon: one copy per player (the multi-copy pool from phase 28).
- Burdens Ungoliant's Swarm and Lingering Venom.
- Encounter sets and Easy removals from `ltp.setup-passage-through-mirkwood` and the `easy-mode` spans.

## E2E

`.maestro/scenarios/passage-through-mirkwood/passage-through-mirkwood.yaml` (a win runs the resolution and unlocks `journey-along-the-anduin`) and `.maestro/scenarios/passage-through-mirkwood/passage-through-mirkwood-loss.yaml` (a loss writes nothing), with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the resolution and unlocks the next part in Mirkwood Paths; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
