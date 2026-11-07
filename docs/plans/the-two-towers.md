# Plan: The Two Towers data and campaign shell

The Two Towers is the second box of the saga campaign that starts in the Fellowship of the Ring (`docs/plans/scenario-fast-track.md`, Order, Shared prerequisite). This plan has two phases, in the shape of the Dream-chaser and Ered Mithrin ones: phase 61 builds its data, phase 62 gives the app the campaign and carries the Fellowship log into it. Neither makes a scenario playable: `src/campaign/playable.ts` is not touched, and the effects of The Uruk-hai are the A/B that follows. The user approves this plan before any of it is built.

Every fact below was read from the pinned sources in `data/raw/` and the pinned rulebook, never from memory. Candidate texts quoted from Hall of Beorn are candidates: the scan-read ledger is what the build uses (`.claude/rules/authority.md`).

## Open questions found while planning

None of these is decided here. Each is a **Stop and ask the user** item in its phase, and the phase it blocks cannot start (61) or finish (62) before it is answered. Recommendations are marked.

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | A Two Towers card with no Treason of Saruman or Land of Shadow twin would need a code no rule makes collision-free. None exists today (all 156 cards pair); stop if the build finds one. | 61 |
| Q2 | Pile counts. Each scenario reconciles with the rulebook's encounter sets and the DragnCards load, once the rules below are applied. Any count that still disagrees is a stop. | 61 |
| Q3 | Nightmare. The six Two Towers Nightmare decks are already in `data/cards/Nightmare.json` (49 cards) but not in the ledger. Attach them to the six scenarios now (adds 49 cards to the ledger read) or leave them unattached? Recommendation: leave unattached; the A/B does not use them. | 61 |
| Q4 | Easy counts. Hall of Beorn's Easy quantity and DragnCards' `E0C.07` to `E0C.12` disagree where this plan checked (see Easy counts). No scan prints an Easy mark. Confirm that the E0C decks lead, as in Ered Mithrin. | 61 |
| Q5 | A scan the ledger read cannot read, or a card no picture source has, is not guessed. | 61 |
| Q6 | Shape of the continuation. Recommendation: `the-two-towers` is its own campaign and save, and a new save may take in a finished Fellowship save's log. The alternative is one save that holds all eighteen scenarios. | 62 |
| Q7 | What the rulebook leaves open about the Fellowship log: the Ring-bearer Frodo logged as a hero when scenarios 7 to 9 give the first player Aragorn, and whether the Campaign Total carries from the Fellowship's six scenarios. | 62 |
| Q8 | Is a Two Towers save with no Fellowship behind it offered ("fresh"), and what do scenarios 7 to 9 read from an empty log? | 62 |
| Q9 | Is The Two Towers offered standalone? Recommendation: yes, as the Fellowship box is. | 62 |
| Q10 | Where the Journey to the Cross-roads Resolution's "name and quantity of each enemy underneath The Black Gate" is recorded: a structured log fact or the free-text notes. | 62 |

## What the sources say

### The product

- **Product.** The Two Towers Saga Expansion, FFG product MEC112, 2023: 330 cards (6 heroes, 63 player cards, 17 quest cards, 218 encounter cards, 6 campaign cards, 20 boon and burden cards) and six scenarios, numbered 7 to 12 of the saga (rulebook p1, Component Overview). It reprints The Treason of Saruman (RingsDB `ToS`, 2015) and The Land of Shadow (`LoS`, 2015) as one box, as MEC109 reprints The Black Riders and The Road Darkens (`data/raw/ringsdb/packs.json`, cycle 41; Hall of Beorn product names `The Treason of Saruman`, `The Land of Shadow`).
- **Not RingsDB `TTT`.** `TTT` is The Three Trials, an Angmar-cycle pack unrelated to this box (`data/raw/ringsdb/packs.json`). `data/cards/TTT.json` and `src/effects/authored/pool/TTT.ts` stay as they are.
- **Rulebook.** `mec112_rulebook_eng.pdf`, 12 pages, 12216245 bytes, sha256 `793d43e2dd7e0d989d880f32fe9419959ac563ef40e6ae430f9b8fb01bbafbf9`, from `https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mec112_rulebook_eng.pdf`. It is already pinned in `data/sources.json` (source `rules`, `pdf/mec112_rulebook_eng.pdf`) and listed in `RULE_PDFS` (`scripts/data/sources/rules.ts`, doc `mec112`) for its decklist page only (`data/rules/columns.json`, `only: [11]`). `pnpm data:sync rules` downloaded it again during planning and the hash matched. Phase 61 reads the whole book; no new pin is needed.
- **Hall of Beorn sets.** Card set `The Two Towers` (slug suffix `TTwT`; images under `Images/Cards/The-Two-Towers/`) holds the box: 99 encounter rows, 23 quest and campaign rows, 34 player rows (`data/raw/hallofbeorn/EncounterCards.json`, `QuestCards.json`, `PlayerCards.json`). Its rows carry `RingsDbCardId` `00001` to `00155`, which are Core Set codes: the set is uncoded (`UNCODED_SETS`, `scripts/data/normalize/cards.ts`) and takes the code of its twin, as `The Fellowship of the Ring` does.
- **Hall of Beorn scenarios.** `data/raw/hallofbeorn/Scenarios.json`: `The Uruk-hai` 7, `Helm's Deep` 8, `The Road to Isengard` 9 (product `The Treason of Saruman`); `The Passage of the Marshes` 10, `Journey to the Cross-roads` 11, `Shelob's Lair` 12 (product `The Land of Shadow`). The per-scenario snapshots under `data/raw/hallofbeorn/Scenarios/` are written only for `BUILT_PRODUCTS`, so they appear once phase 61 names the two products.
- **DragnCards.** `data/raw/dragncards/preBuiltDecks.json`: `Q0C.07` to `Q0C.12` (Normal) and `E0C.07` to `E0C.12` (Easy), labelled with the six titles, load these scenarios from cards of pack `The Treason of Saruman` and `The Land of Shadow`. `Q0B`/`E0B` also list the six scenarios and are not used (the Fellowship boxes use `Q0C`); `N0B`/`N0C` are Nightmare decks.
- **The existing decklists.** `data/prebuilt-decks.json` already resolves `ents-and-friends` and `king-of-rohan-rides` (spans `decklist.mec112-ents-and-friends`, `decklist.mec112-king-of-rohan`, sets `The Two Towers`, `The Fellowship of the Ring`, `Revised Core Set`) to codes 143xxx and 144xxx in `data/decks/prebuilt.json`. They stay byte-identical.

