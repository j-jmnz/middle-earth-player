# Plan: Mirkwood Paths (Revised Core) and The Dark of Mirkwood

## Context

The app plays only the Fellowship of the Ring saga (MEC109). The user wants these scenarios as playable as the existing ones: every card automated, scans and printed-text ledger, rule spans, effects, campaign play, standalone play, and the rule booklets bundled in the app.

- The three Revised Core Set scenarios (RingsDB `RevCore`, MEC101): Passage Through Mirkwood, Journey Along the Anduin and Escape from Dol Guldur.
- The two scenarios of The Dark of Mirkwood (RingsDB `TDoM`): The Oath and The Caves of Nibin-Dûm.

The Dark of Mirkwood rulebook (p6) settles how they fit together. The core campaign is called **Mirkwood Paths**. The Oath is its part 4 and The Caves of Nibin-Dûm its part 5. The same two scenarios can also be played as a **two-scenario mini campaign** on a blank log.

User decisions (2026-10-27):
- Revised Core, not the 2011 core.
- List both campaigns: `mirkwood-paths` (5 parts) and `the-dark-of-mirkwood` (2 parts). They share scenario files.
- "Next campaign" carry-over is automated. Escape from Dol Guldur's resolution (Mendor and Mendor's Support) and The Caves of Nibin-Dûm's (Ranger Sense) record carry-over cards. A new save can take them in from a finished save.
- Bundle the booklets.

Today the pipeline, the registry and the screens are hard-wired to one campaign. The work is in two parts: make the code multi-campaign once, then add each scenario with the existing per-scenario procedure (the phase 12 "Scenario procedure", steps 1–6).

## Facts found during exploration

**Sources already pinned**
- Hall of Beorn's `Scenarios.json` lists `Passage-Through-Mirkwood-(Campaign)` and the other two (product "Revised Core Set"). It also lists `The-Oath-(Campaign)` and `The-Caves-of-Nibin-Dûm-(Campaign)` (product "The Dark of Mirkwood").
- The Hall of Beorn card exports hold:
  - Revised Core: 49 encounter, 13 quest and the campaign cards.
  - The Dark of Mirkwood: 36 encounter and 9 quest/campaign cards.
- The Revised Core Learn to Play (`learn-to-play`) and Rules Reference (`rr`, MEC101.pdf) are pinned. The Learn to Play has campaign mode (pp. 30–31) and each scenario's "encounter deck is built with…" paragraph. `rr.campaign-*` spans already exist.
- The Dark of Mirkwood rulebook is not pinned. It is at `https://images-cdn.fantasyflightgames.com/filer_public/6c/05/6c05f84b-1485-4dce-bd47-92b1ce0974b2/dark_of_mirkwood_rulebook_v2.pdf` (8 pages; verified to be a PDF). It has the set lists and the campaign-mode page.

**Card codes**
- Hall of Beorn gives The Dark of Mirkwood cards `020NN` codes, which collide with The Hunt for Gollum's RingsDB codes. RingsDB lists the same cards as `410NN` (Stalking Goblin is 02041 in Hall of Beorn and 41041 in RingsDB).
- Rule: The Dark of Mirkwood code = `41` + the two-digit collector number, recorded in `data/overrides.json` with that reason.
- Revised Core encounter cards reuse 2011 codes 01074–01131. The `RevCore` printing owns them. Hall of Beorn's ` (Campaign)` encounter-set suffix is normalized away.

**DragnCards**
- `Q01.x`/`E01.x` are the 2011 decks, with no campaign rows. There is no deck for The Dark of Mirkwood.
- So for the new boxes, Hall of Beorn `ScenarioCards` counts lead. DragnCards is a cross-check where it exists, and printed Easy marks (read from the scans) settle any disagreement.

**Player pool**
- Core and every other deck-legal player card is already covered (`src/effects/authored/pool/Core.ts`, `open-lines.ts` lists only Fellowship lines).
- Not yet covered: the boons and burdens 01132–01138 and 41041–41049, and campaign cards 01129–01131, 41050 and 41051.

**Engine pieces that already exist**
- Keywords: surge, doomed, archery.
- Victory display; objective allies (the Gildor pattern; Mendor fits it).
- `leavesPlayLoses`, `FlipCard`, `RevealMore`, `BarEngagement`.
- The `campaign` zone for a campaign card in play; the resolution verbs.

