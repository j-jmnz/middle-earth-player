# Plan: a local game-data store, fetched once, generated wherever possible

## Context

The engine (`src/rules`) is sound. What costs agents time is getting game data into it:
- Encounter and quest cards are hand-typed in `scripts/local-cards.ts`, and keywords in `KEYWORD_OVERRIDES`. Scenario composition is hand-reconciled in `fixtures/*.json`, and the printed timings are a second hand list in `fixtures/abilities/*.json`.
- Setup placement is described twice: by the fixture `pile` and by the quest card's Setup record, with a test keeping them in step.
- Effects take a TypeScript → SQLite → JSON round trip, and card shapes are translated three times (`RingsDbCard` → row → `CatalogCardRow` → `PrintedCard`).
- Rules live only in PDFs nobody in the container has. Agents re-read Hall of Beorn pages by hand, and the brief restates rules in prose.
- Card text was barred from git, so every agent session starts without it.

**What the user directed:**
- Use DragnCards.
- Drop the earlier repository agreements (the no-card-text-in-git rule, the DragnCards ban, the authority chain).
- Avoid hand authoring wherever possible.
- Persist data locally for future agents.
- Effects come from templates plus agent drafts.
- Download the rule booklets and store their content locally.

### Sources (all reached from this container, 2026-10-24)

| Source | What we take | Pin |
|---|---|---|
| **Hall of Beorn export** `hallofbeorn.com/Export/{EncounterCards,QuestCards,PlayerCards}`, `/Export/Scenarios/{slug}` | Every card as typed JSON, including the **MEC109 printing** (`CardSet: "The Fellowship of the Ring"`, 136 cards): stats, traits, `Keywords[]`, text, shadow, quantity, `EasyModeQuantity`, quest front and back (side-B quest points, stage), `IncludedEncounterSets`, `RingsDbCardId`, `OctgnGuid`, `ImagePath`. Normal, Easy and Nightmare counts per scenario. | sha256 per payload |
| **DragnCards LOTR plugin** `github.com/seastan/dragncards-lotrlcg-plugin` (active, Sep 2026) | `tsvs/cardDb.tsv` (5,074 rows: all cards and sides, text, keywords, image file, OCTGN GUID). `jsons/preBuiltDecks.json`: every scenario's load list per placement group (`sharedQuestDeck`, `sharedEncounterDeck`, `sharedStagingArea`, `sharedActiveLocation`, `sharedSetAside`, `player1Play1`, `sharedEncounterDeck2/3`, `sharedQuestDeck2`, `sharedBoons`) for Normal (`Q0C.*`), Easy (`E0C.*`) and Nightmare. `steps.json` and `phases.json` (the framework step numbers). Automation for 233 player cards and 3 encounter cards in DragnLang, used as reference only. `imageUrlPrefix.json`. | git commit SHA |
| **RingsDB API** | Player cards, official codes, errata, images | sha256 per payload |
| **Official rule PDFs** (FFG CDN `cdn.svc.asmodee.net/.../2026/09/`, Hall of Beorn S3) | `mec109_rulebook-compressed.pdf` (12 pages), `mec101_learn_to_play_eng_v11-compressed.pdf` (36), Revised Core **Rules Reference** (`hallofbeorn-resources.s3.amazonaws.com/Images/LotR/Rules/MEC101.pdf`, 36: glossary, framework steps, campaign rules), `lotr_faq_19.pdf`, `campaign-log.pdf`, `lotr_easy_mode.pdf`. `pdftotext` (installed) gives clean reading-order text. | sha256 per file |

**Checks run:**
- Scenario 1: DragnCards' `Q0C.01` puts 42 cards in the encounter deck, 3 quest stages, Bag End active, Bucklebury Ferry set aside, and Gandalf's Delay plus a Black Rider in staging. That is our fixture.
- Black Rider agrees across Hall of Beorn, OCTGN, DragnCards and `local-cards.ts`.
- MEC109 against TBR: stats, keywords and Easy counts are identical. Text differs on 9 campaign and burden cards.
- Join key: 134 of the 136 TFotR cards get a RingsDB code via their TBR or TRD twin. `OctgnGuid` equals DragnCards' `databaseId`, which is the join key across all three sources.
- **DragnCards quirks to guard against:** Mr. Underhill appears in staging, and `E0C.01` lists Frodo twice. Cross-checks catch these (step 3).

