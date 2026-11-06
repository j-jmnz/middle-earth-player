# Phase 49 — Ered Mithrin data

Depends on: phase 37 (the pipeline it generalizes). Phase 48 is not touched.
Blocks: phase 50

Plan: [docs/plans/done/ered-mithrin.md](../../plans/done/ered-mithrin.md), "Phase 49: Ered Mithrin data" and "Notes for the orchestrator". Analogue: [phase 37](phase-37-dream-chaser-data.md).

## Goal

The data pipeline builds the `ered-mithrin` campaign from The Wilds of Rhovanion (RingsDB `TWoR`), the six Adventure Packs (`TWH`, `RAR`, `FitN`, `TGoF`, `MG`, `TFoW`) and the Ered Mithrin Campaign Expansion (EMCE, rulebook MEC115). Data only: nothing new is playable, no screen changes, and every other campaign's data is byte-identical.

Settled by the user (2026-11-05): all nine scenarios are in the campaign; scenarios 1 and 2 deal the Revised Core encounter sets the app already builds and ledgers (Journey Along the Anduin, Wilderlands, Passage Through Mirkwood, Spiders of Mirkwood, Dol Guldur Orcs). Out of scope: Nightmare (no Ered Mithrin Nightmare deck exists in `data/`) and the MEC115 Achievements list.

## Procedure

The plan's Phase 49 items 1 to 8, in order. Network order: `pnpm data:sync hallofbeorn rules`, then `pnpm data:build`, then `pnpm data:sync scans pictures` (`CLAUDE.md`, Data).

1. **Sources.**
   - `scripts/data/campaign-defs.ts`:
     - Eight `PRODUCTS` rows: The Wilds of Rhovanion, the six APs and `Ered Mithrin Campaign Expansion` (pack EMCE). Each has `home: "ered-mithrin"`, `load: "dragncards"` and `twinPack: null`, with `easySheet` as the sources allow.
     - An `ered-mithrin` `CampaignDef` with nine `ScenarioDef`s built by a helper, as `dreamChaser()` is. Each has `campaignProduct: EMCE`, `setupSpan: emce.setup-<id>`, `deck: {normal: Q08.n, easy: E08.n}`, and `groups` that map DragnCards' `EncounterDeck2`/`3` to new piles: `evilCreaturesDeck`, `cavesDeck`, `sideQuestDeck`, and the two Lost in Mirkwood decks (Spiders of Mirkwood, Dol Guldur Orcs).
     - `bookletId: "ered-mithrin"`, `bookletDoc: "emce"`, `saga: false`, no `xp`, `ledger: "ered-mithrin"`.
   - `RULE_PDFS` (`scripts/data/sources/rules.ts`) and `data/sources.json`: doc `emce`, the MEC115 file on the same host as the `FFG` constant there (`https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mec115_rules-web.pdf`), pinned by sha256 `4a730c7cbee16f59656c649ba195f3fa411d6b5db35a1adbc1f14bf8b810837c`. The Hall of Beorn S3 host does not have it. `mec114` and `wor` (`wor.guarded-x`) are already pinned.
   - Run `pnpm data:sync hallofbeorn rules`. The per-scenario Hall of Beorn snapshots (`/Export/Scenarios/<Slug>`) are written only for `BUILT_PRODUCTS`; the nine scenarios' quest and scenario cards come from the product rows and `ScenarioCards`.
2. **Cards.**
   - `TYPE_BY_HOB` and `PRODUCT_TYPES` gain `Objective_Location` and `Treasure`, with a `treasure` card type in `src/catalog/card-facts.ts` and `src/catalog/deck-legal.ts`. A treasure is deck-legal only through the log.
   - RingsDB's 31 EMCE `treasure` rows (12166-12204; already in `data/cards/EMCE.json` with `campaignKind` null) merge with Hall of Beorn's boon, burden and treasure rows and take `campaignKind` (boon, burden or treasure), as RevCore and DCCE do. The campaign cards come from Hall of Beorn.
   - **EMCE code rule.** Hall of Beorn codes EMCE as `19` plus the collector number (19165-19204), which collides with six TFoW codes (19165-19170). The plan's recommendation:
     - EMCE keeps RingsDB's `12NNN` (12166-12204), as `scripts/data/cards.test.ts` already asserts (`12166`/`12171`).
     - The nine campaign cards (collector numbers 165, 168, 170, 175, 184, 187, 189, 193, 195) take the same pattern, except 165: `12165` is CoC Fury and Malice. Give 165 a free code such as `120165` (the `120` prefix is unused; prefixes in use are 110, 131-132, 140-148 and 900-907).
     - Record it as `productCodes` entries in `data/overrides.json` with their reasons, like the DCCE entries.
     - The implementer may choose another collision-free rule and records why. **Stop and ask the user** if no rule is collision-free.
   - Hall of Beorn's Hero Expansion codes (19001-19075) collide with the AP rows. Leave them alone: the Hero Expansion player cards come through RingsDB as they do today. Hall of Beorn numbers TWH #4-7 differently from RingsDB: encounter and quest codes are taken from Hall of Beorn and checked for uniqueness; player codes stay RingsDB's.
   - The Hall of Beorn set suffix `<Scenario> Campaign` normalizes to the campaign set. The eight side quests' null `EncounterSet` (Fire in the Night, codes 19066-19073) takes Fire in the Night's set.
   - Replace the Dream-chaser `home === "dream-chaser"` / `"DCCE"` checks with `ProductDef` flags such as `campaignExpansion` and `ledgerKeywords`. Read each spot first: `scripts/data/normalize/reprints.ts`, `scripts/data/printed/scope.ts` (`DREAM_CHASER_EXPANSION`), `scripts/data/normalize/printed.ts` and `scripts/data/normalize/product-cards.ts`.
