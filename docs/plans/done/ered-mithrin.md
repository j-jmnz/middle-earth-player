# Plan: Ered Mithrin (The Wilds of Rhovanion and the six Ered Mithrin Adventure Packs)

## Context

The app plays the Fellowship saga, Mirkwood Paths, The Dark of Mirkwood and Dream-chaser. The user asked to plan the **Ered Mithrin** campaign: nine scenarios played in order in campaign mode, each with its campaign card, boons, burdens and treasures, and each also playable standalone.

1. Journey Up the Anduin, 2. Lost in Mirkwood, 3. The King's Quest (The Wilds of Rhovanion deluxe, RingsDB `TWoR`).
4. The Withered Heath (`TWH`), 5. Roam Across Rhovanion (`RAR`), 6. Fire in the Night (`FitN`), 7. The Ghost of Framsburg (`TGoF`), 8. Mount Gundabad (`MG`), 9. The Fate of Wilderland (`TFoW`): the six Adventure Packs.

Campaign mode comes from the **Ered Mithrin Campaign Expansion** (RingsDB `EMCE`, rulebook MEC115, 2024 print). It is not a reprint box: it adds 9 campaign cards, 13 boons, 9 burden rows (15 copies) and 9 treasures to the original sets. **There is no XP and no Hard/Expert mode.** Instead the campaign runs on these mechanics:
- **treasures**, discovered during play and kept for the rest of the campaign;
- **boon allies**, each of which either joins the pool or is traded for a log line;
- **encounter cards in the Campaign Pool**;
- the Learn to Play campaign log.

The work has the same shape as `docs/plans/done/dream-chaser.md`:
1. a data phase;
2. a campaign-shell phase;
3. one shared mechanics family plus its table pieces;
4. one phase per scenario, using the phase 12 "Scenario procedure" (`docs/phases/phase-12-knife-in-the-dark.md`).

The new phases are numbered from 49. Phase 48 (The City of Corsairs) is not started and is not touched.

User decisions (2026-11-05):
- All nine scenarios are in scope, ending with the campaign win.
- Scenarios 1 and 2 deal the **Revised Core** encounter sets that the app already builds and ledgers: Journey Along the Anduin, Wilderlands, Passage Through Mirkwood, Spiders of Mirkwood and Dol Guldur Orcs. DragnCards' `Core Set` rows map to them through an override that gives its reason.
- The MEC115 rulebook is bundled as the campaign's booklet (`ered-mithrin`).

Out of scope:
- Nightmare: no Ered Mithrin Nightmare deck exists in `data/` (no `N08`, nothing in `nightmare-defs.ts`).
- The MEC115 Achievements list (p.25).

The standing decisions in `docs/phases/STATUS.md` bind this plan.

## Facts found during exploration

**Sources on disk** (nothing is fetched yet except where noted)
- Hall of Beorn exports:

| CardSet | Encounter rows (copies) | Quest | Notes |
| --- | --- | --- | --- |
| The Wilds of Rhovanion | 52 (103), 18016-18070 | 13 | 4 `Objective_Location`, 1 `Objective_Ally` (Haldan) |
| The Withered Heath | 11 (28) | 4 | Dragon Sign ×4 |
| Roam Across Rhovanion | 15 (29) | 5 | Objective allies Urdug and Tiny |
| Fire in the Night | 17 (31) | 1 | 8 `Encounter_Side_Quest` (19066-19073), EncounterSet null |
| The Ghost of Framsburg | 15 (29) | 3 | Loot and Discover |
| Mount Gundabad | 14 (25) | 8 | 7 "Exploring Gundabad" stage 2s; Wormsbane ×2 |
| The Fate of Wilderland | 13 (29) | 3 | "Assault" ×11 |
| Ered Mithrin Campaign Expansion | 19 (25) encounter-side | 9 campaign cards | 21 player-side rows: 4 boon allies, 4 Accolade attachments, 4 Song events, 9 treasures (the 9 treasures are in both files) |

