# Middle Earth LCG — decisions and implementer brief

This is the source of truth for the app. Read it before writing code. It records what was decided and how to build it.

Authority, in order:

1. The MEC109 booklet, the quest cards and the campaign cards win on a rule; the core-set Learn to Play wins on the ordinary round and on campaign play; the Rules Reference wins on definitions. A card's text is what is printed on it. From phase 8c that is the ledger in `data/printed/`, read from a pinned scan; Hall of Beorn and DragnCards text is a candidate the build checks against it (`docs/plans/authoritative-data.md`). Their text is in `data/rules/` and split into rule ids in `data/rules/entries.json` (`pnpm data:query "select id, title from rules where text like '%surge%'"`). Code and tests name the rule ids they implement. When a rule changes, change the code, the test, and this file in the same commit.
2. This file, for product shape, stack, and the build order. Structure is in [architecture.md](architecture.md).
3. `data/` for cards, scenarios and rules text. Where it came from is in `data/sources.json`; where a source was wrong is in `data/overrides.json`, each with a reason.

Do not reopen the product shape unless a decision below is impossible.

Performance is a product requirement. A hitch under a finger is a failed step, the same as a wrong threat number. The section Performance and feel is binding on every screen.

The app applies the rules. Keywords, phases, effects, damage, resources, threat, and progress are engine results. The player chooses among options those rules currently allow, and cannot type the results.

The proof of concept is playable when a person can install the app on a phone, build a deck from the full official player-card pool with no network, play **A Shadow of the Past** through its campaign resolution with the dealt cards automated, and see the chosen boon and burden on the campaign log with **A Knife in the Dark** unlocked.

## Product

A personal, offline, single-device app for The Lord of the Rings Living Card Game. Official campaigns are the product. The first campaign is the 2022 **Fellowship of the Ring Saga Expansion** (FFG product MEC109). Later official campaigns are added as more content in the same app.

One human. No accounts, no rooms, no matchmaking, no server in the play loop. True solo is one local seat. Two-handed solo is two local seats on the same phone, because staging and engagement are defined per player. That is not multiplayer. The paper log has Player 3 and Player 4 columns. This app does not. `seatCount` is 1 or 2, chosen once at campaign start.

The app opens on the campaign list, not on a blank table. Deckbuilding is a separate root screen and is available before any scenario is won. The dock under the root screens is Campaigns, Scenarios, Decks, Cards and Rules (user request, 2026-10-25): the campaign list, standalone play, the deck list, the card pool, and the rules to look up between turns.

The booklet allows playing a scenario as a standalone adventure (`mec109.campaign-mode`: "players can still play the scenarios as standalone adventures if they choose"). The app has it: a Scenarios tab beside the campaign list deals any playable scenario of the box on its own, with no campaign mechanics (Standalone play, below). User decision 2026-10-25, replacing "out of scope until the campaign path is done"; the Scenarios tab lists one section for each box the app plays: the Fellowship of the Ring, the Revised Core Set (Passage Through Mirkwood, Journey Along the Anduin, Escape from Dol Guldur) and The Dark of Mirkwood (The Oath, The Caves of Nibin-Dûm), see Mirkwood Paths and The Dark of Mirkwood, below.

This brief assumes a personal, unpublished app. A public store listing is a different copyright situation and is not decided here. Do not start one.

## Non-goals

Do not do any of these.

- Do not port DragnLang, Phoenix channels, GenServers, or the generic pile engine. The DragnCards plugin's data (card database, scenario load lists, framework steps, automation snippets) is a source for `data/`, fetched by `pnpm data:sync`; the app never calls it at runtime.
- Do not build a rules language for other card games.
- Do not add accounts, auth, Patreon, image hosting, or a backend.
- Do not restrict the deck builder to cards that have automated effects, or to cards printed in the Fellowship box.
- Do not include ALeP, playtest, or Nightmare cards. Easy and Normal counts only. Easy Mode also puts 1 resource on each hero during setup (`easy-mode.easy-mode`).
- Do not commit card scans, booklet PDFs, or `catalog.db`. `data/` holds card text, rules text and raw source snapshots on purpose, so every session has them. The card text, art and rules belong to FFG/Asmodee; if this repo is ever made public, that is a legal exposure to revisit first. The phone receives `catalog.db` inside the binary. The release build also carries the four booklet PDFs (the Fellowship campaign book, the Learn to Play, the Rules Reference, The Dark of Mirkwood rulebook): `pnpm booklets:pack` (run by `eas-build-post-install`) copies each pinned PDF from `.cache/pdf`, or fetches it from its pinned URL and checks the sha256 in `data/sources.json`, with a map that requires them into `.cache/booklets/` (gitignored); Metro bundles that map in place of the empty stub `src/screens/booklets/bundled-map.ts`. `pnpm data:sync rules` and `pnpm android` pack too. The app never fetches a booklet at runtime. A build without them still lets the player add each PDF from their files.
- Do not paste the MEC109 narrative prose into screens. Encode procedures. Short original labels are fine ("Hide test", "Ring-bearer's life").
- Do not ship a WebView of any existing card-table site.
- Do not build a collection tracker, an encounter-card deck editor, or a second game.

## Decisions

| Decision | Why |
| --- | --- |
| Expo app, one package, no monorepo | One person, one binary. A second package adds a build graph with nothing to share yet. |
| Rules and campaign code cannot import React Native | The game has to be tested in Node. A flat-config ESLint import rule fails the build if `src/rules` or `src/campaign` imports `react-native`, `expo-*`, or anything under `src/play` or `src/screens`. `eslint-plugin-import` v2 is the wrong tool for that config. The same rule fails an `src/effects` import from `src/rules`; `src/campaign`, `src/play` and `src/screens` import `src/effects` directly, and `src/rules` receives the records as an argument. |
| Campaign registry, not a Fellowship-named core | The next box is a folder plus a catalog rebuild. The core round and the deck builder do not mention Fellowship by name. |
| Full official player pool from the first install | Deckbuilding is not gated on campaign progress or on effect coverage. |
| Two SQLite files | `catalog.db` is reference data baked into the binary and replaceable. `user.db` is decks and saves and is never replaced by a catalog update. |
| The engine plays the game | Rules, keywords, phases, effects, damage, resources, threat, and progress are applied by the app. The player only chooses among options the current rules allow. |
| That engine stays inside the app | One device, one player, airplane mode. A rules API adds a host and a network hop. It does not make the math more correct. |
| Effects are records, not parsed English | A template writes a record only when it matches a whole sentence; an agent drafts the rest from a bundle. A partial parse would mistime Forced and Response. A sentence with no effect record is inactive. It is not handed to the player to resolve. |
| Campaign-dealt cards are fully automated before the scenario is playable | Quests, encounters, boons, burdens, and The One Ring have no inactive-text path. |
| Every card is automated (user decision, 2026-10-26) | Every deck-legal player card and every card the six scenarios deal gets effect records for all its printed lines. The phase order and the box-first scope no longer gate this work. The Messenger of the King cards (the `(MotK)` hero versions of allies and the Messenger of the King contract) are left out of the card pool (user decision, 2026-10-26; `outOfScope` in `data/overrides.json`). Until a card's last line has a record, printed cost and combat numbers, plus implemented keywords, still work, the open line is listed in `src/effects/open-lines.ts` (the burn-down list), and the player sees it marked "Not applied". An event with no record cannot be played (`rr.triggered-ability`). |
| Card images are the RingsDB previews, and the DragnCards or Hall of Beorn scan where RingsDB has none | About 430×600, one file per code, cached on the phone. Encounter and quest art has no RingsDB file; `data/cards` lists its other URLs in each printing's `imageUrls`. A 300 dpi scan is not publicly hosted, so it is not the asset. The files stay out of the APK. |
| Feel outranks the next feature | Drag, scroll, and taps stay smooth on a phone. A correct rule that stalls the frame does not ship. |
| Identifiers are RingsDB codes (`141001`), never DragnCards UUIDs | That is the public catalog. |
| Errata wins | When RingsDB sets `has_errata`, store and display the errata text. |
| Booklet and quest card beat this file | This file paraphrases. A wrong paraphrase must not ship. |
| No card-text NLP, and no manual resolver | A wrong Forced effect is worse than leaving the sentence inactive. |

## Stack

Pin these. Do not swap them for a lookalike.

