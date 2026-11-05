# Phase 60 — The Fate of Wilderland

Engine half depends on: phase 59's engine half
Phone half depends on: phase 59
Blocks: nothing (the last Ered Mithrin phase)

Plan: [docs/plans/ered-mithrin.md](../plans/ered-mithrin.md), "Phases 52-60: one scenario each" and "Notes for the orchestrator". Procedure: [phase 12](phase-12-knife-in-the-dark.md), "Scenario procedure".

## Goal

`the-fate-of-wilderland`, Ered Mithrin part 9, is playable in campaign and standalone, and its win ends the campaign.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `the-fate-of-wilderland`, and the plan's list for phases 52 to 60:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 49).
- `pnpm scenario:new the-fate-of-wilderland` (`--dry-run` first) writes the skeletons and the registry lines. `pnpm effects:draft the-fate-of-wilderland`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons, burdens and treasures it names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or an `emce.*` span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/the-fate-of-wilderland.ts`; the EMCE boon, burden and treasure records in `src/effects/authored/pool/EMCE.ts`.
- Golden: `src/campaign/scenarios/the-fate-of-wilderland/golden.json` with its golden test, scene and game scripts: true solo and two-handed, a win and a loss, with the Resolution's pool, log-line and treasure effects. Random treasure picks are a seeded draw.
- A campaign test chains the previous part's real Resolution and checks that its pool, treasures and log lines reach this part.
- Add `the-fate-of-wilderland` to `src/campaign/playable.ts`, then `pnpm effects:open` and `node --experimental-strip-types scripts/card-smoke/run.ts <new codes>`, including the EMCE cards this scenario deals.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.
- Rule wording comes from the pinned MEC115 PDF (`pnpm data:query`), never from memory. A scan the agent cannot read is a question for the user. If a golden of an existing campaign would move, stop and report why.

## Cards

- Campaign card, collector number 195 (code after the EMCE rule in `data/overrides.json`, `productCodes`).
- Assault cards, taken from the ledger.
- Search the encounter deck for a boon or a treasure.
- A Turayn removal and a Beldis removal.
- Ignore Deep and Discover.
- A win ends the campaign ("The players win the campaign!").
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/the-fate-of-wilderland.json` and `emce.setup-the-fate-of-wilderland`.

## E2E

`.maestro/scenarios/the-fate-of-wilderland/the-fate-of-wilderland.yaml` (a win runs the Resolution, writes its pool, treasures and log lines and ends the campaign) and `.maestro/scenarios/the-fate-of-wilderland/the-fate-of-wilderland-loss.yaml` (a loss writes nothing), on the subflows in `.maestro/subflows/`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, writes the pool, treasures and log lines it names, and ends the campaign; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `typecheck`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every other campaign's golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too if `src/screens` or `src/play` changed).