- `Scenarios.json` lists the nine with empty quest and scenario cards. The per-scenario snapshots (`/Export/Scenarios/<Slug>`) are written only for `BUILT_PRODUCTS`. A test fetch of The Withered Heath returned 4 quest cards and 23 `ScenarioCards` with Normal, Easy and Nightmare counts, using the original printings.
- RingsDB:
  - `EMCE.json` has 31 `treasure` rows, codes 12166-12204 (boons, burdens, treasures, no campaign cards). They are already in `data/cards/EMCE.json` with `campaignKind` null, unnormalized.
  - The 75 TWoR and AP player cards are in `data/cards` and in `src/effects/authored/pool/{TWoR,TWH,RAR,FitN,TGoF,MG,TFoW}.ts`. There is no `EMCE.ts`.
- DragnCards (`preBuiltDecks.json`, JSONC):
  - Decks: `Q08.1`-`Q08.9` and `E08.1`-`E08.9`; `CCC.5` "Ered Mithrin" holds 40 `sharedBoons` rows.
  - Extra load groups:
    - Q08.1: `EncounterDeck2` is the Wilderlands enemies (the Evil Creatures deck).
    - Q08.2: `EncounterDeck2` is Spiders of Mirkwood, `EncounterDeck3` is Dol Guldur Orcs; `player1Play1` is Woodmen Village, with a `postLoadActionList` that flips it to Haldan.
    - Q08.3 and Q08.4: `EncounterDeck2` is Lost Caves (the Caves deck).
    - Q08.6: `EncounterDeck2` is the 8 side quests.
    - Q08.8: `EncounterDeck2` is Lost Caves plus Throat of the Mountain and Dagnir's Hoard.
    - Several decks also have set-aside and staging groups.
  - Set names differ from Hall of Beorn: "Lost in the Wilderness" is "Lost in Wilderland", and "Journey Down the Anduin" is "Journey Along the Anduin". These need `encounterSetAliases` entries.
  - Q08.1 and Q08.2 load original `Core Set` cards, which the user decision maps to RevCore.

**Card codes (collisions to settle in phase 49)**
- Hall of Beorn codes EMCE as `19` plus the collector number (19165-19204). This collides with six TFoW codes (19165-19170). RingsDB's `12` plus the number is what `data/cards` and `cards.test.ts:187-189` already use.
- Recommended rule:
  - EMCE keeps RingsDB's `12NNN` (12166-12204).
  - The 9 campaign cards (165, 168, 170, 175, 184, 187, 189, 193, 195) take the same pattern, except 165: `12165` is CoC Fury and Malice. Give 165 a free code such as `120165`, the `120` prefix being unused (prefixes in use: 110, 131-132, 140-148, 900-907).
  - Record it as `productCodes` entries in `data/overrides.json` with their reasons, like the DCCE entries (:993-1007).
  - The implementer may choose another collision-free rule and record why.
- Hall of Beorn's Hero Expansion codes (19001-19075) collide with the AP rows. Leave them alone: the Hero Expansion player cards come through RingsDB as they do today.
- Hall of Beorn numbers TWH #4-7 differently from RingsDB. Encounter and quest codes are taken from Hall of Beorn and checked for uniqueness. Player codes stay RingsDB's.

**Rules PDF**
- MEC115: `https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mec115_rules-web.pdf`.
  - Same host as the `FFG` constant in `scripts/data/sources/rules.ts`.
  - 10,198,396 bytes, 28 pages, sha256 `4a730c7cbee16f59656c649ba195f3fa411d6b5db35a1adbc1f14bf8b810837c`.
  - The Hall of Beorn S3 host does not have it.
- `mec114` (Hero Expansion, decklists only) and `wor` (`wor.guarded-x`) are already pinned.
- Pages:
  - p.2-3: components; Caves deck and Deep; Guarded (X); Immune; Treasure; encounter cards in the Campaign Pool.
  - p.4-23: one setup spread per scenario, each with its "Campaign Setup".
    - p.4-5: the Evil Creatures deck.
    - p.10-11: Dragon Signs.
    - p.12-13: Indestructible and Trust in Urdug.
    - p.15: encounter side quests.
    - p.17: Loot and Discover X.
    - p.21: the Mount Gundabad quest deck and bypassing.
  - p.25: Achievements.
  - p.26-27: Campaign Log.