| Job | Use |
| --- | --- |
| App | Expo SDK 58, TypeScript, the React Native new architecture, Expo Router. pnpm is the package manager. SDK 59 is out of these phases. |
| Table | `@shopify/react-native-skia`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`. The Skia version is the one `pnpm expo install` selects for SDK 58. The table decodes cached files. It does not call `makeImageFromView`. |
| Lists | `@shopify/flash-list`, the SDK 58 `pnpm expo install` version. The card pool, the deck editor, and any list that can grow past one screen. Not `FlatList`, and not a map of card views. If FlashList 2.0.2 is still the bundle pin, the pool does not use sticky headers. |
| Chrome screens | NativeWind 4.2.7 and Tailwind 3. NativeWind 5 is out. No MUI, Emotion, styled-components, or a second styling system |
| Catalog schema | One schema from `drizzle-orm/sqlite-core` in `src/catalog` |
| Database on device | `expo-sqlite`. The phone opens the catalog tables read-only. |
| Database build | `better-sqlite3` opens that same schema in the Node script only |
| User schema | `expo-sqlite`, with committed migrations in `drizzle/` |
| Validation at the catalog boundary | Zod |
| Images and files | `expo-file-system`, `expo-image` |
| Haptics | `expo-haptics`, the SDK 58 `pnpm expo install` version (user request, 2026-10-25): a tick when a table button arms, sends or is refused, and on Undo. It adds to what the screen shows and never replaces it. |
| Screen state | Zustand. The only writer of game state is the reducer in `src/rules` |
| Tests | Vitest, in Node, on `src/rules` and `src/campaign`. Maestro flows in `.maestro/` are written with the phase that names them and run with `maestro test` after the last phase. The physical phone still judges fling and drag. Card ability text stays out of Maestro. |
| Device builds | EAS Build. Android APK/AAB. iOS IPA |

Install Reanimated, `react-native-worklets`, Gesture Handler, Skia, FlashList, `expo-sqlite`, `expo-image`, `expo-file-system` and `expo-haptics` with `pnpm expo install`. Worklets is the Reanimated 4 peer. Stay on the Skia and FlashList versions that command selects. Expo Go ships those binaries.

Do not add TanStack Query, Redux, a Phoenix client, or a server framework.

The rules engine is the pure TypeScript reducer in `src/rules`, called in-process by the screen. Vitest imports that same module. Maestro drives the built app and asserts the phase rail, sheets, and saves. It does not replace those unit tests, and it does not judge a drag. Those flows wait until the last phase. An earlier phase is not open because `maestro test` has not been run. Do not wrap it in HTTP, a localhost server on the phone, a second package, or a remote API. The UI already cannot apply damage or resources. Moving the reducer off the device would not add a rule the module cannot express, and it would break the airplane-mode exit check.

A server is the right shape for a second human who must not see hidden cards, or for many clients sharing one live table. This product has neither. Cross-device save sync, if it is ever wanted, copies `user.db` rows. It still does not run the round. DragnCards needed Phoenix because each room was a multiplayer process. That is the architecture this app rejected.

## Performance and feel

This applies to the table, the card pool, the deck editor, the campaign path, the briefing, the log, and the image cache. A later scenario does not start while the current screen hitches. Do not leave smoothness for a polish pass.

The new architecture stays on. Reanimated is the only animation library. `react-native-worklets` is its peer. A drag, a card lift, and a sheet run on the UI thread. A finger moving across the table does not cross into JavaScript to reposition a card. The reducer runs when the gesture ends or a choice is committed, not on every movement sample. `legalIntents` is computed when the window changes, not per pixel. It does not build the cross product of every card and every target up front. The table computes targets for the card the player selected.

The table is one Skia canvas. It is not a React Native view per card. Skia decodes cached files. It does not call `makeImageFromView`. A Zustand subscriber reads the slice it draws. Reducer updates keep the same object references for zones that did not change. A threat change does not re-render the hand, the pool, or the log. Skia images that leave the table are released.

Lists virtualize. The pool loads card rows when that screen opens, then filters in memory. Painting every row is not. The campaign list reads campaigns and saves. It does not scan `cards`. `expo-image` decodes a list card and the inspect screen. The inspect screen may decode the cached file at its native size, about 430×600. The table is one Skia canvas and decodes with Skia. Nothing decodes the whole cache. Prefetch the hand, every face-up card on the table (the quest stage, the locations, staging, the engaged enemies, the play areas and their attachments), and the screen the player is about to open. On the fetch date recorded below, 1,039 official rows had an `imagesrc`. About 420 MB of that is the player-card subset. Quest and encounter images are further files in the same cache. Do not prefetch the whole cache at startup, and do not make the first paint wait on a download.

The first screen paints from local SQLite. Startup does not scan the image directory or count the catalog before it draws. Image downloads stay off the interaction path.

A tap shows a pressed state in the same frame. Phase changes and sheets animate, and the animation does not gate the rule. If the engine has already resolved, the motion shows the result. A new gesture cancels the animation in progress. When the OS asks for reduced motion, the same transitions snap.

Tap targets are at least 44 points. The phase rail and the choice buttons sit where a thumb reaches. Card text on the table is the picture. Text in sheets is set in type large enough to read at arm's length. There is no desktop table shrunk into the phone.

Profile the pool fling and the table drag on a physical phone before closing step 2 and step 5. A hitch during either is a failed exit. The simulator does not count for that check.

## Repository layout

```
src/rules/        pure TS. Core round, windows, keywords, effect interpreter. rules/families/<family>*.ts hold the engine half of each mechanic family.
src/campaign/     pure TS. Registry, log, pool, saga validators, resolution, standalone games, the playable list, goldens (golden/) and Maestro save fixtures (fixtures/).
src/effects/      generated/ (written by data:build from sentence templates) and authored/ (records for the rest: one file per box scenario, authored/families/<family>.ts for the families' cards, authored/pool/<pack>.ts for the player pool). open-lines.ts lists the printed lines no record owns. Data, not UI.
src/catalog/      Zod schemas, including Card, Effect, Instruction, Condition, Cost, ScenarioData and ScenarioDefinition. One drizzle-orm/sqlite-core catalog schema. catalog/families/<family>.ts hold each family's verbs, triggers and flags (index.ts composes them).
src/play/         Skia table, phase rail, sheets, widgets (life, burden deck, active locations), choice words.
src/screens/      Expo Router. Campaigns, Scenarios, briefing, table, resolution, log, pool, decks, rules.
data/             committed. sources.json, raw/ (verbatim snapshots), cards/, scenarios/, campaigns/, decks/, printed/, rules/, starter-decks.json, prebuilt-decks.json, overrides.json.
scripts/data/     sync (network), build, check, query, effect templates and drafts.
scripts/build-catalog.ts   data/ -> assets/catalog.db, offline
assets/catalog.db          generated, gitignored
drizzle/                   user.db SQL migrations, committed
```

`src/rules` and `src/campaign` have zero React imports. `src/play` sends player intents. It does not assign threat, damage, resources, progress, or log fields.

## Domain

### Campaign

A save is one playthrough of a campaign. The table is discarded when the scenario ends. The log is not.

```ts
type Save = {
  id: string;                    // this playthrough
  campaignId: string;            // any id data/campaigns holds: "fellowship-of-the-ring", "mirkwood-paths", "the-dark-of-mirkwood"
  seatCount: 1 | 2;              // chosen once, at the start of the save
  log: CampaignLog;
  activeScenario: ActiveScenario | null;
};

// The open scenario is not stored as a table. Loading rebuilds the start from the log and the decks, then replays
// the intents through the reducer (src/campaign/replay.ts).
type ActiveScenario = {
  engineVersion: number;         // ENGINE_VERSION in src/rules/version.ts (9 today)
  dataHash: number;              // the catalog version the intents were played against
  seed: number;
  intents: PlayerIntent[];       // every intent sent, Keep included, in order
};


type CampaignLog = {
  heroesBySeat: string[][];      // RingsDB codes, length seatCount
  fallenHeroesBySeat: string[][];
  threatPenalty: number;         // permanent, one number for every player
  campaignPool: PoolCard[];      // earned boons and burdens, attached or not
  captives: { seat: number; hero: string }[];
  completed: string[];           // scenario ids
  earned: Record<string, string[]>; // the codes each won scenario's Resolution recorded; the path shows them on a completed node
  scenarios: Record<string, { rounds: number; victoryPoints: number; score: number }>;
  score: number;                 // the sum of the scenario scores, computed, never typed
  notes: string;
  // Structured campaign facts, in place of the notes the Mirkwood campaign cards ask for (phase 28). An older log reads with these defaults.
  prisoner: string | null;       // the hero code the players named the prisoner
  usedOnce: string[];            // once-per-campaign uses ("Record in the Campaign Log when used"): the code of each card used
  counters: Record<string, number>; // counters on a campaign card, by its code, as the last won scenario left them
  carryOver: PoolCard[];         // cards this campaign hands to the next one (a Resolution's CarryOver)
  carryIn: PoolCard[];           // cards a new save took in from a finished campaign; its first checklist moves them into the pool
};

type PoolCard = {
  code: string;
  back: "player" | "encounter";  // which deck it joins (Campaign Setup Checklist steps 7 and 8)
  burdenSet: string | null;      // a burden belongs to a burden set; later cards remove burdens by set
  attachedTo: string | null;     // a hero code, for a Permanent card or one a Resolution attaches
  seat: number | null;
};
```

The paper sheet also has these labels: Heroes, Fallen Heroes, Threat Modifiers, Boons, Burdens, Scenarios Completed, Score, Notes, Campaign Total. Notes are the only free text. The Learn to Play states the score of a won scenario: the final threat of each player, plus the threat cost of each destroyed hero, plus the damage on each surviving hero, plus 10 per completed round, minus the victory points earned (`ltp.scoring`, `rr.scoring`). Lower is better. The Rules Reference words the second term as the threat penalty on defeated heroes; the Learn to Play, which the log sheet follows, says their threat cost, and this file uses that. The engine computes it on a win (phase 8d). The campaign total is the sum.

Campaign play follows the Learn to Play and Rules Reference campaign rules (`rr.campaign-mode`, `ltp.campaign-mode`, `rr.campaign-cards`, `rr.campaign-pool`, `ltp.campaign-pool`), which phase 8d encodes. Each scenario starts with the Campaign Setup Checklist (`rr.campaign-setup-checklist`, `ltp.campaign-setup-checklist`; eight steps): heroes from the log, fallen heroes replaced, +1 threat penalty per voluntary hero change unless a campaign card waives it, the penalty applied, Permanent cards attached, Setup boons and burdens put into play, player-backed pool cards shuffled into decks, and encounter-backed pool cards shuffled into the encounter deck. Each scenario's campaign card prints its Setup on the front and its Resolution on the back. Those lines are effect records like any other. A burden belongs to a burden set, not an encounter set. Later campaign cards remove burdens by burden set. A player uses the heroes on the log and may trade 1 of them for a new hero between scenarios; a fallen hero may be replaced or left out, and a hero still alive is never left out without that trade (`ltp.fellowship-of-heroes`). Cards a campaign card says the players earned join the pool even when nobody chose them (142019's leftover boons, in the first player's deck). Only a Permanent card stays recorded on a hero. Heroes are logged under the seat that owns them, so a Ring-bearer another seat controls at the end is still its owner's.

The campaign pool holds several copies of one code: "each player earns 1 copy" is one entry for each player, marked `perPlayer` and carrying that player's `seat`, and a card removed from the pool ("remove it from the Campaign Pool") removes one entry (the removing player's copy when the game says whose it was). Any other earn is one copy of its code however often it is earned and whichever seat wrote it, as in the Fellowship: The Ring Draws Them chosen in scenario 1 and earned again by Flight to the Ford is one card. An eliminated player still has a seat for "each player". The structured facts reach the engine at the start of a scenario in Campaign Mode (`StartScenario.facts`), and a won game writes them back; a standalone game has none.

The log shows the six Fellowship rows. Later saga rows are added from each later booklet, in that booklet's order. This file does not set that order. The next box must not invent a second log type. Fellowship's six, in order, are fixed:

1. A Shadow of the Past
2. A Knife in the Dark
3. Flight to the Ford
4. The Ring Goes South
5. Journey in the Dark
6. Breaking of the Fellowship

A lost scenario writes nothing and stays current. A won scenario runs its resolution, then unlocks the next id. The booklet's "players defeat the scenario" means won. Replaying a won scenario does not grant the reward a second time unless that scenario's script says so. The chosen card is added to the pool, or attached when it is Permanent. The unchosen card is not added. Leave it where the quest card prints. Do not add a sweep the card does not print.

### Mirkwood campaign cards and carry-over

The Revised Core and The Dark of Mirkwood campaign cards print Setup lines the Fellowship's do not. The Campaign Setup Checklist and the start deal them (`src/campaign/checklist.ts`, `start.ts`; verbs in `src/catalog/families/campaign.ts`), in Campaign Mode only:

- "Put Mendor into play" (`PutObjectiveAllyIntoPlay`): the objective ally enters play under the first player, with no reveal and no cost. A pool card whose own record says it is put into play at the start of each scenario (Mendor, once an earlier Resolution has carried him over) is put into play instead of being shuffled into the encounter deck: it skips checklist step 8.
- "Set each copy of X aside, out of play" (`SetAside`), "Shuffle the X burden into the encounter deck" (`ShuffleIntoEncounterDeck`).
- "Attach X to a hero of the first player's choice" (`AttachChosen`): the first player chooses any hero at the table; the card is not added to the pool.
- "Each player adds a copy of X to their hand after drawing their starting hand (including taking a mulligan)" (`AddToHandAfterMulligan`): the card is dealt once every seat has kept or taken its mulligan, so a mulligan does not shuffle it away.
- "Add X to the Campaign Pool" (`AddToPool`, a copy for each player when it says each): recorded in the log when the scenario is won. This scenario already has the card, so steps 7 and 8 do not deal it again.

A Resolution can hand cards to the next campaign (`CarryOver`: Mendor, each player's Mendor's Support, Ranger Sense). They are written on the log's `carryOver`; a lost scenario writes nothing. A copy for each player is one entry marked `perPlayer`, with no seat: the new playthrough gives one copy to each of its own seats, whatever the finished one had. A new playthrough (any campaign) offers the carry-over of each finished playthrough of any campaign (`src/campaign/carry-over.ts`): the player takes one or starts fresh. A finished playthrough's carry-over is taken by one new playthrough (its log records `carriedFrom`): the offer is not made again until that playthrough is deleted. The cards go on the new log's `carryIn`, and the first Campaign Setup Checklist moves them into the pool (step 1) and clears `carryIn`. Within one campaign nothing is carried: part 4 of Mirkwood Paths continues the same log. The Dark of Mirkwood mini campaign starts on a blank log (`tdom.mini-campaign`), and so does any new playthrough that takes nothing in.

Loadout rules follow the campaign's `saga` flag. In a saga (the Fellowship of the Ring) the Ring-bearer rules run: a Ring-bearer for the first seat, one Fellowship-sphere hero, no second Frodo, no One Ring in a deck, a fourth hero only as the Ring-bearer. Outside a saga none of them runs, there is no Ring-bearer slot, and a Fellowship-sphere hero is refused: "Heroes belonging to the Fellowship sphere can only be used when playing the scenarios in the saga expansions" (`mec109.the-fellowship-sphere`). The same hero in two seats is still refused (`rr.unique-cards`).

### Standalone play

A standalone game is one deal of one scenario, outside any campaign (`src/campaign/standalone.ts`, user decision 2026-10-25). It is not a save: it has no log, and nothing it does reaches one.

- The saga rules follow the box. The Ring-bearer, The One Ring and the Fellowship sphere are the saga's setup (`mec109.setting-up-the-game`), not the campaign's, so a Fellowship scenario's briefing applies the same loadout rules (`validateLoadout`) and the same deck rules (one to three heroes per saved deck, `rr.deckbuilding`) as a campaign deal. A scenario of the Revised Core or The Dark of Mirkwood box is not a saga: no Ring-bearer slot, and a Fellowship-sphere hero is refused (`mec109.the-fellowship-sphere`). The box a scenario is printed in gives the flag (`src/screens/campaign-data.ts`, `BOXES`).
- No campaign card. It is placed only "while setting up a scenario in Campaign Mode", and its Resolution is followed only after a campaign win (`rr.campaign-cards`, `ltp.campaign-cards`). Its Setup does not run (A Shadow of the Past deals no Mr. Underhill, Gandalf's Delay, Gildor Inglorion or The Ring Draws Them; its Normal encounter deck is the scenario's own 40 cards), and a win has no choice to make: the engine's definition carries no `campaignCard` and an empty `resolution`.
- No boons or burdens. They are earned in Campaign Mode and are not in a game until then (`rr.boons`, `rr.burdens`). No campaign pool, no Campaign Setup Checklist, no threat penalty (each player starts at the printed threat of their heroes), no fallen heroes, no captives.
- A win is scored by the Learn to Play's system, which is for "players who enjoy playing through the same scenario multiple times" (`ltp.scoring`, `rr.scoring`, `faq.scoring`; `src/campaign/score.ts`), and the score is kept with the game. A loss keeps the engine's reason and the completed rounds.
- Only a playable scenario is dealt: one whose dealt cards have an effect record for every printed line (`src/campaign/playable.ts`, kept honest by the coverage test). Campaign-dealt cards have no inactive-text path, so an unplayable scenario is listed and refused, not dealt with inactive encounter text. Today that is A Shadow of the Past, A Knife in the Dark, Flight to the Ford and The Ring Goes South.
- A printed line conditioned on Campaign Mode (141062:A:1, "Use this action only if you are playing campaign mode") reads whether the campaign card is in the game: the condition `campaign`. The engine places a campaign card next to the quest deck (zone `campaign`, in play) when it has an ability that works while the scenario is played, today 141056's Response; a standalone game's definition carries no `campaignCard`, so none is placed and the line is not usable. A campaign card with only a Setup and a Resolution is not placed, so the scenario states of A Shadow of the Past and A Knife in the Dark carry nothing new.
- Each game can be resumed (its seed and intents are replayed, as a save's open scenario is), archived out of the list and restored as it was, or deleted after a second, explicit confirm. A finished game can be played again: a new briefing with the same seats, difficulty and Ring-bearer, and the same saved decks picked by id as they are now (a deck deleted since is not picked). A game from another engine version or data hash is dropped and its row kept.

### Scenario state

Zones are real objects, not a map of string-keyed piles copied four times.

- Seat: threat, deck, hand, discard, heroes, play area (allies and attachments), engaged enemies. From Breaking of the Fellowship stage 2B, also that seat's staging area and quest stage. Model the per-seat slots from the first rules slice, even if the first playtest is true solo.
- Shared, until a script says otherwise: staging area, active location (a second active-location slot only when the script says so), quest deck and current stage, encounter deck and discard, victory display, set aside, removed from the game, the campaign card next to the quest deck (zone `campaign`, only while it has an ability that works during the scenario).
- Optional, declared by the script: burden deck, Ring-bearer life tracker, extra encounter deck, the captive zone (the Ring-bearer and its attachments facedown under the Watcher in the Water, phase 14).
- A seat's player side quest sits in its quest area (zone `seatQuest`), and a contract is in its play area from the start (Player side quests, contracts and saga cards, below). The full list is `ZoneName` in `src/rules/state.ts`.
- Created by a card line: cards facedown under a location. Weather Hills (141049:A:1) prints "place 1 non-unique enemy in play facedown under this location. While an enemy is under this location, it is out of play", and 141049:A:2 returns each one to the staging area face up after the location leaves play. The engine holds such a card in the zone `under`, with the location as its host; it is out of play and is not one of the location's attachments. It is not a widget: the table draws nothing for it, and A Knife in the Dark adds no widget.

A card instance has: instance id, catalog code, zone, exhausted, damage, progress, resources, host, attachment ids, committed to the quest, shadow card id if it is an enemy, face, controller. Control is not the same thing as in play. The Ring-bearer can be in play, facedown, under Watcher in the Water, and controlled by nobody. Tokens on that hero are discarded when the quest card says to discard them. Attached cards go with the hero and are also uncontrolled while the hero is facedown.

### The engine plays the game

The app applies rules, keywords, phases, effects, and the numbers those produce. The player chooses among options the current rules allow. A choice carries a number only when the rule asks the player to distribute a total the engine has already computed, such as archery.

Legal player intents are a closed set. The UI asks `legalIntents(state)` and renders only that set.

- Keep or mulligan.
- Commit a set of legal characters to the quest, or to a Hide test.
- Play a card the current window allows, naming which legal resource pools pay its printed cost.
- Trigger an action or response the engine has judged legal, and pick legal targets.
- Pass an optional window. Seats pass in order. That is what closes an action window. The phase machine then advances on its own.
- Travel or decline. Optionally engage or decline. Declare a legal defender, or leave the attack undefended. Declare legal attackers.
- Distribute a fixed total (archery, or an effect that says "assign N damage") across legal recipients so the assigned amounts sum to N.
- Choose one of the resolution options the scenario script offers.

Everything else is an engine step. The UI cannot dispatch it, and no control on the table types it in.

- Setup, staging, shadow cards, refresh, threat 50, and "The One Ring left play" run because the framework reached them.
- Easy mode (`ltp.easy-mode`, `easy-mode.easy-mode`): the encounter deck holds the Easy counts, and each hero starts with one resource in its pool, added in Setup step 2, "Place Heroes and Set Initial Threat Levels" (`rr.setup`). The Learn to Play says only "during setup"; the Easy Mode sheet names step 2; they agree. Normal adds nothing.
- Each hero gains one resource of its own sphere in the resource phase. Saga Frodo's resource is that same gain. His pool may then pay Fellowship and neutral costs. Seats draw one card in seat order. No other gain or draw happens unless an effect instruction says so.
- Paying a cost removes exactly the printed cost. The chosen pools must sum to that cost, and each pool must be allowed to pay that card's sphere. Overpay, underpay, a wrong sphere, and spending outside a payment are rejected.
- Quest resolution compares committed willpower with staging threat. The active location is not in staging and does not add threat. Progress that would go on the quest goes on the active location first. Overflow goes on the quest. Progress beyond the current stage's quest points does not carry over: the next stage starts with none, so one quest resolution advances one stage at most (`rr.quest-advancement`, `ltp.quest-advancement`); a stage that cannot advance takes all of it (`faq.progress-without-advancing`). A shortfall raises the threat of every player still in the game by the difference (Learn to Play p12-13); an eliminated seat is not raised. Breaking of the Fellowship stage 2B may override this. The core round does not.
- A defended attack places `max(0, attack − defense)` damage after modifiers. An undefended attack places the attack value. Willpower and damage read a modifier list. A `constant` effect appends a record to that list. Toughness X, on an enemy, then reduces what is placed. An indestructible enemy is not destroyed. A character at damage equal to its hit points is destroyed. The player does not enter the result. Adding a card to a zone does not reveal it. Hide, surge, and When Revealed run on a reveal.
- Forced, When Revealed, Setup, shadow, surge, doomed, and Hide run on their timing. The player does not confirm that they happened.
- A revealed treachery is resolved, then placed in the encounter discard pile unless its text says otherwise (`ltp.revealed-treachery`: "resolve the text on the card, and then place it in the encounter deck discard pile, unless the card specifically states otherwise"; `rr.treachery-cards`, `rr.step-3-3`). A canceled treachery goes there too (`rr.cancel`: "it is still placed in the encounter discard pile"). A treachery whose text attached it (a Condition, Weapon or Mount: 141043, 141055, 141070, 141074, 141080) stays attached; one whose "if able" attach found no host is discarded. Its surge resolves after that (`rr.surge`, "immediately after resolving the staging of the encounter card"). Enemies, locations and objectives stay in staging (`rr.step-3-3`). No encounter card in this box is a treasure: RingsDB types the boons and burdens `treasure`, and the build gives each its printed type (a burden treachery is a treachery), so no treasure rule applies.

An intent outside the current window, with an illegal target, or with a number the rule did not ask for, is rejected with a reason. The table has no damage stepper, resource stepper, threat dial, or phase scrubber. Drop targets are zone ids the legality function returned. There is no freeform x/y table, and a drop does not move a card until the reducer accepts it.

Undo stores the intent log and the engine steps that followed, and rebuilds state, with a snapshot at each phase boundary. Replaying from that snapshot restores the state and the seed cursor. Do not diff a giant JSON tree. The interpreter and the reducer are pure. Shuffles advance the seed cursor stored on the scenario. No clock, no network, no `Math.random`.

The table's Undo (user request, 2026-10-25) takes back the last accepted intent, one at a time, while that intent showed the player nothing they had not seen: no card left a deck (a draw, a reveal, a card dealt face up), no card turned face up (a shadow card, a facedown card), no card in a deck or face down was named by the window it opened (a Look, a Pick among the top cards, a search), the top of no player's deck changed, no random result was drawn (a shuffle, a random discard: the seed cursor did not move), and no card came into being. An intent that showed a hidden card, or that won or lost the scenario, cannot be taken back, and neither can any intent before it. Taking an intent back restores the state before it, seed cursor included, and removes it from the save, so sending it again gives the same result and a relaunch replays the same game. Undo is a labeled button in the table's dock, never a gesture, and it is shown only while there is something to take back. While a pick is being made, Undo puts back the pick first.

### Engine steps

These are the core verbs inside the reducer and inside effect instructions. They are not buttons. The full vocabulary is the instruction schema in `src/catalog` and its families (Effects, below).

`Draw`, `GainResources`, `PayCost`, `PlayAlly`, `Attach`, `Exhaust`, `Ready`, `Commit`, `RevealStaging`, `PlaceProgress`, `RaiseThreat`, `Travel`, `Engage`, `DealShadow`, `DeclareDefender`, `DealDamage`, `Attack`, `AdvanceStep`, `ResolveEffect`.

`Mulligan`, `Pass`, `PlayCard`, `TriggerEffect`, `ChooseTargets`, `AssignDamage`, and `ChooseResolution` are the player-facing intents. `DealDamage` and `GainResources` ignore any amount supplied by the UI. The framework or the effect computes the amount.

### Core round

The round, its steps and its keywords are the rules in `data/rules/entries.json`. The phase rail names the framework steps in words, using the ids in `data/rules/steps.json` (DragnCards' step ids joined to the Rules Reference entries). Beginning and end of round are real steps so a response has somewhere to attach.

| Part of the round | Rule ids |
| --- | --- |
| Setup: decks, heroes, starting threat, Easy mode | `rr.setup`, `rr.initial-threat-level`, `mec109.setting-up-the-game`, `ltp.easy-mode`, `easy-mode.easy-mode` |
| Player Setup, opening hand, mulligan | `mec109.setup`, `rr.mulligan` |
| Encounter Setup, quest card Setup | `mec109.setup`, `rr.setup`, `rr.step-0-0` |
| Resource, Planning | `rr.step-1-1`, `rr.step-1-2`, `rr.step-1-3`, `ltp.gain-resources`, `ltp.draw-cards`, `rr.planning-phase`, `rr.step-2-2`, `rr.step-2-3`, `ltp.planning-order` |
| Quest, saga staging | `mec109.saga-staging-rules`, `rr.step-3-3`, `ltp.revealed-treachery`, `rr.treachery-cards`, `rr.step-3-4`, `rr.quest-advancement` |
| Travel | `rr.travel`, `rr.step-4-2` |
| Encounter: optional engagement, engagement checks | `rr.optional-engagement`, `rr.engagement-check` |
| Combat: shadow cards, attacks | `rr.combat-phase`, `rr.step-6-2` |
| Refresh | `rr.refresh-phase`, `rr.step-7-3` |
| Threat elimination, losing | `rr.threat-elimination-level`, `rr.player-elimination` |

Decisions this file owns, because the sources are silent or the user chose:

- A `ReduceOpeningHand` Setup record (141078 Gandalf's Delay) runs with player Setup, before the opening hand, so the hand and a mulligan redraw are 6 minus the reduction. The booklet orders player Setup before the hand and encounter Setup before the quest card's Setup, and says nothing about encounter Setup against the hand. User-accepted reading.
- Saga staging reveals one encounter card per seat, in seat order. "You" on an encounter card is the seat that revealed it. Surge: the same seat reveals another card. Doomed X raises every seat's threat. Peril: the other seats cannot act or trigger responses while that card's staging resolves; a Response on a card nobody controls (the quest card) goes to the revealing seat meanwhile, and an enemy attack the card starts is open to every seat (`faq.peril-attacks`). The lock ends before that card's surge.
- The encounter deck is shuffled back from the encounter discard pile when it is out of cards during the quest phase, once the revealed card's staging is resolved, or as soon as an effect needs a card (`rr.running-out-of-cards`, `faq.last-encounter-card`). Outside the quest phase it stays empty.
- An engagement check engages the enemy in staging with the highest engagement cost at or below the seat's threat. The first player chooses among ties.
- Shadow cards are dealt to each seat's enemies, highest engagement cost first (`rr.step-6-2`). A shadow card stays with its enemy after it resolves; it is discarded when the enemy leaves play, and every one at the end of combat (`ltp.shadow-discard`). An enemy that makes an attack outside the combat phase, or an additional attack, is dealt a new shadow card, after any it had is discarded (`rr.attacks-outside-the-combat-phase`, `faq.additional-attacks`); outside combat that card is discarded when the attack ends (`faq.enemy-attacks-outside-combat`).
- Each seat declares at most one attack against each enemy in the combat phase; an attack a card makes (Quick Strike) is extra (`faq.limitations-on-attacks`). A ranged character may join an attack another seat declares (`rr.ranged`, `rr.step-6-8-1`). A defender that left play before damage leaves the attack undefended (`rr.step-6-4-3`).
- A character or enemy whose damage reaches its hit points is destroyed whenever that happens, a lost hit point bonus included (`rr.hit-points`). A card enters play ready and with no tokens (`rr.ready`).
- Simultaneous effects: when two conflicting effects would occur at once, the first player decides their order (`faq.simultaneous-effects`, FAQ 1.02). Responses to one game occurrence share one window, and the player uses them in any order (`rr.triggering-condition`: "those triggering conditions are handled with a single response window in which abilities ... may be used in any order"; user decision 2026-10-26). A commit of several characters is one occurrence: each committed character's Responses are offered together, first player first. A Response whose resource cost cannot be paid when the window opens waits in it and is listed once another Response has paid for it (Théodred adds the resource Aragorn spends). With nothing usable, no window opens. Forced and delayed effects that conflict still resolve in a fixed order (the order their triggers queue); that part stays open in `docs/phases/STATUS.md`.
- An eliminated seat's hand, deck and cards it controls go to their owners' discard piles, its engaged enemies return to staging with their damage, an attack on it ends with the action window between its steps, a Peril lock it held is released, and the first player token passes on at once if it held it (`rr.player-elimination`, `faq.first-player-elimination`, `mec109.peril`).
- A quest shortfall raises the threat of every seat still in the game. An eliminated seat is not raised. Breaking of the Fellowship stage 2B may override this. The core round does not.

### Keywords implemented once

These live in `src/rules`, not in a card file. Each names its rule ids in its module header.

| Keyword | Rule ids |
| --- | --- |
| Surge, doomed, peril | `rr.surge`, `rr.doomed-x`, `mec109.peril` |
| Archery X | `mec109.archery` |
| Immune to player card effects | `rr.immune`, `mec109.immune-to-player-card-effects` |
| Indestructible, toughness X | `mec109.indestructible`, `mec109.toughness` |
| Permanent | `mec109.permanent`, `ltp.permanent`, `rr.campaign-pool`, `rr.campaign-setup-checklist` (steps 2 and 5) |
| Victory | `rr.victory`, `ltp.victory-x`, `ltp.victory-display` |
| Sentinel, ranged | `rr.sentinel`, `rr.ranged` |
| Hide X | `mec109.hide-x`, `mec109.hide-tests` |
| Restricted | `rr.restricted` |

Decisions this file owns:

- Restricted: a character cannot have more than 2 attachments that carry the keyword. When a third is attached, the character's controller chooses one of them and it moves at once to its owner's discard pile (`rr.restricted`). The keyword is read from the card; the "Attach to ..." sentence is a constant `AttachesTo` record.
- Action windows: every action window of the framework chart opens (`rr.framework-steps`, `rr.attack-resolution-chart`; user decision 2026-10-25): after the resource draw, in planning, at quest commit, after staging, after quest resolution, after travel, after optional engagement, after the engagement checks, after the shadow cards are dealt, between the steps of each enemy attack (before the defender, before the shadow card, before damage, before the attack ends; out of combat too) and of each player attack (after the attackers are declared, after damage), and after the first player token passes. A window in which no seat has an action it could take changes nothing and is skipped. An Action, and an event with an Action, can be used in any of them, the Hide test's action window included. Allies and attachments are played in the planning phase only, by the player whose planning window it is: each seat has its own window in player order (`rr.step-2-2`, `rr.step-2-3`). A window closes when every seat has passed in a row; a play or an action means the seats that passed are asked again (`rr.action-windows`). A card of a sphere needs a hero of that sphere even at cost 0 (`rr.resource-match`). An event with no legal target for a required choice cannot be played (`rr.initiating-abilities-playing-cards`, step 1). An event stays in the hand while its effect resolves and goes to its owner's discard pile after, whether or not the effect was canceled (`rr.cancel`).
- Cancel: a Response that cancels (A Test of Will, Hasty Stroke) is offered before the effect it answers begins (`rr.cancel`): when a card with "when revealed" effects is revealed, and when the shadow card dealt to an attacking enemy has a shadow effect. A canceled effect is still used; the revealed card stays revealed. A card with nothing to cancel offers nothing. "Look at the top card" (Henamarth Riversong) opens a look window that the player closes with a pass; it changes nothing. A search puts the cards looked at back on top, in the order the player chooses, one position at a time.
- Playing from and into other zones: an ally put into play from a hand or a discard pile (Sneak Attack, Stand and Fight, Elf-stone) cannot be a unique card already in play. An ally taken from another player's discard pile is under the new controller until it leaves play, and goes to its owner's discard pile. X on an event (Stand and Fight) is whatever the player pays. Sneak Attack's return and Beorn's shuffle are delayed effects that resolve at the end of the phase they were made in (`rr.delayed-effects`).
- Responses to engagements, attacks and plays: a Response that says "After you engage an enemy with a higher engagement cost than your threat" (Sam Gamgee, Pippin) is offered when the engagement is done, to the player who engaged only (`rr.response`). "After Merry participates in an attack that destroys an enemy" is offered to each attacker once the damage has destroyed the enemy. A Response to a card entering play or being played is offered once the card is in play. A Response is offered immediately after its triggering condition has occurred and resolved (`rr.response`; user decision 2026-10-25), first player first: over any window the framework opened since (an action window, a defense, archery, the choice of an enemy, the next attack, the optional engagement, the travel choice), which comes back after. It waits only while an effect or a revealed card is still resolving and asks for a choice or a Hide commit, and while another trigger's Responses or cancel are being offered.
- Gandalf (hero, 142002): the top card of his controller's deck is faceup, and once per phase that player may play it as if it were in their hand, in the windows that card could be played in from the hand. While it is paid for, Gandalf counts as having the Leadership, Lore, Tactics and Spirit icons; the resources are taken from the heroes that can pay. The new top card is not offered again that phase.
- Per-player limits: Éowyn's Action "may be triggered by each player once each round". Any player may trigger it, from their own hand, and each player once a round. The engine keeps one use per player per round.
- Archery X: the engine totals X across every archery card as the combat phase begins, before the shadow cards are dealt, and the player distributes that total across legal characters; the first seat decides disputes; defense does not block it.
- Indestructible and toughness X are defined here for enemies only. Extend them to another card type only when a card prints the keyword there, and cite that card.
- A Permanent boon or burden is attached to one hero when earned and recorded on the log; it cannot be discarded while that hero is in play, and it leaves the game with the hero.
- On The Ring Goes South stage 4, an effect that targets "the active location" can target only the active location that is not Doors of Durin (immune to player card effects).

## Fellowship of the Ring

MEC109 reprints **The Black Riders** (RingsDB pack `TBR`, 2013) and **The Road Darkens** (pack `TRD`, 2014) as one campaign. There is no RingsDB pack code for the 2022 box. The campaign id is `fellowship-of-the-ring`. The box is 329 cards: 7 heroes, 57 player cards, 22 quests, 209 encounters, 6 campaign cards, 28 boons and burdens.

Every scenario in the box starts the same way. The engine does it. Do not ask the player to remember the booklet.

- The first seat must control a Fellowship-sphere hero with the Ring-bearer trait. That hero is one the player put in the deck. Do not insert a Frodo the player did not choose.
- Attach The One Ring to that hero. The One Ring is an objective granted by setup. It was not among the 29 TBR pack records fetched for this brief. It is not a deck card and it does not count against the 50-card minimum.
- While The One Ring is attached, that hero does not count against the hero limit. A seat may therefore start with four heroes: the Ring-bearer plus three others. A seat may also start with three heroes when one of them is the Ring-bearer. Both are legal. A seat with no Ring-bearer is not.
- Only one Fellowship-sphere hero may be in play. No other version of Frodo may be a starting hero or in the deck.
- Fellowship-sphere heroes cannot be used outside saga scenarios. The deck may still be saved. The briefing refuses them.
- The saga Frodo collects 1 resource in the resource phase. Those resources pay for Fellowship cards and for neutral cards.
- Two-handed: when the first-player token passes in refresh, the new first seat gains control of the attached Ring-bearer, the resources in that hero's pool, and every card attached to that hero. If that transfer leaves a seat with no heroes, that seat is eliminated immediately.

| # | Scenario id | Difficulty | Encounter sets and extra rules, from the booklet |
| --- | --- | --- | --- |
| 1 | `a-shadow-of-the-past` | 6 | Sets: A Shadow of the Past, Hunted, The Ring, The Black Riders. Hide X. Stage titles used by Hall of Beorn: Three is Company, A Shortcut to Mushrooms, Escape to Buckland. Confirm the titles on the quest cards. |
| 2 | `a-knife-in-the-dark` | 7 | Sets: A Knife in the Dark, Hunted, The Ring, The Nazgûl. |
| 3 | `flight-to-the-ford` | 5 | Sets: Flight to the Ford, Hunted, The Black Riders, The Nazgûl. Not The Ring. Burden deck and life tracker, below. The campaign card adds a response any player may trigger. |
| 4 | `the-ring-goes-south` | 6 | Set: The Ring Goes South only. The campaign card waives the hero-change penalty and grants Sting, Mithril Shirt, Glamdring and Andúril. Stage 4 can have two active locations. Doors of Durin is immune to player card effects. The Ring-bearer can be placed facedown under Watcher in the Water. |
| 5 | `journey-in-the-dark` | 8 | Set: Journey in the Dark only. |
| 6 | `breaking-of-the-fellowship` | 7 | Set: Breaking of the Fellowship only. Stage 2A removes the Ring-bearer from the game. From stage 2B, separate staging, each seat on a different stage 3A. True solo is one area. Do not delete the rule for solo. |

The booklet's scenario chapters name the encounter sets. They do not list every card. Card-by-card setup (Bag End, the Black Rider, Bucklebury Ferry, and the rest) is printed on the quest cards. Hall of Beorn is a reading aid for those lines. The quest card wins if Hall of Beorn disagrees. The runtime never fetches Hall of Beorn.

### Scenario 1 resolution

This is a transaction, not a notes field. On a win the player chooses one of:

- `Gandalf's Delay` or `The Ring Draws Them`, then
- `Gildor Inglorion` or `Mr. Underhill`.

Each chosen card is added to the campaign pool and recorded on the log.

The choice is printed on the back of the campaign card 141030. Each campaign card's Setup and Resolution lines are effect records owned by the card's ledger lines, with timings `campaignSetup` and `resolution`. A Resolution record is a list of `ChooseCards` groups plus `Earn`, `EarnAllBurdens`, `MarkFallen` and `NameCaptives`. One choice is asked per group, per player in seat order when the card says so; a chosen card goes to the pool, into a hand or onto a hero, and an `inPlay` or `attachedToHero` condition reads the final state. `ChooseResolution` carries an option id (a code, or `code>heroInstanceId`, or `skip`), never a typed number. A scenario that is lost writes nothing. A scenario already on the log is not granted again. A chosen Permanent card is recorded as attached, not as a pool card.

The score of a won scenario is computed from the final state when the log is written (`src/campaign/score.ts`). Only completed rounds count: a round is tallied at the end of its refresh phase (`faq.scoring`), so the round the players win in is not one.

Stage 3 has no quest points. The win is a `questResolution` record on Bucklebury Ferry: after it leaves play explored, the players win.

### A Knife in the Dark

Decisions of phase 12 (scenario 2). The table gains no widget for this scenario: its definition declares `hide`, `secondActiveLocation` and `perSeatStaging` false and it has no life tracker or burden deck (tested in `src/catalog/scenario-data.test.ts`).

- "Out of play" Ringwraiths (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2) follow the Rules Reference's definition (`rr.in-play-and-out-of-play`: "“Out of play” refers to the cards in a player’s hand, deck, and discard pile, the encounter deck, encounter discard pile, cards in the victory display, cards set aside, and cards removed from the game"). A copy is taken from the cards set aside (stage 1's Setup, 141025:A:1), the encounter discard pile, the victory display, or from under Weather Hills, whose text makes that card out of play (141049:A:1). Not from the encounter deck, which is where the copy is shuffled into, and not from cards removed from the game, which have "no further interaction with the game in any manner" (`rr.removed-from-game`); an encounter card is never in a player's hand, deck or discard pile. The records use the condition `outOfPlay` and the verb `ShuffleOutOfPlayIntoEncounterDeck`; a choice whose option needs a copy is not offered when none is out of play. Copies in one zone are the same choice. When copies are out of play in more than one zone, the zone matters (stage 3's search, 141027:A:1, finds the encounter deck and discard pile but leaves set-aside copies; a copy under Weather Hills would return to staging), and the first player picks the copy (`rr.first-player`: "If an encounter or quest effect targets a single player or card, and there are multiple eligible targets, the first player selects the target"). Leaving out the encounter deck is a reading of "shuffle ... into the encounter deck": the definition lists the encounter deck as out of play, and no source says the destination is excluded.
- A card's stat below 0 counts as 0 (`rr.modifiers`: "if a value is below 0, it is treated as 0"), as stated under Effects; Black Breath's 0 (141055:A:2) is a set modifier and overrides the others.
- The 141044 Resolution (141044:B:1): starting with the first player, each living seat in turn may take one of Tireless Ranger, Skilled Healer, Valiant Warrior and Noble Hero onto a hero it controls, or decline (`skip`). The option id is `code>heroInstanceId`. The box holds one copy of each boon (quantity 1), so a boon one seat took is not offered to the next; the printed line itself does not say "different". The log records each chosen boon as attached to that hero with the seat (`PoolCard.attachedTo`, `seat`), and the Campaign Setup Checklist step 5 puts it back on that hero in later scenarios. Each boon's "Setup: Attach to a hero." (A:2) is a setup record that only describes that placement: the card is never in a deck, so the Setup search never places it a second time.
- Midgewater's "enemies cannot attack, take damage, or be engaged" (141048:A:1) is held by enemies in play. The Prancing Pony's Forced (141045:A:2) puts each enemy it discarded "into play engaged with the first player"; that enemy is out of play when the effect moves it, and card abilities do not reach a card out of play (`rr.in-play-and-out-of-play`), so the line does not stop it: it enters the first player's play area and has engaged that player (`rr.engaged`). Once in play it holds the line like every other enemy. An engagement check, an optional engagement or an effect that engages an enemy in the staging area is stopped by it.
- Weather Hills' facedown enemy (141049:A:1) is held in the zone `under` (Scenario state, above). It is not a widget. The enemy leaves play as it goes under, so each card attached to it is discarded at the same time (`rr.attachment-cards`: "If the card to which an attachment is attached leaves play, simultaneously discard the attachment"), to the discard pile of its own deck (`rr.discard-pile-and-victory-display`): a Pale Blade (141070) or Black Steed (141074) on a Ringwraith goes to the encounter discard pile, as its shadow cards do. The engine uses the same release as a destroyed card.
- Weathertop's Travel cost (141046:A:3, "The first player must exhaust The One Ring to travel here") can be paid only while The One Ring is in play, ready, and controlled by the first player, the player holding the first player token now (`rr.first-player`). In two-handed play the token passes at the end of each refresh phase, so in a round where the Ring-bearer's seat is not first the cost cannot be paid. "If the players cannot pay the Travel cost, then they cannot travel to that location" (`rr.travel`): while the Ring is exhausted, gone, or with the other seat, Weathertop is not a travel target and a Travel intent naming it is refused with a reason. The record's Exhaust names the payer (`who: "firstPlayer"`). A Hide test on a Travel line (141035, 141037) is not such a cost.
- Scenario 1's earned cards reach this scenario through the Campaign Setup Checklist (`rr.campaign-setup-checklist`): an encounter-backed card (Gandalf's Delay, The Ring Draws Them, Gildor Inglorion) is shuffled into the encounter deck in step 8, and Mr. Underhill, Permanent and player-backed, goes on his recorded hero in step 5. Gandalf's Delay's own Setup line (141078:A:1) is then found in the encounter deck by the Setup search (`mec109.setup`) and puts that copy in the staging area; no second copy is made.
- A Test of Will cancels the when revealed effects "of a card that was just revealed from the encounter deck" (01050:A:1). Revealing from the encounter deck is staging (`rr.staging`), so it is offered only against the When Revealed of a card being staged, never against a quest stage reached by advancing (141026:B:1, 141027:A:1) or a card put into play another way.
- On the phone the table adds nothing for this scenario. Each shadow card an enemy carries is drawn face down until its attack (the Forced on 141069:A:2 deals an additional one). An effect's either/or (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2) is a choice sheet whose options are worded from the record's instructions and asked of the seat the record names (the first player for 141026, 141051 and 141076). A location the players cannot travel to is listed on the travel sheet with the reducer's reason and its Travel line. The cards under Weather Hills are not drawn. The resolution screen asks 141044 one seat at a time from the first player, each option naming the boon and the hero, with a visible decline that sends `skip`; the log shows each boon on its hero.