**Hard-wired spots to generalize** (from the explorers)
- Sync and products:
  - `scripts/data/sources/hallofbeorn.ts:8` and `scripts/data/normalize/campaigns.ts:8` (`FELLOWSHIP_PRODUCTS`)
  - `normalize/cards.ts` (TFotR and twin-set gate)
- `normalize/scenarios.ts`:
  - `PACK_BY_NAME`
  - the `Q0C` deck regex
  - TFotR-only campaign-card lookup
  - `SCENARIO_RULE`
  - the literal `fellowship-of-the-ring` campaign object
- `normalize/setup-text.ts` (no Mirkwood Setup verbs).
- Build and ledger:
  - `build.ts:86,99` (one campaign file, one generated effects file, `bookletPages` only reads `mec109.setup-*`)
  - `load-scenarios.ts:14`
  - `printed/scope.ts`
  - `printed/ledger.ts` (`loadLedger` default)
  - `normalize/printed.ts` (TFotR gate)
  - `rules/spans.ts:11` (closed id regex)
- Catalog: `src/catalog/printed-ledger.ts:3`, `scripts/build-catalog.ts:18-19,151` (one campaign and pack set).
- `src/catalog/scenario-data.ts`: `campaignCard`, `prelude` and `starterDecks` are required, and there is no booklet id or saga flag.
- Every `FELLOWSHIP_ID` use, starting with `src/campaign/save.ts:11` and `src/screens/campaign-data.ts`:
  - `(tabs)/index.tsx:73,122,247`
  - `(tabs)/scenarios.tsx:37,211`
  - `standalone/briefing/[scenarioId].tsx:43,70`
  - `log/[saveId].tsx:66`
- Saga rules always run:
  - `src/campaign/loadout.ts:44-53`
  - `src/campaign/briefing.ts:121`
  - `src/screens/seat-picker.tsx:63,168`
  - `src/screens/briefing-parts.tsx:82`
- `src/campaign/start.ts`: only `AttachToRingBearer` and `AddToStaging` campaign-setup verbs are dealt.
- `src/campaign/resolution.ts` `earn()` and `log.ts` `applyResolution`: the pool is deduplicated by code, but "each player earns 1 copy" needs several copies of one code.
- `src/rules/quest.ts` `advanceStage()` is linear, so Passage Through Mirkwood's random 3B branch can't be expressed.
- Booklets: `src/screens/booklets/books.ts`, `scripts/pack-booklets.ts` `BOOKLET_SOURCES`, `campaign-data.ts` `bookletParams` (booklet id = campaign id), `src/screens/rules-glossary.ts` `DOC_NAMES`/`BOOKS`.

## Approach: seven new phases (27–33)

Each phase gets a file in `docs/phases/` in the existing style (Goal / Cards / E2E / Exit) and a row in `docs/phases/STATUS.md`.
- Phases 27 and 28 are shared foundations.
- Phases 29–33 each add one scenario, using the phase 12 procedure, with an engine half and a phone half. In a cloud session the phone checks and Maestro runs stay open, as `CLAUDE.md` says.
- These phases depend on 8d and 9 only, so they can run beside phases 15 and 16. They touch different scenario files, but they share `open-lines.ts`, `data/` and the family indexes, so they merge one at a time.
- `docs/brief.md` changes in the same commits as the rules. It gets a new "Mirkwood Paths" section modelled on the Fellowship one: campaigns, scenario table, campaign-card rules, carry-over, booklets. Line 27's "for now only the Fellowship…" and the "two booklet PDFs" and booklet-ids lines are updated.

### Phase 27 — Multi-campaign data (data only, nothing playable yet)

1. **Sources** (`scripts/data/sources/*`, `data/sources.json`)
   - Replace `FELLOWSHIP_PRODUCTS` with a per-campaign product table. Add "Revised Core Set" and "The Dark of Mirkwood". Snapshot their five `(Campaign)` scenario files.
   - Pin The Dark of Mirkwood rulebook as rules doc `tdom` in `RULE_PDFS`, with its boxes in `data/rules/columns.json`.
   - Run `pnpm data:sync hallofbeorn rules`.
