# Plan: printed cards as the authority, after the data store

Written 2026-10-24, after phase 8b. It reviews phases 9 to 16 against the new `data/` pipeline and changes the plan where the pipeline cannot yet give deterministic behavior from authoritative sources. Phases 8c and 8d are new. Phases 9 to 16 are rewritten to match.

**Status, 2026-10-26: carried out.** The plan is a record of intent; the findings below describe the repository as it was on 2026-10-24, not now. What became of each part:

| Part | Now |
| --- | --- |
| Findings 1 to 9 | All addressed. The RingsDB snapshot is committed (1). Findings 2 and 3 are fixed in the build: `pnpm data:build` writes all six scenarios in `data/scenarios`, with the campaign card, the burden deck and per-player counts modelled. Finding 4: the heading heuristic (`scripts/data/rules/split.ts`) is gone, see E. Finding 5 and 6: the checklist, scoring and the campaign cards' records are in `src/campaign` and `src/effects/authored`. 7: see B. 8: see F. 9: see below. |
| A. Printed-text ledger | Done: `data/printed/fellowship-of-the-ring.json` (read by `scripts/data/printed/ledger.ts`), scans pinned by `data/sources.json` and kept in `.cache/scans/`. The build uses ledger lines in place of Hall of Beorn text. |
| B. Line-addressed effects | Done: `Effect.lines`. `scripts/checks/effect-coverage.test.ts` checks that every printed line of a dealt card is owned. `pnpm effects:open` (`src/effects/open-lines.ts`) lists the printed lines no record owns yet. |
| C. Scenarios from cards | Done as written: the campaign card's and the quest card's Setup records are run by `buildStart` (`src/campaign/start.ts`); DragnCards and Hall of Beorn are cross-checks, with `data/overrides.json` for disagreements. |
| D. Campaign is cards plus the checklist | Done: `src/campaign/checklist.ts`, `briefing.ts`, `log.ts` (`campaignPool`, `threatPenalty`, `captives`, per-scenario `rounds`), `score.ts`; the campaign cards' Setup and Resolution are records with timings `campaignSetup` and `resolution`; `authored.resolution` is gone from the campaign file. |
| E. Rules as verified spans | Done, with the shape changed: `data/rules/index.json` (spans with `doc`, `page`, `column`, exact `from` and `to`), `data/rules/columns.json` (column boxes per document), and `data/rules/entries.json` built from them by `scripts/data/rules/`. Archery, toughness, scoring and the checklist have ids. |
| F. Every step names its cause | Done: `src/rules/core/cause.ts`; `EngineStep` carries `cause`, and the golden tests refuse a step with no cause. |
| G. A save is a seed, intents and a data hash | Done: `src/campaign/replay.ts` (`ActiveScenario`, `ENGINE_VERSION` in `src/rules/engine/version.ts`). |
| New order | Phases 8c and 8d are done. Playable scenarios (`src/campaign/playable.ts`): 1 to 4. Scenarios 5 and 6 (phases 15 and 16) still have open printed lines. Per-phase state is in `docs/phases/STATUS.md`. |

## What 8b got right

- One network command, pinned snapshots, an offline deterministic build, and a drift check in CI.
- Effects are records. A template fires only on a whole line. The rest is authored, not parsed.
- The engine is pure and seeded. A whole scenario replays on fixed seeds (`src/campaign/scenarios/a-shadow-of-the-past/golden.test.ts`).

Keep all of that. The problems are in what the pipeline treats as authoritative.

## Findings

Each item was checked in this container on 2026-10-24.

### 1. A clean clone could not build

`.gitignore` had `**/ringsdb/**`, so `data/raw/ringsdb/` was never committed. On a fresh checkout `pnpm data:check` and 3 tests fail with `ENOENT data/raw/ringsdb/packs.json`, and CI runs that check. Fixed in this change: the snapshot is committed and matches the sha256 pins already in `data/sources.json`.

### 2. Source text is not printed text

Hall of Beorn and DragnCards are transcriptions. The build treats them as the card.