**Not used:**
- OCTGN repo: last commit 2019, superseded by the above.
- Hall of Beorn's GitHub source: 2023, no TFotR.
- Transpiling DragnLang: covers no Fellowship encounter cards, and the user chose templates plus agent drafts instead.

## Target layout

```
data/                                  committed; the only thing tests and agents read
  sources.json                         every source: URL, pin (sha256 or git SHA), fetchedAt
  raw/                                 verbatim snapshots (HoB *.json, RingsDB *.json, DragnCards cardDb.tsv + jsons)
  cards/<pack>.json                    normalized cards, all printings, WITH text, one card per line, sorted
  scenarios/<id>.json                  generated: stages, groups {encounter, staging, active, setAside, ...}, easy deck
  campaigns/<id>.json                  generated plus authored fields: scenario order, prelude, resolution groups
  rules/<doc>.md                       page-anchored text of each PDF ({#rr-p12}, {#mec109-p3})
  rules/entries.json                   split rules: {id, doc, page, title, text, terms[]}
  overrides.json                       the few facts sources get wrong, each with a reason and source
.cache/pdf/                            downloaded PDFs (gitignored, pinned by sha256)
src/effects/generated/<set>.ts         written by the template generator (committed, deterministic)
src/effects/authored/<set>.ts          agent-drafted records for what templates can't express
```

- `pnpm data:sync` is the only network command. It refreshes `data/raw/` and `.cache/pdf/`, then runs `data:build`.
- `pnpm data:build` is offline and deterministic: raw → normalized `data/`, plus the generated effects.
- `pnpm data:check` re-runs `data:build` into a temporary directory and fails on any diff. CI runs it.
- `pnpm catalog:build` becomes an offline transform of `data/` into `assets/catalog.db` for the phone.

## Steps

Each step leaves `pnpm test`, `pnpm lint` and `tsc` green, and is its own commit.

### 0. Golden snapshot
Add a temporary `scripts/refactor-golden.test.ts` that dumps three things:
- the current `PrintedCard`s for the 26 dealt codes plus `141085`;
- the current `ScenarioDefinition`;
- `src/campaign/full-game.test.ts`'s step log and final state on its fixed seeds.

Steps 1–8 keep it green. The full-game log stays afterwards as a permanent per-scenario golden.

### 1. Sync framework and raw snapshots (`scripts/data/`)
- `sources/ringsdb.ts`: move `loadPayload`, the manifest, `mergeCopy`, `assertRulesMatch` and the `ALeP` filter out of `scripts/build-catalog.ts`.
- `sources/hallofbeorn.ts`: the five export endpoints, a 120-second timeout, and a Zod schema over the fields read.
- `sources/dragncards.ts`: fetch `cardDb.tsv`, `preBuiltDecks.json`, `steps.json`, `phases.json`, `imageUrlPrefix.json`, `playerCards.json` and `encounterCards.json` from `raw.githubusercontent.com/seastan/dragncards-lotrlcg-plugin/<sha>/…`.
  - `preBuiltDecks.json` and `playerCards.json` contain `//` comments, so parse them with `jsonc-parser`.
- `sources/rules.ts`: download the six PDFs into `.cache/pdf/` and check sha256.
- Every adapter writes to `data/raw/<source>/` and records its pin in `data/sources.json`.

