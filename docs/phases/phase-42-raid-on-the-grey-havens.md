# Phase 42 — Raid on the Grey Havens

Engine half depends on: phase 41's engine half
Phone half depends on: phase 41
Blocks: phase 43

Plan: [docs/plans/dream-chaser.md](../plans/dream-chaser.md), "Phases 40-48 - one scenario each" and "Notes for the orchestrator and the implementer agent".

**Review rule (user instruction, 2026-10-30):** one review round per phase, run by the orchestrator (`.cursor/agents/orchestrator.md`, "One review round"). A block the fix pass leaves open is recorded in this phase's `STATUS.md` note. This applies to phases 37 to 48.

## Goal

`raid-on-the-grey-havens`, Dream-chaser part 3, is playable in campaign and standalone. Standalone play uses the base sides of the two-sided cards; the campaign uses the Campaign Mode sides (`dcce.campaign-mode`).

## Procedure

The phase 12 "Scenario procedure", steps 1 to 6, for `raid-on-the-grey-havens`, and the plan's list for phases 40 to 48:

- `pnpm data:build -- --verbose` shows no failed cross-check for it; every dealt card has a ledger entry (phase 37).
- `pnpm effects:draft raid-on-the-grey-havens`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup, Resolution and XP list and the boons and burdens its Setup names, on both sides where a card has two.
- A new verb goes in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>*.ts`), cites a ledger line or a rule span, and has its own test. Do not bend an existing verb to mean something else.
- Scenario records go in `src/effects/authored/raid-on-the-grey-havens.ts`; boon and burden pool records in `src/effects/authored/pool/DCCE.ts`.
- Golden: `src/campaign/golden/raid-on-the-grey-havens.json` with its `golden-*.test.ts`, scene and game scripts: true solo and two-handed, a win and a loss, with the XP the campaign card awards.
- A campaign test checks that the previous part's pool, XP and marks reach this part, and that the standalone game uses the base sides.
- Add `raid-on-the-grey-havens` to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone half: words and widgets only where a line creates them (cite the line in `docs/brief.md`), Maestro win and loss flows, fixtures.

## Cards

- Campaign card 11182 (code after the DCCE rule in `data/overrides.json`, `productCodes`).
- Aflame X (`dcce.aflame`) with The Havens Burn hosting the `under` zone, the Dream-chaser location, The Stormcaller Elite first use (Captain Sahír, Na'asiyah), Calphon removed after stage 2B, Galdor's Counsel with X + 1, Parrying Cutlass or Throwing Axe at the Resolution.
- XP from cards underneath The Havens Burn, Elven Wave-runners and Na'asiyah.
- Encounter sets, Easy removals and the extra piles come from `data/scenarios/raid-on-the-grey-havens.json` and `dcce.setup-raid-on-the-grey-havens`.

## E2E

`.maestro/raid-on-the-grey-havens.yaml` (a win runs the Resolution, awards its XP and unlocks the next part) and `.maestro/raid-on-the-grey-havens-loss.yaml` (a loss writes nothing), with their fixtures.

## Exit

**Engine half:** coverage and the goldens green in Node. A win runs the Resolution, awards its XP and unlocks the next part in Dream-chaser; a loss writes nothing. The plan's Verification list is green (`data:build`, `data:check`, `--verbose`, `tsc`, `lint`, `test`, `effects:open` with no line for this scenario, `card-smoke.ts` on the new codes, `catalog:build`, `booklets:pack`, the golden). Every Fellowship and Mirkwood golden and test passes without edits to its expectations.

**Phone half:** as in phase 12: a person can win and lose the scenario on the phone, the log matches the engine, and no control types damage, resources, threat, progress, life or XP. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`.

One review round, as above.
