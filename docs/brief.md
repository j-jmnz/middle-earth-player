# Solo LOTR LCG — decisions and implementer brief

This is the source of truth for the app. Read it before writing code. It records what was decided and how to build it.

Authority, in order:

1. The MEC109 booklet, and the quest cards, when a sentence here disagrees with them. Update this file in the same commit as the code change.
2. This file, for product shape, stack, and the build order. Structure is in [architecture.md](architecture.md).
3. The core-set Learn to Play, for the ordinary round (setup, mulligan, phases). The booklet tells you to use pages 28–30 of that book for full campaign mode. Do not invent a shorter round.

Do not reopen the product shape unless a decision below is impossible. Do not port DragnCards.

Performance is a product requirement. A hitch under a finger is a failed step, the same as a wrong threat number. The section Performance and feel is binding on every screen.

The app applies the rules. Keywords, phases, effects, damage, resources, threat, and progress are engine results. The player chooses among options those rules currently allow, and cannot type the results.

The proof of concept is playable when a person can install the app on a phone, build a deck from the full official player-card pool with no network, play **A Shadow of the Past** through its campaign resolution with the dealt cards automated, and see the chosen boon and burden on the campaign log with **A Knife in the Dark** unlocked.

## Product

A personal, offline, single-device app for The Lord of the Rings Living Card Game. Official campaigns are the product. The first campaign is the 2022 **Fellowship of the Ring Saga Expansion** (FFG product MEC109). Later official campaigns are added as more content in the same app.

One human. No accounts, no rooms, no matchmaking, no server in the play loop. True solo is one local seat. Two-handed solo is two local seats on the same phone, because staging and engagement are defined per player. That is not multiplayer. The paper log has Player 3 and Player 4 columns. This app does not. `seatCount` is 1 or 2, chosen once at campaign start.

The app opens on the campaign list, not on a blank table. Deckbuilding is a separate root screen and is available before any scenario is won.

The booklet allows playing a scenario as a standalone adventure. Standalone play is out of scope until the campaign path for this box is done. Do not build it in the proof of concept.

This brief assumes a personal, unpublished app. A public store listing is a different copyright situation and is not decided here. Do not start one.

## Non-goals

Do not do any of these.

- Do not fork, vendor, or call `github.com/seastan/dragncards`, `dragncards-lotrlcg-plugin`, or the DragnCards S3 buckets (`dragncards-lotrlcg`, `dragncards-core`, `dragncards-shared`).
- Do not port DragnLang, Phoenix channels, GenServers, plugin JSON, or the generic pile engine.
- Do not build a rules language for other card games.
- Do not add accounts, auth, Patreon, image hosting, or a backend.
- Do not restrict the deck builder to cards that have automated effects, or to cards printed in the Fellowship box.
- Do not include ALeP, playtest, or Nightmare cards. Easy and Normal counts only.
- Do not commit card text, card scans, RingsDB response dumps, booklet PDFs, or `catalog.db` if this repo is public. Generate the database in the release job. The phone receives it inside the binary. The player supplies each booklet PDF once. The app does not fetch it and does not ship it.
- Do not paste the MEC109 narrative prose into the app or into git. Encode procedures. Short original labels are fine ("Hide test", "Ring-bearer's life").
- Do not ship a WebView of any existing card-table site.
- Do not build a collection tracker, an encounter-card deck editor, or a second game.

## Decisions

| Decision | Why |
| --- | --- |
| Expo app, one package, no monorepo | One person, one binary. A second package adds a build graph with nothing to share yet. |
| Rules and campaign code cannot import React Native | The game has to be tested in Node. A flat-config ESLint import rule fails the build if `src/rules` or `src/campaign` imports `react-native`, `expo-*`, or anything under `src/play` or `src/screens`. `eslint-plugin-import` v2 is the wrong tool for that config. The same rule fails an `src/effects` import from `src/rules`, `src/campaign`, `src/play`, or `src/screens`. |
| Campaign registry, not a Fellowship-named core | The next box is a folder plus a catalog rebuild. The core round and the deck builder do not mention Fellowship by name. |
| Full official player pool from the first install | Deckbuilding is not gated on campaign progress or on effect coverage. |
| Two SQLite files | `catalog.db` is reference data baked into the binary and replaceable. `user.db` is decks and saves and is never replaced by a catalog update. |
| The engine plays the game | Rules, keywords, phases, effects, damage, resources, threat, and progress are applied by the app. The player only chooses among options the current rules allow. |
| That engine stays inside the app | One device, one player, airplane mode. A rules API adds a host and a network hop. It does not make the math more correct. |
| Effects are authored records, not parsed English | A parser will mistime Forced and Response. A sentence with no effect record is inactive. It is not handed to the player to resolve. |
| Campaign-dealt cards are fully automated before the scenario is playable | Quests, encounters, boons, burdens, and The One Ring have no inactive-text path. |
| The full player pool is still deck-legal | Printed cost and combat numbers, plus implemented keywords, work without a unique-text record. The unique sentence stays inactive until an effect exists. |
| Card images are the RingsDB previews | About 430×600, one file per code, cached on the phone. A 300 dpi scan is not publicly hosted, so it is not the asset. The files stay out of the APK. |
| Feel outranks the next feature | Drag, scroll, and taps stay smooth on a phone. A correct rule that stalls the frame does not ship. |
| Identifiers are RingsDB codes (`141001`), never DragnCards UUIDs | That is the public catalog. |
| Errata wins | When RingsDB sets `has_errata`, store and display the errata text. |
| Booklet and quest card beat this file | This file paraphrases. A wrong paraphrase must not ship. |
| No card-text NLP, and no manual resolver | A wrong Forced effect is worse than leaving the sentence inactive. |