2. **Cards** (`normalize/cards.ts`)
   - Build encounter, quest and campaign cards from Hall of Beorn for the two products, filtered by `CardSet`. Nightmare sets stay out.
   - Apply the `41`-prefix code rule for The Dark of Mirkwood (an override with its reason).
   - Use the `RevCore` printing for 01074–01131, and normalize the ` (Campaign)` set suffix.
3. **Scenarios** (`normalize/scenarios.ts`, `load-scenarios.ts`, `build.ts`)
   - Parametrize by a campaign definition: id, name, products, scenario order, booklet doc and span prefix, saga flag.
   - Hall of Beorn counts lead; DragnCards `Q01`/`E01` is an optional cross-check; `overrides.scenarioEasy` records disagreements.
   - Campaign cards are looked up per product.
   - Add a `sharedBoons` pile.
   - `loadCampaign(id)` and `loadScenarios(campaignId?)` read all campaigns when no id is given.
   - `build.ts` writes:
     - `data/campaigns/mirkwood-paths.json` (5 scenarios)
     - `data/campaigns/the-dark-of-mirkwood.json` (2 scenarios)
     - `data/scenarios/{passage-through-mirkwood, journey-along-the-anduin, escape-from-dol-guldur, the-oath, the-caves-of-nibin-dum}.json`
     - a generated effects file per campaign
   - `normalize/campaigns.ts` marks each built campaign as playable in `index.json` when at least one of its scenarios is in `PLAYABLE_SCENARIOS`; otherwise its tile stays locked.
4. **Setup parser** (`normalize/setup-text.ts`): add patterns for the new Setup sentences, quoted from the ledger rather than Hall of Beorn's typos:
   - "Search the encounter deck for 1 copy of X and 1 copy of Y, add them to the staging area"
   - "Each player reveals 1 card"
   - "attach 1 encounter card to each objective"
   - "Put Mendor into play"
   - "Set each copy of X and Y aside, out of play"
   - "Attach X to a hero of the first player's choice"
   - "Each player chooses 1 Adaptation boon"
   - "adds a copy of X to their hand after drawing their starting hand"
   - "Shuffle the X burden into the encounter deck"
5. **Schema** (`src/catalog/scenario-data.ts`)
   - Campaign data gains `bookletId` and `saga: boolean`.
   - `prelude` and `starterDecks` may be empty.
   - `bookletPages` reads any doc's `setup-<id>` span.
6. **Rules**
   - Widen the span-id regex in `rules/spans.ts` to admit `tdom`.
   - Add hand-checked spans:
     - `ltp.setup-<id>` for the three core scenarios (the "built with" paragraphs)
     - `tdom.setup-the-oath`, `tdom.setup-the-caves-of-nibin-dum`
     - `tdom.campaign-mode`, `tdom.mirkwood-paths`, `tdom.mini-campaign`
     - `easy-mode` spans for the core removals
   - Update `scripts/data/rules.test.ts`.
7. **Ledger**
   - Add `data/printed/mirkwood-paths.json`, read by an agent from the pinned scans (`docs/plans/authoritative-data.md` §A): every dealt, campaign, boon and burden card of both boxes, plus the three core player cards not yet ledgered (01013, 01017, 01030).
   - `loadLedger` merges every `data/printed/*.json` and fails on a duplicate key.
   - `src/catalog/printed-ledger.ts` imports both files.
   - `scope.ts` takes scope from every campaign.
   - Drop the TFotR gate in `applyPrinted`.
   - Order: `pnpm data:build`, then `pnpm data:sync scans`, then read.
   - A scan the agent cannot read is a question for the user.
8. **Tests**: generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `scripts/catalog-exit.test.ts` and `scripts/build-catalog.test.ts` per campaign. The existing Fellowship assertions stay.
9. **Effects tooling**
   - `effects:draft` and `effects:open` read all campaigns.
   - The draft target for non-pool cards is `src/effects/authored/<campaign-scenario>.ts`.
   - `src/effects/index.ts` imports the new generated and authored files.

**Exit:** `pnpm data:build` and `pnpm data:check` are green and deterministic, the new scenario JSONs pass their cross-checks (`--verbose` shows none failed), and `pnpm test` is green. `open-lines.ts` lists the new cards' lines.

### Phase 28 — Campaign registry, saga gating, log, booklets