### Hide tests

The rule is `mec109.hide-x` and `mec109.hide-tests`, with the worked example (Hide 3, 2 willpower committed, discarded threat 2 + 2 + 0, an action raises willpower to 4, the test succeeds) as the fixture. The engine runs it as a frame: the revealing seat tests before that card's When Revealed or Forced effect, an action window opens after the discarded threat is known, then the frame pops and the rest of the revealed card resolves. A treachery adds 0 threat. This is not a token the player tracks by hand.

### Flight to the Ford burden deck and life

Burden deck (`mec109.burden-deck`): the five burden cards numbered 81–85, shuffled, set beside the quest deck. When a burden is discarded, it goes to the encounter discard pile.

The campaign card (141056) settles the win: each burden card in play, in the encounter deck, and in the discard pile is added to the campaign pool. The booklet's line omits "in play"; the card wins. Burdens still in the burden deck are not earned.

Life tracker (`mec109.ringbearers-life`): starts at 15, displayed as its own number, not as a second threat dial that the refresh step increments. Reducing life lowers that number. Healing a character does not raise it. Life 0 loses the game.

Decisions of phase 13 (scenario 3). The table adds the life number (already a widget) and the burden deck's count, each in the top bar and only when the scenario's definition declares it (`widgets.lifeTracker`, `widgets.burdenDeck`); no card of the burden deck is drawn, and a scenario 1 or 2 table shows neither (`src/play/widgets.ts`).