- General campaign rules come from the Learn to Play (pp.30-31), which is already in `data/rules`.

**Campaign rules (MEC115 p.2-3, p.26-27, the campaign cards)**
- **Treasure** is a player card type:
  - In play: an effect picks 1 of 3 random *undiscovered* treasures and attaches it as a guarded objective. When it is free, the players claim it for this game. A win marks it discovered.
  - A discovered treasure may go in a deck: 1 copy by title, outside the 50-card minimum.
- **Boon allies:** Turayn (1), Melanwar (2), Isolde (3), Beldis (6).
  - The Resolution chooses one of two:
    - the ally joins the pool;
    - or the log takes a "Unique Allies Protecting Wilderland" line. Later campaign cards read that line to remove N cards at Setup.
  - Beldis has 4 uses per player across the campaign, marked in the log.
- **Encounter cards in the Campaign Pool** (A Growing Threat, Evil Creatures enemies, Spiders or Orcs cards, Abandoned Ruin, Hazards, staging-area locations, and so on) are added to every encounter deck built later, whatever their set. Copies are tallied. Some Resolutions remove them: A Growing Threat in 8, and in 6 each player may remove one non-burden card.
- **Rules carried across scenarios:**
  - Haldan cannot be a hero, except in The King's Quest.
  - Scenarios 3 and 7 waive the hero-change penalty; the `WaiveThreatPenalty` verb already exists (`src/campaign/briefing.ts:147`).
  - Scenario 8 counts the treasures in the log: 6 or more adds Dragon-sickness.
  - The campaign is won by winning scenario 9.
- Easy counts come from Hall of Beorn and the `E08` decks.

**Engine that already exists** (re-read before use)
- Dream-chaser left reusable plumbing:
  - Second and third encounter decks through `ScenarioDef.groups`, and the deck-as-zone routing in `src/rules/families/uncharted/zone.ts` and `sea/corsair.ts`.
  - Double-sided flips in `uncharted/grotto.ts`, and facedown-under-a-card in `aflame` and `island`.
  - A second quest deck in `stormcaller`.
  - `faces.ts` in `dreamchaser`.
  - The campaign family's Setup verbs, `carryOver`, `usedOnce`, `counters` and `perPlayer` pool entries.
  - `HERO_BANS` (`src/campaign/loadout.ts:16`) and `WaiveThreatPenalty`.
- Existing keywords: Guarded (`objectives`, `wor.guarded-x`), Indestructible, Immune, Surge, Doomed, Restricted, Victory.
- Card types: `encounter-side-quest` exists, but has no engine. `TYPE_BY_HOB` lacks `Objective_Location` and `Treasure`.
- Nothing exists for:
  - Deep and the Caves deck;
  - an enemy-only second deck whose discard keeps its enemies (Evil Creatures);
  - encounter side quests in play;
  - Discover and Loot;
  - a shuffled stage-2 quest deck with bypassing;
  - treasures and boon-ally log lines;
  - encounter cards in the pool;
  - Trust in Urdug.

**Hard-wired spots that need generalizing** (confirm each by reading it first)
- `scripts/data/normalize/reprints.ts:8,15`, `scripts/data/printed/scope.ts:18,97` (`DREAM_CHASER_EXPANSION`), `normalize/printed.ts:35` and `normalize/product-cards.ts:104,189,206` all test `home === "dream-chaser"` or `"DCCE"`. Make these `ProductDef` flags such as `campaignExpansion` and `ledgerKeywords`.
- `scripts/tools/scenario-new-files.ts:304` (`dream`) and `scripts/e2e/seed-kit.ts:64`.
- `src/campaign/xp.ts` `XP_ROWS`, `GAVIN` and `MODE_CARD_CODE` are global, but stay unread when `campaign.xp` is false. Check that nothing reads them unconditionally.
- `HERO_BANS` allows one ban per campaign. Ered Mithrin needs "every part except 3", so the ban takes a list of parts.

