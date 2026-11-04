# Phase 45 — Temple of the Deceived

Engine half depends on: phase 44's engine half
Phone half depends on: phase 44
Blocks: phase 46

Plan: [docs/plans/dream-chaser.md](../../plans/dream-chaser.md), "Phases 40-48 - one scenario each" and "Notes for the orchestrator and the implementer agent".

## Goal

`temple-of-the-deceived`, Dream-chaser part 6, is playable in campaign and standalone. Standalone play uses the base sides of the two-sided cards; the campaign uses the Campaign Mode sides (`dcce.campaign-mode`).

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `temple-of-the-deceived`, and the plan's list for phases 40 to 48:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 37).
- `pnpm effects:draft temple-of-the-deceived`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup, Resolution and XP list and the boons and burdens its Setup names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>/`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/temple-of-the-deceived.ts`; boon and burden pool records in `src/effects/authored/pool/DCCE.ts`.
- Golden: `src/campaign/scenarios/temple-of-the-deceived/golden.json` with its `golden-*.test.ts`, scene and game scripts: true solo and two-handed, a win and a loss, with the XP the campaign card awards.
- A campaign test checks that the previous part's pool, XP and marks reach this part, and that the standalone game uses the base sides.
- Add `temple-of-the-deceived` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Campaign card 11197 (code after the DCCE rule in `data/overrides.json`, `productCodes`).
- The Island Map and Exploration (`dcce.island-map`, `dcce.exploration`): fifteen double-sided locations in a 3 x 5 grid, an active location marker, travel without discarding, directional card text, Gate Key and Temple Guardian, Starla and both Recurring Nightmares as secrets under the Temple locations.
- Resolution: Starla joins the pool and each non-secret Recurring Nightmare is shuffled into a chosen player's deck after the starting hand.
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/temple-of-the-deceived.json` and `dcce.setup-temple-of-the-deceived`.

## E2E

`.maestro/scenarios/temple-of-the-deceived/temple-of-the-deceived.yaml` (a win runs the Resolution, awards its XP and unlocks the next part) and `.maestro/scenarios/temple-of-the-deceived/temple-of-the-deceived-loss.yaml` (a loss writes nothing), with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, awards its XP and unlocks the next part in Dream-chaser; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke/run.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship and Mirkwood golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress, life or XP. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round (`.cursor/agents/orchestrator.md`, "One review round").