- The Ring-bearer is the hero with the Ring-bearer trait, the first player's first (the one The One Ring is attached to at Setup). The life is a number on the scenario state (`life`), set by the definition and lowered only by the verb `ReduceLife`, which writes a `life` step with its cause. It stops at 0 and a game with no life number ignores it. Life 0 is a loss whatever the cards say: `mec109.ringbearers-life` states it, so 141057:A:3 and 141029:B:4 (which restates `rr.winning-the-game`: completing the final stage wins) are `inert` ledger entries that name the rule, not records.
- An Evil Wound (141057:A:1, A:2): its host takes no damage; the damage that would be placed on it is a loss of life of the same amount (`damageToLife`), from any source, combat included. Damage cannot be healed from it (`cannotBeHealed`). The wound is attached to the Ring-bearer by the quest card's Setup, and its attachment host is the Ring-bearer.
- The Last Bridge's X (141058:A:2) is its Threat: Hall of Beorn prints `Threat X, Quest Points 4`, and the data stores X as no number. The records give it the number of players in the game as a constant. Its Travel cost (141058:A:3) reveals the top card of the burden deck for the first player as if it came from the encounter deck: keywords and When Revealed resolve (every burden has Surge, so one more card comes from the encounter deck), and a revealed treachery goes to the encounter discard pile (`mec109.burden-deck`). With an empty burden deck the cost cannot be paid and the players cannot travel there (`rr.travel`), as with Weathertop's exhausted Ring.
- A burden shuffled or placed into the encounter deck leaves the burden deck (141056:A:2, 141062:A:1, 141064:A:2). Burdens that were discarded are in the encounter discard pile, and the campaign card's back adds the burdens in play, in the encounter deck and in the discard pile to the pool (`EarnAllBurdens`); one in the victory display, set aside or still in the burden deck is not.
- The campaign card is in the game, beside the quest deck, only in Campaign Mode, and its Response (141056:A:2, "after an enemy is declared as an attacker") is offered to every seat after the enemy's attack begins (`enemyAttacks`, `anyPlayer`), with no limit but the cards in the burden deck: it shuffles the top burden into the encounter deck and cancels that attack. An attack an effect makes outside the combat phase is answered too.
- A location's, an objective's or a quest card's Action can be used by any player while the card is in play (`rr.action`); The Old Road (141062:A:1) is one, usable in Campaign Mode while the burden deck has a card: the top burden goes on top of the encounter deck and 4 progress go on The Old Road, which fills it (4 quest points) and explores it.
- Ford of Bruinen (141059:A:2): when it leaves play explored, every enemy engaged with a player is discarded to the encounter discard pile (discarded, not defeated: none goes to the victory display). Its Travel cost (A:3) reveals the top card of the encounter deck for the first player.
- Ettenmoors (141061:A:2): the Forced fires once when progress is placed on it while it stays in play (the announcement is made after the placement, so a location the progress explored has left play and hears nothing). Its A:1 keeps the Nazgûl engaged from being dealt a shadow card, the additional one of the Ringwraith (141069:A:2) included.
- Fell Rider (141063:A:2): while it is in the staging area the first player, at the beginning of the encounter phase, reduces the Ring-bearer's life by 1 or engages it. Each Fell Rider in staging asks.
- Stricken Dumb (141064:A:2): "end the quest phase" skips the cards the staging step has yet to reveal and the quest's resolution (no progress, no threat for a shortfall), uncommits the characters (they stay exhausted) and goes to the travel phase after the last action window; used outside the staging step it does nothing. The Enemy is Upon Us! (141065:A:1): each enemy engaged with a player attacks that player in turn, in player order; it gains surge if none did. "If this attack destroys a character" (141065:A:2, 141066:A:2) reads a count the attack leaves for its end: the characters among its defenders and the hero an undefended attack hit that are in the discard pile with damage at their hit points.
- Weight of the Ring (141080:A:2) is attached to the Ring-bearer and keeps its Forced effect while attached; "an additional encounter card this phase" makes the staging step reveal one more card, the extra cards revealed by the players in turn from the first. Fear of Discovery (141081:A:2) reveals its additional card by the choice itself, so it makes two with its Surge. Overcome by Terror (141084:A:2) is one choice, not two steps: the Ring is exhausted if ready, else the first player discards 2 cards at random. Panicked (141083:A:2) passes the token to the next player after the threat; with one player it stays. Eaten Alive! (141082:A:2) is X choices of a hero the first player controls, one point each.
- The Nine are Abroad (141067:A:1) blanks the text box of each character in play when it resolves, until the end of the round: traits stay, printed keywords go (`rr.blank`), and so do its Actions, Responses, Forced effects and constants; text another card gave it stays.
- Easy: the Black Steed (141074) keeps 1 copy (Hall of Beorn's scenario list and card record agree; `data/overrides.json`, `scenarioEasy`).

### The Ring Goes South, stage 4 and the damage on locations

Decisions of phase 14 (scenario 4). The campaign card (142019) is not in the game: it has no ability while the scenario is played, only a Setup (the free hero change and the four boons, in the checklist) and a Resolution (Lust for the Ring is earned only when it is attached to a hero, `attachedToHero`). There is no life number and no burden deck; the table adds the second active location (already a slot), the active locations drawn (phase 22 removed the "Active:" line) and, while the Ring-bearer is held, a Ring mark on its seat's dial that names the card it is facedown under (`threat-<seat>-ring`) (`src/play/widgets.ts`).

- Damage on a location (142021:B:2, 142027:A:1, 142035:A:1): damage tokens are a count of their own that card text reads ("X is the number of damage here"); a location has no hit points, so they never explore or destroy it. Where a card says "the active location" and there are two, the first player chooses; each effect says when it is each.
- Stage 1B (142020:B:1): at the end of the planning phase each player places the top card of their deck faceup, in player order, a round at a time, until four are faceup. The first player assigns them one at a time to the outcomes the card prints, in its order: played for no cost (by the owner; a card that cannot be played goes to the bottom of its owner's deck), added to the owner's hand, discarded, shuffled into the owner's deck. The first player then chooses Lust for the Ring shuffled into the encounter deck or +5 threat for each player, and the quest advances to stage 2. With fewer than four faceup cards the last card takes the next outcome without asking.
- "The players must travel to a location, if able" (stages 2B, 3B, 4B, `mustTravel`): the travel sheet offers no way to decline while a location in the staging area could be traveled to and an active location slot is free (`mec109.stage-4`). Stage 2A reveals cards for the first player until the staging area holds twice as many Threat as there are players; a card that asks a player is answered in the usual way (the reveal is a frame, not a loop that cannot wait).
- Stage 3A (142022:A:1): each player searches the encounter deck and its discard pile for an enemy in turn, the first player first; while Great Warg Chief is in either pile the first search must take it ("if able"). The encounter deck is shuffled after.
- Stage 4 (`mec109.stage-4`, 142023): 4A makes Doors of Durin active, adds the Watcher to the staging area, discards every token on the Ring-bearer and places it and each card attached to it facedown under the Watcher. They are in play and controlled by nobody: the hero leaves its owner's heroes, a card the players played stays attached with its owner kept, and none can be committed, exhausted by a player, or used. 4B lets a second location be traveled to, the second slot; "the active location" in a player card effect is the one that is not Doors of Durin. Each engagement puts 1 damage on every active location. Doors of Durin explored wins; Doors holding 9 damage loses (142030:A:3).
- Doors of Durin (142030:A:2): progress goes on every other active location first, and none goes on Doors unless the first player controls the Ring-bearer; progress that cannot go on Doors goes on the quest. Progress from questing and from card effects obey it alike.
- The Watcher in the Water (142024:A:2): Indestructible and immune. It stays in the staging area but is considered engaged with each player: it makes one attack against each player in the combat phase (in player order, each with a shadow card dealt for that attack), any character may be declared as an attacker against it, no player can engage it, and it adds no Threat to the staging area, as an engaged enemy does not (`rr.engaged`). The sixth damage token placed on it (a single hit that takes it past 6 counts once) gives the Ring-bearer to the first player, exhausted with 1 damage, and its attached cards with it.
- Storm of Howls (142038:A:2): the Warg in the staging area with the highest engagement cost (the first player breaks a tie) makes an immediate attack on the player who revealed it, though it is not engaged; the enemy stays in the staging area. Regiments of Crows (142035:A:2): the undefended damage of that attack goes on an active location instead of a hero; with two, the defending player names it.
- Redhorn Pass, Tree-crowned Hill, Hills of Hollin, Redhorn Foothills and Eregion (142029, 142031 to 142034): their Forced effects read the damage on the location when it is explored. "Each player assigns X damage among characters he controls" is one damage at a time on the character its player chooses; "the players, as a group" (exhaust, discard) is the first player's choice. Snowdrifts (142036:A:1) attaches to an active location that has no copy and caps the progress placed there at 3 each round; otherwise it gains surge.
- Lust for the Ring (142084:A:2) attaches to a non-Fellowship hero in play (a hero whose sphere is not Fellowship; the first player chooses); its Forced effect fires when The One Ring exhausts.

### Breaking of the Fellowship, stage 2B

Stage 2A removes the Ring-bearer and its attachments from the game, with The One Ring's text blank while that resolves. At the end of the refresh phase on stage 2B, each seat, starting with the first, creates its own staging area and advances to a different stage 3A of its choice (142063 to 142066), then the seats move the shared encounter cards to their own areas one at a time in player order. Phases still resolve in seat order, starting with the first seat.

After a seat commits to its own stage, it reveals its encounter card, then compares its own committed willpower with the threat in its own staging area. Progress goes on its stage, or its own threat rises by the difference. Another seat does not raise threat for that failure.

Engagement checks use only that seat's staging area. "At this stage" does not reach another seat's cards. Archery is totaled per stage, and only that seat assigns it. Cards that say "the staging area" or "the quest" mean that seat's. Seats may still affect each other through ordinary card effects that do not use those phrases.

If a seat is eliminated while stages are separate, that stage and the encounter cards at it are discarded.

### Seeded decks

On first launch, insert two saved decks that match the printed starter lists. They are ordinary `user.db` decks. The parenthetical numbers below are collector numbers inside a product, not RingsDB codes, and the same number is used in the core set and in this box. Resolve each row by card name against the core set plus MEC109. Prefer the Revised Core code when the booklet's core-set card has a revised printing. The lists are data: `data/starter-decks.json` holds each row with the code chosen for it and the MEC109 span (`mec109.starter-stealth`, `mec109.starter-wisdom`) that prints the list, `pnpm data:build` copies them into `data/campaigns/fellowship-of-the-ring.json` as `starterDecks`, and the seed script reads that file. A test checks each row's name, collector number and count, and each section total, against the span.

These decks can be built from this expansion and the core set. Counts were checked against the booklet extract: each list is 3 heroes and 50 other cards.

**Stealth and Steadfastness**

- Heroes: Sam Gamgee (3), Merry (4), Pippin (6)
- Allies: 3 Bill the Pony (8), 2 Boromir (11), 2 Faramir (14), 2 Veteran Axehand (28), 2 Beorn (31), 3 Erebor Hammersmith (59), 2 Henamarth Riversong (60), 2 Gléowine (62), 3 Gandalf (73)
- Attachments: 3 Hobbit Cloak (10), 3 Dagger of Westernesse (13), 3 Elf-stone (20), 1 Steward of Gondor (26), 1 Celebrían's Stone (27), 1 Horn of Gondor (42)
- Events: 2 Halfling Determination (14), 3 Frodo's Intuition (26), 2 Ever Vigilant (20), 2 Common Cause (21), 3 Sneak Attack (23), 3 Feint (34), 2 Quick Strike (35)

**Wisdom and Wizardry**

- Heroes: Gandalf (7), Théodred (2), Éowyn (7)
- Allies: 3 Galadriel (9), 3 Bilbo Baggins (15), 1 Faramir (14), 3 Snowbourn Scout (16), 3 Wandering Took (43), 3 Northern Tracker (45)
- Attachments: 3 Gandalf's Staff (22), 3 Wizard Pipe (23), 2 Fellowship of the Ring (25), 2 Steward of Gondor (26), 1 Celebrían's Stone (27), 3 Unexpected Courage (57)
- Events: 3 Flame of Anor (24), 1 Ever Vigilant (20), 1 Common Cause (21), 2 Valiant Sacrifice (24), 1 Grim Resolve (25), 1 The Galadhrim's Greeting (46), 3 Hasty Stroke (48), 3 A Test of Will (50), 3 Stand and Fight (51), 2 Dwarven Tomb (63)

When both decks are used together, the booklet says to replace the three copies of Gandalf (73) in Stealth and Steadfastness with three copies of Elrond (19). Show that as a note on each starter deck's own screen, not on the deck list (user request, 2026-10-25). Do not mutate either saved deck. The same unique card may sit in both decks. A second copy cannot enter play. Do not reject the pair for sharing Faramir, Steward of Gondor, or Celebrían's Stone.

## Mirkwood Paths and The Dark of Mirkwood

Two more official campaigns are built from the Revised Core Set (FFG product MEC101, RingsDB pack `RevCore`) and The Dark of Mirkwood (RingsDB pack `TDoM`). The Dark of Mirkwood rulebook (`tdom`, pinned in `data/sources.json`; `tdom.campaign-mode`, `tdom.mirkwood-paths`, `tdom.mini-campaign`) says how they fit together. Their data is built (phase 27, `docs/plans/mirkwood-paths.md`) and the app knows more than one campaign (phase 28): the campaign list shows one start panel for each campaign `data/campaigns/index.json` marks playable (`start-<id>`; `start-fellowship` for the Fellowship), the Scenarios tab one section for each box, and each save's progress line, path, log and booklet read their own campaign. None of their scenarios is playable yet, so both stay locked in the index until one scenario is in `PLAYABLE_SCENARIOS` (phases 29 to 33).

| Campaign id | Name | Scenarios, in order | Booklet |
| --- | --- | --- | --- |
| `mirkwood-paths` | Mirkwood Paths | `passage-through-mirkwood` (part 1), `journey-along-the-anduin` (2), `escape-from-dol-guldur` (3), `the-oath` (4), `the-caves-of-nibin-dum` (5) | `learn-to-play` (core campaign pages 30 and 31) |
| `the-dark-of-mirkwood` | The Dark of Mirkwood | `the-oath`, `the-caves-of-nibin-dum`, as a two-scenario mini campaign on a blank Campaign Log | `the-dark-of-mirkwood` |

The two campaigns share the scenario files of The Oath and The Caves of Nibin-Dûm. Neither is a saga: `saga` is false in their campaign files, so no Ring-bearer, no Fellowship-sphere hero and no prelude. Each campaign file names its booklet (`bookletId`) and, where the booklet prints a scenario's setup paragraph, its page (`bookletPages`; Mirkwood Paths has them for the three core scenarios, whose paragraphs are on Learn to Play p25, `ltp.setup-passage-through-mirkwood` and its two siblings).

Data rules, each with its reason in `data/overrides.json` or the code:

- The cards come from Hall of Beorn alone for these boxes, by `CardSet` ("Revised Core Set", "The Dark of Mirkwood"). Nightmare sets are different `CardSet`s and stay out. Hall of Beorn's " (Campaign)" encounter-set suffix is not part of the set's name.
- The Revised Core Set reprints the 2011 core encounter cards under the same codes (01074 to 01131); the `RevCore` printing owns them. The Dark of Mirkwood's Hall of Beorn codes (020NN) are The Hunt for Gollum's, so its code is `410` and the two-digit collector number (Stalking Goblin 41041, as RingsDB lists it).
- Hall of Beorn's per-scenario counts lead. The quest card's printed Setup (from the scan-read ledger `data/printed/mirkwood-paths.json`) moves cards out of the encounter deck: searched for and staged, or set aside. DragnCards' decks (the 2011 core Q01/E01 and the Limited Collector's Edition Q00/E00 of The Oath and The Caves) are a cross-check: it compares each card's copy count (Normal and Easy), not which pile the copy is in. The Easy Mode sheet (`easy-mode.core-set`) lists the cards Easy removes from each Core Set encounter set and settles the Revised Core scenarios' Easy counts.
- The Learn to Play calls the second core scenario's set "Journey Down the Anduin"; the cards print "Journey Along the Anduin". The card wins; the booklet name is an alias (`encounterSetAliases`).

## Deckbuilding

The builder is a root route beside the campaign list.

`deck_legal` is set at catalog build for `hero`, `ally`, `attachment`, `event`, `contract`, `player-side-quest` and `treasure` rows (`src/catalog/deck-legal.ts`; a treasure typed `Campaign` is not). `Campaign`, encounter, quest, and nightmare rows are not deck-legal. TBR's pack file mixes heroes with `type_name: "Campaign"`. Filter those out in the build script, not in the UI.

A deck saves at any stage, so a deck can be built over several sittings (user decision, 2026-10-25). The deck list and the editor say whether it is ready to play, and name the first rule it breaks ("Needs 3 more cards"); the briefing does not offer a deck that is not ready. Adding a copy past the copy limit, a hero twice, or a fourth hero is refused at the tap, with a sentence naming the card and the rule, and does not change the deck.

Universal rules, which decide whether a deck is ready to play, are the Rules Reference's (`rr.deckbuilding`; user decision 2026-10-25, replacing the earlier three-hero and sphere-match rules):

- One to three heroes, no two with the same title.
- At least 50 other cards.
- At most three copies of a title, across its printings, and never more than the card's `deck_limit`. `is_unique` does not lower that cap. A second copy of a unique title cannot enter play; that is not a save check. A contract in the deck is no deck card and does not count toward the minimum; at most one. The deckbuilding rules printed on its side A are `DeckRule` instructions on its records (no allies, copies by title, one starting hero or four, different spheres, an exact or larger size, cards per sphere) and change these checks (`src/catalog/deck-rules.ts`, `deck-save.ts`).
- A card's sphere does not have to match a hero to be saved. It needs a hero of that sphere to be played (`rr.resource-match`), which the table checks. Saga rules still run on the briefing loadout, not on this save.
- A restriction record on a card (trait, sphere, campaign) is enforced when that record exists. If the printed deckbuilding limit has no record yet, the card can still be saved and carries the inactive-text mark. Do not invent a restriction, and do not ask the player to enforce it at the table.

Fellowship rules run on the briefing loadout, not on the saved deck. MEC109 says Frodo is the only Ring-bearer in this box. The player chooses that hero. Do not insert a Frodo they did not choose.

- The hero count runs on the saved deck. The saga rules run on the loadout.
- The first seat's loadout has exactly one Fellowship-sphere Ring-bearer. Once The One Ring is attached, that hero does not count toward the hero limit.
- The Ring-bearer slot is required when the saved deck has no Ring-bearer, and unused when it already has one. A fourth hero is legal only when the extra hero is that Ring-bearer.
- No second Frodo in that seat's cards.
- Two-handed play requires a single Ring-bearer across the table. It does not reject two decks that share some other unique card.

A saved deck does not have to be legal for any particular campaign. The briefing picks one saved deck per seat, offers only a deck that is ready to play, and refuses to deal when the loadout fails. The error names the card and the rule.

The deck list is one list, the deck saved last first; the two starter decks are ordinary rows, not pinned (user request, 2026-10-25). It shows each deck as a card with its heroes' pictures or as a compact row, and filters by a search over deck and hero names, by ready or not ready, and by a hero's sphere. Manage offers Duplicate on every deck, Delete on the player's own (after a second, explicit tap; playthroughs keep the cards their loadout copied), and Reset on a starter, which puts it back to the printed list: a starter is put back on launch when it is missing, so it is never deleted.

Import accepts a RingsDB decklist id or a `ringsdb.com` URL (the decklist page, with or without its slug, or the API URL), via `GET /api/public/decklist/{id}.json`. That payload lists each hero in `slots` as well as in `heroes`; the slot entry is the same hero, not a second copy. Cards that are not in the official pool are reported by name and dropped. The result is an ordinary saved deck, saved at once and opened in the editor, which names what was dropped and what the deck still lacks.

The import screen also lists the pre-built decks, offline: every decklist an official product prints. They are data: `data/prebuilt-decks.json` names each one and `pnpm data:build` writes `data/decks/prebuilt.json`. The four core-set decks are the ones the Learn to Play prints (`ltp.starter-decks`): the three heroes it names, every copy of the Revised Core Set's cards in its collector range, and two Gandalf (73). That is 47 cards, so the editor shows "At least 50 cards." until three are added, and the deck's note says why; DragnCards' deck of the same sphere (the 2011 core set's 30-card list) is a cross-check on the heroes and titles. Every other deck is a `decklist.*` span read from the product's own PDF (pinned with the rules in `data/sources.json`, decklist pages only): the four 2019 Starter Decks (whose deck and sideboard must also equal DragnCards' lists and the product's RingsDB contents), the two starter decklists in each of the Angmar Awakened, Dream-chaser and Ered Mithrin Hero Expansions and The Two Towers and The Return of the King Saga Expansions, the decklists in the six original saga rulesheets and the two Hobbit rulesheets, and FFG's three Community Deck Lists. A row is resolved by its name, type and collector number within the products the list names (a Community Deck List row: the products it prints), through Hall of Beorn. Where Hall of Beorn numbers a revised product's reprints differently from the print (The Two Towers, The Return of the King, Ered Mithrin), the deck is marked `renumbered` and a number that matches no printing falls back to the name, only when one card has it. A printed misspelling, short name or wrong collector number is an alias with its reason; a heading total that disagrees with its rows is a recorded misprint with its reason; a printed condition (Valor and Vigilance's 0-3x rows) is a chosen count, and the condition shows as the editor's note. The screen is one list: the RingsDB field and Import scroll away above the decks, which sit under sticky full-width group headings (Core Set, Starter Decks, Hero Expansions, Saga Expansions, Original Saga Expansions, The Hobbit, Community Deck Lists); each row shows the heroes' spheres and names. Tapping a pre-built deck opens it in the editor as a new deck (heroes and cards, without the sideboard), with its note (a printed condition, or why a core deck is 47 cards) on the editor's note line; Save is the one action, so a tap never saves a second copy. Pre-built decks are not seeded, and are not in the printed-text or effect scope.

