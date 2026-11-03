# Phase 28 — Campaign registry, saga gating, log, booklets

Depends on: phase 27
Blocks: phase 28b

Plan: [docs/plans/mirkwood-paths.md](../plans/mirkwood-paths.md), "Phase 28" and "Notes for the orchestrator and the implementer agent".

**Review rule (user instruction, 2026-10-27):** one review round per phase. The main session runs `/reviewer` once on this phase's diff (and `/ux` once if `src/screens` or `src/play` changed), hands its blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that fix pass leaves open is recorded in this phase's `STATUS.md` note. This replaces "until `/reviewer` reports no blocks" for phases 27 to 33.

## Goal

The app knows more than one campaign. The campaign list, the Scenarios tab, the path, the log and the booklets read the campaign they belong to. Saga-only rules run only in a saga. The log holds the facts the Mirkwood campaign cards ask for, and carries cards to the next campaign. Fellowship play is unchanged.

## Registry

- `src/campaign/save.ts` and `src/screens/campaign-data.ts` become a map from campaign id to its data and scenarios. Metro needs static JSON imports, so the map is written by hand; a test checks it against `data/campaigns/index.json`.
- `campaignOf` and `nameOf` work for any id. Remove every `FELLOWSHIP_ID` fallback the plan lists (`(tabs)/index.tsx`, `(tabs)/scenarios.tsx`, `standalone/briefing/[scenarioId].tsx`, `log/[saveId].tsx`, …).
- `scripts/build/catalog.ts` tags `cards.campaign_id` from a pack → campaign map.

## Screens

- Campaign list: one start panel per playable campaign. `start-fellowship` keeps its testID; the new ones are `start-<id>`. Each save's progress line reads its own campaign.
- Scenarios tab: one section per box (Fellowship, Revised Core, The Dark of Mirkwood).
- The standalone briefing takes the box from the scenario. Path and log screens use `campaign.bookletId`.

## Saga gating

- Only when `campaign.saga`: `validateLoadout`'s `noRingBearer`, `twoFellowshipHeroes`, `secondFrodo`, `ringInDeck` and the fourth-hero allowance; `needsRingBearer`; the Ring-bearer slot in `seat-picker.tsx` and `briefing-parts.tsx`.
- Outside a saga, Fellowship-sphere heroes are refused, with the rule cited. Standalone play follows the box's flag.

## Campaign setup verbs

`src/campaign/start.ts` and `checklist.ts` deal these campaign-card Setup instructions: `PutIntoPlay` (an objective ally under the first player), `SetAside`, `AttachChosen` (the first player's choice), `AddToHandAfterMulligan`, `ShuffleIntoEncounter`. A pool card that says "put into play at the start of each scenario" (Mendor) skips checklist step 8.

## Log

- The pool holds several copies of one code: no code dedupe in `earn()` / `applyResolution`; `removedFromPool` is per entry.
- Structured campaign facts in place of the notes the cards ask for: `prisoner` (a hero code); Valor and Scarred through `attachedTo`; once-per-campaign uses (the Adaptations' "Record in the Campaign Log when used"); counters on a campaign card (The Oath's resource tokens, read at resolution). `StartScenario` passes them into the engine.
- Carry-over: a resolution can write `carryOver` cards (Mendor, Mendor's Support allowance, Ranger Sense). Creating a new save offers the carry-over of a finished save of any campaign; checklist step 1 applies it.
- The Dark of Mirkwood mini campaign starts on a blank log. In Mirkwood Paths, part 4 continues the same log.
- Bump `ENGINE_VERSION`. A changed column gets a migration in `drizzle/`. The JSON log grows through its Zod schema with defaults, so old saves load.

## Booklets

- `BOOKLETS` (`src/screens/booklets/books.ts`) and `BOOKLET_SOURCES` (`scripts/build/pack-booklets.ts`) gain `rules-reference` (`MEC101.pdf`, pinned as `rr`) and `the-dark-of-mirkwood` (`dark_of_mirkwood_rulebook_v2.pdf`, pinned in phase 27).
- Mirkwood Paths opens `learn-to-play`, which holds the core campaign and setup pages. The Dark of Mirkwood opens `the-dark-of-mirkwood`. `bookletParams` returns `campaign.bookletId`.
- `rules-glossary.ts` `DOC_NAMES`/`BOOKS` gain `tdom` and `rr`.
- Update the brief's booklet ids and its "two booklet PDFs" line, and `scripts/build/pack-booklets.test.ts`.

## Brief

`docs/brief.md` gains a "Mirkwood Paths" section modelled on the Fellowship one (campaigns, scenario table, campaign-card rules, carry-over, booklets), and line 27's "for now only the Fellowship…" is updated, in the same commits as the rules.

## Tests

Registry against `index.json`; loadout gating (Fellowship unchanged; Mirkwood refuses a Fellowship hero and needs no Ring-bearer); multi-copy earn; carry-over round trip; booklet map.

## E2E

`.maestro/mirkwood-start.yaml` (start Mirkwood Paths; the briefing has no Ring-bearer slot), `.maestro/scenarios-boxes.yaml` (three box sections), `.maestro/booklet-dark-of-mirkwood.yaml`. Written in this phase; in a cloud session they do not run and stay open in `STATUS.md`.

## Exit

- Every Fellowship golden unchanged and green; the new tests green; `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm data:check` green.
- `pnpm booklets:pack` packs four books with matching sha256.
- One review round (`/reviewer` and `/ux`), as above. Phone checks and Maestro runs stay open in a cloud session.