## Approach: phases 49 to 60, plus 51b

Each phase gets a file in `docs/phases/` in the existing style (Goal / Procedure / Cards / E2E / Exit) and a row in `docs/phases/STATUS.md`. Phase 49 extends the STATUS rules header: phases 49 to 60 and 51b have **one review round per phase**, and phases 52 to 60 each have an engine half and a phone half. The phases run in order, one at a time, because they share `open-lines.ts`, `data/` and the family indexes. In a cloud session the phone checks and Maestro runs stay open. `docs/brief.md` changes in the same commit as the rules it states.

### Phase 49: Ered Mithrin data (nothing playable yet)

1. **Sources.**
   - `campaign-defs.ts`:
     - Eight `PRODUCTS` rows: The Wilds of Rhovanion and the six APs, plus `Ered Mithrin Campaign Expansion` (pack EMCE). Each has `home: "ered-mithrin"`, `load: "dragncards"` and `twinPack: null`, with `easySheet` as the sources allow.
     - An `ered-mithrin` `CampaignDef` with nine `ScenarioDef`s built by a helper, as `dreamChaser()` is. Each has `campaignProduct: EMCE`, `setupSpan: emce.setup-<id>`, `deck: {normal: Q08.n, easy: E08.n}`, and `groups` that map `EncounterDeck2`/`3` to new piles: `evilCreaturesDeck`, `cavesDeck`, `sideQuestDeck`, and the two Lost in Mirkwood decks.
     - `bookletId: "ered-mithrin"`, `bookletDoc: "emce"`, `saga: false`, no `xp`, `ledger: "ered-mithrin"`.
   - `RULE_PDFS` and `data/sources.json`: doc `emce`, the MEC115 URL and its sha256.
   - Run `pnpm data:sync hallofbeorn rules`.
2. **Cards.**
   - `TYPE_BY_HOB` and `PRODUCT_TYPES` gain `Objective_Location` and `Treasure`, with a `treasure` card type in `card-facts.ts` and `deck-legal.ts`. A treasure is deck-legal only through the log.
   - RingsDB's 31 EMCE rows merge with Hall of Beorn's boon, burden and treasure rows and take `campaignKind` (boon, burden or treasure), as RevCore and DCCE do.
   - The campaign cards come from Hall of Beorn.
   - Apply the EMCE code rule (see Facts) with its override reason.
   - The Hall of Beorn set suffix `<Scenario> Campaign` normalizes to the campaign set.
   - The side quests' null `EncounterSet` takes Fire in the Night's set.
   - Replace the dream-chaser `home` checks with `ProductDef` flags.
3. **Scenarios.**
   - Map the load groups to the new `PILES` in `src/catalog/scenario-data.ts`, with its tests.
   - Map DragnCards' `Core Set` rows to the RevCore codes, through `encounterSetAliases`, a pack alias and an override reason (user decision).
   - Map Q08.2's `player1Play1` Woodmen Village and its flip to Haldan to a setup placement, not a player-deck card.
   - Take Easy counts from E08 and `ScenarioCards`, and filter out the Nightmare rows.
   - `build.ts` writes `data/campaigns/ered-mithrin.json`, nine `data/scenarios/*.json` and `src/effects/generated/ered-mithrin.ts`.
   - Check each pile against `emce.setup-<id>` ("built with…") and the quest's Setup text. A disagreement is settled by `scenarioPiles`, `scenarioCounts` or `scenarioEasy`, citing the printed card.
4. **Setup parser** (`normalize/setup-text.ts`): the nine campaign cards' and the nine stage 1A Setup sentences, quoted from the ledger. Examples:
   - "Build the Evil Creatures deck"
   - "Shuffle the Caves deck"
   - "gains control of Turayn"
   - "search the encounter deck for Twilight Hall"
   - "attach 1 of 3 random undiscovered treasures"
   - "If <log line>, remove 3 enemies from the encounter deck"
   - "Ignore the deep keyword"
   - "Add each encounter card in the Campaign Pool"

   `data:build -- --verbose` lists any sentence that no pattern reads.