Filters on the pool screen: name, sphere, type, pack or cycle, trait, cost, unique, and whether the card's text is applied (the Applied only chip). Opening a card shows stats, text, and the errata line. A line the app does not apply is labeled Not applied, with what that costs the player (an ability not applied, a card that cannot be played). Nothing on that screen writes a campaign.

## Effects

### Three layers

1. **Keywords**, above.
2. **Unique card text.** An effect record:

```ts
type Effect = {
  id: string; // "<code>:<timing>:<n>", unique
  cardCode: string;
  lines: string[]; // the ledger lines it implements, "<code>:<side>:<n>"; at least one
  timing:
    | "setup"
    | "forced"
    | "triggered"
    | "whenRevealed"
    | "response"
    | "action"
    | "shadow"
    | "constant"
    | "questResolution"
    | "campaignSetup"  // the Setup printed on a campaign card
    | "resolution"     // the Resolution printed on a campaign card
    | "travel"
    | "engagement"
    | "beginningOfPhase"
    | "endOfPhase"
    | "endOfRound";
  trigger?: Trigger;  // the engine event it answers; the list is `triggerSchema` plus the families' TRIGGERS
  limit?: Limit;      // oncePerPhase, oncePerRound, oncePerRoundEachPlayer, twicePerPhase, oncePerAttack, oncePerGame, ... (`limitSchema`)
  cost?: Cost | Cost[];
  subject?: "self" | "host" | PickSpec;  // which card the event must be about
  anyPlayer?: boolean;                   // any player may use this Action or Response
  fromHand?: true;                       // used from the owner's hand only
  cancel?: { cost: number; sphere?: Sphere; unless?: Condition }; // the first player may pay to cancel it
  condition?: Condition;
  instructions: Instruction[];
};
```