1. **Registry**
   - `src/campaign/save.ts` and `src/screens/campaign-data.ts` become a map from campaign id to campaign data and scenarios. Metro needs static JSON imports, so the map is written by hand, and a test checks that it matches `data/campaigns/index.json`.
   - `campaignOf` and `nameOf` work for any id. Remove every `FELLOWSHIP_ID` fallback listed above.
   - `scripts/build-catalog.ts` tags `cards.campaign_id` from a pack→campaign map.
2. **Screens**
   - Campaign list: one start panel per playable campaign. `start-fellowship` keeps its testID; the new ones are `start-<id>`. Each save's progress line reads its own campaign.
   - Scenarios tab: one section per box (Fellowship, Revised Core, The Dark of Mirkwood).
   - The standalone briefing takes the box from the scenario.
   - Path and log screens use `campaign.bookletId`.
3. **Saga gating**
   - These run only when `campaign.saga`:
     - `validateLoadout`: `noRingBearer`, `twoFellowshipHeroes`, `secondFrodo`, `ringInDeck`, the fourth-hero allowance
     - `needsRingBearer`
     - the Ring-bearer slot in `seat-picker.tsx` and `briefing-parts.tsx`
   - Outside a saga, Fellowship-sphere heroes are refused, with the rule cited.
   - Standalone play follows the box's flag.