### Card codes

The twin codes are RingsDB's: ToS is `143001` to `143068` and LoS `144001` to `144076` in Hall of Beorn's two original sets (81 and 75 rows; `RingsDbCardId`). All 156 `The Two Towers` rows pair with exactly one twin by title and type, with equal counts per title, so every card takes its twin's code. Checked against every `data/cards/*.json`: none of the 156 codes exists outside `ToS.json` and `LoS.json`. The other saga cycle-41 boxes use `145` (The Flame of the West) and `146` (The Mountain of Fire), and the Fellowship uses `141` and `142`, so no prefix is shared.

- **Collision.** None. The Fellowship's rule for a twinless MEC109 card (`14`, `0`, collector number: `140077`, `140151`, `data/overrides.json`, `cards`) shares the `140` prefix with the Fellowship's own codes, so it cannot be reused for this box. There is no such card here; see Q1.
- **Existing records.** `data/cards/ToS.json` (22 cards) and `data/cards/LoS.json` (16) already hold the RingsDB player cards, boons and burdens under these codes (`143001` Aragorn, `143021` Poisoned Counsels, `143068` Saruman's Voice, `144001` Frodo Baggins, `144015` The Searching Eye, `144052` A Heavy Burden). Phase 61 adds the encounter, quest and campaign cards to those two files and a `TTwT` printing to every card; the player cards' fields do not change.
- **The pack code `TTwT`.** MEC112 is not a RingsDB pack. The catalog pack code `TTwT` is Hall of Beorn's slug suffix, as `TFotR` is the Fellowship's. It is the only invented code; `PACK_CAMPAIGN` derives from the product rows.

### The scenarios, in order

Encounter sets are the rulebook's lists (p6 to p10, "built with all the cards from the following encounter sets"); quantities are Hall of Beorn's card rows by set (`EncounterInfo.EncounterSet`, `Quantity`); the pile columns are DragnCards' `Q0C.nn` load groups.

| # | Scenario id | Campaign card | Encounter sets (rulebook) | Quest cards | DragnCards load (Normal) |
| --- | --- | --- | --- | --- | --- |
| 7 | `the-uruk-hai` | 143071 | The Uruk-hai (24), Orcs of the White Hand (8), Snaga Orcs (5) | Follow the Orcs, Rescue the Captives | staging: To Isengard!, Uglúk; quest 2; encounter 34; active location Eastemnet; hero ☺ Aragorn |
| 8 | `helms-deep` | 143077 | Helm's Deep (37), Orcs of the White Hand (8) | five stages, King of the Golden Hall to The King Rides Out | staging 4 Soldier of Isengard and 4 Poisoned Counsels; quest 5; encounter 35; set aside The Defense of Helm's Deep and 1 Deeping Wall; hero ☺ Aragorn |
| 9 | `the-road-to-isengard` | 143081 | The Road to Isengard (36), Snaga Orcs (5) | Rouse the Ents, Breaking Isengard, The Voice of Saruman | staging 4 Ent of Fangorn; quest 3; encounter 33 (includes Saruman's Voice); set aside Gates of Isengard, Orthanc, Saruman, Saruman's Staff; hero ☺ Aragorn |
| 10 | `the-passage-of-the-marshes` | 144067 | The Passage of the Marshes (34), Gollum (4 rows), Morgul Nazgûl (4) | The Taming of Sméagol, Across the Marshes, Don't Look at the Lights! | staging Sméagol; quest 3; encounter 36; set aside 4 The Searching Eye; heroes Frodo Baggins, The One Ring |
| 11 | `journey-to-the-cross-roads` | 144069 | Journey to the Cross-roads (31), Men of Harad (9) | Ambush the Men of Harad (one stage) | staging The Black Gate, The Cross-roads; quest 1; encounter 29; second deck 9 (Men of Harad); set aside 4 Brace of Coneys; Frodo Baggins, The One Ring |
| 12 | `shelobs-lair` | 144073 | Shelob's Lair (26), The Great Spider (10), Gollum (4 rows), Morgul Nazgûl (4) | The Stairs of Cirith Ungol, The Spider's Pass, Gollum's Betrayal | staging A Heavy Burden, Sméagol, Sméagol's Secret Way; quest 3; encounter 27; second deck 10 (The Great Spider); set aside Cleft of Cirith Ungol, Shelob; active location Morgul Vale; Frodo Baggins, The One Ring |

Ids follow `scenarioSlug` (`scripts/data/campaign-defs.ts`). The campaign cards are the twins' `QuestCards.json` rows of type `Campaign` (codes in the table; the `TTwT` rows are numbers 28, 47, 67, 90, 106, 122, slugs `<Title>-Campaign-TTwT`). The quest, encounter and campaign cards are 17 quest stages and 6 campaign cards, matching the rulebook's counts. The 218 encounter cards are the 219 Hall of Beorn rows less one, because Gollum and Sméagol are the two sides of one card.

Boons and burdens (20 cards): boons Intimidation, Hands of a Healer, Forewarned, Leader of Men, Beyond All Hope, Palantír of Orthanc (1 each) and Brace of Coneys (4); burdens Poisoned Counsels (4, burden set Helm's Deep), Saruman's Voice (1, The Road to Isengard), The Searching Eye (4, The Passage of the Marshes) and A Heavy Burden (1, Shelob's Lair).

### The first player's saga hero

Rulebook p2: setting up The Uruk-hai, Helm's Deep or The Road to Isengard, the first player takes control of ☺ Aragorn (`143001`); setting up The Passage of the Marshes, Journey to the Cross-roads or Shelob's Lair, the first player takes control of a ☺ hero with the Ring-bearer trait and attaches The One Ring (`144063`, the Two Towers print; the Fellowship's is `141085`). Players cannot use any ally or hero titled Saruman, Gríma or Sméagol in any of the six scenarios (p2). Only one ☺ hero may be in play; ☺ Aragorn does not count against the hero limit, has "The first player gains control of Aragorn" and loses the game if he leaves play (p3).

## How the Fellowship log carries into The Two Towers

Rulebook p4 and `data/rules/learn-to-play.md` (Campaign Mode, The Fellowship of Heroes) say the six scenarios are played "as part of ... the campaign they began in The Fellowship of the Ring Saga Expansion", and MEC113 (The Return of the King) says its scenarios "are played after completing The Two Towers". The Fellowship rulebook says the campaign "combines all 18 of the scenarios from the three ... saga expansions into one epic adventure" (`data/rules/mec109.md`, Campaign Mode).

What the Two Towers cards read from the log (the six campaign cards are Hall of Beorn candidates; the ledger decides their text):

- **Heroes and fallen heroes.** Rulebook p4, Campaign Mode Rules - Aragorn: when a scenario features ☺ Aragorn and a player recorded Aragorn as a hero in the log, that player loses control of that version and may choose another hero without the +1 threat penalty, records it, and moves any Permanent card from the old Aragorn to ☺ Aragorn. If Aragorn was on the list of fallen heroes he is removed from it and each player takes a permanent +1 threat penalty. The Uruk-hai's Resolution lets a player take a hero off the list of fallen heroes (Beyond All Hope) and drop heroes from the log down to three non-Fellowship ones.
- **Captives.** The Uruk-hai stage 1A: "If playing campaign mode, choose each captive from the Campaign Log instead". The Fellowship's Breaking Resolution records one captive per player in the log (`CampaignLog.captives`).
- **Campaign pool and burden sets.** The Uruk-hai Setup removes Gildor Inglorion and Mr. Underhill from the pool, and removes from the encounter deck each burden of the burden sets A Shadow of the Past, Flight to the Ford and The Ring Goes South. Scenarios 10 to 12 remove the burdens of Helm's Deep and The Road to Isengard from the encounter deck and each player's deck. The pool entries carry `burdenSet` and `attachedTo` (`docs/brief.md, Campaign`).
- **Threat penalty.** Scenarios 8 and 10 let each player change heroes without the +1 penalty; scenario 10's Resolution has each player take a permanent +2 starting threat penalty or earn The Searching Eye, recorded in the log per player.
- **Notes.** The Journey to the Cross-roads Resolution records "the name and quantity of each enemy underneath The Black Gate in the notes section".

What the log does today (`docs/brief.md, Campaign`, `docs/brief.md, Mirkwood campaign cards and carry-over`): one `CampaignLog` type; one save is one campaign; within a campaign nothing is carried, and a new save of any campaign may take in only the pool cards a finished save's Resolutions marked `carryOver` (`src/campaign/carry-over.ts`). The brief also says "The log shows the six Fellowship rows. Later saga rows are added from each later booklet ... The next box must not invent a second log type." Phase 62 keeps the one log type.

## Phase 61: The Two Towers data

Depends on: phase 60 (the pipeline it extends). Blocks: phase 62.

### Goal

The data pipeline builds the `the-two-towers` campaign from The Treason of Saruman and The Land of Shadow (twins of the MEC112 box) and the rulebook MEC112: six scenario files, six campaign cards, the box's cards with their ledger, and a campaign file. Data only: nothing is playable, no screen changes, and every other campaign's data is byte-identical. `data/campaigns/index.json` already lists `the-two-towers` as locked with six scenarios (`data/overrides.json`, `campaigns`); the entry becomes a built campaign with the same fields, and the override entry is removed.

### Network order

`pnpm data:sync hallofbeorn rules`, then `pnpm data:build`, then `pnpm data:sync scans pictures`, then the ledger read, then `pnpm data:build` again (the build reads the ledger), then `pnpm data:check` (`CLAUDE.md`, Data).

### Steps

1. **Sources** (`scripts/data/campaign-defs.ts`).
   - Two `PRODUCTS` rows: `The Treason of Saruman` (twin pack `ToS`) and `The Land of Shadow` (twin pack `LoS`), `packs: ["TTwT"]`, `home: "the-two-towers"`, `load: "dragncards"`, `easySheet: false`, as the Black Riders and Road Darkens rows are. DragnCards files each side of Gollum / Sméagol as a row of one guid (`sidedDragnRows`); set it if the build needs it.
   - A `the-two-towers` `CampaignDef`: the six `ScenarioDef`s of the table, `setupSpan: mec112.setup-<id>`, no `deck` key (the build finds `Q0C.07` to `Q0C.12` by label, which equals each Hall of Beorn title), `bookletId: "the-two-towers"`, `bookletDoc: "mec112"`, `saga: true`, no `xp`, `ledger: "the-two-towers"`. It goes last in `CAMPAIGNS`, so `index.json` keeps its order.
   - Generalize the Fellowship-only code to one reprint set per saga box: `ProductDef` names its reprint set and pack (`The Fellowship of the Ring`/`TFotR`; `The Two Towers`/`TTwT`), so `TFOTR` and `printingOf("TFotR")` in `scripts/data/normalize/cards.ts`, `pairTwins`, the `"TFotR"` checks in `scripts/data/printed/scope.ts` (the MEC109 scan first, the box's Ring-bearer), `PRODUCT_OF_PACK` in `scripts/data/sources/pictures.ts` and the default owner `"fellowship-of-the-ring"` in `scripts/data/effects/generate.ts` read the product. Twins pair within their own reprint set: a title in both boxes (Aragorn, Frodo Baggins, The One Ring, Gollum) must not cross. The Fellowship output stays byte-identical.
   - `scripts/data/rules/spans.ts`: the span-id regex admits `mec112`. `RULE_PDFS` keeps its entry; its comment says the box's setup pages and campaign rules are read.
2. **Cards.**
   - Pair each `The Two Towers` row with its twin, take the twin's code, and add a `TTwT` printing with the Hall of Beorn scan URL. `data/cards/ToS.json` and `LoS.json` change; no other cards file does. Check that no code appears in another `data/cards` file (Q1).
   - Gollum / Sméagol is one physical card with two Hall of Beorn rows (`144075` Gollum, `144076` Sméagol) and one DragnCards guid. Represent it as the Haldan / Woodmen Village precedent does (`takeControlFaceup`, `docs/brief.md, Ered Mithrin`), so the dealt side is the side the Setup names: Gollum in scenario 10, Sméagol in scenario 12.
   - Boons, burdens and `campaignKind`, `burdenSet` follow the Fellowship: the burden sets above are Hall of Beorn's `EncounterSet` of each burden; the ledger confirms the icons (the Fellowship needed `data/overrides.json` entries where Hall of Beorn's set was wrong).
   - Where DragnCards spells a name differently (set `Nazgûl` for `Morgul Nazgûl`; `Smeagol`, `Orc of Citith Ungol`, `We Hates Them`, `Across the Dead Marshes`), the build matches by guid and pack number first; add `dragnCardCodes` or `encounterSetAliases` entries only for the names the build reports unmatched, each with its reason.
   - The `The Passage of the Marshes | Rules` row in `Q0C.10`'s set-aside group is not a card; it is left out.
3. **Scenarios.**
   - `groups` map each scenario's `sharedEncounterDeck2` to a pile that is not the default burden deck: `Q0C.11`'s nine Men of Harad cards are shuffled and placed under The Cross-roads by the Setup, and `Q0C.12`'s ten Great Spider cards are set aside by it. Add the piles (`haradDeck`, `greatSpiderDeck` or the names the implementer picks) to `PILES` in `src/catalog/scenario-data.ts` with its tests, and to `EXTRA_DECKS` in `scripts/data/normalize/scenarios.ts`, as the Ered Mithrin decks are.
   - Boons and burdens in a load group (Poisoned Counsels and Soldier of Isengard in `Q0C.08`'s staging group, Saruman's Voice in `Q0C.09`'s encounter group, The Searching Eye in `Q0C.10`'s set-aside group, Brace of Coneys in `Q0C.11`'s, A Heavy Burden in `Q0C.12`'s staging group) are the campaign's: the campaign card's Setup deals them, so the standalone piles exclude them, as the Fellowship's do. `Q0C.08`'s four Soldier of Isengard are the copies each player sets aside (Setup: "Each player sets 1 copy of Soldier of Isengard aside").
   - The first player's saga hero is `player1Play1`: ☺ Aragorn in scenarios 7 to 9, Frodo Baggins and The One Ring (`144063`) in 10 to 12. A campaign file's `prelude` is the first scenario's player-1 play area today (the Fellowship's One Ring), which would be Aragorn here. Record the saga hero per scenario instead (a scenario-data field, such as `sagaStart`: a hero code or the Ring-bearer with its attachment) and leave the campaign's `prelude` empty. Phase 62 reads it.
   - Easy counts come from the `E0C` decks. Hall of Beorn's Easy quantity disagrees with them where this plan checked: `E0C.07` omits Grishnákh (Hall of Beorn Easy 0, which it also gives The Wold, kept 3 times in `E0C.07`). Settle a disagreement with `scenarioEasy` and its reason, as Dream-chaser did (Q4).
   - Normal counts. Counting each double-sided card once and the burdens the campaign card deals, the DragnCards load groups equal the rulebook's sets and Hall of Beorn's rows for all six scenarios (7: 37 encounter cards; 8: 45; 9: 41; 10: 41; 11: 40; 12: 43). A disagreement left after the rules above is Q2.
   - The Nightmare decks (`scripts/data/nightmare-defs.ts`, rows 9067 to 9072) have no `scenario` field and stay unattached unless Q3 says otherwise.
   - `scripts/data/build.ts` writes `data/campaigns/the-two-towers.json`, six `data/scenarios/*.json` and `src/effects/generated/the-two-towers.ts`.
4. **Setup parser** (`scripts/data/normalize/setup-text.ts`). The six campaign cards' and the first stage 1A Setup sentences, quoted from the ledger. Hall of Beorn's candidates:
   - "Remove Gildor Inglorion and Mr. Underhill from the Campaign Pool"
   - "Remove each burden with the following burden set icons from the encounter deck [and each player's deck]: <sets>"
   - "Each player may change hero cards he controls without incurring the +1 threat penalty"
   - "Shuffle Saruman's Voice into the encounter deck"
   - "Each player shuffles 1 copy of The Searching Eye into his deck"
   - "Each player must choose: either add 1 resource to each of his heroes' pools, or shuffle 1 copy of Brace of Coneys into his deck"
   - "Attach A Heavy Burden to the Ring-bearer"
   - 1A: "Make Eastemnet the active location (Hall of Beorn prints Estemnet; the scan decides). Add Uglúk and To Isengard! to the staging area. Each player chooses 1 non-Fellowship hero ... Captive ... underneath To Isengard! (If playing campaign mode, choose each captive from the Campaign Log instead). Set the pursuit value to 10"; "Set The Defense of Helm's Deep and 1 copy of Deeping Wall aside"; "Each player sets 1 copy of Soldier of Isengard aside ... either each player shuffles 1 copy of Poisoned Counsels into his deck, or advance to stage 2A"; "Set Gates of Isengard, Orthanc, Saruman, and Saruman's Staff aside ... Add each copy of Ent of Fangorn to the staging area"; "Put Gollum into play engaged with the first player. Each player searches the encounter deck for 1 location"; "Add The Black Gate and The Cross-roads to the staging area. Shuffle the Harad encounter set and place it facedown under The Cross-roads. Each player, except for the first player, searches the encounter deck for a different non-unique location"; "Set Cleft of Cirith Ungol, Shelob and The Great Spider encounter set aside ... Put Sméagol into play under the first player's control. Make Morgul Vale the active location".
   - `pnpm data:build -- --verbose` lists every sentence no pattern reads and every failed cross-check; none may remain for the six scenarios.
5. **Rules.** `data/rules/columns.json` replaces the `mec112` entry (`only: [11]`) with the column boxes of pages 1 to 11 (the rulebook prints two columns and art-overlaid text on p3 to p5; the boxes are hand-checked), keeping the decklist spans' text identical. `data/rules/index.json` gets hand-checked spans: `mec112.setup-<id>` (six), `mec112.setting-up-the-game`, `mec112.saga-staging-rules`, `mec112.saruman-grima-smeagol`, `mec112.the-fellowship-sphere`, `mec112.fellowship-sphere-heroes`, `mec112.aragorn`, `mec112.the-one-ring`, `mec112.multiplayer-the-one-ring`, `mec112.campaign-mode`, `mec112.campaign-mode-aragorn`, `mec112.gollum-smeagol`, `mec112.poisoned-counsels-searching-eye`, `mec112.pursuit`, `mec112.defense`, `mec112.wizardry`, `mec112.mire`, `mec112.saga-expansion-rules`, `mec112.saga-expansion-player-cards`, and the keywords the book repeats (`archery`, `immune-to-player-card-effects`, `indestructible`, `peril`, `permanent`, `setup`, `toughness`). `data/rules/mec112.md` and `entries.json` are rebuilt. `scripts/data/rules.test.ts` asserts the page count (12), the six setup spans' set lists, and one quoted sentence for each of the new rules. Rule wording comes from `pnpm data:query`, never from memory.
6. **Ledger.** `data/printed/the-two-towers.json`, read by an agent from the pinned scans (`data/printed/fellowship-of-the-ring.json` and its `conventions` give the format).
   - Order: `pnpm data:build`, `pnpm data:sync scans pictures`, then the read.
   - Scope (`scripts/data/printed/scope.ts`): every card the six scenarios deal on both difficulties, the six campaign cards (both sides), the quest stages (both sides), the boons and burdens, `143001` Aragorn, `144001` Frodo Baggins, The One Ring `144063`, and the box's cards the two decklists hold. Each entry records `readBy` and the scan's sha256. The scan is Hall of Beorn's `TTwT` picture first, then the twin's, as MEC109 is first for the Fellowship. A card whose 2023 wording differs from the 2015 one is listed (`MEC112_CHANGED` beside `MEC109_CHANGED`); Hall of Beorn's `TTwT` front text, keywords, stats, shadow and quantity equal the twins' for all 156 pairs, so only the scans can show a reworded line.
   - Wire it: `src/catalog/printed-ledger.ts` imports the file and `scope.ts` takes the campaign's scope.
   - `pnpm data:sync pictures` runs on every new card; `scripts/data/sources/pictures.test.ts` fails otherwise. A card no picture source has goes on that test's exception list only after the user says so (Q5).
7. **Tests.** Generalize `scripts/data/{scenarios,campaigns,printed,cards}.test.ts`, `catalog-exit.test.ts` and `build/catalog.test.ts` for a sixth campaign: `campaigns.test.ts` now expects only The Return of the King locked; a saga test for the new campaign (no starter decks, saga, its booklet); a test that the 156 codes have no twin collision. Existing assertions stay.
8. **Effects tooling.** `src/effects/index.ts` imports `generated/the-two-towers.ts`; `scripts/data/effects/{generate,draft}.ts` and the authored barrel read the fifth campaign's files. The box's player cards move from `generated/player-pool.ts` to the new file (`boxOwners`); the merged effect list stays the same for every other campaign. `src/effects/authored/pool/ToS.ts` and `LoS.ts` keep their records. The scenario files `src/effects/authored/<scenario-id>.ts` come from `pnpm scenario:new` in the later phases.

### Exit

- `pnpm data:build` and `pnpm data:check` green and deterministic; `pnpm data:build -- --verbose` shows no failed cross-check and no unread Setup sentence for the six scenarios.
- The ledger is read from the scans with `readBy` and each scan's sha256; `pnpm data:sync scans pictures` has run and every new card has a picture pin.
- Every other campaign's data, goldens and fixtures are byte-identical; `data/campaigns/index.json`, `data/decks/prebuilt.json` and `data/cards/` other than `ToS.json` and `LoS.json` do not change.
- `pnpm effects:open` lists the new cards' lines; `pnpm catalog:build`, with `src/catalog/version.ts` committed if it changed.
- No Two Towers scenario is in `PLAYABLE_SCENARIOS`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green, and `pnpm vitest run scripts/docs` after `pnpm docs:index`. One review round (`.claude/agents/orchestrator.md`, One review round).

### Stop and ask the user

- **Code collision (Q1).** The build finds a Two Towers card with no ToS/LoS twin, or two cards with one code. The Fellowship's twinless rule collides, and no other collision-free rule exists in `data/overrides.json` (`productCodes`) for a saga box.
- **Pile counts (Q2).** Any scenario's pile count disagrees with the rulebook's encounter sets or the quest's Setup after the rules in step 3. Do not settle it with an override the printed card cannot justify.
- **Nightmare (Q3).** Whether to attach the six decks.
- **Easy counts (Q4).** `E0C` and Hall of Beorn disagree and no printed source decides, or an `E0C` deck removes nothing from its scenario (as `E06.8` did).
- **Unreadable scan or missing picture (Q5).** A scan the agent cannot read; a card no picture source has.
- **Anything else a source leaves open**, including a printed line the ledger reads that contradicts the rulebook (the rulebook, the quest card and the campaign card win).

## Phase 62: The Two Towers campaign shell

Depends on: phase 61, and the answers to Q6 to Q10. Blocks: the A/B on The Uruk-hai (`docs/plans/scenario-fast-track.md`, Order).

### Goal

The app knows The Two Towers: it is on the campaign list and the Scenarios tab (one box, `the-two-towers`, six scenarios), opens its booklet (MEC112), applies its saga setup per scenario and its loadout bans, and a new save of it may take in a finished Fellowship save's log (heroes, fallen heroes, captives, pool, threat penalty, notes) while the Fellowship save stays as it was. No scenario is playable.

### Shape (recommendation, Q6)

`the-two-towers` is its own campaign and save, as its entry in `data/campaigns/index.json` already is, with the one `CampaignLog` type. Starting it offers "Continue the saga" for each finished Fellowship save that no other save continued (`log.carriedFrom`, as `carryOffers` records a taken offer), copying the log columns above onto the new save's log with `completed`, `earned`, `scenarios` and `score` empty. The alternative, one save whose scenario list grows with each box, changes the Fellowship's campaign file, its goldens, its end-of-campaign screen and its six-scenario count, and `the-return-of-the-king` would have to follow it. The offer reaches the Start screen only once the campaign is `playable` in the index; until then the code is covered by tests.

### Steps

1. **Registry.** `src/screens/data/campaign-data.ts`: the campaign, six scenarios, one box `the-two-towers` (`saga: true`); `campaignIds`, the Scenarios-tab section, `start-the-two-towers`, the registry test against `data/campaigns/index.json` (`campaign-data.test.ts` stops treating The Two Towers as unbuilt; `list.test.ts` likewise); `scripts/build/catalog.ts` and `PACK_CAMPAIGN`. `src/campaign/playable.ts` is unchanged.
2. **Booklet.** `BOOKLETS` id `the-two-towers` (`src/screens/booklets/books.ts`), a `BOOKLET_SOURCES` row (`scripts/build/pack-booklets.ts`) bundling the pinned MEC112 file, `assets/booklets/bundled-map.ts`, `src/screens/rules/glossary.ts` (`DOC_NAMES`, `BOOKS`, the `mec112.setup-` filter), the `src/screens/rules/view.tsx` tile and `BOOK_SCENE`.
3. **The saga start per scenario.** The campaign file carries the first player's saga hero per scenario (phase 61): scenarios 7 to 9 give the first player ☺ Aragorn (143001), who does not count against the hero limit, so the Ring-bearer slot is not asked; scenarios 10 to 12 ask the Ring-bearer slot and attach The One Ring (144063). `src/campaign/briefing.ts` (the slot is asked "only in a saga campaign"), `loadout.ts`, `start.ts`, `checklist.ts` and `standalone.ts` read the per-scenario value instead of `campaign.saga` alone; the Fellowship, whose six scenarios all use the Ring-bearer, behaves as before. The Ring-bearer rules stay stated in `docs/brief.md, Fellowship of the Ring`, and a new section states Aragorn's.
4. **Loadout** (`src/campaign/loadout.ts`).
   - No ally or hero titled Saruman, Gríma or Sméagol in any of the six scenarios (`mec112.saruman-grima-smeagol`); a title ban beside `HERO_BANS`, with the reason in the error.
   - One ☺ hero at a time and no other version of that hero in the deck (`mec112.fellowship-sphere-heroes`), for Aragorn as it is for Frodo today.
5. **Campaign log** (`src/campaign/log.ts`; Zod with defaults, so old saves load). Columns follow the card texts the ledger confirms:
   - a per-seat extra threat penalty, for scenario 10's "each player ... permanent +2 starting threat penalty" (`CampaignLog.threatPenalty` is one number for every player today, as `docs/brief.md, Campaign`, says; that line is rewritten in this phase);
   - the per-player choice scenario 10 records between that penalty and The Searching Eye;
   - the Black Gate enemies of scenario 11 as a structured fact, if Q10 says so;
   - `carriedFrom` on a continued save, as an offer already uses it.
   The carry copies `heroesBySeat`, `fallenHeroesBySeat`, `threatPenalty`, `campaignPool` (with `burdenSet` and `attachedTo`), `captives` and `notes`; it never edits the Fellowship save.
6. **Continuation** (`src/campaign/carry-over.ts` or a sibling, pure). Offers each finished Fellowship save not continued; the new save takes its `seatCount`, since a log is per seat (the seat count is chosen once). Q7, Q8: the Ring-bearer entry and a fresh start follow the answers.
7. **Campaign verbs.** The six campaign cards' lines as effect verbs, in a campaign-family file run by Setup and Resolution; nothing here uses a verb a record does not yet use, so `ENGINE_VERSION` moves only in the first phase whose records use one:
   - remove named pool cards (`RemoveFromPool` exists in `src/catalog/families/wilderland.ts`) and remove the burdens of named burden sets from the encounter deck and each player's deck (new);
   - Beyond All Hope: a player takes a hero off the list of fallen heroes and drops heroes from the log down to three non-Fellowship ones, with no +1 penalty (new);
   - the Aragorn rule of rulebook p4 at the start of a scenario with ☺ Aragorn: the logged Aragorn's player loses control and picks another hero without a penalty, Permanent cards move, a fallen Aragorn leaves the list and each player takes +1 (new);
   - `WaiveThreatPenalty` for scenarios 8 and 10 (exists in `src/campaign/briefing.ts`);
   - the scenario 7 captives read from `log.captives` (the quest's "choose each captive from the Campaign Log").
8. **Screens.** The path and log show the new columns; Resolution choices (the skill boons or Beyond All Hope; the Searching Eye or +2) are made on the existing resolution screen; no control types a number.
9. **Docs.** `docs/brief.md` gains a "The Two Towers" section in the same commit as the rules it states (saga start per scenario, Aragorn's campaign rule, the carry from the Fellowship log) and its Campaign paragraph about later saga rows is rewritten to the answer to Q6; `docs/design-system.md` where a screen changes. `pnpm docs:index` follows.
10. **Versions.** The catalog version bumps if a column changes; `drizzle/` only if a column does. No `ENGINE_VERSION` bump unless a record uses a verb.
11. **Tests and flows.** Registry; loadout (title bans, Aragorn); log round trip and old-save load; continuation from a finished Fellowship log (heroes, fallen, captives, pool kept, Fellowship save unchanged, one offer per Fellowship save); the Aragorn rule; per-scenario saga start in the briefing. Flows: `.maestro/features/the-two-towers-start.yaml`, `.maestro/features/booklet-the-two-towers.yaml`, `.maestro/features/scenarios-boxes.yaml` updated. A cloud session has no Maestro and the phone checks are not tracked (`.claude/rules/code-standards.md`, Checking a change).

### Exit

Every other campaign's goldens unchanged and green, new tests green, `pnpm lint`, `pnpm typecheck` and `pnpm test` green; `pnpm catalog:build` with `src/catalog/version.ts` committed if it changed. One review round (`.claude/agents/orchestrator.md`, One review round; `ux` too: `src/screens` changes).

### Stop and ask the user

- **Shape (Q6).** Confirm the separate campaign and save, or choose one save for all eighteen scenarios.
- **Open in the rulebook (Q7).** (a) Scenarios 7 to 9 give the first player ☺ Aragorn, a ☺ hero, and only one ☺ hero may be in play, while the Fellowship's log has the Ring-bearer Frodo as a hero and the Breaking of the Fellowship removed him from the game: the rulebook does not say whether Frodo stays on the log's hero list for 7 to 9 and returns for 10 to 12, or leaves it. (b) The Campaign Log has one Campaign Total; the rulebook does not say whether the Fellowship's six scores are in the total of a continued save, or each box starts at zero.
- **Fresh start (Q8).** Whether a Two Towers save may start with no Fellowship behind it, and what scenarios 7 to 9 do with no captives, no pool and no recorded Aragorn. The sources only say the box is played "as part of" the saga.
- **Standalone (Q9).** Whether The Two Towers is offered standalone. The rulebook allows it ("players can still play the scenarios as standalone adventures"), as MEC109 does for the Fellowship, whose standalone rules are in `docs/brief.md, Standalone play`, and the recommendation is yes: with no campaign card, no boons or burdens and the per-scenario saga start.
- **The Black Gate record (Q10).** Structured fact or the notes; no later box in the pinned sources reads it (MEC113's rulebook does not mention it), so the choice is only whether the app stores a list.
- **Per-player threat penalty.** If the ledger-read text of The Passage of the Marshes' campaign card is not per player, the per-seat column is dropped.
- **Anything else the rulebook leaves open** about what the Fellowship log carries.

## Notes for the orchestrator

- Phase 61 and phase 62 are two implementer tasks in that order, each with the one review round. The data phase is mostly network and reading; the ledger read from the scans is its own agent task, run after `pnpm data:sync scans pictures`.
- The Fellowship's twin pairing is the one place whose generalization can move existing data: run `pnpm data:check` after step 1 before touching anything else, and stop if a Fellowship file changes.
- `data:sync hallofbeorn rules` refreshes `fetchedAt` in `data/sources.json` and nothing else when the sources are unchanged; commit it only with the data it describes.
