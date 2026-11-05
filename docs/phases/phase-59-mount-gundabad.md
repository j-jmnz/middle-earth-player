# Phase 59 — Mount Gundabad

Engine half depends on: phase 58's engine half
Phone half depends on: phase 58
Blocks: phase 60

Plan: [docs/plans/ered-mithrin.md](../plans/ered-mithrin.md), "Phases 52-60: one scenario each" and "Notes for the orchestrator". Procedure: [phase 12](phase-12-knife-in-the-dark.md), "Scenario procedure".

## Goal

`mount-gundabad`, Ered Mithrin part 8, is playable in campaign and standalone.

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `mount-gundabad`, and the plan's list for phases 52 to 60:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 49).
- `pnpm scenario:new mount-gundabad` (`--dry-run` first) writes the skeletons and the registry lines. `pnpm effects:draft mount-gundabad`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons, burdens and treasures it names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or an `emce.*` span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/mount-gundabad.ts`; the EMCE boon, burden and treasure records in `src/effects/authored/pool/EMCE.ts`.
- Golden: `src/campaign/scenarios/mount-gundabad/golden.json` with its golden test, scene and game scripts: true solo and two-handed, a win and a loss, with the Resolution's pool, log-line and treasure effects. Random treasure picks are a seeded draw.
- A campaign test chains the previous part's real Resolution and checks that its pool, treasures and log lines reach this part.
- Add `mount-gundabad` to `src/campaign/playable.ts`, then `pnpm effects:open` and `node --experimental-strip-types scripts/card-smoke/run.ts <new codes>`, including the EMCE cards this scenario deals.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.
- Rule wording comes from the pinned MEC115 PDF (`pnpm data:query`), never from memory. A scan the agent cannot read is a question for the user. If a golden of an existing campaign would move, stop and report why.

## Cards

- Campaign card, collector number 193 (code after the EMCE rule in `data/overrides.json`, `productCodes`).
- The Gundabad quest deck (`emce.gundabad-quest-deck`, `emce.bypassing`).
- The seven Exploring Gundabad stage 2s are shuffled with side 2A faceup and there is no stage 3; a stage flips to B at the start of the quest phase; at the end of combat the current quest may be bypassed (it loses progress, goes to the bottom, and the next 2A is revealed); a completed one goes to the victory display or wins the game. This is a quest-order verb next to Voyage's random stage order (`src/rules/quest/quest.ts`). The quest-deck area is built in this phase from the design in phase 51b's Scenario areas.
- The Caves deck plus Dagnir's Hoard and Throat of the Mountain; First Forge set aside; Wormsbane.
- Dragon-sickness at 6 or more logged treasures. Ignore Discover. Encounter effects cannot discard unique locations.
- Resolution: take a treasure; remove A Growing Threat from the Campaign Pool (`RemoveFromPool`).
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/mount-gundabad.json` and `emce.setup-mount-gundabad`.

## E2E

`.maestro/scenarios/mount-gundabad/mount-gundabad.yaml` (a win runs the Resolution, writes its pool, treasures and log lines and unlocks the next part) and `.maestro/scenarios/mount-gundabad/mount-gundabad-loss.yaml` (a loss writes nothing), on the subflows in `.maestro/subflows/`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, writes the pool, treasures and log lines it names, and unlocks the next part in Ered Mithrin; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `typecheck`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every other campaign's golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress or life. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too if `src/screens` or `src/play` changed).
