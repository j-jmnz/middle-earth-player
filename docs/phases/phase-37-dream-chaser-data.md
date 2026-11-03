# Phase 37 — Dream-chaser data

Depends on: phase 36
Blocks: phase 38

Plan: [docs/plans/dream-chaser.md](../plans/dream-chaser.md), "Phase 37 - Dream-chaser data" and "Notes for the orchestrator and the implementer agent". Analogue: [phase 27](phase-27-multi-campaign-data.md).

## Goal

The data pipeline builds the `dream-chaser` campaign from the seven original sets (The Grey Havens and the six Adventure Packs) and the Dream-chaser Campaign Expansion (DCCE, MEC111). Data only: nothing new is playable, no screen changes, and the Fellowship, Mirkwood Paths and The Dark of Mirkwood data are byte-identical.

## Procedure

The plan's Phase 37 items 1 to 8, in order:

1. **Sources.** Eight `PRODUCTS` rows, a `dream-chaser` `CampaignDef` with nine `ScenarioDef`s (each with `setupSpan` `dcce.setup-<id>` and its `Q06.n`/`E06.n` deck keys), MEC111 pinned as rules doc `dcce`. `pnpm data:sync hallofbeorn rules`.
2. **Cards.** `Ship_Objective` and `Ship_Enemy` types, the DCCE code rule with its override reason, the boon and burden merge with RingsDB's `treasure` rows, two-sided folds, the `... Campaign` set suffix.
3. **Scenarios.** Nine `data/scenarios/*.json`, `data/campaigns/dream-chaser.json`, the extra piles (Corsair deck, second encounter deck, Uncharted, Grotto, Stormcaller quest deck), Easy counts from the `E06` decks, Nightmare rows filtered out.
4. **Setup parser.** The nine campaign cards' and nine stage 1A Setup sentences, quoted from the ledger; a sentence no pattern reads is listed by `pnpm data:build -- --verbose`.
5. **Rules.** `dcce` in the span-id regex, the MEC111 boxes in `data/rules/columns.json`, the hand-checked `dcce.*` spans in `data/rules/index.json`, `scripts/data/rules.test.ts`.
6. **Ledger.** `data/printed/dream-chaser.json`, read from the pinned scans (`docs/plans/done/authoritative-data.md` section A). Order: `pnpm data:build`, `pnpm data:sync scans`, read. Every dealt, campaign, boon and burden card side, with each encounter card's Sailing success symbol; each entry records `readBy` and the scan sha256. A scan nobody can read is a question for the user, not a guess.
7. **Tests.** Generalize the `scripts/data` tests, `catalog-exit.test.ts` and `build/catalog.test.ts` for the fourth campaign; the existing assertions stay.
8. **Effects tooling.** `effects:draft` and `effects:open` read the fourth campaign; `src/effects/index.ts` imports the new files.

## E2E

None. No screen changes.

## Exit

- `pnpm data:build` and `pnpm data:check` green and deterministic; `pnpm data:build -- --verbose` shows no failed cross-check for the nine scenarios.
- `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm test` green. Every Fellowship and Mirkwood golden and test passes without edits to its expectations.
- `pnpm effects:open` lists the new cards' lines.
- `pnpm catalog:build`; `src/catalog/version.ts` committed if it changed.
- One review round (`.cursor/agents/orchestrator.md`, "One review round").