5. **Rules.**
   - The `spans.ts` regex admits `emce`, and `columns.json` gets the MEC115 column boxes.
   - Hand-checked spans in `data/rules/index.json`:
     - `emce.setup-<id>` (nine)
     - `emce.caves-deck`, `emce.deep`, `emce.guarded-x`, `emce.immune`
     - `emce.treasure`, `emce.campaign-pool-encounter`
     - `emce.evil-creatures-deck`, `emce.dragon-signs`
     - `emce.indestructible`
     - `emce.side-quests`, `emce.loot`, `emce.discover`
     - `emce.gundabad-quest-deck`, `emce.bypassing`
     - `emce.boon-allies`, `emce.haldan`, `emce.campaign-log`
   - Update `scripts/data/rules.test.ts`.
6. **Ledger.** `data/printed/ered-mithrin.json`, read by an agent from the scans.
   - Order: `pnpm data:build`, then `pnpm data:sync scans pictures` (CLAUDE.md, Data), then the read.
   - Scope: every dealt, campaign, boon, burden and treasure card, both sides where a card has two (Woodmen Village / Haldan, the campaign cards).
   - The RevCore sets are already ledgered. Run `pictures` on every new card (the pictures test fails otherwise). A scan the agent cannot read is a question for the user.
   - Wire it up: `src/catalog/printed-ledger.ts` imports the file, and `printed/scope.ts` takes the campaign's scope.
7. **Tests.** Generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `catalog-exit.test.ts` and `build/catalog.test.ts` for a fifth campaign. The existing assertions stay, including `12166`/`12171` as EMCE.
8. **Effects tooling.** `src/effects/index.ts` imports `generated/ered-mithrin.ts`. Boon, burden and treasure records go in `src/effects/authored/pool/EMCE.ts` as each scenario phase uses them.

**Exit:** `pnpm data:build` and `pnpm data:check` green and deterministic; no failed cross-check under `--verbose`; `pnpm test` green; `open-lines.ts` lists the new cards' lines.

### Phase 50: Ered Mithrin campaign shell, treasures and the pool

1. **Registry.**
   - `src/screens/data/campaign-data.ts`: the campaign, nine scenarios and one box `ered-mithrin`.
   - Also: `campaignIds`, the Scenarios-tab section, `start-ered-mithrin`, and the registry test against `data/campaigns/index.json`.
   - `scripts/build/catalog.ts` and `PACK_CAMPAIGN`.
   - `playable.ts` stays unchanged until phase 52.
2. **Booklet.**
   - `BOOKLETS` id `ered-mithrin` and a `BOOKLET_SOURCES` row.
   - `rules/glossary.ts`: `DOC_NAMES`, `BOOKS`, and the `emce.setup-` filter.
   - The `rules/view.tsx` tile and `BOOK_SCENE`.
3. **Loadout.**
   - Haldan (TWoR hero) is refused in every part except 3, citing `emce.haldan`. `HERO_BANS` takes a list of parts per ban.
   - A discovered treasure may be added to a deck: 1 copy by title, outside the 50-card minimum. An undiscovered treasure is refused, with the reason.
4. **Campaign log** (Zod with defaults, so old saves load; columns follow the MEC115 Campaign Log sheet):
   - treasures discovered;
   - the four "Unique Allies Protecting Wilderland" log lines;
   - Beldis's uses per player (4 boxes);
   - encounter cards in the pool, with tallied copies.
5. **Campaign verbs** (a new `wilderland` campaign-family file, run by Setup and Resolution):
   - `AttachRandomTreasure`: 1 of 3 random undiscovered treasures, attached as a guarded objective.
   - `DiscoverTreasure`: on a win, for the treasure that was claimed.
   - `BoonAllyOrLogLine`: the players choose; no default.
   - `AddEncounterToPool` and `RemoveFromPool`, with the "each player may remove one non-burden card" choice.
   - `RemoveFromEncounterDeckIfLogged`: N cards of a type, chosen by the first player.
   - The deal adds the pool's encounter cards to every encounter deck it builds, citing `emce.campaign-pool-encounter`.