### 2. One card model (`src/catalog/card-facts.ts`)
- Zod `cardSchema`: code, printings[] (pack, number, octgnGuid, hobSlug, imageUrls), name, type, sphere, traits[], cost, stats, questPoints, victory, engagementCost, isUnique, quantity, easyQuantity, encounterSet, stage, keywords, timings, text, shadowText, errata, deckLegal, sides.
- `PrintedCard` (`src/rules/printed.ts`) becomes the engine-facing subset of this type. `definePrinted` stays as the test helper.
- `scripts/data/normalize/`, pure functions with unit tests:
  - keyword tokens → `Keywords` (`"Hide 2."` → `{hide: 2}`). Unknown tokens go to a report.
  - timing labels from text.
  - joining printings by `OctgnGuid`; codes from RingsDB or the TBR/TRD twin's `RingsDbCardId`.
  - the TFotR printing wins for Fellowship cards.
- `data:build` writes `data/cards/*.json`.
- Delete `scripts/local-cards.ts`, `KEYWORD_OVERRIDES`, `src/rules/catalog-row.ts`, keyword parsing in `src/catalog/card-row.ts`, and `scripts/mec109-read.test.ts`.
- `data/overrides.json` covers only the two twinless cards' codes, The One Ring's `leavesPlayLoses`, and whatever the cross-checks flag.

### 3. Scenarios generated, including setup placement
- `data:build` maps DragnCards `Q0C.NN` (Normal) and `E0C.NN` (Easy) load groups to `data/scenarios/<id>.json`, keyed by our ids (the booklet order in `data/campaigns/fellowship-of-the-ring.json`).
  - `player1Play1` cards other than the prelude are dropped. Frodo is the player's choice.
- Cross-checks fail the build unless resolved by an override:
  - Group counts must equal Hall of Beorn's per-scenario Normal and Easy counts for the scenario's encounter sets, minus Nightmare.
  - Placement must agree with the template parse of the stage-1 quest card's `Setup:` text, step 5. This catches Mr. Underhill in staging.
- The engine reads placement from the scenario's groups:
  - `startScenario` and `finishSetup` (`src/rules/setup.ts`) spawn each group into its zone, in the order the quest card's Setup text gives (set aside, staging, active, attach). `searchSetup` and `handSetup` (`src/rules/setup-search.ts`) are unchanged in what they compute.
  - `sharedEncounterDeck2`, `sharedQuestDeck2` and `sharedBoons` map to the optional zones the brief already reserves (burden deck, second encounter deck). The widget flags become derived: a non-empty group turns the widget on.
- Delete the `fixtures/` directory, `src/catalog/scenario-fixture.ts`, `scripts/join-scenario-fixtures.ts`, the authored `141022:setup:1` placement record, `src/campaign/effects-setup-records.test.ts`, `ScenarioScript`, `registry.ts` and `fellowship/a-shadow-of-the-past.ts`.
  - They're replaced by a pure `buildStart(campaign, scenarioId, input)` in `src/campaign/start.ts`.
- `data/campaigns/fellowship-of-the-ring.json` is generated: scenario list from the `Q0C` keys, and the prelude (The One Ring attached to the Ring-bearer, from `player1Play1`).
  - Only `resolution` groups are authored, in an `authored` block of the same file. Each group's codes are validated against the scenario's cards.
  - Template extraction of reward choices from the MEC109 resolution text in `data/rules/` is a follow-up, if the text proves regular.

### 4. Rules store
- `data:build` runs `pdftotext` (reading order, not `-layout`) per page into `data/rules/<doc>.md`, with `## p<N> {#<doc>-p<N>}` headings.
- A splitter turns the Rules Reference glossary (alphabetical headings), the Learn to Play phase sections and the MEC109 keyword and campaign sections into `data/rules/entries.json`: `{ id: "rr.surge", doc, page, title, text, terms }`.
- Cleanup is one agent pass, then committed: fixing column interleaving the splitter can't. The extraction is regenerated only when a PDF's sha256 changes. A test asserts each entry's page exists and its title appears on that page.
- Framework steps: DragnCards `steps.json` ids (`1.1`…`7.x`) join to Rules Reference "Framework Details" entries, giving `data/rules/steps.json` (id, phase, title, rule entry). The phase rail and the engine's step names use these ids.
- Every `src/rules` module names the rule ids it implements in its header comment, and tests put the id in `describe("rr.surge")`. A test fails if an id is missing from `entries.json`. This replaces the prose rule restatements in `docs/brief.md`.

