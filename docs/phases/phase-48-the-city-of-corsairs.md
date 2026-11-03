# Phase 48 — The City of Corsairs

Engine half depends on: phase 47's engine half
Phone half depends on: phase 47
Blocks: nothing (the last Dream-chaser phase)

Plan: [docs/plans/dream-chaser.md](../plans/dream-chaser.md), "Phases 40-48 - one scenario each" and "Notes for the orchestrator and the implementer agent".

## Goal

`the-city-of-corsairs`, Dream-chaser part 9, is playable in campaign and standalone. Standalone play uses the base sides of the two-sided cards; the campaign uses the Campaign Mode sides (`dcce.campaign-mode`).

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `the-city-of-corsairs`, and the plan's list for phases 40 to 48:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 37).
- `pnpm effects:draft the-city-of-corsairs`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup, Resolution and XP list and the boons and burdens its Setup names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/the-city-of-corsairs.ts`; boon and burden pool records in `src/effects/authored/pool/DCCE.ts`.
- Golden: `src/campaign/golden/the-city-of-corsairs.json` with its `golden-*.test.ts`, scene and game scripts: true solo and two-handed, a win and a loss, with the XP the campaign card awards.
- A campaign test checks that the previous part's pool, XP and marks reach this part, and that the standalone game uses the base sides.
- Add `the-city-of-corsairs` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Campaign card 11215 (code after the DCCE rule in `data/overrides.json`, `productCodes`).
- From Sea to Land (`dcce.from-sea-to-land`): the encounter deck swapped for a second deck at stage 2B, Captain Sahír (Indestructible) with the Black Key burden, The Black Sword and its Refresh Action, Slave Ship, The Shattered Monument. The campaign card flips and its back is a standing effect.
- A win ends the campaign ("The players win the campaign!"); "Gavin returned" puts him in.
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/the-city-of-corsairs.json` and `dcce.setup-the-city-of-corsairs`.

## E2E

`.maestro/the-city-of-corsairs.yaml` (a win runs the Resolution, awards its XP and ends the campaign) and `.maestro/the-city-of-corsairs-loss.yaml` (a loss writes nothing), with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, awards its XP and ends the campaign; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship and Mirkwood golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress, life or XP. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round").