- **The Ring Goes South campaign card (142019) is wrong in Hall of Beorn.** Its front and back repeat quest stage 1A/1B. The scan (`hallofbeorn-resources/.../The-Fellowship-of-the-Ring/The-Ring-Goes-South-SetupA.jpg` and `SetupB.jpg`) prints something else. Setup: each player may change heroes without the +1 threat penalty, the players earn Sting, Mithril Shirt, Glamdring and Andúril, each player chooses one for their hand, and any left over are shuffled into the first player's deck. Resolution: if Lust for the Ring is attached to a hero, the players have earned that burden. That is why the build says "Sting is staged and no Setup text puts it there".
- Typos that would reach templates or names: "The Prancy Pony" (141025), "eithe remove" (141026), "Forod`s Choice" (142062), "burder" (141056, 142039), "ememy" (141056), backticks for apostrophes everywhere, "The Argonauth" (DragnCards).
- Race to Rivendell (141029) prints one line twice in the source. Coverage counts lines, so it would demand two records for one sentence.
- Boons and burdens are typed `treasure`/`Campaign`. A burden's burden set is not modelled: Lust for the Ring carries `encounterSet: "Breaking of the Fellowship"`, but later campaign cards remove burdens by burden set ("A Shadow of the Past, Flight to the Ford, The Ring Goes South").

### 3. Most cross-check failures come from the model, not from the sources

`pnpm data:build -- --verbose` leaves scenarios 2 to 6 unbuilt. The reasons:

| Failure | Real cause |
| --- | --- |
| Knife: "The Prancing Pony is staged and no Setup text puts it there" | 141025 Setup does say "Add The Prancing Pony and Bill Ferny to the staging area". The Setup parser misses a two-card list and "all copies of". |
| Flight: `sharedEncounterDeck2` not supported; 5 burdens "Normal 0, Hall of Beorn 1" | The burden deck is not modelled. |
| Flight: "1 Fell Rider per player" | Per-player counts are not parsed. |
| Ring Goes South: Sting, Mithril Shirt, Glamdring, Andúril staged | The campaign card's Setup is ignored, and Hall of Beorn's copy of it is wrong (finding 2). |
| Journey: "the quest card's Setup text names no placement" | The burdens come from the campaign card's Setup (142039), which the build does not read. |
| Breaking: Phial, Three Golden Hairs, Lórien Rope, Lembas staged | The campaign card's Setup (142060) has each player choose one. DragnCards stages all four as a loading convenience. |
| Knife: Ringwraith Easy 4 vs 2. Flight: Black Steed Easy 3 vs 1 | Real source disagreements. These need the printed Easy marks, and then an override. |

Only the last row is a disagreement between sources. The rest are gaps in the build: the campaign card, the burden deck, the campaign pool, and the Setup parser.

### 4. The rules store's ids do not hold the rules they name

`scripts/data/rules/split.ts` guesses headings in `pdftotext` output. Two-column pages interleave. The test checks that a cited id exists, not that it holds the right text.

- (As found on 2026-10-24; the store is now built from `data/rules/index.json`.) `rr.campaign-pool` and `ltp.campaign-pool` hold the blank log sheet. `ltp.score` holds the credits page.
- `ltp.attack-strength` is `"12\nDefense Strength\n2"`, and the brief cites it for archery. No archery entry exists, and no toughness entry exists.
- `rr.campaign-setup-checklist` stops after step 1 of 8. `rr.scoring` lost step 1. The full scoring rule is under `ltp.ending-a-campaign`.
- 88 of 396 entries are under 80 characters. 145 contain page furniture (page numbers, "photocopy", log labels).

Code that "names the rule id it implements" can therefore name a page of credits.

### 5. Campaign rules are missing from the model

The Learn to Play (p28 to 30) and the Rules Reference (p30 to 31) define campaign play. The brief covers little of it.