## Stack

Pin these. Do not swap them for a lookalike.

| Job | Use |
| --- | --- |
| App | Expo SDK 57.0.17 or later, TypeScript, the React Native new architecture, Expo Router. SDK 58 is out of these phases. |
| Table | `@shopify/react-native-skia`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`. The Skia version is the one `npx expo install` selects for SDK 57. The table decodes cached files. It does not call `makeImageFromView`. |
| Lists | `@shopify/flash-list`, the SDK 57 `expo install` version. The card pool, the deck editor, and any list that can grow past one screen. Not `FlatList`, and not a map of card views. If FlashList 2.0.2 is still the bundle pin, the pool does not use sticky headers. |
| Chrome screens | NativeWind 4.2.7 and Tailwind 3. NativeWind 5 is out. No MUI, Emotion, styled-components, or a second styling system |
| Catalog schema | One schema from `drizzle-orm/sqlite-core` in `src/catalog` |
| Database on device | `expo-sqlite`. The phone opens the catalog tables read-only. |
| Database build | `better-sqlite3` opens that same schema in the Node script only |
| User schema | `expo-sqlite`, with committed migrations in `drizzle/` |
| Validation at the catalog boundary | Zod |
| Images and files | `expo-file-system`, `expo-image` |
| Screen state | Zustand. The only writer of game state is the reducer in `src/rules` |
| Tests | Vitest, in Node, on `src/rules` and `src/campaign`. Maestro flows in `.maestro/` against a built app. The physical phone still judges fling and drag. Card ability text stays out of Maestro. |
| Device builds | EAS Build. Android APK/AAB. iOS IPA |

Install Reanimated, `react-native-worklets`, Gesture Handler, Skia, FlashList, `expo-sqlite`, `expo-image`, and `expo-file-system` with `npx expo install`. Worklets is the Reanimated 4 peer. Stay on the Skia and FlashList versions that command selects. Expo Go ships those binaries.

Do not add TanStack Query, Redux, a Phoenix client, or a server framework.

The rules engine is the pure TypeScript reducer in `src/rules`, called in-process by the screen. Vitest imports that same module. Maestro drives the built app and asserts the phase rail, sheets, and saves. It does not replace those unit tests, and it does not judge a drag. Do not wrap it in HTTP, a localhost server on the phone, a second package, or a remote API. The UI already cannot apply damage or resources. Moving the reducer off the device would not add a rule the module cannot express, and it would break the airplane-mode exit check.

A server is the right shape for a second human who must not see hidden cards, or for many clients sharing one live table. This product has neither. Cross-device save sync, if it is ever wanted, copies `user.db` rows. It still does not run the round. DragnCards needed Phoenix because each room was a multiplayer process. That is the architecture this app rejected.

## Performance and feel

This applies to the table, the card pool, the deck editor, the campaign path, the briefing, the log, and the image cache. A later scenario does not start while the current screen hitches. Do not leave smoothness for a polish pass.

The new architecture stays on. Reanimated is the only animation library. `react-native-worklets` is its peer. A drag, a card lift, and a sheet run on the UI thread. A finger moving across the table does not cross into JavaScript to reposition a card. The reducer runs when the gesture ends or a choice is committed, not on every movement sample. `legalIntents` is computed when the window changes, not per pixel. It does not build the cross product of every card and every target up front. The table computes targets for the card the player selected.

The table is one Skia canvas. It is not a React Native view per card. Skia decodes cached files. It does not call `makeImageFromView`. A Zustand subscriber reads the slice it draws. Reducer updates keep the same object references for zones that did not change. A threat change does not re-render the hand, the pool, or the log. Skia images that leave the table are released.

Lists virtualize. The pool loads card rows when that screen opens, then filters in memory. Painting every row is not. The campaign list reads campaigns and saves. It does not scan `cards`. `expo-image` decodes a list card and the inspect screen. The inspect screen may decode the cached file at its native size, about 430×600. The table is one Skia canvas and decodes with Skia. Nothing decodes the whole cache. Prefetch the hand, staging, and the screen the player is about to open. On the fetch date recorded below, 1,039 official rows had an `imagesrc`. About 420 MB of that is the player-card subset. Quest and encounter images are further files in the same cache. Do not prefetch the whole cache at startup, and do not make the first paint wait on a download.

The first screen paints from local SQLite. Startup does not scan the image directory or count the catalog before it draws. Image downloads stay off the interaction path.

A tap shows a pressed state in the same frame. Phase changes and sheets animate, and the animation does not gate the rule. If the engine has already resolved, the motion shows the result. A new gesture cancels the animation in progress. When the OS asks for reduced motion, the same transitions snap.

Tap targets are at least 44 points. The phase rail and the choice buttons sit where a thumb reaches. Card text on the table is the picture. Text in sheets is set in type large enough to read at arm's length. There is no desktop table shrunk into the phone.

Profile the pool fling and the table drag on a physical phone before closing step 2 and step 5. A hitch during either is a failed exit. The simulator does not count for that check.

## Repository layout

```
src/rules/        pure TS. Core round, windows, keywords, effect interpreter.
src/campaign/     pure TS. Registry, log, pool, saga validators, resolution.
src/effects/      authored effect records, grouped by set. Data, not UI.
src/catalog/      Zod schemas, including Effect, Instruction, Condition, Cost, and ScenarioDefinition. One drizzle-orm/sqlite-core catalog schema.
src/play/         Skia table, phase rail, Hide sheet, life tracker, choice sheet.
src/screens/      Expo Router. Campaigns, briefing, table, resolution, log, pool, decks.
scripts/build-catalog.ts
assets/catalog.db          generated, gitignored
drizzle/                   user.db SQL migrations, committed
fixtures/                  checked-in codes and counts for scenario decks. No card text.
```

`src/rules` and `src/campaign` have zero React imports. `src/play` sends player intents. It does not assign threat, damage, resources, progress, or log fields.

## Domain

### Campaign

A save is one playthrough of a campaign. The table is discarded when the scenario ends. The log is not.

```ts
type Save = {
  id: string;                    // this playthrough
  campaignId: string;            // "fellowship-of-the-ring"
  seatCount: 1 | 2;              // chosen once, at the start of the save
  log: CampaignLog;
  pool: PoolCard[];              // earned, not attached
  activeScenario: ScenarioState | null;
};