`forced` and `triggered` effects name the engine event they answer in `trigger`. A `triggered` effect is mandatory and not printed as Forced. It resolves before the Forced effects on the same event, and those are collected after it resolves. Forced effects then resolve oldest card in play first, each in its own frame. A setup record for a card that the scenario definition or the campaign script already puts out describes that placement. It never places the card a second time.

`constant` is a while-in-play modifier. It appends a record to the modifier list. The engine rebuilds those records from the effect list after every intent, so they follow the source card and its condition. Hide numbers (the X, the discarded threat, the committed willpower) are held by the table or by a seat in the same list. A constant that forbids something (`Restrict`: advance, travel, attach, hero limit, defend) is checked where the thing happens; a bar that falls on other cards (cannot attack, take damage, take non-combat damage, be engaged, be optionally engaged) is a flag on the modifier list of each card it bars. A card's stat below 0 counts as 0, and a stat set to a value (`SetStat`) overrides every other modifier (`rr.modifiers`). A constant whose condition is "while this card is in the victory display" works from there (141046:A:2, `rr.in-play-and-out-of-play`). A lasting effect of an encounter card on "each ally" also holds for allies that enter play later (`rr.lasting-effects`). A response names the event it answers in `trigger`.

An Action or Response may name a `cost` (exhaust or discard the card, add it to the victory display, or pay resources from the heroes the player names) and a `limit`. The cost is paid when the effect is triggered, and the use is recorded for the limit. A Response window offers each Response a seat may use after an event; a pass gives up all of that seat's offers for it. Peril limits who is offered. Instructions are engine verbs. The vocabulary (verbs, triggers, stat flags) is split by mechanic family: `src/catalog/families/<family>.ts` declares each family's share (encounter, costs, quest, defense, attachments, attack, play, deck, sidequests, misc, burden, south) and `index.ts` composes them; `src/rules/families/<family>*.ts` runs them and `src/effects/authored/families/<family>.ts` holds their records (`docs/plans/effect-authoring.md`). The verb list grows when a dealt card or a starter card needs a verb. That growth stays inside this interpreter. There is no second language. Scenario 1 needs static modifiers, a response trigger, cancel, and delayed instructions.

The Zod schemas for `Effect`, `Instruction`, `Condition`, `Cost`, and `ScenarioDefinition` live in `src/catalog`. `src/effects` exports the generated records plus the authored ones, an authored id replacing a generated one. The interpreter takes the effect list as an argument and does not import `src/effects`; `src/campaign`, `src/play` and `src/screens` import it and pass it in. There is no effects table in `catalog.db`.

Gandalf's Delay (141078) has two Setup records: the placement in staging, and `ReduceOpeningHand` amount 1. It is cited to MEC109 #46 (user-accepted). RingsDB's row for 141078 differs from the MEC109 printing on the starting-hand rule; the MEC109 printing wins (user decision). The engine applies it with player Setup, before the opening hand, so the opening hand and a mulligan redraw both draw 6 minus the reduction. The same holds in a later scenario, where the campaign pool has shuffled it into the encounter deck: it is in the encounter deck at the beginning of the game, so its hand sentence counts before the hands are drawn and the encounter search places it after them (`mec109.setup`).

Frodo Baggins (141001) is in every game as the Ring-bearer, so his Response is a record like a dealt card's: after a card is revealed from the encounter deck, before any of its effects (keywords included) resolve, his controller may spend 1 Fellowship resource and exhaust The One Ring to cancel them; the card is shuffled back and the same seat reveals another. The other saga Frodo (142001) has a record too: when he defends, exhaust The One Ring and spend a Fellowship resource, and the attack deals no damage.

3. **Player cards with an open line.** Every deck-legal player card is automated (user decision, 2026-10-26). A card outside the box has no scan-read ledger entry: its printed lines are its source text written to the ledger's conventions (`src/catalog/pool-lines.ts`, read by `scripts/data/printed/pool.ts`: one ability per line, icons as words), and its records live in `src/effects/authored/pool/<pack>.ts`. Templates read the pool's lines like the box's. While a line has no record it is listed in `src/effects/open-lines.ts` (`pnpm effects:open` rewrites it; the coverage test checks it): the card can be paid for, played, quested, defended, and attacked with using printed numbers and implemented keywords. The line is shown, it is not offered, and there is no sheet on which the player applies it. When the record exists, the ability becomes a normal legal intent or a normal engine step. An event with no record is the exception: as the engine applies it, its Action could not change the game state, so it is not played and opens no action window (`rr.triggered-ability`: "A triggered ability on a player card can only be initiated if its effect has the potential to change the game state on its own"; user decision 2026-10-26, replacing "can be paid for, played" for events). The mark is per printed line (`src/catalog/active-text.ts`): a line is applied when a record names it in `lines`, when it is only keywords the engine reads, or when the ledger marks it inert. A card the shipped ledger does not hold is read from its source text with the pool's reading, so the app names exactly the lines of `open-lines.ts` (the coverage test checks the two agree). The player sees the words "Not applied", never "inactive" (`docs/plans/inactive-text.md`).

A player card outside the box that the player's own decks play can be brought into scope on request: it joins `PLAYER_REQUESTS` in `scripts/data/printed/scope.ts`, `pnpm data:sync scans` pins its scan, its lines are read into the ledger, and it gets a record like any other (user request, 2026-10-25). The first is The Shirefolk (19121): "Play only if each of your heroes is a Hobbit" is the `heroesAll` condition on its Action, so it cannot be played otherwise, and it reduces its player's threat by 4.

