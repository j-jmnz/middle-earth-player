# Plan: the Shadows of Mirkwood cycle, playable standalone with Nightmare

## Context

Every official campaign is now playable (`src/campaign/playable.ts`). The README Roadmap says the cycles come next, in release order, and the oldest is **Shadows of Mirkwood** (position 1 in `data/campaigns/index.json`, released 2011-07-22): The Hunt for Gollum, Conflict at the Carrock, A Journey to Rhosgobel, The Hills of Emyn Muil, The Dead Marshes, Return to Mirkwood. It is `kind: "cycle"` in `data/overrides.json` (campaigns): no Campaign Mode, so its scenarios are played standalone only. The user chose all six scenarios, Normal, Easy **and Nightmare** (user decision, 2026-11-16).

Nothing of kind `cycle` has ever been built, so the work is a data step and a "cycle shell" (the pipeline, the app and the harness learn a scenario with no campaign card), then the six scenarios through the existing Scenario procedure (`docs/agents/agent-brief.md`).

What is already there :
- Raw Hall of Beorn cards for all six sets (`data/raw/hallofbeorn/{Encounter,Quest,Player}Cards.json`), `Scenarios.json` lists them; DragnCards decks `Q01.4`–`Q01.9` / `E01.4`–`E01.9` labelled with the exact titles.
- The reused core encounter sets are built and scan-read through `RevCore` (`data/printed/mirkwood-paths.json`), so only each pack's own encounter and quest cards are new.
- The packs' player cards (`data/cards/{HfG,CatC,JtR,HoEM,TDM,RtM}.json`) already have records in `src/effects/authored/pool/` and no open line. Out of scope.
- Nightmare decks 9004–9009 are built (`scripts/data/nightmare-defs.ts`) with no `scenario:` key and no ledger entries in `data/printed/nightmare.json`.

Run by the `orchestrator` (`.claude/agents/orchestrator.md`) on branch `claude/oldest-release-cycle-plan-ojlsqf`, sections in order, one commit per section (checkpoints in between), one review round at the end. This file is the plan.

## What does not move

- Every existing `golden.json`, step log and committed fixture is byte-identical through sections A and B. `ENGINE_VERSION` is unchanged in A and B; a scenario section bumps it only for a rule change that can move a replayed game (`.claude/agents/implementer.md`), and then reports every golden it moved.
- Every existing `data/` file except the ones the cycle adds or the lines named below (`index.json` row, `overrides.json` campaigns entry, `nightmare-defs` keys, `sources.json` pins) is unchanged: `pnpm data check` and `git diff --stat data/` prove it.
- Campaign behaviour is unchanged: the Campaigns tab, saves, log, XP and every campaign's standalone briefing.

## A. Data: the cycle's cards, scenarios and ledger

