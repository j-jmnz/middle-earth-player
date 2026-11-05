# Phase 48 — The City of Corsairs

Engine half depends on: phase 47's engine half
Phone half depends on: phase 47
Blocks: nothing (the last Dream-chaser phase)

Plan: [docs/plans/done/dream-chaser.md](../../plans/done/dream-chaser.md), "Phases 40-48 - one scenario each" and "Notes for the orchestrator and the implementer agent".

## Goal

`the-city-of-corsairs`, Dream-chaser part 9, is playable in campaign and standalone. Standalone play uses the base sides of the two-sided cards; the campaign uses the Campaign Mode sides (`dcce.campaign-mode`).

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `the-city-of-corsairs`, and the plan's list for phases 40 to 48:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 37).
- `pnpm scenario:new the-city-of-corsairs` writes the skeletons and the registry lines (`docs/handover/agent-brief.md`, Approach, step 7); `pnpm data:build`, then `pnpm effects:draft the-city-of-corsairs` and the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup, Resolution and XP list and the boons and burdens its Setup names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/the-city-of-corsairs.ts`; boon and burden pool records in `src/effects/authored/pool/DCCE.ts`.
- Golden: `src/campaign/scenarios/the-city-of-corsairs/golden.json` with its `golden.test.ts` beside it, and `test/scenarios/the-city-of-corsairs/scene.ts` and `game.ts` on the shared kit (`test/harness/scene-kit.ts`, `game-kit.ts`, `golden-suite.ts`; the seed finder `scripts/e2e/seed-kit.ts`), listed in `test/harness/golden-registry.ts`: true solo and two-handed, a win and a loss, with the XP the campaign card awards.
- A campaign test checks that the previous part's pool, XP and marks reach this part, and that the standalone game uses the base sides.
- Add `the-city-of-corsairs` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Before the records, move the sea family's direct calls from the core (the attack legality in `src/rules/engine/legal.ts` and `src/rules/combat/combat.ts`) behind a family hook, with the goldens byte-identical (`docs/plans/scenario-pipeline.md`, section D).
- The rulings needed first are the Stormcaller card the campaign Setup flips (the 48 row of the Phases table in `docs/phases/STATUS.md`) and the readings that carry over: Gavin's and Send for Help's seats and the added Refresh (`docs/phases/STATUS.md`, Open items, Rules and engine).
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Campaign card 11215 (code after the DCCE rule in `data/overrides.json`, `productCodes`).
- From Sea to Land (`dcce.from-sea-to-land`): the encounter deck swapped for a second deck at stage 2B, Captain Sahír (Indestructible) with the Black Key burden, The Black Sword and its Refresh Action, Slave Ship, The Shattered Monument. The campaign card flips and its back is a standing effect.
- A win ends the campaign ("The players win the campaign!"); "Gavin returned" puts him in.
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/the-city-of-corsairs.json` and `dcce.setup-the-city-of-corsairs`.

## E2E

`.maestro/scenarios/the-city-of-corsairs/the-city-of-corsairs.yaml` (a win runs the Resolution, awards its XP and ends the campaign) and `.maestro/scenarios/the-city-of-corsairs/the-city-of-corsairs-loss.yaml` (a loss writes nothing), on the subflows in `.maestro/subflows/`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, awards its XP and ends the campaign; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship and Mirkwood golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress, life or XP. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round").