### 5. Effects: templates first, agent drafts for the rest
- `scripts/data/effects/templates.ts`: an ordered library of `{ id, pattern: RegExp over normalized text, build(match, card) → Effect }` covering formulaic sentences. Examples:
  - `Shadow: attacking enemy gets +X [stat]`
  - `When Revealed: each player raises their threat by X`
  - `Surge` / `Doomed X` are keywords, not records
  - `Setup: add X to the staging area`
  - `Forced: After X is explored, …` (where the verbs exist)
  - `Restrict` / `ModifyStat` constants
  - the conditional `if you have failed a Hide test this round` → `when: { kind: "hideFailed", scope: "round" }`

  A pattern only fires when the whole sentence matches. Partial matches go to the drafts list.
- `data:build` writes `src/effects/generated/<set>.ts`.
- `src/effects/authored/<set>.ts` holds records for sentences no template covers. An authored record with the same `id` replaces the generated one, so a wrong template can be overridden without editing it.
- Seed the template library from the existing records in `src/effects/fellowship-of-the-ring/*.ts`. Each existing record is either reproduced by a template (and deleted from authored) or stays authored. The step 0 golden plus `full-game.test.ts` prove nothing changed.
- `pnpm effects:draft <scenario>` writes `.agent/drafts/<code>.md` for every card whose printed timings still lack records. Each bundle holds:
  - all printings' text;
  - the DragnCards automation snippet if one exists;
  - the matching `data/rules/entries.json` entries by keyword and term;
  - the verb, condition and target lists from `src/catalog/effect-schema.ts`;
  - the three most similar existing records.

  New `.claude/agents/effect-author.md`: reads a bundle, writes `src/effects/authored/`, and runs the coverage and scenario tests.
- New verbs are still added to `effect-schema.ts` and `src/rules/interpret.ts` by hand. That's engine work, not data.
- `scripts/effect-coverage.test.ts` reads timings from `data/cards`, iterates `data/scenarios/*.json` plus the prelude, and requires the nth record from generated plus authored. There's no manifest file and no SQLite.

### 6. Direct imports, slim catalog
- `src/effects/index.ts` exports generated plus authored. `src/screens` and `src/campaign` import it, and `eslint.config.js` drops the `allowEffects` gating. `src/rules` still receives effects as an argument.
- `scripts/validate-effects.ts` moves into a Vitest schema test. Delete the `effects` and `scenarios` tables, `scripts/effects-roundtrip.test.ts`, and the readers in `src/screens/routes/{pool,card/[code],debug}.tsx`. `activeCardCodes` (`src/catalog/active-text.ts`) takes the effect list.
- `scripts/build-catalog.ts` becomes an offline `data/` → `catalog.db` transform (`cards` with text and image URLs, `packs`, `campaigns`, `meta`).
  - The version is a content hash. `src/screens/applied-catalog-version.ts` compares for equality.
  - Delete `scripts/catalog-snapshot.ts`'s `nextVersion` and `scripts/ensure-catalog.ts`.
- Images: encounter and quest art comes from DragnCards (`imageUrlPrefix` plus `imageUrl`), falling back to Hall of Beorn `ImagePath`. This fills the gap RingsDB leaves for `src/screens/images/`.

### 7. Offline tests and CI
- `scripts/test-catalog.ts` becomes `loadCards()` over `data/cards`.
- No test needs the network or a prebuilt database. Display tests build `catalog.db` in a temporary directory from `data/`.
- `.claude/hooks/session-start.sh` drops the catalog build.
- `.github/workflows/test.yml` runs `data:check`, then `pnpm test` and `pnpm lint`.

