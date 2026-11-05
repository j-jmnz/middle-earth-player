# Phase 52 — Journey Up the Anduin

Engine half depends on: phase 51
Phone half depends on: phase 51b
Blocks: phase 53

Plan: [docs/plans/ered-mithrin.md](../plans/ered-mithrin.md), "Phases 52-60: one scenario each". Procedure: [phase 12](phase-12-knife-in-the-dark.md), "Scenario procedure".

## Goal

`journey-up-the-anduin`, Ered Mithrin part 1, is playable in campaign and standalone.

## Cards

- Campaign card, collector number 165 (code after the EMCE rule in `data/overrides.json`, `productCodes`).
- First use of the Wilderland family's Evil Creatures deck (`emce.evil-creatures-deck`).
- Setup: the Evil Creatures deck is built from the Wilderlands enemies taken out of the encounter deck; Wilderlands locations and treacheries are removed. The scenario deals the Revised Core sets Journey Along the Anduin and Wilderlands (user decision, 2026-11-05).
- Turayn comes under a player's control (a boon ally; `emce.boon-allies`). A Growing Threat is shuffled in. Resources are collected on the campaign card, and a treasure is attached at players + 3 (`emce.treasure`).
- Resolution: Turayn joins the pool or the oath log line is written (`BoonAllyOrLogLine`); A Growing Threat and the Evil Creatures enemies in play go to the Campaign Pool (`emce.campaign-pool-encounter`).
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/journey-up-the-anduin.json` and `emce.setup-journey-up-the-anduin`.

## E2E

`.maestro/scenarios/journey-up-the-anduin/journey-up-the-anduin.yaml` (a win runs the Resolution, writes its pool, treasures and log lines and unlocks the next part) and `.maestro/scenarios/journey-up-the-anduin/journey-up-the-anduin-loss.yaml` (a loss writes nothing), on the subflows in `.maestro/subflows/`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, writes the pool, treasures and log lines it names, and unlocks the next part in Ered Mithrin; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `typecheck`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every other campaign's golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too if `src/screens` or `src/play` changed).