type CampaignLog = {
  heroesBySeat: string[][];      // RingsDB codes, length seatCount
  fallenHeroesBySeat: string[][];
  threatModifier: number;
  boons: { code: string; attachedTo: string | null; permanent: boolean }[];
  burdens: { code: string; attachedTo: string | null }[];
  completed: string[];           // scenario ids
  score: number;
  notes: string;
};
```

The paper sheet also has these labels: Heroes, Fallen Heroes, Threat Modifiers, Boons, Burdens, Scenarios Completed, Score, Notes, Campaign Total. Notes are the only free text. Do not invent a scoring formula. If a quest card or the Learn to Play states one, encode that and cite the page in this file. Until then, leave score at 0.

The log shows the six Fellowship rows. Later saga rows are added from each later booklet, in that booklet's order. This file does not set that order. The next box must not invent a second log type. Fellowship's six, in order, are fixed:

1. A Shadow of the Past
2. A Knife in the Dark
3. Flight to the Ford
4. The Ring Goes South
5. Journey in the Dark
6. Breaking of the Fellowship

A lost scenario writes nothing and stays current. A won scenario runs its resolution, then unlocks the next id. The booklet's "players defeat the scenario" means won. Replaying a won scenario does not grant the reward a second time unless that scenario's script says so. The chosen card is added to the pool, or attached when it is Permanent. The unchosen card is not added. Leave it where the quest card prints. Do not add a sweep the card does not print.

### Scenario state

Zones are real objects, not a map of string-keyed piles copied four times.

- Seat: threat, deck, hand, discard, heroes, play area (allies and attachments), engaged enemies. From Breaking of the Fellowship stage 2B, also that seat's staging area and quest stage. Model the per-seat slots from the first rules slice, even if the first playtest is true solo.
- Shared, until a script says otherwise: staging area, active location (a second active-location slot only when the script says so), quest deck and current stage, encounter deck and discard, victory display, set aside, removed from the game.
- Optional, declared by the script: burden deck, Ring-bearer life tracker, extra encounter deck.

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
- Each hero gains one resource of its own sphere in the resource phase. Saga Frodo's resource is that same gain. His pool may then pay Fellowship and neutral costs. Seats draw one card in seat order. No other gain or draw happens unless an effect instruction says so.
- Paying a cost removes exactly the printed cost. The chosen pools must sum to that cost, and each pool must be allowed to pay that card's sphere. Overpay, underpay, a wrong sphere, and spending outside a payment are rejected.
- Quest resolution compares committed willpower with staging threat. The active location is not in staging and does not add threat. Progress that would go on the quest goes on the active location first. Overflow goes on the quest. A shortfall raises that seat's threat by the difference. Breaking of the Fellowship stage 2B may override this. The core round does not.
- A defended attack places `max(0, attack − defense)` damage after modifiers. An undefended attack places the attack value. Willpower and damage read a modifier list. A `constant` effect appends a record to that list. Toughness X, on an enemy, then reduces what is placed. An indestructible enemy is not destroyed. A character at damage equal to its hit points is destroyed. The player does not enter the result. Adding a card to a zone does not reveal it. Hide, surge, and When Revealed run on a reveal.
- Forced, When Revealed, Setup, shadow, surge, doomed, and Hide run on their timing. The player does not confirm that they happened.

An intent outside the current window, with an illegal target, or with a number the rule did not ask for, is rejected with a reason. The table has no damage stepper, resource stepper, threat dial, or phase scrubber. Drop targets are zone ids the legality function returned. There is no freeform x/y table, and a drop does not move a card until the reducer accepts it.

Undo stores the intent log and the engine steps that followed, and rebuilds state, with a snapshot at each phase boundary. Replaying from that snapshot restores the state and the seed cursor. Do not diff a giant JSON tree. The interpreter and the reducer are pure. Shuffles advance the seed cursor stored on the scenario. No clock, no network, no `Math.random`.

### Engine steps

These are the verbs inside the reducer and inside effect instructions. They are not buttons.

`Draw`, `GainResources`, `PayCost`, `PlayAlly`, `Attach`, `Exhaust`, `Ready`, `Commit`, `RevealStaging`, `PlaceProgress`, `RaiseThreat`, `Travel`, `Engage`, `DealShadow`, `DeclareDefender`, `DealDamage`, `Attack`, `AdvanceStep`, `ResolveEffect`.

`Mulligan`, `Pass`, `PlayCard`, `TriggerEffect`, `ChooseTargets`, `AssignDamage`, and `ChooseResolution` are the player-facing intents. `DealDamage` and `GainResources` ignore any amount supplied by the UI. The framework or the effect computes the amount.

### Core round

Name the steps in the phase rail in words. Beginning and end of round are real steps so a response has somewhere to attach.

Setup, in this order:

1. Shuffle the decks. Place heroes. Starting threat is the sum of the dealt heroes' threat costs, plus the campaign log's threat modifier.
2. Search out player cards with Setup and resolve them before the opening hand.
3. Draw 6. One mulligan: shuffle the hand back and draw 6. No second mulligan.
4. Search out encounter cards with Setup and resolve them before the quest card's Setup.
5. Run the quest card's Setup, then flip to side B. That includes the active location, set-aside, The One Ring, and whatever that card prints. The setup Black Rider in scenario 1 is added to staging and does not take a Hide test.

1. Resource. Each hero gains one resource of its sphere. The first seat draws one card, then each later seat draws one. Player actions.
2. Planning. Play allies, attachments, and events.
3. Quest. Commit, then staging, then resolution. Saga staging reveals one encounter card per seat, in seat order, and resolves it before the next seat. For true solo that is one reveal. "You" on an encounter card means the seat who revealed it. Surge: that same seat reveals another encounter card before the next seat. Doomed X raises every seat's threat. Peril: the other seats cannot act or trigger responses while that card's staging resolves.
4. Travel.
5. Encounter. Each seat may optionally engage one enemy. Seats then repeat engagement checks in order until no enemy still in staging has an engagement cost at or below that seat's threat.
6. Combat. Deal a shadow card face down to each engaged enemy. Reveal a shadow when that enemy attacks. Resolve every enemy attack in seat order, then resolve every player attack in seat order.
7. Refresh. Ready exhausted cards. Raise each seat's threat by 1. Pass the first-player token.

Threat 50 eliminates that seat. A seat with no heroes in play is eliminated. If no seat remains, the players lose. The One Ring leaving play loses the game. Quest points met advances or flips the stage as the script says. Re-read this round against the Learn to Play before freezing it. Where that book disagrees, the book wins.

### Keywords implemented once

These live in `src/rules`, not in a card file.

- **Surge, doomed, peril.** See staging above.
- **Archery X.** At the start of combat the engine totals X across every archery card in play. The player distributes that total across legal characters. The first seat decides disputes. The amounts must sum to the total. Defense does not block it.
- **Immune to player card effects.** Player cards do not affect it and cannot choose it as a target. On The Ring Goes South stage 4, an effect that targets "the active location" can target only the active location that is not Doors of Durin.
- **Indestructible.** MEC109 defines this for an enemy. Damage does not destroy that enemy, including at full hit points. Do not extend it to other card types unless a card in this box prints the keyword there. Cite that card.
- **Toughness X.** MEC109 defines this for an enemy. Each time that enemy is assigned damage, it takes X less.
- **Permanent.** A boon or burden with this keyword is attached to one hero when it is earned, and that hero is recorded on the log. It is not left in the pool. It cannot be discarded while that hero is in play. If the hero leaves play, the attachment is removed from the game.
- **Setup.** See core round.
- **Victory.** Standard victory-display rules from the Learn to Play.
- **Sentinel, ranged.** Standard combat range from the Learn to Play.
- **Hide X.** A framework frame the scenario script requests. See below. Not a one-off in a card file.

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
| 3 | `flight-to-the-ford` | 5 | Sets: Flight to the Ford, Hunted, The Black Riders, The Nazgûl. Not The Ring. Burden deck and life tracker, below. |
| 4 | `the-ring-goes-south` | 6 | Set: The Ring Goes South only. Stage 4 can have two active locations. Doors of Durin is immune to player card effects. The Ring-bearer can be placed facedown under Watcher in the Water. |
| 5 | `journey-in-the-dark` | 8 | Set: Journey in the Dark only. |
| 6 | `breaking-of-the-fellowship` | 7 | Set: Breaking of the Fellowship only. From stage 2B, separate staging. True solo is one area. Do not delete the rule for solo. |

The booklet's scenario chapters name the encounter sets. They do not list every card. Card-by-card setup (Bag End, the Black Rider, Bucklebury Ferry, and the rest) is printed on the quest cards. Hall of Beorn is a reading aid for those lines. The quest card wins if Hall of Beorn disagrees. The runtime never fetches Hall of Beorn.

### Scenario 1 resolution

This is a transaction, not a notes field. On a win the player chooses one of:

- `Gandalf's Delay` or `The Ring Draws Them`, then
- `Gildor Inglorion` or `Mr. Underhill`.