6. **Screens.**
   - The path and log show treasures, ally lines, Beldis's boxes and the pool's encounter cards.
   - The Resolution's choices are made on the existing resolution screen (as Parrying Cutlass or Throwing Axe was).
7. **Versions.** Bump `ENGINE_VERSION` and the catalog version if a column changes.
8. **Tests and flows.**
   - Tests: registry, loadout (Haldan, treasures), log round trip, old-save load, pool encounter cards dealt.
   - Flows: `.maestro/features/ered-mithrin-start.yaml` and `booklet-ered-mithrin.yaml`; update `scenarios-boxes.yaml`.

**Exit:** every other campaign's goldens unchanged and green; new tests green; lint green.

### Phase 51: Wilderland mechanics family

Covers the vocabulary that several scenarios share. Schema goes in `src/catalog/families/wilderland.ts` and the engine in `src/rules/families/wilderland/`. Each verb cites an `emce.*` span and has a test. Generalize Dream-chaser's deck-zone code instead of copying it.
- **Caves deck and Deep** (`emce.caves-deck`, `emce.deep`), used in 3, 4 and 8:
  - The Caves deck is a pile zone (reuse `uncharted/zone.ts`).
  - After travel to a Deep location, discard it; the top Caves card becomes the active location.
  - With the Caves deck empty, Deep is ignored.
  - "Ignore the deep keyword" is a scenario-level switch that campaign cards set.
- **Guarded (enemy/location)** for encounter objectives and treasures (`emce.guarded-x`, `wor.guarded-x`):
  - Discard until a card of that type comes up; reshuffle if the deck runs out.
  - Read the existing `objectives` family first; extend it, don't fork it.
- **Second encounter decks with their own discard** (Evil Creatures in 1; Spiders and Orcs in 2): generalize `sea/corsair.ts` into a named-deck helper.
  - An Evil Creatures enemy leaving play goes to its own discard pile, even with Victory.
  - An empty deck reshuffles its discard.
- **Discover X and Loot** (`emce.discover`, `emce.loot`), used in 7 and switched off in 8 and 9:
  - On activation, look at the top X cards (reshuffling the discard if short), attach 1 Loot as guarded, reveal 1 random Hazard and discard the rest.
  - Loot revealed any other way is discarded, and another card is revealed.
- **Immune and Indestructible:** read them against the existing keywords. Any gap is a family fix with a test.

**Exit:** the family tests green; `families/index.ts` lists the family; nothing playable yet.

### Phase 51b: Wilderland on the table

Gives the table the new piles within the phase 39b limits (667 × 375 with two seats, up to a tablet), reusing 39b's pile slot and `row-fold.ts`:
- the Caves deck pile beside the encounter pair, and the Evil Creatures deck and discard;
- a guarded treasure shows its attached state and its claim;
- the Discover look strip.

The design goes in the phase file's "Scenario areas" section. The side-quest area (6) and the Gundabad quest deck (8) are built in their own phases from it.

**Exit:** as the phase file says; `/ux` once.

### Phases 52-60: one scenario each (phase 12 procedure)

For each phase:
- `pnpm scenario:new <id>` (`--dry-run` first).
- `pnpm effects:draft <id>`, then the `effect-author` agent, until coverage is green for every line of every dealt card. That includes the campaign card's Setup and Resolution and the boons, burdens and treasures it names.
- New verbs go in a mechanic family. Records go in `src/effects/authored/<id>.ts`, and the EMCE records in `pool/EMCE.ts`.
- Goldens: true solo and two-handed, a win and a loss, with the Resolution's pool, log-line and treasure effects.
- A campaign test checks that the previous part's pool, treasures and log lines reach this part.
- Add the scenario to `playable.ts`, then run `pnpm effects:open` and `card-smoke` on the new codes.
- Phone: widgets only where a line creates them; Maestro win and loss flows; fixtures.

