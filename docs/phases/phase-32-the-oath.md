# Phase 32 — The Oath

Engine half depends on: phase 31's engine half
Phone half depends on: phase 31
Blocks: phase 33

Plan: [docs/plans/done/mirkwood-paths.md](../plans/done/mirkwood-paths.md), "Phases 29–33" and "Notes for the orchestrator and the implementer agent".

## Goal

`the-oath` is playable as Mirkwood Paths part 4 (continuing the same log), as The Dark of Mirkwood part 1 (a blank log, `tdom.mini-campaign`), and standalone.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `the-oath`:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 27).
- `pnpm effects:draft the-oath`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons and burdens below.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/the-oath.ts`; boon and burden pool records in `src/effects/authored/pool/TDoM.ts`.
- Golden: `src/campaign/scenarios/the-oath/golden.json` with `the-oath/golden.test.ts`, `test/scenarios/the-oath/scene.ts` and `test/scenarios/the-oath/game.ts`: true solo and two-handed, a win and a loss.
- A campaign test checks that Escape from Dol Guldur's pool reaches this scenario in Mirkwood Paths, and that a new `the-dark-of-mirkwood` save starts it on a blank log.
- Add `the-oath` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Setup: each player chooses 1 Adaptation boon (41044 to 41047). Their Actions are once per campaign: "Record in the Campaign Log when used" is the log's once-per-campaign fact (phase 28).
- Stalking Goblin burden (41041): searches the encounter deck, the discard pile and the player's collection.
- The campaign card in play gains a resource each round; the count is read at resolution (Guilty Conscience, 41043).
- Encounter sets and Easy removals from `tdom.setup-the-oath`.

## E2E

`.maestro/scenarios/the-oath/the-oath.yaml` (a win unlocks `the-caves-of-nibin-dum` in both campaigns) and `.maestro/scenarios/the-oath/the-oath-loss.yaml`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the resolution and unlocks the next part in both Mirkwood Paths and The Dark of Mirkwood; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