4. **Campaign setup verbs** (`start.ts`, `checklist.ts`)
   - Deal these campaign-card Setup instructions:
     - `PutIntoPlay` (an objective ally under the first player)
     - `SetAside`
     - `AttachChosen` (the first player's choice)
     - `AddToHandAfterMulligan`
     - `ShuffleIntoEncounter`
   - A pool card that says "put into play at the start of each scenario" (Mendor) skips checklist step 8.
5. **Log** (`log.ts`, `resolution.ts`, `save.ts`)
   - The pool holds several copies of one code (no code dedupe; `removedFromPool` is per entry).
   - Add structured campaign facts in place of the "notes" the cards ask for:
     - `prisoner` (a hero code)
     - heroes with Valor or Scarred attached (already covered by `attachedTo`)
     - once-per-campaign uses (The Fervor of Lore and the other Adaptations: "Record in the Campaign Log when used")
     - counters on a campaign card (The Oath's resource tokens are read at resolution)
   - `StartScenario` passes these facts into the engine.
   - Carry-over: a resolution can write `carryOver` cards to the log (Mendor, Mendor's Support allowance, Ranger Sense). Creating a new save offers the carry-over of a finished save of any campaign, and checklist step 1 applies it.
   - The Dark of Mirkwood mini campaign starts on a blank log. In Mirkwood Paths, part 4 continues the same log.
   - Bump `ENGINE_VERSION`, and add a migration in `drizzle/` if a column changes. The JSON log grows through its Zod schema with defaults, so old saves load.
6. **Booklets**
   - `BOOKLETS` and `BOOKLET_SOURCES` gain:
     - `rules-reference` (`MEC101.pdf`, already pinned as `rr`)
     - `the-dark-of-mirkwood` (`dark_of_mirkwood_rulebook_v2.pdf`, pinned in phase 27)
   - Mirkwood Paths opens `learn-to-play`, which already holds the core campaign and setup pages. The Dark of Mirkwood opens `the-dark-of-mirkwood`.
   - `rules-glossary.ts` `DOC_NAMES`/`BOOKS` gain `tdom` and `rr`.
   - `bookletParams` returns `campaign.bookletId`.
   - Update the brief's booklet ids and the "two booklet PDFs" line, and `scripts/pack-booklets.test.ts`.
7. **Tests**: registry, loadout gating (Fellowship unchanged; Mirkwood refuses a Fellowship hero and needs no Ring-bearer), multi-copy earn, carry-over round trip, booklet map. Write Maestro flows: `mirkwood-start.yaml` (start, briefing with no Ring-bearer slot), `scenarios-boxes.yaml`, `booklet-dark-of-mirkwood.yaml`.

**Exit:** all Fellowship goldens unchanged and green, the new tests green, `pnpm lint` green. `/reviewer` and `/ux` report no blocks.

### Phases 29–33 — one scenario each (phase 12 procedure)

For each phase:
- `pnpm effects:draft <id>`, then the `effect-author` agent, until coverage is green, including the campaign card, boons and burdens.
- New verbs go in a mechanic family: `src/catalog/families/<f>.ts` plus `src/rules/families/<f>*.ts`, each citing a ledger line or rule span, each with its own test.
- Records go in `src/effects/authored/<scenario-id>.ts`; boon and burden pool records go in `authored/pool/RevCore.ts` and `authored/pool/TDoM.ts`.
- Goldens: `src/campaign/golden/<id>.json` with `golden-<short>.test.ts`, `scripts/<short>-scene.ts` and `<short>-game.ts`. They cover true solo and two-handed, a win and a loss.
- A campaign test checks that the previous part's pool reaches this part.
- Add the id to `src/campaign/playable.ts`, then run `pnpm effects:open`.
- Phone: words and widgets only where a line creates them, Maestro win and loss flows, fixtures.

| Phase | Scenario | New engine work (cited cards) |
| --- | --- | --- |
| 29 | Passage Through Mirkwood | **Branching quest**: random choice between 3B cards (01121/01122) with the other removed, and a "stage reached" fact read by campaign card 01129's resolution (`quest.ts` `advanceStage`). Mendor (01135) as an objective ally with `leavesPlayLoses`. Mendor's Support boon (one copy per player). Ungoliant's Swarm and Lingering Venom burdens. |
| 30 | Journey Along the Anduin | Each player reveals 1 card at setup. Hill Troll (01082): excess combat damage to threat. Stage rules: no engagement checks, skip the staging step, win when no enemies are in play, search for a Hill Troll if none is in play. Campaign card 01130: Valor and Scarred set aside and attached on triggers. Resolution picks the prisoner (most damage, random tie). Smaller lines: Banks of the Anduin, Wargs, Wolf Rider, Enchanted Stream. |
| 31 | Escape from Dol Guldur | **Objective Guarded and claim** (01108–01110): attach the next encounter card, "free of encounters", claim and attach, return on detach. **Prisoner and rescue**: generalize `south-captive.ts`; the hero and its attachments are facedown and unusable; Mendor is captured with them; a rescued event. Orc Guard (01107/01125): a deck card as a facedown enemy. Iron Shackles (01105): attached to a player deck. Group limit of one ally per round (01123/01124). Dungeon Jailor. Campaign card 01131 Forced replacement and flip. Resolution writes the Mendor carry-over. |
| 32 | The Oath | Choose an Adaptation boon at setup (41044–41047), with once-per-campaign Actions. Stalking Goblin burden (41041): search the encounter deck, discard pile and the player's collection. The campaign card in play gains a resource each round, read at resolution (Guilty Conscience 41043). Mirkwood Paths part 4 and mini campaign part 1. |
| 33 | The Caves of Nibin-Dûm | "No Time to Waste!" added to hand after the mulligan. Shiny Distraction burden (41042). Resolution reads the highest final threat (< 40): Ranger Sense (41049) joins the deck now, plus carry-over. "Remove from the game and from the Campaign Pool". |

**Exit for each:** coverage and goldens green in Node; a win runs the resolution and unlocks the next part in both campaigns that contain the scenario; a loss writes nothing; the phone half follows the phase 12 rule.

## Critical files

- `scripts/data/sources/{hallofbeorn,rules,scans}.ts`
- `scripts/data/normalize/{cards,scenarios,setup-text,campaigns,printed}.ts`
- `scripts/data/{build,load-scenarios}.ts`, `scripts/data/printed/{scope,ledger}.ts`, `scripts/data/rules/spans.ts`
- `scripts/data/effects/{draft,open}`, `data/overrides.json`, `data/rules/{index,columns}.json`, `data/printed/mirkwood-paths.json` (new)
- `src/catalog/{scenario-data,printed-ledger}.ts`, `scripts/build-catalog.ts`, `src/catalog/version.ts`
- `src/campaign/{save,start,checklist,loadout,briefing,log,resolution,path,playable}.ts`
- `src/rules/quest.ts`, `src/rules/families/*`, `src/catalog/families/*`
- `src/effects/index.ts`, `src/effects/authored/*`
- `src/screens/{campaign-data,seat-picker,briefing-parts,rules-glossary}.ts(x)`, `src/screens/routes/(tabs)/{index,scenarios}.tsx`, `src/screens/booklets/books.ts`, `scripts/pack-booklets.ts`
- `docs/brief.md`, `docs/architecture.md` (registry note), `docs/phases/phase-27…33-*.md`, `docs/phases/STATUS.md`

## Verification

After each phase:
- `pnpm data:build` and `pnpm data:check` (deterministic)
- `pnpm data:build -- --verbose` (no failed cross-checks)
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`
- `pnpm effects:open`, which shows no lines for scenarios in `playable.ts`
- `node --experimental-strip-types scripts/card-smoke.ts <new codes>`
- `pnpm catalog:build`, then commit `src/catalog/version.ts`
- `pnpm booklets:pack`, which packs four books with matching sha256
- the per-scenario golden tests
- `/reviewer` on the diff, and `/ux` when `src/screens` or `src/play` changed

Maestro and phone checks stay open in cloud sessions and are noted in `STATUS.md`.

## Notes for the orchestrator and the implementer agent

User instructions (2026-10-27). They bind every session that runs these phases.

**Orchestrator (the session that spawns agents)**
- Every agent you spawn runs on **Sonnet** (`model: "sonnet"`), except the reviewers. That covers `implementer`, `effect-author`, `Explore`, `general-purpose`, the ledger-reading agents and any fork-free helper.
- The reviewers (`reviewer`, and `ux` when `src/screens` or `src/play` changed) run on the default model, with no override.
- **One round of review per phase.**
  - Run `reviewer` (and `ux` when due) once on the phase's diff.
  - Hand its blocks to one Sonnet `implementer` fix pass.
  - Then close the phase: do not re-run the reviewers on the fix.
  - If that fix pass leaves a block unresolved, record it in the phase's `STATUS.md` note and tell the user. Do not start a second review round.
- This replaces the "until `/reviewer` reports no blocks" wording in `STATUS.md` for phases 27–33. Write that into each new phase file and into the `STATUS.md` header note.
- Run the phases in order: 27, 28, then 29–33. One implementer per phase. Merge each phase before starting the next, because they share `open-lines.ts`, `data/` and the family indexes.

**Implementer (per phase)**
- Read `.cursor/rules/authority.mdc`, `docs/brief.md`, `docs/architecture.md`, the phase file, and `docs/handover/agent-brief.md` before writing code. For phases 29–33, also read the phase 12 "Scenario procedure" and `docs/plans/effect-authoring.md`.
- Data changes go through the source adapter, the normalizer, the templates or `data/overrides.json`, each with a reason. Never hand-edit generated files: `data/cards`, `data/scenarios`, `data/campaigns`, `data/rules/entries.json`, `src/effects/generated`.
- `pnpm data:sync` is the only network step. Sources are online: query the pinned PDF or scan when a line is in question, and never rely on memory. Ask the user about a scan you cannot read rather than guessing.
- Ledger work: each read entry records `readBy`, and its scan sha256 must match the pin. Quote Setup sentences from the ledger, not from Hall of Beorn.
- New verbs go in a mechanic family (`src/catalog/families/<f>.ts`, `src/rules/families/<f>*.ts`), each with a test that names the rule ids or ledger lines it implements. Do not bend an existing verb to mean something else.
- Keep the Fellowship path byte-identical:
  - every existing golden and test stays green without edits to its expectations;
  - if one must move, stop and report why.
- Before marking the engine half done, run the Verification list above and paste the results into the report. Phone checks and Maestro runs stay open in a cloud session; say so in `STATUS.md`.
- Update `docs/brief.md` in the same commit as any rule change. Set the phase `active` with a one-line note when starting it, and `completed` (with the date) when its exit is green and the single review round is done.
- Commit with clear messages and push to the branch the session names. Do not open a PR unless the user asks.

## Risks

- Hall of Beorn's core quest and campaign text is garbled (sides swapped, typos). The scan-read ledger decides, so the ledger read is the long pole of phase 27.
- The 01074–01131 printing merge and the `41`-code rule must not disturb the existing Fellowship data: `data:check` and the Fellowship tests guard it.
- An `ENGINE_VERSION` or `CATALOG_VERSION` bump drops in-progress scenarios on phones. Logs and decks survive (the existing rule).