| Phase | Scenario (campaign card) | New engine work |
| --- | --- | --- |
| 52 | Journey Up the Anduin (165) | First use of the Evil Creatures deck (Wilderlands enemies out of the encounter deck; locations and treacheries removed). Turayn under a player's control; A Growing Threat shuffled in; resources collected on the campaign card, with a treasure at players + 3. Resolution: Turayn or his oath line; A Growing Threat and the Evil Creatures enemies in play go to the pool. |
| 53 | Lost in Mirkwood (168) | Three encounter piles (main, Spiders, Orcs) and Woodmen Village / Haldan (`Objective_Location` to `Objective_Ally`). The quest's own deck rules are taken from the ledger. Melanwar; search for Twilight Hall and attach a random treasure, guarded. Resolution: Melanwar or his line; discard until X Spiders or Orcs cards come up, which go to the pool. |
| 54 | The King's Quest (170) | First use of the Caves deck and Deep; Fire Drake, Dragon Hoard and Dragon Might set aside. Hero change without penalty; Haldan allowed. Isolde; The Threat to Wilderland in staging; Dagnir's Spawn and Abandoned Ruin shuffled in. A Turayn-oath removal. Resolution choices. |
| 55 | The Withered Heath (175) | **Dragon Signs**: a Dragon Sign that replaces the active location through Deep goes to staging and resolves Guarded. Cold-Drake. A boon-ally deck search. Stage defeats award Accolade boons (176-179). Resolution: Song boons (180-183), and a treasure when 4 Dragon Signs are in the victory display. |
| 56 | Roam Across Rhovanion (184) | **Trust in Urdug** (printed on the campaign card 12184, not in the MEC115 rules text): a resource on Urdug at setup and after each claimed objective, or shuffle Urdug's Cunning in; Urdug gets +1 to each stat per resource. Tiny; Grey Mountain Giant (Indestructible). Ignore Deep. Resolution: Misplaced Trust into the pool and each deck at 3 or more resources, otherwise Urdug's Cunning; a copy of a staging-area location to the pool. |
| 57 | Fire in the Night (187) | **Encounter side quests** (`emce.side-quests`): a side-quest deck; side quests go to staging and their When Revealed cannot be cancelled; the first player may make one current at the start of the quest phase; a defeated one goes to the victory display without advancing; excess progress is discarded. Dagnir in staging. Beldis and the 4-use log boxes. Resolution: a treasure at 5 or more progress on Hrogar's Hill; each player may remove one non-burden pool card. |
| 58 | The Ghost of Framsburg (189) | First use of Discover and Loot; Hazards. Ashen Brazier (boon objective), Gundabad Hunter and Gundabad Stalker shuffled in. Once per game a treasure attaches to Fram's Shade when it engages at 1B or 2B. Action: each player raises threat by 1 to reshuffle the encounter discard. Resolution: Hunter or Stalker into the pool, plus 1 of the first 2 Hazards discarded. |
| 59 | Mount Gundabad (193) | **Gundabad quest deck** (`emce.gundabad-quest-deck`, `emce.bypassing`): the stage 2s are shuffled with side 2A faceup and there is no stage 3; a stage flips to B at the start of the quest phase; at the end of combat the current quest may be bypassed (it loses progress, goes to the bottom, and the next 2A is revealed); a completed one goes to the victory display or wins the game. This is a quest-order verb next to Voyage's random stage order. Caves deck plus Dagnir's Hoard and Throat of the Mountain; First Forge set aside; Wormsbane. Dragon-sickness at 6 or more logged treasures. Ignore Discover. Encounter effects cannot discard unique locations. Resolution: take a treasure; remove A Growing Threat from the pool. |
| 60 | The Fate of Wilderland (195) | Assault cards (taken from the ledger). Search the deck for a boon or treasure. A Turayn removal and a Beldis removal. Ignore Deep and Discover. A win ends the campaign ("The players win the campaign!"). |