1. **Definitions** (`scripts/data/campaign-defs.ts`): six `PRODUCTS` rows (`load: "dragncards"`, `twinPack: null`, packs `HfG`, `CatC`, `JtR`, `HoEM`, `TDM`, `RtM`, `home: "shadows-of-mirkwood"`), and one `CampaignDef` with a new `kind: "cycle"` (default `"campaign"`), `ledger: "shadows-of-mirkwood"`, its six `ScenarioDef`s with `deck: { normal: "Q01.<n>", easy: "E01.<n>" }`. For a cycle, `bookletId`, `bookletDoc` and each scenario's `setupSpan` become optional (types say which kind needs them). Remove the cycle's entry from `data/overrides.json` campaigns (`buildCampaignIndex` refuses two entries naming one product).
2. **Rules source.** Research online (`.claude/rules/authority.md`, Open points) whether each Adventure Pack's rules insert is published (FFG, Hall of Beorn `Images/LotR/Rules/`). If it is, pin it in `data/sources.json` `rules`, span its Setup and special rules in `data/rules/index.json`/`columns.json` (`sotm.*` ids) and use those as `setupSpan`. If not, the quest card's printed Setup line in the ledger is the check, and `docs/brief.md` says so.
3. **Normalizer** (`scripts/data/normalize/scenarios.ts`, `campaigns.ts`): a `cycle` scenario has no campaign card (skip the campaign-card lookup and `campaignText`/`campaignLines`), and its cross-check compares the DragnCards piles with the stage 1A Setup text (or the span from step 2). `scenarioDataSchema.campaignCard` becomes optional and `campaignDataSchema` gains `kind`, with `campaignCards`, `bookletId`, `prelude` optional for a cycle (`src/catalog/scenario-data.ts`). `buildCampaignIndex` writes the built entry's `kind` from the def. `load-scenarios.ts`, `scenarioOrder()`, `boxOwners`/`boxCodes` (`scripts/data/effects/generate.ts`) and `authoredOrder()` take a cycle like a campaign (the cycle file after the campaigns, in release order).
4. **Sync and build**: `pnpm data sync hallofbeorn` (the six `Scenarios/<Title>.json`), `pnpm data build`, `pnpm data sync scans pictures`, `pnpm assets scans`. `pictures.test.ts` passes with no new exception unless no picture source has a card.
5. **Ledger**: build `scenario-pipeline.md` section E's `pnpm ledger:seed <scenario-id>` first (it waits for exactly this case), then read every seeded entry of `data/printed/shadows-of-mirkwood.json` against its scan and set `readBy`. A scan that cannot be read is the one question for the user.
6. **Nightmare data**: add `scenario:` to the six rows 9004–9009 in `nightmare-defs.ts`; read each deck's cards and setup card from the Drive pictures into `data/printed/nightmare.json` (seeded the same way where the tool reaches them).
7. `scripts/data/shadows-of-mirkwood.test.ts`, on the pattern of `scripts/data/return-of-the-king.test.ts`: six scenario files, piles and counts per difficulty, no campaign card, Nightmare removals resolve.

Exit: `pnpm data build -- --verbose` reports no failed cross-check for the six; `pnpm data check`, `pnpm test fast`, lint, typecheck green; the six `data/scenarios/*.json`, `data/campaigns/shadows-of-mirkwood.json` and the ledger exist; existing data unchanged except as named.

## B. The cycle shell: a scenario with no campaign

Engine and app:
- `src/campaign/world.ts` (`worldFrom`) and `src/campaign/standalone.ts` take a scenario with no `campaignCard`; `start.ts` standalone mode already drops campaign setup. A cycle game's `campaignId` is the cycle id.
- `src/screens/data/campaign-data.ts`: add the cycle file and the six scenarios to `RAW_CAMPAIGNS` / `RAW_SCENARIOS`, and a `BOXES` entry for the cycle (not a saga: no Ring-bearer, Fellowship sphere refused). `bookletParams()` returns none for a cycle unless A.2 pinned the inserts (then they open as the booklet). The standalone briefing (`src/screens/routes/standalone/briefing/[scenarioId].tsx`) hides the booklet link when there is none.
- Scenarios tab (`src/screens/routes/(tabs)/scenarios.tsx`, `hub-runs.ts`, `list.ts`): the cycle is one fold, "Shadows of Mirkwood", its scenarios in pack order, shown once one is playable; the rest stay "Coming soon" inside it. Campaigns tab (`src/screens/routes/(tabs)/index.tsx`): `startable` keeps only `kind === "campaign"`, so a cycle never offers a New playthrough.

Harness and tools:
- `test/harness/game-kit.ts`: a `standaloneGame()` factory (world, plan, start, `playGolden`) with no checklist, log or earlier parts, on the pattern of `src/campaign/standalone-game.test.ts`.
- `test/harness/golden-suite.ts`: a standalone won loop (outcome and score from `src/campaign/score.ts`, no Resolution, XP or next part) and the same lost loop.
- `scripts/tools/scenario-new.ts` and `scenario-new-files.ts`: a cycle scenario gets the standalone game, golden test, a standalone test in place of the campaign test, and Maestro flows on new standalone win and loss subflows under `.maestro/subflows/`.
- Fixtures: a standalone fixture kind (a save holding one open standalone game at its moment) in `src/campaign/fixtures/registry.ts`, `src/campaign/fixtures.ts`, `scripts/e2e/fixtures.ts`, and `fixtures.test.ts` reading the cycle's order instead of `campaignPath`. `golden-registry.ts` lists the cycle after the campaigns.

