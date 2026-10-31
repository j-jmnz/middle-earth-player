# Plan: Dream-chaser (The Grey Havens and the six Dream-chaser Adventure Packs)

## Context

The app plays the Fellowship saga and, from the Revised Core Set, Mirkwood Paths and The Dark of Mirkwood. The user asked for "the dream catcher campaign and scenarios". The cards say **Dream-chaser**. It is nine scenarios played in order in campaign mode, each with its campaign card, boons and burdens, and each playable standalone:

1. Voyage Across Belegaer, 2. The Fate of Númenor, 3. Raid on the Grey Havens (The Grey Havens deluxe, Hall of Beorn product `The Grey Havens`, RingsDB `TGH`).
4. Flight of the Stormcaller (`FotS`), 5. The Thing in the Depths (`TitD`), 6. Temple of the Deceived (`TotD`), 7. The Drowned Ruins (`DR`), 8. A Storm on Cobas Haven (`SoCH`), 9. The City of Corsairs (`CoC`): the six Adventure Packs.

Campaign mode comes from the **Dream-chaser Campaign Expansion** (RingsDB `DCCE`, rulebook MEC111, 2023 print): one box that reprints the nine scenarios with nine campaign cards, 38 boons and burdens, a Heading card and campaign-only sides. Its rules differ from the other campaigns in one big way: the campaign card's Resolution awards **XP**, which the players spend on levelling and upgrading cards (see Facts, "Campaign rules"). The work has the same shape as `docs/plans/mirkwood-paths.md`: a data phase, a campaign-registry phase, a shared mechanics family, then one phase per scenario using the phase 12 "Scenario procedure" (`docs/phases/phase-12-knife-in-the-dark.md`).

Out of scope: the nine Dream-chaser Nightmare decks (their cards are already in `data/cards/Nightmare.json`, prefixes 9046 to 9054 in `scripts/data/nightmare-defs.ts`; they stay unbuilt, with no `scenario` set, until a later plan); the campaign Achievement list; Messenger of the King cards.

User decisions (2026-10-30):
- The campaign is **Dream-chaser**, built from the Dream-chaser Campaign Expansion (DCCE, MEC111) printing, with the seven original sets for the base cards.
- XP is fully automated: the Resolutions award it, and the players choose where to spend it (which scalable card gets a level, which card is upgraded). The app never spends XP for them.
- The MEC111 rulebook is bundled as the campaign's booklet.
- The Hard and Expert Mode card (collector 217) is in scope.
- One Scenarios-tab box, `dream-chaser`, holds all nine scenarios.
- Ships on the table (phase 39b): the heading shows as a top-bar dial while the Heading card is in play; a row too full at 44 pt steps folds whole groups into a "+n" stack with a list; the Corsair deck and its discard are piles on the board; the Island Map is a chip plus a map panel.
- The DCCE code rule below is the plan's; the implementer may pick another collision-free rule and record it with its reason.

The standing decisions in `docs/phases/STATUS.md` bind this plan.

## Facts found during exploration

**Sources**
- Hall of Beorn card exports (`data/raw/hallofbeorn/{Encounter,Quest,Player}Cards.json`) hold the nine scenarios under seven `CardSet`s, plus a `Dream-chaser Campaign Expansion` set. Encounter rows, quest rows and the campaign set per product:

| CardSet | Encounter (copies) | Quest | Notes |
| --- | --- | --- | --- |
| The Grey Havens | 59 rows (116) | 10 | 15 player cards (RingsDB `TGH`); ships 11080-11083 and the Heading card 11084 `Navigation` (Objective) are here |
| Flight of the Stormcaller | 11 (22) | 7 | stages 1-4 A/B plus the Stormcaller's own 2C-4C/D |
| The Thing in the Depths | 15 (32) | 3 | |
| Temple of the Deceived | 14 (31) | 1 | |
| The Drowned Ruins | 15 (39) | 2 | |
| A Storm on Cobas Haven | 15 (26) | 3 | |
| The City of Corsairs | 15 (31) | 4 | |
| Dream-chaser Campaign Expansion | 36 rows (38) | 9 campaign cards | 34 boon/burden player rows; 8 encounter-backed burdens and boons |

