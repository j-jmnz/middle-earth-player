# Phase 57 — Fire in the Night

Engine half depends on: phase 56's engine half
Screen half depends on: phase 56
Blocks: phase 58

Plan: [docs/plans/done/ered-mithrin.md](../plans/done/ered-mithrin.md), "Phases 52-60: one scenario each" and "Notes for the orchestrator". Procedure: [agent brief](../handover/agent-brief.md), "Scenario procedure".

## Goal

`fire-in-the-night`, Ered Mithrin part 6, is playable in campaign and standalone.

## Procedure

The "Scenario procedure" (`docs/handover/agent-brief.md`), steps 1 to 6, for `fire-in-the-night`, and the plan's list for phases 52 to 60:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 49).
- `pnpm scenario:new fire-in-the-night` (`--dry-run` first) writes the skeletons and the registry lines. `pnpm effects:draft fire-in-the-night`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup and Resolution and the boons, burdens and treasures it names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or an `emce.*` span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/fire-in-the-night.ts`; the EMCE boon, burden and treasure records in `src/effects/authored/pool/EMCE.ts`.
- Golden: `src/campaign/scenarios/fire-in-the-night/golden.json` with its golden test, scene and game scripts: true solo and two-handed, a win and a loss, with the Resolution's pool, log-line and treasure effects. Random treasure picks are a seeded draw.
- A campaign test chains the previous part's real Resolution and checks that its pool, treasures and log lines reach this part.
- Add `fire-in-the-night` to `src/campaign/playable.ts`, then `pnpm effects:open` and `node --experimental-strip-types scripts/card-smoke/run.ts <new codes>`, including the EMCE cards this scenario deals.
- Screen half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.
- Rule wording comes from the pinned MEC115 PDF (`pnpm data:query`), never from memory. A scan the agent cannot read is a question for the user. If a golden of an existing campaign would move, stop and report why.

## Cards

- Campaign card, collector number 187 (code after the EMCE rule in `data/overrides.json`, `productCodes`).
- Encounter side quests (`emce.side-quests`).
- A side-quest deck of eight side quests (null `EncounterSet` in Hall of Beorn, given Fire in the Night's set by phase 49). Side quests go to staging and their When Revealed cannot be cancelled; the first player may make one current at the start of the quest phase; a defeated one goes to the victory display without advancing; excess progress is discarded.
- The side-quest area is built in this phase from the design in phase 51b's Scenario areas.
- Dagnir in staging. Beldis and the four-use log boxes (`emce.boon-allies`).
- Resolution: a treasure at 5 or more progress on Hrogar's Hill; each player may remove one non-burden card from the Campaign Pool (`RemoveFromPool`).
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/fire-in-the-night.json` and `emce.setup-fire-in-the-night`.

## E2E

`.maestro/scenarios/fire-in-the-night/fire-in-the-night.yaml` (a win runs the Resolution, writes its pool, treasures and log lines and unlocks the next part) and `.maestro/scenarios/fire-in-the-night/fire-in-the-night-loss.yaml` (a loss writes nothing), on the subflows in `.maestro/subflows/`, with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, writes the pool, treasures and log lines it names, and unlocks the next part in Ered Mithrin; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `typecheck`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every other campaign's golden and test passes without edits to its expectations.

**Screen half:** as the Scenario procedure says: the words and widgets written and tested, the Maestro flows written, and no control types damage, resources, threat, progress or life.

One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too if `src/screens` or `src/play` changed).