3. **Scenarios.**
   - Map the load groups to the new `PILES` in `src/catalog/scenario-data.ts`, with its tests. DragnCards (`preBuiltDecks.json`, decks `Q08.1`-`Q08.9`, `E08.1`-`E08.9`) loads, besides the main deck:
     - Q08.1: `EncounterDeck2`, the Wilderlands enemies (the Evil Creatures deck).
     - Q08.2: `EncounterDeck2` Spiders of Mirkwood and `EncounterDeck3` Dol Guldur Orcs.
     - Q08.3 and Q08.4: `EncounterDeck2`, Lost Caves (the Caves deck).
     - Q08.6: `EncounterDeck2`, the eight side quests.
     - Q08.8: `EncounterDeck2`, Lost Caves plus Throat of the Mountain and Dagnir's Hoard.
     - Several decks also have set-aside and staging groups.
   - DragnCards set names differ from Hall of Beorn ("Lost in the Wilderness" for "Lost in Wilderland", "Journey Down the Anduin" for "Journey Along the Anduin"): add `encounterSetAliases` entries.
   - Q08.1 and Q08.2 load original `Core Set` cards. Map them to the RevCore codes through `encounterSetAliases`, a pack alias and an override that gives its reason (user decision, 2026-11-05). **Stop and ask the user** if a mapping's pile count disagrees with `emce.setup-*` after the overrides the printed cards can justify.
   - Map Q08.2's `player1Play1` (Woodmen Village, with a `postLoadActionList` that flips it to Haldan) to a setup placement, not a player-deck card.
   - Easy counts come from the `E08` decks and `ScenarioCards`; filter out the Nightmare rows.
   - `scripts/data/build.ts` writes `data/campaigns/ered-mithrin.json`, nine `data/scenarios/*.json` and `src/effects/generated/ered-mithrin.ts`.
   - Check each pile against `emce.setup-<id>` ("built with…") and the quest's Setup text. A disagreement is settled by `scenarioPiles`, `scenarioCounts` or `scenarioEasy`, citing the printed card.
4. **Setup parser** (`scripts/data/normalize/setup-text.ts`): the nine campaign cards' and nine stage 1A Setup sentences, quoted from the ledger. Examples the plan lists:
   - "Build the Evil Creatures deck"
   - "Shuffle the Caves deck"
   - "gains control of Turayn"
   - "search the encounter deck for Twilight Hall"
   - "attach 1 of 3 random undiscovered treasures"
   - "If <log line>, remove 3 enemies from the encounter deck"
   - "Ignore the deep keyword"
   - "Add each encounter card in the Campaign Pool"

   `pnpm data:build -- --verbose` lists any sentence no pattern reads.
5. **Rules.** The span-id regex in `scripts/data/rules/spans.ts` admits `emce`, and `data/rules/columns.json` gets the MEC115 column boxes. Hand-checked spans in `data/rules/index.json` (MEC115 pages: components 2-3, setup spreads 4-23, Campaign Log 26-27):
   - `emce.setup-<id>` (nine)
   - `emce.caves-deck`, `emce.deep`, `emce.guarded-x`, `emce.immune`
   - `emce.treasure`, `emce.campaign-pool-encounter`
   - `emce.evil-creatures-deck`, `emce.dragon-signs`
   - `emce.indestructible`
   - `emce.side-quests`, `emce.loot`, `emce.discover`
   - `emce.gundabad-quest-deck`, `emce.bypassing`
   - `emce.boon-allies`, `emce.haldan`, `emce.campaign-log`

   Update `scripts/data/rules.test.ts`. General campaign rules come from the Learn to Play, already in `data/rules`.
6. **Ledger.** `data/printed/ered-mithrin.json`, read by an agent from the pinned scans (`docs/plans/done/authoritative-data.md` section A).
   - Order: `pnpm data:build`, then `pnpm data:sync scans pictures`, then the read.
   - Scope: every dealt, campaign, boon, burden and treasure card, both sides where a card has two (Woodmen Village / Haldan, the campaign cards). The RevCore sets are already ledgered. Each entry records `readBy` and the scan sha256.
   - Run `pictures` on every new card: `scripts/data/sources/pictures.test.ts` fails otherwise.
   - A scan the agent cannot read is a question for the user, not a guess. **Stop and ask.**
   - Wire it up: `src/catalog/printed-ledger.ts` imports the file, and `scripts/data/printed/scope.ts` takes the campaign's scope.
7. **Tests.** Generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `catalog-exit.test.ts` and `build/catalog.test.ts` for a fifth campaign. The existing assertions stay, including `12166`/`12171` as EMCE.
8. **Effects tooling.** `src/effects/index.ts` imports `generated/ered-mithrin.ts`. Boon, burden and treasure records go in `src/effects/authored/pool/EMCE.ts` as each scenario phase uses them; there is no such file yet.

Keep every existing campaign byte-identical. If a golden or any existing campaign's data must move, **stop and report why**. `data/raw` is written only by `pnpm data:sync`. Rule wording comes from the pinned MEC115 PDF through `pnpm data:query`, never from memory.

## E2E

None. No screen changes.

## Exit

- `pnpm data:build` and `pnpm data:check` green and deterministic; `pnpm data:build -- --verbose` shows no failed cross-check for the nine scenarios.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` green. Every other campaign's golden and test passes without edits to its expectations.
- `pnpm effects:open` lists the new cards' lines.
- `pnpm catalog:build`; `src/catalog/version.ts` committed if it changed.
- One review round (`.cursor/agents/orchestrator.md`, "One review round").