Docs: `docs/brief.md` (Product, Standalone play: a cycle scenario; a new `## Shadows of Mirkwood` section that each scenario fills), `docs/architecture.md` where the data flow and the harness are described, `docs/design-system.md` for the fold if it says how boxes are captioned.

Exit: `pnpm scenario new the-hunt-for-gollum --dry-run` lists standalone skeletons; a test deals a cycle scenario standalone on its stand-in (all lines still open, so not listed as playable) and asserts no Campaigns-tab tile; every existing golden and fixture unchanged; `pnpm test fast`, lint, typecheck, `pnpm data check` green. `ux` reviews in the closing round (screens changed).

## C–H. The six scenarios, in pack order

C The Hunt for Gollum, D Conflict at the Carrock, E A Journey to Rhosgobel, F The Hills of Emyn Muil, G The Dead Marshes, H Return to Mirkwood.

Each section is the Scenario procedure (`docs/agents/agent-brief.md`) as orchestrator tasks: `scenario-author` Read → Build → `reading-judge` → Finish. Per scenario:
- `pnpm scenario new <id>` (dry run first), `pnpm data build`, `pnpm scenario pack <id>`; the Read task's readings, researched online, go under the scenario in `docs/brief.md` (and `recommended` ones to STATUS Open items).
- Records in `src/effects/authored/<id>.ts`, templates and copies first; the core encounter sets' lines are already owned, so the drafts hold only the pack's own cards. New mechanics go to their families (the Read task names them; expected: Hunt for Gollum's Signs of Gollum clues, Rhosgobel's Wilyador and Athelas, Emyn Muil's victory-point quest progress, Dead Marshes' Gollum escape test, Return to Mirkwood's Gollum guard).
- **Nightmare in the same section**: the deck's setup card and cards get records in the same authored file (or a `<id>-nightmare` file if past the size limit), the scenario joins `NIGHTMARE_PLAYABLE` once its deck's lines are all owned, and the encounter smoke and one Nightmare golden cover it.
- `PLAYABLE_SCENARIOS` once no line is open; the render snapshot; spec rows; asks file checked with `--words`; goldens (true solo and two-handed win, a loss per way to lose, Nightmare loss or win, within the Test cost budget); seed finder; standalone fixtures; Maestro flows written, not run.
- The first section to make a scenario playable also flips the cycle row to `playable` (the build does it from `playable.ts`) and moves the cycle out of Coming later.

Exit of each: the Engine half and Screen half exits in `docs/agents/agent-brief.md`, with "a win runs the campaign card's resolution" read as "a win is scored and recorded in History"; `pnpm test scenario <id>` green.

## Closing

- One review round (`reviewer`, plus `ux` since screens changed) on the diff from the base commit; one fix task ending on the full `pnpm test`.
- README Roadmap: the cycle moves out of the list of cycles to come and the playable boxes are named; `docs/brief.md` Product lists the cycle.
- `docs/phases/STATUS.md`: Open items for what stays open (missing won fixtures, renderer gaps, readings not user-confirmed); the plan file is deleted and its citations point at `docs/brief.md` / `docs/architecture.md`; `pnpm doc index`.
- Each section's commit body carries its `Pipeline measure:` lines (`scenario-pipeline.md`, After each scenario phase). Commits follow `.claude/rules/commit-standards.md` (e.g. `feat: The Hunt for Gollum, standalone and Nightmare`); no PR or release unless the user asks.

## Verification

- After each section: `pnpm data build`, `pnpm data check`, `pnpm lint`, `pnpm typecheck`, `pnpm test fast`, `pnpm test scenario <id>` for a scenario section, `pnpm effects open` diff limited to the scenario's lines, `git diff --stat` showing no change to other scenarios' `golden.json` or fixtures (unless an `ENGINE_VERSION` bump is reported).
- `pnpm test encounter <id>` and `pnpm test smoke` on the dealt player cards per scenario.
- Web build: open the Scenarios tab, see the Shadows of Mirkwood fold, deal The Hunt for Gollum on Normal and Nightmare from the briefing, and check the Campaigns tab shows no cycle tile (`run` skill / Playwright screenshot).
- At the end: the one full `pnpm test`, `pnpm data check`, `pnpm commit:check` on every commit.
