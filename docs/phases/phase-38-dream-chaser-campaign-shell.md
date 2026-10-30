# Phase 38 — Dream-chaser campaign shell and XP

Depends on: phase 37
Blocks: phase 39
May be split into 38 and 38b (as 28 and 28b) if the XP screen is large.

Plan: [docs/plans/dream-chaser.md](../plans/dream-chaser.md), "Phase 38 - Dream-chaser campaign shell and XP" and "Notes for the orchestrator and the implementer agent". Analogue: [phase 28](phase-28-campaign-registry.md).

## Goal

The app knows the Dream-chaser campaign: it is on the campaign list and the Scenarios tab (one box, `dream-chaser`, holding all nine scenarios), opens its booklet, refuses Na'asiyah in scenarios 1 to 7, and carries XP, marks and upgrades in the campaign log. No scenario is playable yet.

## Procedure

The plan's Phase 38 items 1 to 8:

1. **Registry.** `src/screens/campaign-data.ts`, `campaignIds`, the Scenarios tab section, `start-dream-chaser`, the registry test against `data/campaigns/index.json`, `scripts/build-catalog.ts`. `saga` is false.
2. **Booklet.** `BOOKLETS` id `dream-chaser`, `BOOKLET_SOURCES`, `rules-glossary.ts`, `rules-view.tsx`, `bookletParams`. The pinned MEC111 file is bundled.
3. **Loadout.** Na'asiyah (12109) refused in scenarios 1 to 7 of a campaign game, citing `dcce.naasiyah`.
4. **Campaign log: XP.** New log fields with defaults so old saves load; a `GainXp` effect verb in a new `dreamchaser` campaign-family file, run by the Resolution; the path shows XP; a "Spend XP" screen lets the players choose where each XP goes. No typing of numbers, no automatic spend (`dcce.gaining-xp`, `dcce.scalable-upgradable`).
5. **Campaign facts.** "Gavin returned" as a log fact; the Campaign Pool holds the scalable cards; the checklist deals the pool cards each campaign card names.
6. **Hard/Expert Mode card** (`dcce.hard-expert`): offered at campaign setup and in each briefing; the log stores the choice per scenario.
7. **Bump** `ENGINE_VERSION` and the catalog version if a column changes; a migration in `drizzle/` if needed.
8. **Tests and flows.** Registry, loadout, XP round trip, spend and upgrade, old-save load; `.maestro/dream-chaser-start.yaml`, `scenarios-boxes.yaml` updated, `booklet-dream-chaser.yaml`.

## E2E

`.maestro/dream-chaser-start.yaml`, `.maestro/scenarios-boxes.yaml` (updated), `.maestro/booklet-dream-chaser.yaml`.

## Exit

Fellowship and Mirkwood goldens unchanged and green, new tests green, `pnpm lint`, `npx tsc --noEmit` and `pnpm test` green. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`. One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too: `src/screens` changes).
