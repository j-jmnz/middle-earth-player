# Phase 27 — Multi-campaign data

Depends on: phases 8d and 9
Blocks: phase 28
Can run beside: phases 15 and 16 (different scenario files; merge one at a time, they share `open-lines.ts`, `data/` and the family indexes)

Plan: [docs/plans/mirkwood-paths.md](../../plans/mirkwood-paths.md), "Phase 27" and "Notes for the orchestrator and the implementer agent".

**Review rule (user instruction, 2026-10-27):** one review round per phase. The main session runs `/reviewer` once on this phase's diff (and `/ux` once if `src/screens` or `src/play` changed), hands its blocks to one implementer fix pass, and closes the phase without re-running the reviewers. A block that fix pass leaves open is recorded in this phase's `STATUS.md` note. This replaces "until `/reviewer` reports no blocks" for phases 27 to 33.

## Goal

The data pipeline builds more than one campaign. Two campaigns are built from their printed cards: `mirkwood-paths` (Revised Core Set, MEC101, parts 1 to 3, with The Dark of Mirkwood's two scenarios as parts 4 and 5) and `the-dark-of-mirkwood` (the two-scenario mini campaign, `tdom.mini-campaign`). They share scenario files. Data only: nothing new is playable, no screen changes, and the Fellowship data is byte-identical.

## Sources

- Replace `FELLOWSHIP_PRODUCTS` (`scripts/data/sources/hallofbeorn.ts`, `scripts/data/normalize/campaigns.ts`) with a per-campaign product table. Add "Revised Core Set" and "The Dark of Mirkwood". Snapshot the five `(Campaign)` scenario files: Passage Through Mirkwood, Journey Along the Anduin, Escape from Dol Guldur, The Oath, The Caves of Nibin-Dûm.
- Pin The Dark of Mirkwood rulebook as rules doc `tdom` in `RULE_PDFS` (URL in the plan; 8 pages), with its column boxes in `data/rules/columns.json`. `pnpm data:sync hallofbeorn rules`.

## Cards

- Encounter, quest and campaign cards of both products come from Hall of Beorn, filtered by `CardSet`. Nightmare sets stay out.
- The Dark of Mirkwood code is `41` + the two-digit collector number (Hall of Beorn's `020NN` collides with The Hunt for Gollum; RingsDB lists Stalking Goblin as 41041). An override in `data/overrides.json` says so.
- Revised Core encounter cards 01074 to 01131 take the `RevCore` printing. Hall of Beorn's ` (Campaign)` set suffix is normalized away.

## Scenarios and campaigns

- `normalize/scenarios.ts`, `load-scenarios.ts` and `build.ts` take a campaign definition: id, name, products, scenario order, booklet doc and span prefix, saga flag. No literal `fellowship-of-the-ring` object.
- Hall of Beorn `ScenarioCards` counts lead. DragnCards `Q01`/`E01` (the 2011 decks) is a cross-check where it exists. A disagreement settled by printed Easy marks is an `overrides.scenarioEasy` entry naming the card.
- Campaign cards are looked up per product. A `sharedBoons` pile holds boons both campaigns use.
- `loadCampaign(id)`; `loadScenarios(campaignId?)` reads all campaigns when no id is given.
- `build.ts` writes `data/campaigns/mirkwood-paths.json` (5 scenarios), `data/campaigns/the-dark-of-mirkwood.json` (2), `data/scenarios/{passage-through-mirkwood, journey-along-the-anduin, escape-from-dol-guldur, the-oath, the-caves-of-nibin-dum}.json`, and one generated effects file per campaign.
- `normalize/campaigns.ts` marks a campaign playable in `index.json` when at least one of its scenarios is in `PLAYABLE_SCENARIOS`; otherwise its tile stays locked.

## Setup sentences

`normalize/setup-text.ts` reads these, quoted from the ledger, not from Hall of Beorn's typos:

- "Search the encounter deck for 1 copy of X and 1 copy of Y, add them to the staging area"
- "Each player reveals 1 card"
- "attach 1 encounter card to each objective"
- "Put Mendor into play"
- "Set each copy of X and Y aside, out of play"
- "Attach X to a hero of the first player's choice"
- "Each player chooses 1 Adaptation boon"
- "adds a copy of X to their hand after drawing their starting hand"
- "Shuffle the X burden into the encounter deck"

A sentence no template reads is authored, as in phase 8.

## Schema

`src/catalog/scenario-data.ts`: campaign data gains `bookletId` and `saga: boolean`; `prelude` and `starterDecks` may be empty. `bookletPages` reads any doc's `setup-<id>` span.

## Rules

- Widen the span-id regex in `scripts/data/rules/spans.ts` to admit `tdom`.
- Hand-checked spans: `ltp.setup-passage-through-mirkwood`, `ltp.setup-journey-along-the-anduin`, `ltp.setup-escape-from-dol-guldur` (the "encounter deck is built with…" paragraphs), `tdom.setup-the-oath`, `tdom.setup-the-caves-of-nibin-dum`, `tdom.campaign-mode`, `tdom.mirkwood-paths`, `tdom.mini-campaign`, and `easy-mode` spans for the core removals. Update `scripts/data/rules.test.ts`.

## Ledger

- `data/printed/mirkwood-paths.json`, read by an agent from the pinned scans (`docs/plans/done/authoritative-data.md` §A): every dealt, campaign, boon and burden card of both boxes, plus core player cards 01013, 01017 and 01030. Each entry records `readBy`; its scan sha256 matches the pin.
- Order: `pnpm data:build`, then `pnpm data:sync scans`, then read.
- `loadLedger` merges every `data/printed/*.json` and fails on a duplicate key. `src/catalog/printed-ledger.ts` imports both files. `printed/scope.ts` takes scope from every campaign. Drop the TFotR gate in `applyPrinted`.
- A scan the agent cannot read is a question for the user, not a guess.

## Effects tooling

`effects:draft` and `effects:open` read all campaigns. The draft target for a non-pool card is `src/effects/authored/<scenario-id>.ts`. `src/effects/index.ts` imports the new generated and authored files.

## Tests

Generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `scripts/build/catalog-exit.test.ts` and `scripts/build/catalog.test.ts` per campaign. The Fellowship assertions stay as they are.

## E2E

None. No screen changes.

## Exit

- `pnpm data:build` and `pnpm data:check` green and deterministic; `pnpm data:build -- --verbose` shows no failed cross-check for the five new scenarios.
- `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm test` green. Every existing Fellowship golden and test passes without edits to its expectations.
- `pnpm effects:open` lists the new cards' lines.
- `pnpm catalog:build`; `src/catalog/version.ts` committed if it changed.
- One review round, as above.