**Exit for each:** coverage and goldens green in Node. A win runs the Resolution, writes the pool, treasures and log lines, and unlocks the next part. A loss writes nothing. The phone half follows the phase 12 rule. Phase 60's win ends the campaign.

## Critical files

- `scripts/data/campaign-defs.ts`, `scripts/data/sources/{hallofbeorn,rules}.ts`, `data/sources.json`, `data/overrides.json` (`productCodes`, `encounterSetAliases`, scenario overrides)
- `scripts/data/normalize/{cards,product-cards,scenarios,setup-text,setup-piles,reprints,printed}.ts`, `scripts/data/printed/scope.ts`, `scripts/data/rules/spans.ts`, `data/rules/{index,columns}.json`, `data/printed/ered-mithrin.json` (new)
- `src/catalog/{card-facts,deck-legal,scenario-data,printed-ledger}.ts`, `src/catalog/families/wilderland.ts` (new) and `index.ts`
- `src/rules/families/{objectives,sea,uncharted}/` (generalize), `src/rules/families/wilderland/` (new), `src/rules/quest/quest.ts`
- `src/campaign/{log,loadout,start,checklist,briefing,save,playable}.ts`
- `src/effects/index.ts`, `src/effects/authored/pool/EMCE.ts` (new)
- `src/screens/data/campaign-data.ts`, `src/screens/booklets/books.ts`, `scripts/build/pack-booklets.ts`, `src/screens/rules/{glossary.ts,view.tsx}`, path and log screens
- `scripts/tools/scenario-new-files.ts`, `scripts/e2e/seed-kit.ts`
- `docs/brief.md` (an "Ered Mithrin" section), `docs/architecture.md`, `docs/phases/phase-49…60.md`, `docs/phases/STATUS.md`, `docs/INDEX.md` (`pnpm docs:index`)

## Verification

After each phase:
- `pnpm data:build` and `pnpm data:check` (deterministic); `pnpm data:build -- --verbose` shows no failed cross-check.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (`pnpm test:scenario <id>` while authoring).
- `pnpm effects:open` shows no line for any scenario in `playable.ts`.
- `node --experimental-strip-types scripts/card-smoke/run.ts <new codes>`, including the EMCE cards each scenario deals.
- `pnpm catalog:build`, then commit `src/catalog/version.ts`.
- `pnpm booklets:pack`, from phase 50 on.
- Every existing golden passes without edits to its expectations.
- `/reviewer` once on the diff, and `/ux` when `src/screens` or `src/play` changed.

Maestro runs and phone checks stay open in cloud sessions and are noted in `STATUS.md`.

## Notes for the orchestrator

- The plan is run by `orchestrator`. Code-writing agents run on Sonnet, `reviewer` and `ux` on Opus. There is one review round per phase, and an unresolved block goes in the phase's STATUS note.
- Order: 49, 50, 51, 51b, then 52 to 60.
- Rule wording comes from the pinned MEC115 PDF (`pnpm data:query`), never from memory. A scan the agent cannot read is a question for the user.
- Keep every existing campaign byte-identical. If a golden must move, stop and report why.
- `data/raw` is written only by `pnpm data:sync`.

## Risks

- **Code collisions** (EMCE campaign card 165 against CoC 12165; Hall of Beorn's `19NNN` against TFoW). Settle them in phase 49, before anything reads a code.
- **The RevCore mapping for scenarios 1 and 2.** DragnCards loads 2011 Core cards, so counts or titles may differ from the RevCore sets. The cross-check against `emce.setup-*` decides, through overrides.
- **Lost in Mirkwood's three decks and the Haldan flip** are the least known. Read the quest text from the ledger before phase 53 starts; it may need its own family file.
- **Random treasure picks** need a seeded draw so that goldens stay deterministic.
- **Pool encounter cards change every later deal.** The campaign tests must chain real Resolutions.
- An `ENGINE_VERSION` or catalog version bump drops in-progress games on phones. Logs survive.
