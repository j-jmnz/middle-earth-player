# Phase 50 — Ered Mithrin campaign shell, treasures and the pool

Depends on: phase 49
Blocks: phase 51

Plan: [docs/plans/done/ered-mithrin.md](../../plans/done/ered-mithrin.md), "Phase 50: Ered Mithrin campaign shell, treasures and the pool" and "Notes for the orchestrator". Analogue: [phase 38](phase-38-dream-chaser-campaign-shell.md).

## Goal

The app knows the Ered Mithrin campaign: it is on the campaign list and the Scenarios tab (one box, `ered-mithrin`, holding all nine scenarios), opens its booklet, refuses Haldan as a hero outside part 3, and carries discovered treasures, boon-ally log lines, Beldis's uses and the encounter cards of the Campaign Pool in the campaign log. There is no XP and no Hard/Expert mode. No scenario is playable yet.

## Procedure

The plan's Phase 50 items 1 to 8:

1. **Registry.**
   - `src/screens/data/campaign-data.ts`: the campaign, nine scenarios and one box `ered-mithrin`. `saga` is false.
   - Also `campaignIds`, the Scenarios-tab section, `start-ered-mithrin`, and the registry test against `data/campaigns/index.json`.
   - `scripts/build/catalog.ts` and `PACK_CAMPAIGN`.
   - `src/campaign/playable.ts` stays unchanged until phase 52.
2. **Booklet.**
   - `BOOKLETS` id `ered-mithrin` (`src/screens/booklets/books.ts`) and a `BOOKLET_SOURCES` row (`scripts/build/pack-booklets.ts`); the pinned MEC115 file is bundled.
   - `src/screens/rules/glossary.ts`: `DOC_NAMES`, `BOOKS`, and the `emce.setup-` filter.
   - The `src/screens/rules/view.tsx` tile and `BOOK_SCENE`.
3. **Loadout** (`src/campaign/loadout.ts`).
   - Haldan (hero 19026, from RAR; TWoR 18070 is the objective ally, not the hero) is refused in every part except 3, citing `emce.haldan`. `HERO_BANS` allows one banned part per ban today; Ered Mithrin needs "every part except 3", so the ban takes a list of parts.
   - A discovered treasure may be added to a deck: 1 copy by title, outside the 50-card minimum (`emce.treasure`). An undiscovered treasure is refused, with the reason.
4. **Campaign log** (`src/campaign/log.ts`; Zod with defaults, so old saves load; columns follow the MEC115 Campaign Log sheet, `emce.campaign-log`):
   - treasures discovered;
   - the four "Unique Allies Protecting Wilderland" log lines (boon allies Turayn, Melanwar, Isolde, Beldis; `emce.boon-allies`);
   - Beldis's uses per player (four boxes);
   - encounter cards in the Campaign Pool, with tallied copies (`emce.campaign-pool-encounter`).
5. **Campaign verbs.** A new `wilderland` campaign-family file, run by Setup and Resolution:
   - `AttachRandomTreasure`: 1 of 3 random undiscovered treasures, attached as a guarded objective. The pick is a seeded draw, so goldens stay deterministic.
   - `DiscoverTreasure`: on a win, for the treasure that was claimed.
   - `BoonAllyOrLogLine`: the players choose between the ally joining the pool and the log line; no default.
   - `AddEncounterToPool` and `RemoveFromPool`, with the "each player may remove one non-burden card" choice.
   - `RemoveFromEncounterDeckIfLogged`: N cards of a type, chosen by the first player.
   - The deal adds the pool's encounter cards to every encounter deck it builds, whatever their set, citing `emce.campaign-pool-encounter`.
   - Carried rules the verbs and checks read: scenarios 3 and 7 waive the hero-change penalty (the `WaiveThreatPenalty` verb already exists in `src/campaign/briefing.ts`); scenario 8 counts the treasures in the log; the campaign is won by winning scenario 9.
   - Check that nothing reads `XP_ROWS`, `GAVIN` or `MODE_CARD_CODE` in `src/campaign/xp.ts` unconditionally; they stay unread when `campaign.xp` is false.
6. **Screens.**
   - The path and log show treasures, ally lines, Beldis's boxes and the pool's encounter cards.
   - The Resolution's choices are made on the existing resolution screen (as Parrying Cutlass or Throwing Axe was). No control types a number.
7. **Versions.** The catalog version bumps if a column changes. The `ENGINE_VERSION` bump (`src/rules/engine/version.ts`) belongs to the first phase whose records use these verbs: a verb no record uses cannot move a replayed game.
8. **Tests and flows.**
   - Tests: registry, loadout (Haldan, treasures), log round trip, old-save load, pool encounter cards dealt.
   - Flows: `.maestro/features/ered-mithrin-start.yaml` and `.maestro/features/booklet-ered-mithrin.yaml`; update `.maestro/features/scenarios-boxes.yaml`.

Also touched (plan, Critical files): `src/campaign/{start,checklist,save}.ts`. `docs/brief.md` gains an "Ered Mithrin" section in the same commit as the rules it states.

## E2E

`.maestro/features/ered-mithrin-start.yaml`, `.maestro/features/scenarios-boxes.yaml` (updated), `.maestro/features/booklet-ered-mithrin.yaml`.

## Exit

Every other campaign's goldens unchanged and green, new tests green, `pnpm lint`, `pnpm typecheck` and `pnpm test` green. In a cloud session the phone checks and Maestro runs stay open in `STATUS.md`. One review round (`.cursor/agents/orchestrator.md`, "One review round"; `ux` too: `src/screens` changes).