Each chosen card is added to the campaign pool and recorded on the log. Look up the current RingsDB codes while building the catalog. In the TBR pack fetched for this brief they were campaign-type cards in the 1410xx range (`141077` Gildor Inglorion, `141078` Gandalf's Delay, `141079` The Ring Draws Them). Confirm against the live payload, including Mr. Underhill, which was not pinned here. Do not hardcode a code you have not just read from the catalog build.

### Hide tests

When an encounter card with Hide X is revealed, the revealing seat makes a Hide test before that card's When Revealed or Forced effect.

The seat may exhaust any number of characters it controls to commit them. Discard the top X cards of the encounter deck. Sum committed willpower. Sum the threat of the discarded cards. A treachery adds 0. After that total is known, an action window opens. Then the test succeeds if willpower is greater than or equal to threat, and fails otherwise. Characters are then uncommitted. The frame pops, and the rest of the revealed card resolves.

This is not a token the player tracks by hand. The Tristan example in the booklet is the fixture: Hide 3, 2 willpower committed, discarded threat 2 + 2 + 0, an action raises willpower to 4, the test succeeds.

### Flight to the Ford burden deck and life

Burden deck: the five burden cards numbered 81–85, shuffled, set beside the quest deck. When a burden is discarded, it goes to the encounter discard pile.

The booklet's win line says that after the scenario is defeated, all burden cards in the encounter deck and the discard pile are added to the campaign pool. It does not say "also sweep whatever is still in the burden deck." Encode the sentence you can point at. Re-read the quest card before deciding the burden deck's leftovers. Do not silently add a sweep the card does not print.

Life tracker: starts at 15, displayed as its own number, not as a second threat dial that the refresh step increments. Reducing life lowers that number. Healing a character does not raise it. Life 0 loses the game.

### Breaking of the Fellowship, stage 2B

Each seat sets a staging area in front of itself and places its quest stage 3 there. Phases still resolve in seat order, starting with the first seat.

After a seat commits to its own stage, it reveals its encounter card, then compares its own committed willpower with the threat in its own staging area. Progress goes on its stage, or its own threat rises by the difference. Another seat does not raise threat for that failure.

Engagement checks use only that seat's staging area. "At this stage" does not reach another seat's cards. Archery is totaled per stage, and only that seat assigns it. Cards that say "the staging area" or "the quest" mean that seat's. Seats may still affect each other through ordinary card effects that do not use those phrases.

If a seat is eliminated while stages are separate, that stage and the encounter cards at it are discarded.

### Seeded decks

On first launch, insert two saved decks that match the printed starter lists. They are ordinary `user.db` decks. The parenthetical numbers below are collector numbers inside a product, not RingsDB codes, and the same number is used in the core set and in this box. Resolve each row by card name against the core set plus MEC109. Prefer the Revised Core code when the booklet's core-set card has a revised printing. Write the chosen code next to the row in the seed script.

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

When both decks are used together, the booklet says to replace the three copies of Gandalf (73) in Stealth and Steadfastness with three copies of Elrond (19). Show that as a note on the seed. Do not mutate either saved deck. The same unique card may sit in both decks. A second copy cannot enter play. Do not reject the pair for sharing Faramir, Steward of Gondor, or Celebrían's Stone.

## Deckbuilding

The builder is a root route beside the campaign list.

`deck_legal` is set at catalog build for `hero`, `ally`, `attachment`, `event`, and the later official player types (contracts, player side quests, treasures) once those `type_code` values are confirmed from a live pack payload. `Campaign`, encounter, quest, and nightmare rows are not deck-legal. TBR's pack file mixes heroes with `type_name: "Campaign"`. Filter those out in the build script, not in the UI.

Universal rules, enforced on every save:

- Exactly three heroes.
- At least 50 other cards.
- At most three copies, and never more than the card's `deck_limit`. Unique cards once inside that deck. Official contract decks that change the hero count or the copy limit are a known limit of this proof of concept. Do not invent that support here.
- A non-neutral card's sphere must match one of the heroes.
- A restriction record on a card (trait, sphere, campaign) is enforced when that record exists. If the printed deckbuilding limit has no record yet, the card can still be saved and carries the inactive-text mark. Do not invent a restriction, and do not ask the player to enforce it at the table.

Fellowship rules run on the briefing loadout, not on the saved deck. MEC109 says Frodo is the only Ring-bearer in this box. The player chooses that hero. Do not insert a Frodo they did not choose.

- The three-hero rule runs on the saved deck. The saga rules run on the loadout.
- The first seat's loadout has exactly one Fellowship-sphere Ring-bearer. Once The One Ring is attached, that hero does not count toward the hero limit.
- The Ring-bearer slot is required when the saved deck has no Ring-bearer, and unused when it already has one. A fourth hero is legal only when the extra hero is that Ring-bearer.
- No second Frodo in that seat's cards.
- Two-handed play requires a single Ring-bearer across the table. It does not reject two decks that share some other unique card.

A saved deck does not have to be legal for any particular campaign. The briefing picks one saved deck per seat and refuses to deal when the loadout fails. The error names the card and the rule.

Import accepts a RingsDB decklist id or a `ringsdb.com` URL, via `GET /api/public/decklist/{id}.json`. Cards that are not in the official pool are reported by name and dropped. The result is an ordinary saved deck.

Filters on the pool screen: name, sphere, type, pack or cycle, trait, cost, unique, and whether unique text is active. Opening a card shows stats, text, and the errata line. An inactive sentence is labeled inactive. Nothing on that screen writes a campaign.

## Effects

### Three layers

1. **Keywords**, above.
2. **Unique card text.** An effect record:

```ts
type Effect = {
  cardCode: string;
  timing:
    | "setup"
    | "forced"
    | "whenRevealed"
    | "response"
    | "action"
    | "shadow"
    | "constant"
    | "questResolution"
    | "travel"
    | "engagement"
    | "beginningOfPhase"
    | "endOfPhase"
    | "endOfRound";
  trigger?: string;
  limit?: "oncePerPhase" | "oncePerRound";
  cost?: Cost;
  condition?: Condition;
  instructions: Instruction[];
};
```

`constant` is a while-in-play modifier. It appends a record to the modifier list. A response names the event it answers in `trigger`. Instructions are engine verbs. The verb list grows when a dealt card or a starter card needs a verb. That growth stays inside this interpreter. There is no second language. Scenario 1 needs static modifiers, a response trigger, cancel, and delayed instructions.

The Zod schemas for `Effect`, `Instruction`, `Condition`, `Cost`, and `ScenarioDefinition` live in `src/catalog`. `src/effects` holds the authored records. The interpreter takes the effect list as an argument and does not import `src/effects`. Vitest passes the TypeScript records. The phone loads rows from `catalog.db` and passes those. The build script is the only production writer of that table.

Gandalf's Delay says each player draws one less card in their starting hand. When that sentence applies is not encoded here. Read it on the quest card and on pages 28–30 of the Learn to Play before writing the effect. Until that citation exists, leave the test red and name the card. Do not guess.

3. **Player cards with no effect row.** The card can be paid for, played, quested, defended, and attacked with using printed numbers and implemented keywords. Its unique sentence is inactive: it is shown, it is not offered, and there is no sheet on which the player applies it. The mark is the absence of the row. When the row exists, the ability becomes a normal legal intent or a normal engine step.

Campaign-dealt cards cannot be inactive. That includes encounter cards, quest cards, boons, burdens, and The One Ring. A missing effect id there fails the coverage test, and the scenario stays unplayable.

### Window stack

Forced effects in the current window run in timestamp order. Responses are offered and may be passed. A Hide test, a shadow reveal, or a When Revealed pushes a frame and pops it before the parent continues. Do not flatten these into one modal queue with no stack. The Hide action window happens after the discarded cards' threat is known and before success or failure. Hide itself runs before When Revealed or Forced on the card that was just revealed.

### Coverage test

The coverage job builds `catalog.db` before Vitest. The database stays gitignored. A campaign is not marked playable unless that test loads its quest deck, encounter deck, burden deck, and the seeded starter decks, and every Setup, Forced, When Revealed, Response, Action, and shadow on those cards has an effect id. A player deck that contains other official cards does not fail this test. In play, each of those other cards keeps its printed numbers and implemented keywords, and its unique text stays inactive.

Author effects in scenario order. Scenario 1 and both starter decks are the first playable slice. Scenarios 2 through 6 reuse the keyword framework.

## Data sources

| Need | Source | Notes |
| --- | --- | --- |
| Packs | `GET https://ringsdb.com/api/public/packs/` | Drop names that start with `ALeP - `. |
| Cards | `GET https://ringsdb.com/api/public/cards/{pack}.json` | One file per pack. TBR is 29 records and mixes heroes with campaign-type cards. |
| Card images | `https://ringsdb.com` + `imagesrc` | The hosted file is the asset. See Card images. Sniff the bytes. The `.png` name is often a JPEG. |
| One decklist | `GET https://ringsdb.com/api/public/decklist/{id}.json` | Import only. |
| Encounter composition | Hall of Beorn scenario pages, e.g. `https://hallofbeorn.com/LotR/Scenarios/A-Shadow-of-the-Past`, checked against the quest cards and the booklet | HTML. `ScenarioDetails` returns difficulty statistics, not the card list. There is no RingsDB `/api/public/scenarios/` index. Do not block on a numeric scenario id. |
| Procedures | MEC109 booklet and the core-set Learn to Play, supplied by the player as PDFs | The app does not fetch the Asmodee CDN, does not ship either file in the APK or IPA, and does not commit it. The campaign-log footer allows photocopying for personal use. Encode procedures. The reader is for the person holding the phone. |
| Ordinary round | Core-set Learn to Play | The booklet points at pages 28–30 for campaign mode. |

RingsDB states that the texts are copyrighted by Fantasy Flight Games and that the API is for tools that complement the game. The release script may fetch them to build `catalog.db`. Do not commit the payload. Do not point image URLs at DragnCards.

Hall of Beorn's headings and the booklet's encounter-set list do not always match. The scenario script is the reconciliation, done by hand. A test asserts the built Normal deck size against the count you verified. Do not generate the script from the HTML at runtime.

Prefer `has_errata` text. Record the RingsDB pack `code` and the fetch date in a `meta` row inside `catalog.db`.

Snapshot the card codes a scenario actually dealt into the save at scenario start, so a later catalog rebuild cannot rewrite a game in progress.

## Card images

The asset is the file RingsDB already hosts at `imagesrc`. On 23 Oct 2026 that was a JPEG of about 430×600 for a normal card. Frodo `141001` was 423×600 and 148338 bytes. Aragorn `01001` was 429×600 and 150904 bytes. Hall of Beorn served the same Frodo bytes. Do not upscale these, and do not hunt a 300 dpi master. Sniff the magic bytes, because the URL ends in `.png`.

`GET /api/public/cards/` that day returned 1,107 official rows after dropping pack names that start with `ALeP`. 1,039 of them had an `imagesrc`. A content-length pass got 1,014 of those files, summing to 416.5 MB. The other 25 answered 503. Filling those from the median of their type puts the official player-card image set at about 420 MB. The median file was 152 KB. Allies, attachments, events, and heroes sit near 150 KB. Treasure rows sit near 550 KB and are why the mean is higher. Quest and encounter images are not in that 420 MB. They use the same kind of file and the same cache, and they are extra storage once their URLs are known.

Download with `File.createDownloadTask` from `expo-file-system` into the document directory. Persist `DownloadPauseState` so a kill mid-file can resume. Cap concurrency and retry a 503. `user.db` `image_files` stores code, path, width, height, byte size, media type, and sha256. SQLite does not store the bytes. A catalog update deletes a file only when that code's hash changed. One local function sets `isExcludedFromBackup` on the image directory and does nothing else. About 420 MB of player-card art, plus quest and encounter art, must not enter an iCloud backup. Do not commit the files, and do not hotlink DragnCards.

Keep the files out of the APK. A JPEG does not shrink inside the zip, so packing the player-card set in would add about 420 MB and put the package near half a gigabyte. The APK is the Expo binary, Skia, and `catalog.db`. `catalog.db` is a few megabytes. The native shell has not been built. A release APK for one ABI, with Expo and Skia, is expected around 50–80 MB. Treat that range as an estimate until a build exists.

The inspect screen shows the cached file and can zoom it. The table decodes the same file at the card's on-screen size. There is no second image and no image server. Text is enough to play while a file is still downloading. After the cache is on disk, airplane mode still shows it.

## Persistence and shipping

Open `catalog.db` and `user.db` as two handles, both reachable from screens. Do not nest `SQLiteProvider` and read both through `useSQLiteContext`. That hook returns the nearest provider, and the suspense helper keeps one module-level database and closes the previous file.

`catalog.db` is a Metro asset. `forceOverwrite` defaults to false. Pass true only when the bundled `CATALOG_VERSION` is greater than the version stored in `user.db`. `scripts/build-catalog.ts` writes that constant when it writes the database. On first launch the applied version is absent, so the copy runs.

`user.db` tables: `decks`, `saves`, `image_files`, `booklets`, `meta` (applied catalog version). Drizzle migrations for these are committed and run on open. `saves.activeScenario` carries a schema version. When the engine version differs, drop the in-progress scenario and keep the log, the decks, and the image index. Do not migrate a half-played game during this box.

`booklets` is one row per book: id, path, original filename, byte size, sha256, page count, and last page. One file per book lives in the document directory under `booklets/`. Those bytes stay eligible for backup. A catalog update does not delete the row or the file. The picker cache is not the store. Copy the picked file into `booklets/` before recording the row. The ids for this box are `fellowship-of-the-ring` (MEC109) and `learn-to-play` (the core-set book). A later campaign adds its own id. Gitignore the PDFs.

`catalog.db` tables: `packs`, `cards`, `effects`, `scenarios`, `campaigns`, `meta`. No decks, no saves, no image bytes. `cards.deck_legal` is true for builder types. `cards.campaign_id` is set only for rows a campaign owns. One `drizzle-orm/sqlite-core` schema in `src/catalog` defines those tables. The script opens it with `better-sqlite3`. The phone opens the same tables with `expo-sqlite`, read-only. RingsDB payloads are cached in a gitignored directory. A re-run with that cache present does not refetch. CI fetches on a miss.

Schema changes to `catalog.db` are a new file, not an in-place migration. Schema changes to `user.db` are migrations.

EAS Build produces the Android and iOS binaries from the same asset. Android can sideload an APK. A physical iPhone needs Apple signing (EAS dev client, ad hoc, or TestFlight). The simulator does not.

Development gotcha: the copy from the asset into the app sandbox runs once per database name. After changing `assets/catalog.db` during development, bump `CATALOG_VERSION` or delete the app's storage. Do not leave `forceOverwrite` unconditionally true.

The phone plays with no network once a card's image is cached. Text is enough while a download is still pending.

## Screens

| Route | Behavior |
| --- | --- |
| Campaign list | Root. Reads campaigns and saves. It does not scan `cards`. Fellowship is playable. Later campaigns may show as locked, with name and scenario count. Locking does not hide cards. Opens a stored booklet and returns here on close. |
| Campaign path | Six nodes in book order: locked, current, or completed. A completed node shows the reward that was chosen. The pool sits under the path. The log is one tap away, not a settings page. Opens a stored booklet and returns here on close. |
| Log | The sheet as data: heroes per seat, fallen heroes per seat, threat modifier, boons and which hero a permanent boon is stuck to, burdens, the six scenario rows, score, notes. Opens a stored booklet and returns here on close. |
| Briefing | Stages in order, encounter sets and counts for Easy or Normal, special rules by name, deck picker, the Ring-bearer slot, validator errors that name the card. The slot is required when the deck has no Ring-bearer. Refuses to deal on failure. Opens a stored booklet and returns here on close. |
| Table | Phase rail, pinned quest stage, staging, active location, engaged, play area, hand. The rail shows the step the engine is in. It does not skip steps. Hide sheet, life number, burden deck, second active-location slot, and a second staging area render only when the script declares them. The second active-location slot is shared scenario state. A trigger shows the card, the timing, and the legal choices. Shadow cards stay face down until that attack. Resource, damage, threat, and progress change only when the engine changes them. A tap on a card opens the inspect route. The picture stays on the canvas. Opens a stored booklet and returns here on close. |
| Resolution | Choice buttons from the script. A loss has no reward screen. |
| Booklet | Full-screen native reader for one stored PDF. Close sits in thumb reach and returns to the screen that opened it. The engine does not read the file. A missing file does not block a scenario. The control offers to add the booklet and names which book is absent. Ids for this box: `fellowship-of-the-ring` and `learn-to-play`. The same reader opens both. Opening from a scenario starts on that scenario's page index when one is recorded, and otherwise on the saved last page. Turning a page writes the last page. It is not a Skia surface and not a WebView. |
| Card | Full-screen view of the cached RingsDB file. Lists and this screen use `expo-image`. The table decodes the same file with Skia, at the size on screen. A tap on a table card opens this route. The picture stays on the canvas. |
| Card pool | Search and filters. Loads card rows when the screen opens, then filters in memory. No campaign writes. |
| Deck | Three hero slots, count against 50, copy limit, saga-only badge. Save without a campaign check. |

## Build order

Do these in order. Do not start the Skia table before step 3 is green. Do not start scenario N+1 before scenario N's coverage test is green. The slice-by-slice work orders are in `docs/phases/`. What is active and what is done is in `docs/phases/STATUS.md`. Work one file until its exit is green.

### 1. Catalog script and a phone that can open it

- `scripts/build-catalog.ts` writes `assets/catalog.db` from RingsDB for every non-ALeP pack, with `deck_legal` set from the type list above.
- Fellowship encounter and quest rows for scenario 1 are loaded from the hand-checked fixture, not from a live HTML parse.
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

- Setup builds the Normal encounter deck from the checked counts and runs the quest card's setup. Lines to re-read on the quest card before freezing the fixture, currently taken from Hall of Beorn: attach Mr. Underhill to the Ring-bearer; add Gandalf's Delay to staging; shuffle Gildor Inglorion and The Ring Draws Them into the encounter deck; set Bucklebury Ferry aside; one Black Rider in staging; Bag End is the active location. Assert the built Normal deck size.
- A scripted Hide 3 fails, and the booklet's success line (2 willpower, discarded threat 4, an action raises willpower to 4) passes. The action window is after the threat total is known. Hide runs before When Revealed on that card.
- Staging reveals one card for one seat. Surge reveals another for that same seat. Both are engine steps. A player intent cannot reveal an extra card.
- Quest resolution places progress on the active location first, and raises threat by the computed difference when staging threat is higher. An intent that supplies its own progress or threat number is rejected.
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
- A stored booklet opens from the campaign list, the path, the briefing, and the log, then closes back to that screen. The player supplies the PDF. A missing file does not block a scenario.
- Exit: a win recorded by the reducer unlocks scenario 2 on the path and shows the chosen cards. A loss leaves scenario 2 locked. When the engine version on the open scenario differs, the in-progress scenario is gone and the log, the decks, and the image index remain.

### 5. Table for scenario 1

- Skia zones, phase rail, drag that dispatches commands, Hide sheet, trigger sheet, resolution screen. The table uses the same booklet route. A tap on a card opens the inspect screen. The picture stays on the canvas.
- Exit: a human can play Three is Company through Escape to Buckland on a phone, lose without corrupting the log, and win into the real resolution screen. Both starter decks are fully automated. A card from outside those decks can be sleeved and uses its printed numbers and implemented keywords. Its unique text stays inactive. The table never asks the player to apply it, and it never offers a way to type damage, resources, threat, or progress. On that phone, dragging a card stays smooth with the phase rail up. The drag does not run through JavaScript each frame.

### 6. Scenarios 2 through 6

One scenario per slice. Each slice adds the script, the required effects, the special widget (life tracker, burden deck, second active location, per-seat staging), and extends the coverage test.

### 7. The next campaign

A new folder, `register()`, encounter rows, scripts, effects. Bump the catalog version. `user.db` stays. If it is a saga box, it fills the remaining log rows. It does not get a new log type.

## Recommendations for the implementer

Work down the build order. Stop at the end of a step whose exit check is green. Do not scaffold later steps "so the structure is ready."

- Treat a missing source as a failing test, not as a guess. If you cannot point at the booklet, the quest card, or the Learn to Play for an effect's timing, do not write the effect. Leave the coverage test red and name the card.
- Freeze scenario 1's deck list as a checked-in JSON fixture of codes and counts. Produce it while looking at the quest cards and the booklet together.
- Confirm every RingsDB code at catalog-build time. Codes in this file are from one TBR fetch. They are hints.
- Put `CATALOG_VERSION` in source next to the asset, written by the build script, and store the applied version in `user.db`.
- Gitignore `assets/catalog.db`, RingsDB payload caches, card images, booklet PDFs, and `agent-tools/`. Research extracts of the booklet are not source. The app does not fetch a booklet and does not parse one into rules.
- Add the ESLint boundary in step 1, before the first component imports the reducer.
- Keep the phase rail as text steps the engine advances. Widgets for The One Ring, Hide, the life tracker, the burden deck, and the second active location are declared by the scenario script. The life number and the threat number change only through engine steps.
- Do not add a manual resolver, a "I dealt 3 damage" control, or a resource plus button. If a test can pass only by letting the UI write a token field, the test is wrong.
- When a rule in this file and the booklet disagree, change this file. Do not leave both wordings alive.
- Do not implement the Skia table, the image library, or scenarios 2–6 in the same change as the catalog script. The image library is a required data set, not a later polish pass.
- The app is not a DragnCards client. If a DragnCards file seems to already solve a rule, ignore it and encode the booklet.
- Do not add a backend because the engine is authoritative. Authority means the reducer is the only writer. It does not mean the reducer moves to a server.
- Ship the RingsDB image as the card art. Do not block the build on a 300 dpi scan, and do not put the image bytes in the APK.
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