- **Campaign Setup Checklist, 8 steps.** Heroes from the log. Fallen heroes replaced. A voluntary hero change adds +1 to the threat penalty. The threat penalty is applied. Permanent cards are attached. Setup boons and burdens are put into play. Player-backed pool cards go into the decks. Encounter-backed pool cards go into the encounter deck. None of this exists. The earned Gandalf's Delay and The Ring Draws Them must reach scenario 2's encounter deck, and they will not.
- **A scoring formula exists:** final threat, plus the threat cost of destroyed heroes, plus damage on surviving heroes, plus 10 per round, minus victory points (Learn to Play, Scoring). The brief says score stays 0 until a formula is cited.
- **Campaign cards print each scenario's setup and resolution.** The Learn to Play says to follow the Setup on the front and the Resolution on the back. Scenario 1's resolution is hand-typed in `data/campaigns/fellowship-of-the-ring.json` `authored.resolution`. The other five resolutions are not "pick one code per group":
  - **Knife (141044):** starting with the first player, each player may choose one of four Permanent boons and attach it to a hero they control.
  - **Flight (141056):** add each burden **in play**, in the encounter deck and in the discard pile. The brief paraphrased the booklet and dropped "in play". The question it left open ("re-read the quest card before deciding the leftovers") is answered by this card.
  - **Ring Goes South (142019):** conditional on Lust for the Ring being attached.
  - **Journey (142039):** choose one of two pairs, or all four if The Balrog is still in play.
  - **Breaking (142060):** a hero with Fallen into Evil attached becomes a fallen hero. The first player chooses a burden. Each player names a captive hero for the Notes.

### 6. The brief paraphrases Breaking of the Fellowship wrongly

Stage 2A (142062) removes the Ring-bearer and its attachments from the game. Stage 2B has each player create their own staging area and advance to a *different* stage 3A of their choice: four distinct stage 3 cards, 142063 to 142066. Each player then moves encounter cards from the shared area to their own. The brief and phase 16 say "places its quest stage 3", and they do not mention the Ring-bearer leaving.

### 7. Coverage counts lines; it does not own them

`scripts/checks/effect-coverage.test.ts` checks that there are at least as many records as segments, and as many per timing as labels. A record for the wrong line passes. A duplicated source line fails. An unlabelled constant ("The players cannot advance while…") is checked only by the count.

### 8. Engine steps do not say why

`EngineStep` (`src/rules/core/intents.ts`) records threat, damage, progress and so on, but not the rule or the record that caused them. A wrong number cannot be traced to its authority without a debugger.

### 9. Starter decks are hand-typed code

(Fixed: the lists are `data/starter-decks.json`, read from the booklet spans; `Restricted` is a parsed keyword, `src/rules/core/keywords.ts`.) `src/screens/starter-decks.ts` held the two lists as TypeScript. The coverage test does not read them. `Restricted` appears in 79 cards (Sting, Glamdring, Andúril, and attachments in the starter decks) and is an unknown keyword token. The engine does not implement it.

## Fundamental changes

These are proposals. Phases 8c and 8d carry them out. Nothing here moves the engine off the phone or adds a parser for English.

### A. A printed-text ledger, checked against card scans

For every card a campaign deals (quest, encounter, campaign, boon, burden, The One Ring) and every starter-deck card, commit the printed text as read from a scan. Add `data/printed/<campaign>.json` with one entry per code and side:

```json
{ "code": "142019", "side": "A", "printing": "TRD", "scan": { "url": "…/The-Ring-Goes-South-SetupA.jpg", "sha256": "…" },
  "lines": ["You are playing Campaign Mode.", "Setup: Each player may change hero cards …"], "readBy": "agent", "confirmedBy": null }
```

- `pnpm data:sync scans` downloads the scans for those codes into `.cache/scans/`, pinned by sha256 in `data/sources.json`. Scans stay out of git.
- An agent reads each scan (agents read images) and writes the lines. A disagreement with Hall of Beorn's text is printed by the build. Each disagreement is either a typo the ledger fixes or a real errata question for the user. `confirmedBy: "user"` records a call the user made. That is how the physical-card check in phase 8 was waived; this makes it a standing mechanism.
- `data:build` uses ledger text in place of the source text for templates, effect drafts, names in Setup text, and coverage. A dealt card with no ledger entry fails `data:check` once its scenario is marked playable.
- Normalize backticks to apostrophes in the normalizer, not by hand.

The scan is the closest thing to the printed card that a session can read. The ledger pins which scan was read.

### B. Line-addressed effects