### 8. Query helper for agents
`pnpm data:query "<sql>"` loads `data/cards`, `data/scenarios` and `data/rules/entries.json` into an in-memory `node:sqlite` database (Node 22 is already used by `scripts/effect-coverage.test.ts`) and prints rows. Example: `select code,name,text from cards where encounterSet='Hunted'`. There's no committed database file, because the JSON stays canonical and diffable.

### 9. Governance and docs rewrite
- Rewrite `.cursor/rules/authority.mdc` and `CLAUDE.md`:
  - `data/` is the source of truth for cards, scenarios and rules text;
  - sources are listed in `data/sources.json`;
  - remove the DragnCards ban, the no-card-text rule and the "confirm on the card" chain;
  - add the commands (`data:sync`, `data:build`, `data:check`, `data:query`, `effects:draft`).
- `docs/brief.md` keeps product decisions only (screens, seats, saves, non-goals). The Core round, Keywords, Hide and Setup-order prose is replaced by rule ids from `data/rules/entries.json`. The Data sources table is replaced by a pointer to `data/sources.json`.
- `docs/architecture.md`: update Processes, Modules, Persistence, Catalog build and Tests. Point at Zod schemas instead of restating types.
- Strip the "MEC109/TFotR printing read via Hall of Beorn … Confirm on the card" comments throughout `src/effects` and `src/rules`. Provenance lives in `data/sources.json` and `data/overrides.json`.
- Add `docs/phases/phase-08b-data-store.md` and a STATUS row. Update `.claude/agents/*` to point at `data/`. Delete the step 0 scaffolding, keeping the full-game golden.

## Adding scenario 2 afterwards
1. `pnpm data:build` already emits `data/scenarios/a-knife-in-the-dark.json` from `Q0C.02`. Review the cross-check report.
2. Add its `resolution` groups to the campaign file's `authored` block.
3. `pnpm effects:draft a-knife-in-the-dark`, then run `effect-author` on the bundles until `effect-coverage` and the scenario test are green.

## Risks
- **Source errors** (DragnCards placement quirks, a Hall of Beorn typo). Three-way cross-checks (Hall of Beorn, DragnCards, quest Setup text) fail the build, and `overrides.json` records each resolution with its reason.
- **Hall of Beorn is slow and unversioned** (about 30 seconds per call, 4 MB encounter export). Fetching is sync-only, raw snapshots are committed, and builds are offline.
- **Templates are wrong in ways types can't catch.** The golden full-game logs, the scenario tests, and authored-overrides-generated precedence limit the damage. A template fires only on whole-sentence matches.
- **Repo size.** Raw snapshots are roughly 12 MB of text and churn only on sync. PDFs (about 50 MB) stay out of git, pinned by sha256 in `.cache/pdf/`, because the extracted text is what agents read. This can switch to committing the PDFs if offline re-extraction matters more than clone size.
- **Licensing.** Card text, art and rule PDFs belong to FFG/Asmodee, and the DragnCards plugin has no license file. Per the user's direction this is persisted in the repo. If the repo is public, that's a legal exposure to revisit.

## Verification
- `pnpm test`, `pnpm lint` and `pnpm exec tsc --noEmit` are green after every step.
- `pnpm data:sync && pnpm data:check` is clean, and a second `data:build` produces no diff.
- With network off and `assets/catalog.db` deleted, `pnpm test` passes.
- Golden: identical `PrintedCard`s for the 26 dealt codes plus `141085`; the generated scenario 1 has a 42-card Normal deck, the current Easy counts and the same placement; `full-game.test.ts` gives an identical step log and final state.
- `effect-coverage` is green for scenario 1, with records split between generated and authored. The report lists how many came from templates.
- The rules test confirms every rule id referenced in `src/rules` and in tests exists in `data/rules/entries.json` with a valid page anchor.
- `pnpm data:query "select count(*) from cards where printings like '%TFotR%'"` returns 136.
- Run `/reviewer` per step, and `/ux` for step 6 (screens and images). Phone checks stay open in STATUS.