- The seven original sets total 297 encounter copies and 30 quest cards. The DCCE rulebook lists 288 encounter, 30 quest, 9 campaign, 38 boon and burden cards and 1 Heading card (366). The 9-card gap is settled by the scan read.
- The DCCE set holds the 2023 changes: the two new ships (Duskbringer, Glórinaith), "Campaign Mode only" and "Upgraded" back sides (Stormcaller, The Thing in the Depths, Temple Guardian, Gate Key, Black Key, Dol Amroth Warship, the ships), the Shattered Monument and Calphon reprints, and every boon, burden and campaign card. Hall of Beorn files the two sides of one such card as two rows with one code.
- `Scenarios.json` lists the nine with empty `QuestCards` and `ScenarioCards`. `scripts/data/sources/hallofbeorn.ts` snapshots `Scenarios/<Slug>.json` only for products in `BUILT_PRODUCTS` (`scripts/data/campaign-defs.ts`). Fetched on 2026-10-30, all nine answer 200 (10 to 26 KB each) and hold the full quest cards (text, both sides) and `ScenarioCards` with Normal and Easy counts, mixed with the scenario's Nightmare set rows (filter on `... Nightmare`). So adding the products to the campaign definition makes `pnpm data:sync hallofbeorn` write them. Nothing is committed from this exploration.
- Hall of Beorn text is the 2016 text (Voyage's quest says "Sunny, Cloudy"; DCCE prints the on-course sun and the off-course icons). The scan-read ledger decides, as everywhere.

**Printing (recommendation: DCCE)**
- RingsDB (`data/raw/ringsdb/cards`) has only player cards for TGH, FotS, TitD, TotD, DR, SoCH, CoC (already in `data/cards/` and automated in `src/effects/authored/pool/{TGH,FotS,TitD,TotD,DR,SoCH,CoC}.ts`; `src/effects/open-lines.ts` has no line for them). Its `DCCE` pack is 37 `treasure` rows, codes 11172-11216, one per boon/burden (they are in `data/cards/DCCE.json`, `campaignKind` null, `deckLegal` false). No encounter, quest or campaign card of these products is in RingsDB.
- DCCE is the analogue of MEC109 and RevCore: the only printing with campaign cards, boons, burdens, the Heading card and the campaign rulebook, and it reprints all nine scenarios. Recommend building the campaign from DCCE: the seven original sets give the base cards, the DCCE set gives the 2023 cards and sides, and the ledger is read from DCCE scans where the two differ. Standalone play uses the base sides (the rulebook: a "Campaign Mode only" side is used only in campaign mode).

**Card codes**
- Hall of Beorn's codes for the seven products are RingsDB's numbering (TGH `11NNN`, the packs `12NNN`) and are unique across the seven (249 rows checked), and none collides with `data/cards`.
- The DCCE set does collide. Its codes are `12` plus the DCCE collector number (13 to 217), which hits: the packs' own codes (12013 Full Sail Ahead, 12042, 12063 Scouting Party, 12077, 12078, 12102, 12136-12141 incl. Prince Imrahil 12138), and `EMCE` in `data/cards` (12166-12204, Ered Mithrin). RingsDB's own DCCE codes are `11172`-`11216` with gaps at exactly the nine campaign cards (11171, 11179, 11182, 11191, 11194, 11197, 11200, 11209, 11215) and Hard/Expert Mode (11217).
- Recommended rule (a `data/overrides.json` `productCodes` entry with the reason, as for `41` in The Dark of Mirkwood): a DCCE card with collector number 171 or more is `11` plus its number (RingsDB's code where RingsDB lists it, the same pattern where it does not); a DCCE card with a lower number (the 2023 reprints: Calphon 13, Stormcaller 42, The Thing in the Depths 63, Temple Guardian 77, Gate Key 78, Dol Amroth Warship 102, Shattered Monument 129, six ships 136-141) is `110` plus its three-digit number, since `110NNN` is unused (6-digit prefixes in use: 131-132, 140-148, 900-907). The two sides of one card share the code. `productCodeOf` pads to two digits, so the entry needs a width.
- Hall of Beorn codes with no collision (11022-11084 encounter, 12019-12165 encounter, 11016-11021 and 12012-12149 quest) are used as they are.
- Success symbols: a Sailing test counts a symbol printed on some encounter cards' text boxes. No source carries it (Hall of Beorn, DragnCards `cornerText` and RingsDB all lack it), so the ledger read records which cards print it.

**DragnCards**
- The nine are `Q06.1`-`Q06.9`, Easy `E06.1`-`E06.9`, Nightmare `N06.1`-`N06.9`. `CCC.4` "Dream-chaser" holds 60 DCCE boon/burden/campaign rows. The Q06 decks are the 2016 cards (packs `The Grey Havens` and the AP packs, no DCCE card), complete with Easy counts, so they carry no campaign rows.
- Load groups per deck: quest deck, encounter deck, set-aside, staging area, and `sharedEncounterDeck2`/`3` and `sharedQuestDeck2`. `EncounterDeck2` is the Corsair deck in 1 and 4 to 8, the Uncharted deck in 2 and the Grotto deck in 7. In 9 `EncounterDeck2` and `3` are the Corsair deck and the second encounter deck (the rulebook's "From Sea to Land"). `sharedQuestDeck2` is the Stormcaller's quest deck in 4. `scripts/data/normalize/scenarios.ts` maps `sharedEncounterDeck2` to the burden pile and finds a deck only by the `Q0C.n` key, so both generalize.
- Hall of Beorn's per-scenario counts and the Q06 decks do not agree card for card (Voyage: 43 Normal copies in Hall of Beorn's `ScenarioCards`, 46 in the DragnCards piles). The Q06 decks lead the piles; the rulebook's "built with…" paragraph (`dcce.setup-<id>`) and the quest Setup text are the check, as in phase 8d. A count Hall of Beorn and the load list disagree on is a build problem until an override settles it from the printed card: `overrides.scenarioPiles` (a pile), `scenarioCounts` (a count, for example the set size a card prints) or `scenarioEasy`.

**Rules PDFs**
- The Dream-chaser Campaign Expansion rulebook is MEC111, 32 pages, 31 MB, `https://hallofbeorn-resources.s3.amazonaws.com/Images/LotR/Rules/MEC111.pdf` (verified PDF; sha256 `2a4093f7ee5b64fe4a78d9720fcebcf15a954989222500eafdb05f77ccebb6d2`). The asmodee host answers 200 `text/html` for any name it lacks; none of 18 plausible MEC111 names exists there. The S3 host is already used for `rr`, so `RULE_PDFS` pins MEC111 from S3 as doc `dcce`. The Grey Havens rules insert and the 2016 pack rulesheets were not found on either host: the DCCE rulebook replaces them. `MEC108` (Angmar Awakened) and `mec115_rules-web.pdf` (Ered Mithrin) are other campaign expansions, and S3 `MEC110.pdf` is a two-page credit sheet. Sailing wording below is from the MEC111 text (`pdftotext` of the fetched file).
- Pages: new keywords and card types 2-4 (Archery, Immune, Last Player, Stormcaller Elite, Campaign Mode, Ships, Corsair deck, Boarding, Ship-objectives, Heading, Sailing and Sailing tests); setup and encounter-deck paragraphs at 6 (Voyage), 7-8 (Fate of Númenor, Uncharted, Uncharted deck), 9 (Raid, Aflame), 12-13 (Flight, the Stormcaller's area), 14 (Thing in the Depths, Grapple), 17-18 (Temple, Island Map, Exploration), 20 (Drowned Ruins, Grotto deck), 23 (Cobas Haven), 24 (City of Corsairs, From Sea to Land, Indestructible); campaign rules 29, Campaign Log 30-31. Each scenario also names its "Campaign Setup" extra cards.

**Campaign rules (MEC111 p29, p30-31)**
- The campaign card back awards XP (a list of "1 XP if…" conditions per scenario). XP is spent only before or after a scenario: one XP marks one checkbox beside a card's title in the Campaign Log. A **scalable** card's X is its marked boxes (Galdor's Counsel, Command, Círdan's Blessing in four spheres each, Come Together, Starla); an **upgradable** card (the Modification boons, ships, Black Key, Calaerion, Calphon, Gavin, Gate Key, Send for Help, Spyglass, The Havens Burn, The Shattered Monument, The Black Sword, Parrying Cutlass, Throwing Axe, the Dream-chaser location) uses its Upgraded side once all boxes are marked. Some burdens upgrade to weaker sides.
- Na'asiyah (SoCH hero 12109) cannot be used in scenarios 1 to 7. The log also has Heroes, Fallen Heroes, Boons, Burdens, Threat Modifiers, scenario score, XP gained and unspent.
- Boons and burdens that are encounter cards: all ship-objectives, Modification attachments, Calaerion, Gavin, Send for Help.
- A double-sided Hard/Expert Mode card (collector 217, code 11217) is an optional extra objective for more XP.
- The campaign ends when The City of Corsairs is won ("The players win the campaign!").

**Engine that already exists** (re-read before use)
- Keywords surge, doomed, archery, indestructible, immune to player card effects (`src/rules/keywords.ts`), victory display zone, `under` zone (cards under a location), `captive` zone, `secondActiveLocation` zone, `FlipCard`, `RevealMore`, `BarEngagement` verbs.
- Objective allies and the Guarded/claim objectives (`src/catalog/families/objectives.ts`), the campaign family's Setup verbs (`PutIntoPlay`, `SetAside`, `AttachChosen`, `ShuffleInto`, `AddToHandAfterMulligan`; `src/catalog/families/campaign.ts`, dealt by `src/campaign/start.ts` and `checklist.ts`), multi-copy pool entries (`perPlayer`), `usedOnce`, `counters`, `prisoner`, `carryOver` in the log (`src/campaign/log.ts`), branching quest stages (`stages[i].branch`, `src/rules/quest.ts`), searches of the encounter deck and discard pile.
- Catalog type `ship-enemy` exists (`scripts/data/normalize/cards.ts` `TYPE_BY_HOB`, `src/catalog/deck-legal.ts`), added for the Nightmare decks. There is no engine behaviour for it.
- Nothing exists for: ship-objectives; the Heading card and on-course/off-course; the Sailing keyword and test; Boarding; the Corsair deck and its discard pile (the engine has one encounter deck and one discard pile, `src/rules/state.ts`); a second encounter deck swap; Aflame; Uncharted/Grotto double-sided locations and their decks; Grapple; the Stormcaller's area (a second quest deck); the Island Map grid and Exploration keyword; two-sided encounter cards chosen per scenario (The Stormcaller Elite); XP, levels, upgrades, Hard/Expert; the per-scenario fleet choice.

**Hard-wired spots a fourth campaign touches** (confirm each by reading before editing)
- Definitions: `scripts/data/campaign-defs.ts` (`PRODUCTS`, `CAMPAIGNS`, `ScenarioDef`, `HOB_ONLY_PACKS`, `PACK_CAMPAIGN`, `BUILT_PRODUCTS`), `scripts/data/sources/rules.ts` (`RULE_PDFS`), `data/overrides.json` (`productCodes`, `encounterSetAliases`, `scenarioPiles`, `scenarioEasy`, `campaigns`).
- Cards: `scripts/data/normalize/cards.ts` (`TYPE_BY_HOB`, which lacks `Ship_Objective`, and the boon/burden classification), `product-cards.ts` (`PRODUCT_TYPES`, `PRODUCT_PACK` takes `packs[0]`, `productCodeOf` pads to 2 digits), `src/catalog/card-facts.ts` and `deck-legal.ts` (type lists).
- Scenarios and build: `normalize/scenarios.ts` (`GROUP_PILE`, the `Q0C` key regex, `easyDeck` key rewrite), `normalize/setup-text.ts` (Setup patterns: "Prepare the Corsair deck", "Players prepare their fleet", "Prepare the Uncharted deck", "Prepare the Island Map", "Prepare the Grotto deck", "Prepare the Stormcaller's area"), `normalize/setup-piles.ts`, `scripts/data/build.ts`, `load-scenarios.ts`, `printed/scope.ts`, `printed/ledger.ts`, `rules/spans.ts` (id regex lacks `dcce`), `src/catalog/scenario-data.ts` (`PILES`: no Corsair, second-deck, Stormcaller-quest, Uncharted or Grotto pile), `src/effects/index.ts` (one generated file per campaign).
- Catalog: `src/catalog/printed-ledger.ts` (imports each ledger file by hand), `scripts/build-catalog.ts` (campaign rows from `data/campaigns/index.json`, `PACK_CAMPAIGN`).
- Registry and screens: `src/screens/campaign-data.ts` (`RAW_CAMPAIGNS`, `RAW_SCENARIOS`, `BOXES`), `src/campaign/playable.ts`, `src/screens/booklets/books.ts` (`BOOKLETS`), `scripts/pack-booklets.ts` (`BOOKLET_SOURCES`), `src/screens/rules-glossary.ts` (`DOC_NAMES`, `BOOKS`, the `inGlossary` setup filter), `src/screens/rules-view.tsx` (`BOOK_TEST_IDS`, `BOOK_SCENE`), `src/campaign/save.ts` (`FELLOWSHIP_ID`), the campaign list, scenarios tab, briefing, path and log screens, `src/campaign/loadout.ts` (`saga` gating; add the Na'asiyah rule), `src/campaign/briefing.ts`.
- Docs: `docs/brief.md` (a "Dream-chaser" section modelled on Mirkwood Paths; the booklet ids and "booklet PDFs" lines), `docs/architecture.md` registry note, `docs/phases/`, `docs/INDEX.md` (`pnpm docs:index`).

## Approach: thirteen new phases (37-48 and 39b)

Each phase gets a file in `docs/phases/` in the existing style (Goal / Cards / E2E / Exit) and a row in `docs/phases/STATUS.md`. Phase 37 also extends the STATUS rules header: phases 37 to 48 and 39b have one review round per phase. Phases 40 to 48 each have an engine half and a phone half (phase 12 describes them). In a cloud session the phone checks and Maestro runs stay open, as `CLAUDE.md` says. The phases run in order (37, 38, 39, 39b, then 40 to 48), one at a time, because they share `open-lines.ts`, `data/` and the family indexes. `docs/brief.md` changes in the same commit as the rules it states.

### Phase 37 - Dream-chaser data (nothing playable yet)

1. **Sources.** `scripts/data/campaign-defs.ts`: eight `PRODUCTS` rows (the seven originals with packs TGH, FotS, TitD, TotD, DR, SoCH, CoC, and `Dream-chaser Campaign Expansion` with pack DCCE), `home` `dream-chaser`, `load: "dragncards"`, `twinPack: null`, `easySheet: false`. A `dream-chaser` `CampaignDef` with nine `ScenarioDef`s in play order, each with its `setupSpan` (`dcce.setup-<id>`) and a new `deck` field for the `Q06.n`/`E06.n` keys (`crossCheck` serves the same purpose today for a setup-mode box). `data/sources.json` and `RULE_PDFS`: doc `dcce` from the S3 MEC111 URL. `pnpm data:sync hallofbeorn rules`.
2. **Cards.**
   - `TYPE_BY_HOB` and `PRODUCT_TYPES` gain `Ship_Objective` and `Ship_Enemy` (and a `ship-objective` card type in `card-facts.ts`); `Objective_Ally` boons and burdens classify by `CardSubType`.
   - RingsDB's 37 `treasure` rows merge with Hall of Beorn's Boon/Burden rows and take `campaignKind`, as the RevCore boons do.
   - The DCCE two-row cards fold into one two-sided card; a DCCE card Hall of Beorn lacks or gives no second side is built from DragnCards' rows (#129, and the backs of Calphon, Dol Amroth Warship, Duskbringer, Glórinaith and Navigation), their text a candidate the ledger replaces.
   - A card whose two sides are two catalog cards (the Stormcaller Elite's enemy and objective-ally sides, a Grotto location and its Underwater side) is one placement: `code` is the side dealt faceup (the side the quest's Setup names), `back` the other side, and one code can have several backs in a pile (`dcce.grotto-deck`). A DCCE reprint of a card (Calphon, the Stormcaller, the ships) is linked by `reprints` (original code to `110NNN`): a campaign game deals the reprint, standalone play the original.
   - Apply the DCCE code rule (see Facts) with its override reason; extend `productCodes` with a width.
   - A Hall of Beorn set suffix like `... Campaign` ("The Fate of Númenor Campaign") normalizes to the scenario's set.
3. **Scenarios.** Generalize `normalize/scenarios.ts`: find the deck by `ScenarioDef.deck`; map load groups to piles per scenario (Corsair deck, second encounter deck, Uncharted deck, Grotto deck, Stormcaller quest deck as new `PILES`, written to `data/scenarios/<id>.json` with `src/catalog/scenario-data.ts` and its tests); take Easy counts from the `E06` decks and `ScenarioCards`; filter the Nightmare rows. Campaign cards are looked up per product. `build.ts` writes `data/campaigns/dream-chaser.json`, nine `data/scenarios/*.json` and `src/effects/generated/dream-chaser.ts`.
4. **Setup parser** (`normalize/setup-text.ts`): the nine campaign cards' and nine stage 1A Setup sentences, quoted from the ledger rather than Hall of Beorn's typos ("Prepare the Corsair deck", "Players prepare their fleet", "Each player chooses a Modification boon for each of their ship-objectives and attaches it", "One player may raise their threat by 4 to attach Spyglass to a hero", "Put Calaerion into play under the control of the player with the Dream-chaser", "Shuffle X into the Corsair deck", "Flip the Stormcaller to its 'Campaign Mode only' side", …). A sentence no pattern reads is listed by `data:build -- --verbose`.
5. **Rules.** `scripts/data/rules/spans.ts` regex admits `dcce`; `data/rules/columns.json` gets the MEC111 boxes (two columns, 619 x 800 pt pages); hand-checked spans in `data/rules/index.json`: `dcce.setup-<scenario-id>` (nine), `dcce.ships`, `dcce.ship-enemies`, `dcce.ship-objectives`, `dcce.corsair-deck`, `dcce.boarding`, `dcce.prepare-your-fleet`, `dcce.heading`, `dcce.sailing`, `dcce.sailing-tests`, `dcce.stormcaller-elite`, `dcce.campaign-mode`, `dcce.uncharted`, `dcce.uncharted-deck`, `dcce.aflame`, `dcce.stormcallers-area`, `dcce.grapple`, `dcce.island-map`, `dcce.exploration`, `dcce.grotto-deck`, `dcce.from-sea-to-land`, `dcce.indestructible`, `dcce.archery`, `dcce.last-player`, `dcce.gaining-xp`, `dcce.scalable-upgradable`, `dcce.hard-expert`. `scripts/data/rules.test.ts` updated.
6. **Ledger.** `data/printed/dream-chaser.json`, read by an agent from the DCCE and original scans (`docs/plans/done/authoritative-data.md` section A; order: `pnpm data:build`, `pnpm data:sync scans pictures` (CLAUDE.md, Data), read): every dealt, campaign, boon and burden card of the box, both sides, including each encounter card's Sailing success symbol. A scan the agent cannot read is a question for the user. `src/catalog/printed-ledger.ts` imports it; `printed/scope.ts` takes the campaign's scope. Player cards of the seven packs are already ledgered.
7. **Tests.** Generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `catalog-exit.test.ts` and `build-catalog.test.ts` for the fourth campaign; Fellowship and Mirkwood assertions stay.
8. **Effects tooling.** `effects:draft` and `effects:open` read the fourth campaign; the draft target for non-pool cards is `src/effects/authored/<scenario-id>.ts`; `src/effects/index.ts` imports the new files. The 37 DCCE boon and burden rows get records in `src/effects/authored/pool/DCCE.ts` as each scenario phase uses them.

**Exit:** `pnpm data:build` and `pnpm data:check` green and deterministic, the nine scenario JSONs pass their cross-checks (`--verbose` shows none failed), `pnpm test` green, `open-lines.ts` lists the new cards' lines.

### Phase 38 - Dream-chaser campaign shell and XP

1. **Registry.** `src/screens/campaign-data.ts` (campaign, nine scenarios, one box `dream-chaser` holding all nine (user decision)), `campaignIds`, the Scenarios tab section, `start-dream-chaser`, `src/campaign/playable.ts` stays empty until phase 40, the registry test against `data/campaigns/index.json`, `scripts/build-catalog.ts` and `PACK_CAMPAIGN`. `saga` is false, so the Ring-bearer rules do not run.
2. **Booklet.** `BOOKLETS` id `dream-chaser`, `BOOKLET_SOURCES` file for the pinned MEC111 PDF, `rules-glossary.ts` (`DOC_NAMES`, `BOOKS`, the `dcce.setup-` filter), `rules-view.tsx` tile and scene, `bookletParams`. The pinned file is 31 MB; it is bundled (user decision).
3. **Loadout.** Na'asiyah (12109) is refused in scenarios 1 to 7 of this campaign, with the rule cited (`dcce.campaign-mode`).
4. **Campaign log: XP.** New log fields with defaults so old saves load: XP gained per scenario, XP unspent, and the marks per card (the scalable and upgradable cards of p30). Their order and columns follow the Campaign Log sheet. A `GainXp` effect verb (amount and a condition) in a new `dreamchaser` campaign-family file, run by the Resolution; the path shows XP; between scenarios a "Spend XP" screen lets the players choose where each XP goes: a level on a scalable card or an upgrade, marking one box per XP (no typing of numbers, no automatic spend). A card's level is its marks, its upgrade flips the card to its Upgraded side (side B, `dcce.scalable-upgradable`). The scenario score still follows `ltp.scoring`.
5. **Campaign facts.** "Gavin returned" is a log fact (`dcce` campaign card 11209 Resolution, read by 11215); the Campaign Pool holds the scalable cards (several copies of one code, as Command per sphere); the checklist deals the pool cards each campaign card names.
6. **Hard/Expert Mode card** (11217): the campaign setup and each briefing offer Hard or Expert (`dcce.hard-expert`); the log stores the choice per scenario, the deal follows it, and the Resolution adds its XP.
7. **Bump** `ENGINE_VERSION` and the catalog version if a column changes; migration in `drizzle/` if needed.
8. **Tests and flows.** Registry, loadout, XP round trip, spend and upgrade, old-save load; `.maestro/dream-chaser-start.yaml`, `scenarios-boxes.yaml` updated, `booklet-dream-chaser.yaml`.

**Exit:** Fellowship and Mirkwood goldens unchanged and green, new tests green, `pnpm lint` green. May be split into 38 and 38b (as 28 and 28b) if the XP screen is large.

### Phase 39 - Sea mechanics family

The ship, heading, sailing and Corsair-deck vocabulary of scenarios 1, 3, 4, 5, 8 and 9. New files `src/catalog/families/sea.ts` (schema) and `src/rules/families/sea*.ts` (engine), each verb citing a `dcce.*` span or ledger line, each with a test. Nothing is built for one scenario's card.
- **Ships.** Ship-enemies are enemies with these exceptions: only ship-objectives defend their attacks, an undefended attack damages a ship-objective, ship-enemies can be attacked by ship-objectives and by non-ship characters. Ship-objectives are objective allies that attack only ship-enemies and defend only against ship-enemy attacks (`dcce.ship-enemies`, `dcce.ship-objectives`). The defender and attacker pickers, the legal-intent check and the "why not" refusal read the type.
- **Fleet.** "Prepare your fleet": each player takes one of the six ships, one takes the Dream-chaser (a solo player takes the Dream-chaser and one other); unused ships leave the game (`dcce.prepare-your-fleet`). The seat picker and briefing show the choice; no control types a stat.
- **Heading.** The Heading card on the Dream-chaser, set to on-course at the start; shift on-course / off-course one step; predicates `onCourse`, `offCourse`, `heading is worst`; the quest, location and enemy conditions the cards read (`dcce.heading`). A table widget exists only because the setup creates the card.
- **Sailing and Sailing tests.** The quest-phase step (first player, before committing): shift off-course, exhaust any characters (the Dream-chaser always can and counts as two), look at that many encounter cards (reshuffling the discard pile if short), each success symbol allows a shift on-course, discard the looked-at cards; Actions open before and after, not during (`dcce.sailing`, `dcce.sailing-tests`). The symbols come from the ledger.
- **Corsair deck.** A second deck and discard pile zones (`corsairDeck`, `corsairDiscard`); "prepare the Corsair deck" moves every non-ship enemy out of the encounter deck; non-ship enemies that would be discarded go to the Corsair discard pile; empty deck reshuffles its discard pile (`dcce.corsair-deck`).
- **Boarding X.** When a ship-enemy with Boarding X engages a player from the staging area, reveal X Corsair cards and put them into play engaged with that player; no other engagement triggers it (`dcce.boarding`).
- **The Stormcaller Elite.** Two-sided cards (enemy / objective ally) with no encounter back: leaving play as an enemy sends it to the victory display, as an ally removes it from the game; the scenario's Setup says which side (`dcce.stormcaller-elite`). Shared by 3, 5, 7 and 9, first used in 42.
- **Archery X, Immune, Last Player, Indestructible** are read against the existing keywords; any gap is a family fix here, with a test, not a bend of an existing verb.

**Exit:** the family tests green; `src/catalog/families/index.ts` lists the family; no scenario is playable yet.

### Phase 39b - Ships on the table

How the table holds the sea family in its limited room, from 667 × 375 with two seats to a tablet (user request, 2026-10-30). The design is in `docs/phases/phase-39b-ships-on-the-table.md`. In short:
- ships stand first in their controller's play-area row;
- the Heading card adds one top-bar dial;
- the Corsair deck and its discard pile take a second pile slot under the encounter pair;
- Boarding reveals into the engagement area;
- a Sailing test lays its looked-at cards in a strip with their success marks;
- one crowding rule (`row-fold.ts`) squeezes staging and the engagement area to 44 pt steps, then folds what no moment asks about into a stack with a list.

The phase builds the shared pieces. Phases 41 to 48 build their own areas from its "Scenario areas" section. Phase 40's phone half depends on it; its engine half needs only phase 39.

**Exit:** as the phase file says; no scenario is playable yet.

### Phases 40-48 - one scenario each (phase 12 procedure)

For each phase:
- `pnpm data:build -- --verbose` shows no failed cross-check; every dealt card has a ledger entry (phase 37).
- `pnpm effects:draft <id>`, then the `effect-author` agent, until coverage is green for every line of every dealt card, including the campaign card's Setup, Resolution and XP list and the boons and burdens its Setup names, on both sides where a card has two.
- New verbs go in a mechanic family, never bent from an existing one. Records go in `src/effects/authored/<scenario-id>.ts`; the boon and burden records go in `src/effects/authored/pool/DCCE.ts`.
- Golden `src/campaign/golden/<id>.json` with a `golden-<short>.test.ts`, `scripts/<short>-scene.ts` and `<short>-game.ts`: true solo and two-handed, a win and a loss, with the XP the campaign card awards.
- A campaign test checks that the previous part's pool, XP and marks reach this part, and that the standalone game uses the base sides.
- Add the id to `src/campaign/playable.ts`, then `pnpm effects:open`.
- Phone: words and widgets only where a line creates them (cite the line in `docs/brief.md`), built from phase 39b's pieces and its "Scenario areas" section, Maestro win and loss flows, fixtures.

| Phase | Scenario (campaign card) | New engine work (cited cards, codes after the DCCE rule) |
| --- | --- | --- |
| 40 | Voyage Across Belegaer (11171) | **First use of the sea family.** Stage 1A Setup: prepare the Corsair deck, prepare fleet, shuffle the four stage 2 cards, search Rolling Seas 11051 and Scouting Ship 11022 (11016). Random stage-2 order and "look at the top 2 stages and advance to one" on defeat when on-course (11017-11020, a quest-order verb beside `branch`). Stage 3 Corsair Pursuit 11021: win with no Ship enemies or at 10 progress, no progress off-course. Boarding ships 11022, 11057, 11058 Corsair Warship, 11059 Boarding Party; weather locations 11050-11056. Heading card 11084. Campaign Setup: Modification boon per ship-objective (11172-11175 Armor Plating, Ballista, Enlarged Quarters, Extra Sails), "deal 2 damage to a ship for 1 resource", shuffle Ominous Fate 11176 and Thunderstruck 11177 into the encounter deck and Crowley 11178 into the Corsair deck. Resolution adds Ominous Fate to the pool; XP conditions read stage 2B cards, heading, Ship enemies, Corsair Warships in the victory display. |
| 41 | The Fate of Númenor (11179) | **Uncharted** (`dcce.uncharted`, `dcce.uncharted-deck`): double-sided locations (Lost Island / real side, 11027, 11030-11032 and the rest, folded to one code per card), no quest points, "Forced: after Lost Island becomes active, flip", "Action: remove 4 progress to look", flipping removes progress, double-sided locations shuffle back to the Uncharted deck on discard. Calphon 11028 (110013 campaign) objective ally, losing him loses. Spyglass 11180 attached to Calphon, Revenant 11181 shuffled in, "deal 1 damage to reduce threat by 1" per character. XP: Lush Jungle and Drowned Graves in the victory display, resources on the campaign card. |
| 42 | Raid on the Grey Havens (11182) | **Aflame X** (`dcce.aflame`): damage placed on staging-area Aflame locations at the end of the round, a destroyed one goes facedown underneath The Havens Burn 11038 (out of play; the `under` zone hosted by an objective, not only a location), Dream-chaser location 11039, loss at 3 + players cards under it, explored Aflame locations discard their tokens. **The Stormcaller Elite** first use (Captain Sahír 11076/11077, Na'asiyah 11078/11079). Stage 1: Calphon removed after stage 2B. Setup: first player controls Calphon with Spyglass and Black Key boon 11183; Graxar 11188 shuffled in; each player may take one Galdor's Counsel (11184-11187) with X + 1. Resolution: choose Parrying Cutlass 11189 or Throwing Axe 11190 and the hero it attaches to; XP from cards underneath, Elven Wave-runners, Na'asiyah. |
| 43 | Flight of the Stormcaller (11191) | **The Stormcaller's area** (`dcce.stormcallers-area`): a second quest deck of stages 2C-4C (12016-12018) beside the Stormcaller 12019 / 110042 (flip to its Campaign Mode only side), cards there are immune and outside the staging area unless the players' stage matches, end-of-round progress from the top encounter card, stage advance through C and D sides. Ships 12020-12022, Archery. Setup: Black Key burden 12192 on the Stormcaller, Calaerion 12193 into play under the Dream-chaser's player, Modification boons, Thunderstruck, Crowley. XP: on-course, stage 2B, destroyed the Stormcaller, no damage on heroes. |
| 44 | The Thing in the Depths (11194) | **Grapple X** (`dcce.grapple`): an enemy attaches facedown to the location with the highest or lowest printed Threat or quest points, is immune and unengageable, adds 2 Threat, detaches when the location becomes active or is explored (arms 12050-12054; Crushing Arm 12052 attacks when detached). Encounter deck built from The Stormcaller and Corsair Raiders only, with The Thing in the Depths 12049 / 110063 and The Stormcaller Elite set aside until stage 2 swaps the sets. Stormcaller locations 12042-12048. Captain Sahír flips and Black Key swaps burden to boon; Sea Serpent 12196 (two sides), Come Together 12195. XP: resources on Sahír and Na'asiyah, Sea Serpent in play or the victory display. |
| 45 | Temple of the Deceived (11197) | **Island Map and Exploration** (`dcce.island-map`, `dcce.exploration`): 15 double-sided locations in a 3 x 5 grid (three Temple of the Deceived locations in the right-hand column), an active location marker in place of the active slot, orthogonal neighbours as the staging area, travel without discarding, locations that stay when progress equals quest points, directional card text. Gate Key 12071 / 110078 (claim, Action to look at a facedown Temple), Temple Guardian 12070 / 110077, Temple Halls 12069, Grotto's Entrance 12068. Setup: Starla 12198 and both Recurring Nightmares 12199 as secrets under the Temple locations ("Travel Action: flip a secret"); Revenant, Spyglass, Black Key boon. Resolution: Starla joins the pool, each non-secret Recurring Nightmare is shuffled into a chosen player's deck after the starting hand. |
| 46 | The Drowned Ruins (11200) | **Grotto and Underwater** (`dcce.grotto-deck`): nine double-sided locations (12094-12104; Shrine to Morgoth 12094/12095 set aside until stage 2), the Grotto deck, Grotto side up when entering the staging area, Underwater side only on a flip, explored Grotto locations return to the deck and explored Underwater locations go to the victory display. Sahír and Na'asiyah as objective allies. Setup: Black Key boon, Revenant, Command (11201-11204) and Círdan's Blessing (11205-11208) chosen from the pool. XP: Underwater locations in the victory display, Shrine to Morgoth Grotto side. |
| 47 | A Storm on Cobas Haven (11209) | Ships in a besieged bay: Dol Amroth Warships 12123 / 110102 (two, set aside when destroyed), Raider Flagship 12124 (Victory 20, only ship-objectives attack it), Corsair Skirmisher 12125, Siege Ship 12126, Heavy Cruiser 12127; the four tower objectives 12134-12137; Cobas Haven 12130 lowers Boarding; heading bonuses on ships. Setup: Black Key burden on the Raider Flagship, Gavin 11210 into play, Send for Help x4 (11211-11214) set aside facedown, one Círdan's Blessing not in the pool. Resolution: spend 4 XP on Gavin for the "Gavin returned" log fact. |
| 48 | The City of Corsairs (11215) | **From Sea to Land** (`dcce.from-sea-to-land`): the active encounter deck is swapped for a second deck at stage 2B (merge the Corsair deck and discard pile, search Watch Tower and Battle-hardened across, keep Watch Towers in play), ships leave. Stormcaller 12151 flipped, Captain Sahír 12158 (Indestructible) with Black Key burden and The Black Sword 11216 and its Refresh Action, Slave Ship 12152, The Shattered Monument 12159 / 110129. Campaign card flips and its back is a standing effect, not a Resolution only. Win = the campaign is won; "Gavin returned" puts him in. |

**Exit for each:** coverage and goldens green in Node; a win runs the Resolution, awards its XP and unlocks the next part; a loss writes nothing; the phone half follows the phase 12 rule. Phase 48's win ends the campaign.

## Critical files

- `scripts/data/campaign-defs.ts`, `scripts/data/sources/{hallofbeorn,rules,scans}.ts`, `data/sources.json`, `data/overrides.json`
- `scripts/data/normalize/{cards,product-cards,scenarios,setup-text,setup-piles,campaigns,printed}.ts`, `scripts/data/{build,load-scenarios}.ts`, `scripts/data/printed/{scope,ledger}.ts`, `scripts/data/rules/spans.ts`, `data/rules/{index,columns}.json`, `data/printed/dream-chaser.json` (new)
- `src/catalog/{card-facts,deck-legal,scenario-data,printed-ledger}.ts`, `src/catalog/families/{sea,dreamchaser}.ts` (new) and `index.ts`, `scripts/build-catalog.ts`, `src/catalog/version.ts`
- `src/rules/{state,zones,quest,keywords,combat,stage-reveal}.ts`, `src/rules/families/sea*.ts` (new)
- `src/campaign/{log,resolution,score,loadout,start,checklist,briefing,save,playable}.ts`
- `src/effects/index.ts`, `src/effects/authored/*`, `src/effects/authored/pool/DCCE.ts` (new)
- `src/screens/{campaign-data,rules-glossary,rules-view,seat-picker,briefing-parts}.ts(x)`, `src/screens/routes/(tabs)/{index,scenarios}.tsx`, `src/screens/booklets/books.ts`, `scripts/pack-booklets.ts`
- `docs/brief.md`, `docs/architecture.md`, `docs/phases/phase-37 to 48-*.md`, `docs/phases/STATUS.md`

## Verification

After each phase:
- `pnpm data:build` and `pnpm data:check` (deterministic); `pnpm data:build -- --verbose` (no failed cross-check)
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`
- `pnpm effects:open`, which shows no line for a scenario in `playable.ts`
- `node --experimental-strip-types scripts/card-smoke.ts <new codes>` (including the DCCE boons and burdens a scenario deals)
- `pnpm catalog:build`, then commit `src/catalog/version.ts`
- `pnpm booklets:pack` packs the books with matching sha256 (the new book after phase 38)
- the per-scenario golden tests; every Fellowship and Mirkwood golden passes without edits to its expectations
- `/reviewer` on the diff, and `/ux` when `src/screens` or `src/play` changed

Maestro and phone checks stay open in cloud sessions and are noted in `STATUS.md`.

## Notes for the orchestrator and the implementer agent

The plan is run by `orchestrator` (`.cursor/agents/orchestrator.md`); its Models and Implementer-tasks sections bind: every code-writing agent runs on Sonnet, `reviewer` and `ux` on Opus, one implementer per phase, merge each phase before the next. Do not copy that file into a phase file.
- **One review round per phase:** `reviewer` (and `ux` when `src/screens` or `src/play` changed) once on the phase's diff, one Sonnet fix pass, then close; an unresolved block goes in the phase's `STATUS.md` note.
- Order: 37, 38, 39, 39b, then 40 to 48 in play order. The data phase must finish before any code phase reads `data/scenarios`.
- The implementer reads `.cursor/rules/authority.mdc`, `docs/brief.md` and `docs/architecture.md` sections the phase names, the phase file, `docs/handover/agent-brief.md`, and for 40 to 48 the phase 12 "Scenario procedure" and `docs/plans/effect-authoring.md`.
- Rule wording comes from the pinned MEC111 PDF (`pnpm data:query` over `data/rules`), never from memory. A scan the agent cannot read is a question for the user.
- Keep the Fellowship and Mirkwood paths byte-identical: existing goldens and tests stay green without edits to their expectations; if one must move, stop and report why.
- The Dream-chaser Nightmare decks are untouched: do not set `scenario` on a `NIGHTMARE_DECKS` row.
- The Hall of Beorn per-scenario files hold Nightmare rows; filter them out. `data/raw` is written by `pnpm data:sync`, never by hand.

## Risks

- DCCE reprints change card text and add sides; Hall of Beorn's text is the 2016 text and has typos (backquotes, "Gaxar", "horoes"). The ledger read is the long pole of phase 37: about 366 cards, both sides, with the success symbols.
- Phase 38's XP and upgrade log is new product surface in the one place every campaign shares; a bad log schema breaks old saves. The log grows through its Zod schema with defaults.
- Four rule families are new at once (ships, zones for decks, double-sided locations, grid). Phase 39 holds only what several scenarios share; the rest wait for the scenario that needs them, so a late discovery does not rework phase 39.
- An `ENGINE_VERSION` or `CATALOG_VERSION` bump drops in-progress scenarios on phones. Logs and decks survive.
- The MEC111 book is 31 MB; bundling it enlarges the app (user-accepted).