A ledger line has an id `<code>:<side>:<n>`. `Effect` gains `lines: string[]`, the line ids it implements. Coverage becomes ownership: every line of a dealt card is owned by one or more records, by a keyword the engine implements, or by an explicit `inert` entry in the ledger with a reason (reminder text, "You are playing Campaign Mode."). A record that claims a line on another card fails. This replaces the count checks and fixes the duplicate-line case.

### C. Scenarios assembled from the cards, checked against the aggregators

Today DragnCards' load list is the input, and the quest card's Setup text is the check. Reverse that:

1. The encounter sets come from the booklet's Setup line for the scenario (`mec109.setup-*` spans, finding 4).
2. Quantities per card come from Hall of Beorn's set counts, with the printed Easy marks winning through overrides.
3. Placement comes from running the setup records (the campaign card's front, then quest stage 1A) against that pool, in printed order, inside `buildStart`.
4. DragnCards' load list and Hall of Beorn's per-scenario counts become cross-checks. A mismatch fails the build, and an override says which printed card settles it.

The card text drives the build. The aggregators only check it. Every scenario in the box is then written to `data/scenarios`, and `data:check` fails when one is missing. A scenario that is built but not covered is "built, not playable"; it is never silently absent.

### D. The campaign is cards plus the checklist

- `src/campaign` runs the Campaign Setup Checklist as numbered engine steps, each naming its rule id. Pool cards go into decks, the encounter deck, or play according to their back and keywords. The threat penalty, fallen heroes, and hero changes are in it.
- Campaign card Setup and Resolution are effect records with timings `campaignSetup` and `resolution`, drafted and authored like any other line. `authored.resolution` in the campaign file is deleted. `ChooseResolution` generalizes to the choices those records open: per player, attach to a hero, conditional groups, and naming a hero for the notes.
- `CampaignLog` gains `campaignPool` (code, back, burden set, attachedTo), `threatPenalty`, `captives`, and `rounds` per scenario. `score` is computed by the Learn to Play formula.
- Card facts gain `campaignKind: "boon" | "burden" | null` and `burdenSet`, from the card. Later campaign cards remove burdens by burden set.

### E. Rules as verified spans

Replace the heading heuristic with a curated index, `data/rules/index.json`: `{ id, doc, page, column, from, to }`. `from` and `to` are exact quotes that bound the span. Extraction runs `pdftotext` per column with crop boxes, so columns no longer interleave. `entries.json` is generated from the index. A test asserts that each span is found verbatim on its page. An agent writes the index once per PDF and re-checks it only when a PDF's sha256 changes. The brief's citations are corrected against it, and ids for archery, toughness, scoring and the campaign checklist are added.

### F. Every engine step names its cause

`EngineStep` gains `cause: { rule: string } | { effect: string; line: string }`. A test plays the golden games and fails on a threat, damage, progress, resource, draw or reveal step with no cause, or with a cause that is not a verified rule span or a ledger line. The table's log sheet shows the cause. This is the runtime half of "name the rule you implement".

### G. A save is a seed, an intent log, and a data hash

The brief already keeps an intent log for undo. Make it the save. `saves.activeScenario` stores the seed, the intents, the engine version, and the hash of the scenario data dealt. Loading replays. A changed engine version or data hash drops the in-progress scenario, as today. The replay is the same test the goldens run.

## What stays

The offline in-process engine, the Skia table, the full player pool with inactive text, no parsing of English beyond whole-line templates, the two SQLite files, the booklet reader, and one scenario per slice.

## New order

| Phase | Work | Depends on |
| --- | --- | --- |
| 8c | Printed text and rule spans (A, B, E), scenario 1 and starter cards | 8b |
| 8d | Campaign from cards (C, D, F, G in the engine), all six scenarios built, scenario 1 regenerated | 8c |
| 9 | Starter effects, line-owned, with Restricted | 8c |
| 10 | Campaign shell on the new log | 6, 8d |
| 11 | Scenario 1 table | 5, 9, 10 |
| 12–16 | Scenarios 2 to 6, each with an engine half and a phone half | the previous scenario; the engine half also needs 8d and 9 |

The engine half of a scenario (coverage, a golden game on fixed seeds, win and loss through the reducer) needs no table. It can run beside phases 10 and 11. The phone half waits for phase 11.