The four core-set Learn to Play decks followed (user request, 2026-10-26): their 42 cards with text are in `PLAYER_REQUESTS`, read from the Revised Core Set scans, and every printed line is owned (the coverage test holds the requests to that). Their records are the pool's and the mechanic families' (`src/effects/authored/pool/Core.ts`, `src/effects/authored/families/`), one record per printed line; the core decks' tests (`src/campaign/core-*.test.ts`) play them. Readings checked against the rules text (2026-10-26): Brok Ironfist's Response is not offered while a Brok Ironfist is in play, since putting him into play then could not change the game state (`rr.triggered-ability`, `rr.unique-cards`; the record's `intoPlay` condition); Thalin damages only a card the encounter deck reveals (staging, a surge, the top card; `rr.staging`), not one a player searches for and reveals, as such a card is not "revealed from the encounter deck" for a cancel either (the record's `byEncounterDeck`); Dark Knowledge also answers the shadow card dealt for an attack outside the combat phase (`rr.attacks-outside-the-combat-phase`); an Action or Response whose effect has nothing to act on (no damaged hero for Daughter of the Nimrodel, no Condition attachment for Miner of the Iron Hills, no damage on Self Preservation's host) is not offered (`rr.triggered-ability`); and an encounter card that "counts as a Condition attachment" (141043, 141055) is one for "a Condition attachment" (`CountsAs`), so Miner of the Iron Hills can discard it. Stand Together's extra defenders are the chosen player's own characters, as printed: their defense is pooled and the defending player puts all the damage on one of them (`rr.multiple-defenders`).

Campaign-dealt cards cannot be inactive. That includes encounter cards, quest cards, boons, burdens, and The One Ring. A missing effect id there fails the coverage test, and the scenario stays unplayable.

### Player side quests, contracts and saga cards

These are supported by the engine and the catalog (families `sidequests` and `misc`; every deck-legal card is in scope, user decision 2026-10-26). The Rules Reference in `data/rules` has no span for side quests or contracts, so the rules follow the printed cards and the Learn to Play; the Battle, Siege and Guarded (X) keywords follow `hon.battle`, `hon.siege` and `hon.archery` (the Heirs of Númenor rulesheet) and `wor.guarded-x` (the Wilds of Rhovanion rulesheet).

- A player side quest sits in its player's quest area (zone `seatQuest`). Characters commit to it instead of the current quest; their Willpower (or attack for Battle, defense for Siege, `QuestsWith`) is placed on it as progress, not compared with staging threat, and it is defeated when its progress reaches its quest points.
- A contract starts in its player's play area, outside the deck, showing side A; its own abilities flip it (`FlipCard`), and each side's records carry a `faceUp` condition. Its side A deckbuilding rules are checked on save (Deckbuilding, above).
- A card with the Encounter keyword is set aside at the start and a player card effect shuffles it into the encounter deck, where it is revealed like an encounter card (`EncounterKeyword`). `VictoryLimit` and `InPlayLimit` cap copies in the victory display and in play.
- Saga cards the box does not deal (The One Ring and Master cards, collection heroes) are records in the `misc` family.
- Messenger of the King: the `(MotK)` hero versions of unique allies (pack `MotKA`) and the Messenger of the King contract (22134) are not in the card pool (`outOfScope` in `data/overrides.json`, user decision 2026-10-26).

### Window stack

Forced effects in the current window run in timestamp order. Responses are offered and may be passed. A Hide test, a shadow reveal, or a When Revealed pushes a frame and pops it before the parent continues. Do not flatten these into one modal queue with no stack. The Hide action window happens after the discarded cards' threat is known and before success or failure. Hide itself runs before When Revealed or Forced on the card that was just revealed.

### Coverage test

`scripts/effect-coverage.test.ts` reads the printed lines from `data/cards` and the dealt cards from `data/scenarios`, with no database. From phase 8c it checks line ownership against the ledger: every printed line is owned by a record, an implemented keyword, or an `inert` ledger entry with a reason. A campaign is not marked playable unless that test finds an effect record for every printed line on its quest deck, encounter deck, burden deck, and the seeded starter decks, and for every Setup, Forced, When Revealed, Response, Action, Travel and shadow label by timing. `pnpm effects:draft <scenario | starter deck id | pack | codes>` writes a bundle under `.agent/drafts` for each line no template reads; the `effect-author` agent turns a bundle into authored records. A player deck that contains other official cards does not fail this test; the open-lines list names what is left, and it is meant to reach empty (user decision, 2026-10-26).

Author effects in scenario order. Scenario 1 and both starter decks were the first playable slice; scenarios 2 to 4 are done, and 5 and 6 reuse the same framework (their lines are the box's share of `open-lines.ts`).

## Data sources

`data/sources.json` lists every source with its URL, its pin (a sha256, or a git commit for the DragnCards plugin) and when it was fetched. `pnpm data:sync` is the only command that uses the network; it refreshes `data/raw/` (verbatim snapshots) and `.cache/pdf/` (the rule PDFs, not committed), and `pnpm data:build` turns them into `data/cards`, `data/scenarios`, `data/campaigns`, `data/rules` and `src/effects/generated` without it. `pnpm data:check` fails when a fresh build differs from what is committed.

| Need | Source |
| --- | --- |
| Packs, player cards, codes, errata, RingsDB images | RingsDB public API |
| Every card as typed JSON, the MEC109 printing, Normal, Easy and Nightmare counts per scenario (the Fellowship box, the Revised Core Set and The Dark of Mirkwood) | Hall of Beorn export |
| Card database, scenario load lists by pile, framework steps, automation snippets, card art | DragnCards LOTR plugin |
| Procedures and definitions | MEC109 booklet, core-set Learn to Play, The Dark of Mirkwood rulebook, Rules Reference, FAQ, Easy mode, campaign log, and the keyword rules of two rulesheets (Heirs of Númenor, Wilds of Rhovanion) (PDFs, extracted per page) |

Sources disagree. The build cross-checks them (Hall of Beorn counts against the DragnCards load lists, piles against the quest card's Setup text) and a scenario that fails a check is not written. Each resolved disagreement is a row in `data/overrides.json` with its reason and source.

RingsDB states that the texts are copyrighted by Fantasy Flight Games and that the API is for tools that complement the game.

Prefer `has_errata` text. `data/sources.json` records the fetch date; `catalog.db` carries it in a `meta` row.

Snapshot the card codes a scenario actually dealt into the save at scenario start, so a later catalog rebuild cannot rewrite a game in progress.

## Card images

The asset is the file RingsDB already hosts at `imagesrc`. On 23 Oct 2026 that was a JPEG of about 430×600 for a normal card. Frodo `141001` was 423×600 and 148338 bytes. Aragorn `01001` was 429×600 and 150904 bytes. Hall of Beorn served the same Frodo bytes. Do not upscale these, and do not hunt a 300 dpi master. Sniff the magic bytes, because the URL ends in `.png`.

`GET /api/public/cards/` that day returned 1,107 official rows after dropping pack names that start with `ALeP`. 1,039 of them had an `imagesrc`. A content-length pass got 1,014 of those files, summing to 416.5 MB. The other 25 answered 503. Filling those from the median of their type puts the official player-card image set at about 420 MB. The median file was 152 KB. Allies, attachments, events, and heroes sit near 150 KB. Treasure rows sit near 550 KB and are why the mean is higher. Quest and encounter images are not in that 420 MB. They use the same kind of file and the same cache, and they are extra storage once their URLs are known.

Download with `File.createDownloadTask` from `expo-file-system` into the document directory. Persist `DownloadPauseState` so a kill mid-file can resume. Cap concurrency and retry a 503. `user.db` `image_files` stores code, path, width, height, byte size, media type, and sha256. SQLite does not store the bytes. A catalog update deletes a file only when that code's hash changed. One local function sets `isExcludedFromBackup` on the image directory and does nothing else. About 420 MB of player-card art, plus quest and encounter art, must not enter an iCloud backup. Do not commit the files.

Keep the files out of the APK. A JPEG does not shrink inside the zip, so packing the player-card set in would add about 420 MB and put the package near half a gigabyte. The APK is the Expo binary, Skia, and `catalog.db`. `catalog.db` is a few megabytes. The native shell has not been built. A release APK for one ABI, with Expo and Skia, is expected around 50–80 MB. Treat that range as an estimate until a build exists.

The inspect screen shows the cached file and can zoom it. The table decodes the same file at the card's on-screen size. There is no second image and no image server. Text is enough to play while a file is still downloading. After the cache is on disk, airplane mode still shows it.

## Persistence and shipping

Open `catalog.db` and `user.db` as two handles, both reachable from screens. Do not nest `SQLiteProvider` and read both through `useSQLiteContext`. That hook returns the nearest provider, and the suspense helper keeps one module-level database and closes the previous file.

`catalog.db` is a Metro asset. `forceOverwrite` defaults to false. Pass true only when the bundled `CATALOG_VERSION` is greater than the version stored in `user.db`. `scripts/build-catalog.ts` writes that constant when it writes the database. On first launch the applied version is absent, so the copy runs.

`user.db` tables: `decks`, `saves`, `standalone_games`, `image_files`, `booklets`, `settings` (one JSON value per key; `table` holds the table's stops, the free Responses always used, the readability options and the first-game guide), `meta` (applied catalog version). Drizzle migrations for these are committed and run on open. `saves.activeScenario` is `{ engineVersion, dataHash, seed, intents }`, replayed through the reducer on load. When the engine version or the data hash differs, or the reducer refuses an intent, drop the in-progress scenario and keep the log, the decks, and the image index. Do not migrate a half-played game during this box. `standalone_games` holds one row per standalone game: the box, the scenario, the seat count, the dealt loadout, the open game as the same `{ engineVersion, dataHash, seed, intents }`, the result, when it was dealt, and when it was archived. It has no log or pool column.

`booklets` is one row per book: id, path, original filename, byte size, sha256, page count, and last page. One file per book lives in the document directory under `booklets/`. Those bytes stay eligible for backup. A catalog update does not delete the row or the file. The picker cache is not the store. Copy the picked file into `booklets/` before recording the row. The ids are `fellowship-of-the-ring` (MEC109), `learn-to-play` (the core-set book), `rules-reference` (MEC101.pdf, pinned as `rr`) and `the-dark-of-mirkwood` (`dark_of_mirkwood_rulebook_v2.pdf`, pinned as `tdom`). A later campaign adds its own id. A campaign opens the book its data names (`bookletId`): the Fellowship its MEC109 book, Mirkwood Paths the Learn to Play, The Dark of Mirkwood its own rulebook. When the build carries the book and no stored file is there, opening the reader copies the bundled PDF into `booklets/` through the same path as a picked file. A book the player added stays. Gitignore the PDFs.

`catalog.db` tables: `packs`, `cards`, `campaigns`, `meta`. No decks, no saves, no image bytes, no effects (records are code in `src/effects`) and no scenarios (they are `data/scenarios`, read by `src/campaign`). `cards.deck_legal` is true for builder types. `cards.campaign_id` is set only for rows a campaign owns. One `drizzle-orm/sqlite-core` schema in `src/catalog` defines those tables. The script opens it with `better-sqlite3`. The phone opens the same tables with `expo-sqlite`, read-only. RingsDB payloads are cached in a gitignored directory. A re-run with that cache present does not refetch. CI fetches on a miss.

Schema changes to `catalog.db` are a new file, not an in-place migration. Schema changes to `user.db` are migrations.

EAS Build produces the Android and iOS binaries from the same asset. Android can sideload an APK. A physical iPhone needs Apple signing (EAS dev client, ad hoc, or TestFlight). The simulator does not.

Development gotcha: the copy from the asset into the app sandbox runs once per database name. After changing `assets/catalog.db` during development, bump `CATALOG_VERSION` or delete the app's storage. Do not leave `forceOverwrite` unconditionally true.

The phone plays with no network once a card's image is cached. Text is enough while a download is still pending.

## Screens

Chrome follows [design-system.md](design-system.md). Phase 17 writes that file from the card art, the scenario scans, and the booklets. Later screen phases use its tokens. They do not invent a second palette, a second type scale, or a second styling system. Decoration that stalls a list or a drag does not ship. The performance rules above still win.

| Route | Behavior |
| --- | --- |
| Campaign list | Root. Reads campaigns and saves. It does not scan `cards`. Fellowship is playable. Later campaigns may show as locked, with name and scenario count. Locking does not hide cards. The playthrough written last says what is next and does it in one tap: Resume opens the table on its open scenario, Begin the briefing of its current scenario, and a finished campaign its path; its path and log are one tap each. Archives a playthrough out of the open list and restores it as it was, log and open scenario included. Deletes a playthrough, open or archived, only after a second, explicit confirm; a delete cannot be undone and leaves the decks. |
| Scenarios | Root tab beside the campaign list. A game in progress sits on top (Resume). Then the box's scenarios in book order; a playable one opens the standalone briefing, the others read "Not playable yet". Under them the finished games, newest first, each with its result and score and Play again. Manage turns each into Archive and Delete; archived games sit under "Archived · n" with Restore and Delete. A delete is asked a second time and cannot be undone; it leaves the decks. |
| Standalone briefing | The briefing without a campaign: stages, sets and counts, special rules, Easy or Normal, True solo or Two-handed, a saved deck per seat and, in a saga box only, the Ring-bearer slot, validator errors that name the card. No checklist, penalty or choices. Deal writes a new game and opens its table. |
| Standalone outcome | Victory with the score and its parts, or Defeat with the reason. The result asks for nothing, so it is written as the screen opens; Done returns to Scenarios and Play again opens the briefing with the same choices. Nothing is written to a campaign. The table's last sheet for a standalone win says "The scenario is won." and See the score, never the campaign card's rewards. |
| Campaign path | One node for each scenario of the campaign, in book order (six for the Fellowship): locked, current, or completed. A completed node shows the reward that was chosen. The pool sits under the path. The log is one tap away, not a settings page. Opens a stored booklet and returns here on close. |
| Log | The sheet as data: heroes per seat, fallen heroes per seat, threat modifier, boons and which hero a permanent boon is stuck to, burdens, one scenario row for each scenario of the campaign, score, notes. Opens a stored booklet and returns here on close. |
| Briefing | Stages in order, encounter sets and counts for Easy or Normal, special rules by name, deck picker (the Decks tab's list, with its views and filters), the Ring-bearer slot, validator errors that name the card. The Ring-bearer slot is shown, and required when the deck has no Ring-bearer, only in a saga campaign; outside one there is none, and a Fellowship-sphere hero is refused. Refuses to deal on failure. Opens a stored booklet and returns here on close. |
| Table | Landscape only (user request, 2026-10-25). Phase rail, pinned quest stage, staging, active location, the engagement area between staging and the player's cards, play area, hand, and four piles: the player's deck and discard pile, the encounter deck and its discard pile, each with its count; only a discard pile opens a list. A character defending, attacking, or hit by an undefended attack is drawn beside the enemy it fights while the attack lasts. The rail shows the step the engine is in. It does not skip steps. Hide numbers, life number, burden deck, second active-location slot, and a second staging area render only when the script declares them. The second active-location slot is shared scenario state. A trigger shows the card, the timing, and the legal choices. Shadow cards stay face down until that attack. Resource, damage, threat, and progress change only when the engine changes them; the table shows the engine's numbers for the moment (committed willpower against staging threat while questing, attack against defense in an attack) and, after each intent, what it did (the quest's result, each strike and its damage). Choices are made on the table: a tap picks, a button confirms, and no single tap sends an intent; a button that sends one with nothing picked (Pass, Keep, Leave undefended) must be tapped twice. The exception is a moment with only one answer, where the engine allows one intent and the table shows one answer for it (user request, 2026-10-25: no character can defend, so Leave undefended is the answer (with one hero it hit, the dock names that hero, says whether the hero is destroyed, and draws the hero beside the enemy); nothing to travel to; a window with only Pass; a Look's Done; a lone option of a choice; an archery total one character must take): its answer is picked already and one tap on its card or its button sends it. A sheet opened from the table is never such a moment. Undo, in the dock, takes back the last choice while it showed nothing hidden (Rules engine). A long press shows a card large with its attachments and the effects on it, an effect still to come, and why a hand card cannot be played now. Before a choice is confirmed the dock says what it would do: each defender's damage and whether it is destroyed (several defenders pool their defense), an undefended hit, what a commit leaves for combat and which enemies it would face, what a travel changes in staging. A choice that loses the game is asked twice, the second tap naming the loss. The quest band names how a stage without quest points is won. The threat dial marks the threat that engages each staging enemy and opens the threat panel; a staging enemy the engagement checks would engage now is marked. Both read the engine's own checks run on a copy (`engagementForecast`), so an enemy that cannot be engaged stays, and one enemy engages one seat. In two-handed play the player may peek at the other seat's whole area (its hand, play area, engaged enemies, deck and discard pile) by tapping that seat's threat dial, because both hands are the one player's (user decision, 2026-10-26): a peek is a view and nothing else. The engine's acting seat does not change, the dock, every pick and every intent stay the acting seat's, a tap on a card only opens its preview, nothing can be dragged, the table says plainly whose area it shows and who is acting, and the peek is not saved: it ends with the next state the engine reaches, on Android Back, or on a tap on the acting seat's dial. A true solo table has one dial and no peek; staging and the quest are shared and stay on the table. The rail opens the turn reference: the round's steps from `data/rules`, the player's stops and the settings (strong outlines, the first-game guide, a line in the dock's note the first times each step's own decision comes up). Stops are off until the player turns them on; then a step's action window that is not a stop is passed for the player unless a card usable there is new, and Pass to stop passes to the next stop or planning, whichever comes first. Planning, the commit, Responses and every pick always ask. A free Response (no cost, nothing to choose) can be set to Always use. A stop or an Always is the player's own standing answer, so it stands as the confirmation; each answer is an ordinary intent that Undo takes back. The outcome banner resolves in beats, each ringing on the table the cards it names, and the moment a round ends adds the round's summary. A card with a line the app does not apply carries a small struck ring at its edge; its preview lists the lines under Not applied. Opens a stored booklet and returns here on close. |
| Resolution | Choice buttons from the script. A loss has no reward screen. |
| Booklet | Full-screen native reader for one stored PDF, with pinch and double-tap zoom. Close sits in thumb reach and returns to the screen that opened it. The engine does not read the file. A build that carries the book installs it on first open. A missing file does not block a scenario. The control offers to add the booklet and names which book is absent. Ids: `fellowship-of-the-ring`, `learn-to-play`, `rules-reference` and `the-dark-of-mirkwood`. The same reader opens all four, and a campaign's path, log and briefing open the book its data names (`bookletId`). Opening from a scenario starts on that scenario's page index when one is recorded, and otherwise on the saved last page. Turning a page writes the last page. It is not a Skia surface and not a WebView. |
| Card | Full-screen view of the cached RingsDB file. Lists and this screen use `expo-image`. The table decodes the same file with Skia, at the size on screen. Details on the table's long-press preview opens this route. The picture stays on the canvas. |
| Card pool | The Cards tab, and the deck editor's picker. Search, type chips and filters. Loads card rows when the screen opens, then filters in memory. No campaign writes. Packs, encounter cards included, open from the Cards tab. Opened to add cards, each row has − and + with the deck's count, and a bar shows the deck's counts above Done. Every add, removal and refusal is said in a toast at the foot of the screen, with Undo for a change. |
| Rules | The four stored books, each opening the booklet reader and returning here on close, and a glossary of the rule spans in `data/rules` (Rules Reference, Learn to Play, FAQ, Easy Mode, the MEC109 rules, The Dark of Mirkwood rulebook's rules; not decklists, scenario setups or stage text) searched by title and term. The table's Rules opens the same glossary over the game, and Back returns to the table. A rule shows its book and page, its text as the span prints it, and its See also names as links; a rule from a stored booklet opens the reader on its page. |
| Deck list | One list, the deck saved last first, starters included. Cards view (hero pictures) or List view (compact rows); search, Ready / Not ready, and sphere filters. Each shows its heroes, its counts, whether it is ready to play, and how many of its cards have text the app does not apply. New deck, Import. Manage: Duplicate, Delete (asked twice), Reset on a starter. |
| Deck | Subsections in order: Heroes (up to three slots at the top, an empty one opens the pool on heroes), Allies, Attachments, Events, each with its count and Add. Count against 50, starting threat, ready to play or the rule it breaks, how many cards have text not applied, cards grouped by type with − and + on each and Not applied on a card that has such a line. Copy limit by title, refused at the tap. Saga-only badge. Saves at any stage without a campaign check; Back with unsaved changes asks Save, Discard or Keep editing. |

## Build order

State: steps 1 to 5 are built, and step 6 is built for scenarios 2 to 4 (engine halves merged; phone checks and Maestro runs open in the cloud sessions that built them). Scenarios 5 and 6 are not started. `docs/phases/STATUS.md` is the record.

Do these in order. Do not start the Skia table before step 3 is green. Do not start scenario N+1 before scenario N's coverage test is green. The slice-by-slice work orders are in `docs/phases/`. What is active and what is done is in `docs/phases/STATUS.md`. Work one file until its exit is green.

### 1. Catalog script and a phone that can open it

- `scripts/build-catalog.ts` writes `assets/catalog.db` from RingsDB for every non-ALeP pack, with `deck_legal` set from the type list above.
- Fellowship encounter and quest rows for scenario 1 are loaded from `data/scenarios`, not from a live HTML parse.
- The app opens on a device, `SQLiteProvider` copies the file, and a screen lists packs and a card by code.
- `user.db` migrates beside it.
- The ESLint import boundary is on in this step.
- Exit: airplane mode, kill the app, relaunch, the card is still there.

### Image library

Its own change, after step 1, before the table. Not polish on the catalog script.

- Download `https://ringsdb.com` + `imagesrc` for official cards with `File.createDownloadTask` into the document directory. Exclude that directory from backup. Do not pack the files into the APK.
- Record width, height, byte size, and the real media type.
- Exit: airplane mode, kill, relaunch. A card opened from the pool still shows its cached file. The APK itself does not contain that file.

### 2. Deck builder

- Pool filters, deck editor, copy limits, sphere check, save, RingsDB import.
- Seed the two starter decks. Record the code chosen for each printed row.
- Exit: a deck of cards from outside the Fellowship box saves and reloads offline. A fourth copy is refused. A Fellowship hero shows the saga-only badge and still saves. On a physical phone, flinging the full official pool and typing in the filter do not hitch. The list is virtualized, and row images are decoded at row size.

### 3. Rules core, scenario 1, no pixels

Vitest fixtures, no React. Two-handed seats exist in the state even if every assertion is true solo.

- Setup builds the Normal encounter deck from `data/scenarios` and runs the quest card's setup: attach Mr. Underhill to the Ring-bearer; add Gandalf's Delay to staging; shuffle Gildor Inglorion and The Ring Draws Them into the encounter deck; set Bucklebury Ferry aside; one Black Rider in staging; Bag End is the active location. `data:build` already checks those piles against the quest card's Setup text. Assert the built Normal deck size.
- A scripted Hide 3 fails, and the booklet's success line (2 willpower, discarded threat 4, an action raises willpower to 4) passes. The action window is after the threat total is known. Hide runs before When Revealed on that card.
- Staging reveals one card for one seat. Surge reveals another for that same seat. Both are engine steps. A player intent cannot reveal an extra card.
- Quest resolution places progress on the active location first, and raises every living player's threat by the computed difference when staging threat is higher. An intent that supplies its own progress or threat number is rejected.
- Resource phase adds exactly one resource to each hero and draws one card per seat. A second gain in that phase, with no effect that says so, is rejected.
- Playing a card removes exactly its printed cost from legal spheres. Wrong sphere, overpay, and underpay are rejected.
- A defended attack places `max(0, attack − defense)` after toughness. An undefended attack places the attack value. An intent that names a different damage total is rejected. Destroying a character is a consequence of that total, not a separate player action.
- An action window offers only legal plays and legal triggers. Passing advances the phase. An unauthored player-card action is absent from the list.
- A win offers the two pairs and writes exactly the chosen codes into the pool. A loss writes nothing. A second win does not grant the reward again.
- The coverage test fails if a dealt card, or a starter-deck card, has a printed ability and no effect id.
- Illegal Fellowship loads are refused: two Fellowship heroes, a second Frodo, a missing Ring-bearer.

Exit: `vitest` green in Node. No table component exists yet.

### 4. Campaign path, briefing, log

- Path of six nodes. Only scenario 1 is current. 2–6 are visible and locked.
- Briefing shows stages, sets, Hide, and the validator.
- Log shows the sheet fields. While the table does not exist, a dev-only control may send `ChooseResolution`. It does not type a number. Delete that control in the table step.
- A stored booklet opens from the campaign list, the path, the briefing, and the log, then closes back to that screen. The release build carries the PDF; a build without it lets the player supply it. A missing file does not block a scenario.
- Exit: a win recorded by the reducer unlocks scenario 2 on the path and shows the chosen cards. A loss leaves scenario 2 locked. When the engine version on the open scenario differs, the in-progress scenario is gone and the log, the decks, and the image index remain.

### 5. Table for scenario 1

- Skia zones, phase rail, drag that dispatches commands, Hide sheet, trigger sheet, resolution screen. The table uses the same booklet route. A long press on a card previews it, and Details there opens the inspect screen (until 2026-10-25 a tap opened it). The picture stays on the canvas.
- Exit: a human can play Three is Company through Escape to Buckland on a phone, lose without corrupting the log, and win into the real resolution screen. Both starter decks are fully automated. A card from outside those decks can be sleeved and uses its printed numbers and implemented keywords. Its unique text stays inactive. The table never asks the player to apply it, and it never offers a way to type damage, resources, threat, or progress. On that phone, dragging a card stays smooth with the phase rail up. The drag does not run through JavaScript each frame.

### 6. Scenarios 2 through 6

One scenario per slice. Each slice adds the required effects, the zone or widget its cards create (life tracker, burden deck, second active location, per-seat staging), and extends the coverage test. Each slice has an engine half, proven in Node with goldens, and a phone half. The engine half can run before the table exists; the phone half needs it. Phases 8c and 8d come first: they make the printed cards and the campaign cards the input for every scenario (`docs/plans/authoritative-data.md`).

### 7. The next campaign

A new folder, `register()`, encounter rows, scripts, effects. Bump the catalog version. `user.db` stays. If it is a saga box, it fills the remaining log rows. It does not get a new log type.

## Recommendations for the implementer

Work down the build order. Stop at the end of a step whose exit check is green. Do not scaffold later steps "so the structure is ready."

- Treat a missing source as a failing test, not as a guess. If you cannot point at a rule id or the quest card for an effect's timing, do not write the effect. Leave the coverage test red and name the card.
- Scenario decks are `data/scenarios/*.json`, generated and cross-checked. Do not hand-edit them; fix the source or add an override with a reason.
- Codes come from `data/cards`. Query it with `pnpm data:query`.
- `CATALOG_VERSION` is a hash of the catalog rows, written to `src/catalog/version.ts` by `pnpm catalog:build` and checked by a test. The phone stores the applied version in `user.db` and replaces the catalog when the two differ.
- Gitignore `assets/catalog.db`, `.cache/`, card images, booklet PDFs, and `.agent/`. The app does not fetch a booklet at runtime and does not parse one into rules.
- Add the ESLint boundary in step 1, before the first component imports the reducer.
- Keep the phase rail as text steps the engine advances. Widgets for The One Ring, Hide, the life tracker, the burden deck, and the second active location are declared by the scenario script. The life number and the threat number change only through engine steps.
- Do not add a manual resolver, a "I dealt 3 damage" control, or a resource plus button. If a test can pass only by letting the UI write a token field, the test is wrong.
- When a rule in this file and the booklet disagree, change this file. Do not leave both wordings alive.
- Do not implement the Skia table, the image library, or scenarios 2–6 in the same change as the catalog script. The image library is a required data set, not a later polish pass.
- The app is not a DragnCards client. DragnCards data is a source and its automation snippets are reference for effect drafts. Where it seems to solve a rule, encode the booklet's rule and cite the rule id.
- Do not add a backend because the engine is authoritative. Authority means the reducer is the only writer. It does not mean the reducer moves to a server.
- Ship the RingsDB image as the card art, and the DragnCards or Hall of Beorn scan where RingsDB has none. Do not block the build on a 300 dpi scan, and do not put the image bytes in the APK.
- Do not defer frame rate. If the pool or the drag hitches, stop and fix it before the next scenario. Do not add a second animation library, a view per card, or a startup task that blocks the first paint.

## Definition of done for the proof of concept

All of these are true on a phone in airplane mode, after a kill and relaunch:

- The official player pool browses and a mixed-cycle deck saves.
- Fellowship's six scenarios appear in order. Only a won scenario unlocks the next.
- A Shadow of the Past can be won and lost. A win records one burden choice and one boon choice. A loss records nothing.
- The dealt cards and both starter decks are covered by the effect test.
- A player card from outside that set can be in the deck. Printed numbers and implemented keywords resolve. Its unique text is visibly inactive, and the player has no control that applies it.
- Damage, resources, threat, and progress on the finished table match the engine. No control on the phone types those numbers.
- `user.db` still has the deck and the log after a catalog version bump.
- A cached RingsDB image still opens after a kill and relaunch in airplane mode. The APK does not contain the image bytes.
- On a physical phone, flinging the official pool and dragging a card on the table stay smooth. Reduced motion snaps instead of springing. The first screen appears from local data without waiting on an image download.

## Sources checked while deciding

- MEC109 rulebook, FFG 2022, `mec109_rulebook-compressed.pdf`. Component counts, the six scenarios and their difficulties, the encounter-set lines (including Flight to the Ford using The Black Riders and The Nazgûl, not The Ring), saga setup, The One Ring, Hide tests and the order versus When Revealed, the burden deck, the life tracker, stage-4 active locations and uncontrolled facedown Ring-bearer, separate staging from stage 2B, the starter lists, the Gandalf-to-Elrond note, and the campaign log labels. The log footer grants photocopying for personal use.
- RingsDB public API, including `GET /api/public/packs/` and `GET /api/public/cards/` (1,107 official rows, 1,039 with `imagesrc`, about 420 MB of image files). RingsDB's own notice: texts are copyrighted by Fantasy Flight Games. `GET /api/public/scenarios/` returned 404. Frodo's `imagesrc`, and the matching Hall of Beorn JPEG, were 423×600 and 148338 bytes.
- Hall of Beorn page `A-Shadow-of-the-Past` for stage titles and the resolution choice between Gandalf's Delay and The Ring Draws Them, then Gildor Inglorion and Mr. Underhill. Those setup lines still have to be checked on the quest card.
- expo-sqlite `SQLiteProvider` `assetSource` and `forceOverwrite`. `.db` is a Metro asset extension. EAS Build is the Android and iOS package step.
