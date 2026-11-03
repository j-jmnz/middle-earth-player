# Authoring effect records

Every deck-legal player card is automated (user decision, 2026-10-26), and so is every card a playable scenario deals; the
Messenger of the King cards (pack MotKA and the contract 22134) are out of scope (`outOfScope` in `data/overrides.json`).
This is the cookbook for turning a card's printed lines into effect records. The schema is the authority:
`src/catalog/effect-schema.ts` (record, timings, triggers, costs, limits) and its parts `effect-schema-verbs.ts`,
`-pick.ts`, `-conditions.ts`, `-stats.ts`, `-amount.ts`, plus `src/catalog/families/<family>.ts`. Every field there has a
comment saying what the engine does with it, so this page groups the vocabulary by what an author needs and does not list
it. If a line needs something the schema does not have, leave the line open and report it; do not bend a verb to mean
something else.

## Workflow

1. `pnpm effects:draft <scenario-id | starter-deck-id | pack | code,code,...>` writes `.agent/drafts/<code>.md` for each card
   with a printed line no record owns: the line ids, the card text, DragnCards' automation (a hint about intent, never a
   rule), related rules text, the vocabulary and the nearest existing records. `--all` drafts covered lines too.
2. Write the records (see Where records live).
3. `pnpm effects:open` rewrites `src/effects/open-lines.ts`, the list of printed lines with no record. The coverage test
   compares it with the data, so run it after adding or removing records.
4. Check: `pnpm exec tsc --noEmit`, `pnpm vitest run src/effects scripts/effect-coverage.test.ts`, and
   `node --experimental-strip-types scripts/card-smoke.ts <code> <code> ...` for the cards you wrote. Card-smoke plays a
   seeded game with the card in hand or on the table and fails on a throw, a refusal or `state.failure`; it shows the
   records run, not that they do what the card says. For that, write a test next to the family
   (`src/rules/families/<family>/index.test.ts`) that names the rule ids it implements.

`scripts/effect-coverage.test.ts` is the gate: every printed line of a card a playable scenario deals (`src/campaign/playable.ts`)
or of a deck-legal player card is owned by a record that names it in `lines`, by a keyword the engine reads (a line that is
only keywords needs no record), or by an `inert` entry in the printed-text ledger (`data/printed`). A record names lines of
its own card, and the timing of the record matches the line's label. If one sentence pattern repeats on many cards, it
belongs in a template (`scripts/data/effects/*-templates.ts`), not in more authored records.

## Where records live

Generated records (`src/effects/generated`, written by `pnpm data:build` from the templates) and authored ones are merged in
`src/effects/index.ts`. An authored record with the id of a generated one replaces it; list that id in the file's `REPLACES`
with the reason, and the coverage test checks that no other id is replaced.

- `src/effects/authored/pool/<PACK>.ts`: a player card's lines that no template reads and no family owns (`RECORDS`,
  `REPLACES`). The pack is the card's `data/cards/<PACK>.json`; a new pack file is added to `pool/index.ts`.
- `src/effects/authored/families/<family>.ts`: records written with a mechanic family (below).
- `src/effects/authored/<scenario-id>.ts`: the cards of a scenario box (`fellowship-of-the-ring.ts` holds scenarios 1 and 2
  and the starter lists, `flight-to-the-ford.ts`, `the-ring-goes-south.ts`). The `burden` and `south` families' records
  live here, with their scenarios. A scenario becomes playable (`playable.ts`) when none of its dealt cards has an open line.

Family and scenario files are TypeScript, so local constants for a repeated filter or a small builder are fine; pool files
are one JSON-shaped record per line. Record ids are unique across every file.

## The record

```ts
{ "id": "<code>:<timing>:<n>", "cardCode": "<code>", "lines": ["<code>:A:2"], "timing": "response", "trigger": "...", ...,
  "instructions": [...] }
```

- `lines` names the printed lines the record implements, as `<code>:<side>:<n>` (ids from the draft). One line can need
  several records (a constant and a Response on one line); one record names several lines only when they are one ability.
- `<n>` counts records of that timing on the card, in text order (front, then side B, then shadow), from 1.
- Timing from the label: `Action:` (also `Planning/Quest/Travel/Encounter/Combat/Refresh/Resource Action:`) `action`,
  `Response:` `response`, `Forced:` `forced`, `When Revealed:` `whenRevealed`, `Setup:` `setup`, `Travel:` `travel`,
  `Shadow:` `shadow`. No label is `constant`, or `triggered` for a mandatory effect not printed as Forced (it resolves
  before Forced effects on the same event). A campaign card's Setup and Resolution are `campaignSetup` and `resolution`.
  The schema lists the rest.
- `trigger` is required on `forced`, `triggered` and `response` and only there. An event's own Action is `action`; its printed
  cost is paid by playing it. An event's Response adds `"cost": {"kind": "playEvent"}` (`01037:response:1`, Swift Strike).
- `limit`: `oncePerRound`, `oncePerPhase`, `twicePer...`, `oncePerAttack`, `oncePerGame`, the `Group` limits that count every
  copy of the card, `oncePerRoundEachPlayer`. `"anyPlayer": true` for "Any player may trigger this action/response".
- `condition` gates the record; `cancel` is the paid cancel the first player may offer; `uncancelable` says when nothing
  may cancel it.
- `fromHand: true` marks an Action or Response of a card that is not an event as used from its owner's hand, and only there
  ("put ~ into play from your hand"): `01019:response:1` (Brok Ironfist) is `fromHand` with `[{"verb":"PutIntoPlay"}]`.
  An ability on the card in hand that is not an Action, such as a play restriction or a discount, is a `constant`.

## Which card an instruction acts on

- A `Pick` chooses a card or a player; the instructions after it act on the last picked (`target` defaults to `picked`). A
  pick with one candidate is taken without asking; with none, it picks nothing and later verbs do nothing.
  `{ "verb": "Pick", "pick": { "type": "player", "control": "any" } }` picks a player, and verbs with `"who": "picked"`
  then act for that player (`01012:action:1`, Beravor).
- Card references (`target`, `of`, `card`, `subject`): `self` (the source), `host` (the card the source is attached to),
  `picked`, `subject` (the card the answered event is about), `other` (the second card the event names: the enemy a
  character defends against or attacks, the enemy an attack destroyed), `attacker`, `defender`, `activeLocation`.
  Each verb's schema comment says which of these it takes.
- `Each { pick, instructions }` runs the instructions once per matching card, each as the picked card, with no choice; with
  `upTo` the actor chooses up to that many of them instead. `ForEachPlayer` runs instructions for each player. `Choose`
  offers options ("choose one: ..."), each with its own `requires`. `Repeat`, `Delay` (until the end of the phase or round,
  or `endOfAttack`, `questSucceeded`) and `AfterAttack` hold instructions of their own.
- A cost that chooses a card ("Exhaust a Dwarf character to ...", "Discard a card from your hand to ...") is the first
  instructions, with a `canPick` condition that it can be paid (`01011:action:1`, Glorfindel).

## Pick filters

`type` and `control` (`you`, `any`, `other`) are required. The rest narrow by what a rules text says; the schema file groups
them with comments:

- Identity: `trait`, `traits`, `notTraits`, `names`, `exceptNames`, `sphere`, `spheres`, `printedIcon`, `unique`,
  `nonUnique`, `keyword` (printed or gained), `printedKeyword`, `cardType`, `cost`, `maxCost`, `minCost`.
- State: `state` (ready, exhausted), `damaged`, `committed`, `attacking`, `defending`, `hasAttachment`, `attachedTo`,
  `hasResources`, `active` (an active location), `engaged: "you" | "other"` and `staging` / `stagingOnly` for enemies.
- Zone: `from` (play by default; hand, discard, deck with `top`, victory, loot), `looked` (only the cards an earlier verb
  looked at or discarded), `intoPlay` (the card is going to be put into play: a unique card already in play is not offered).
- Relations: `sharesTrait` is `self`, `host`, `other`, `activeLocation` or `attackingEnemy` (never the card itself and
  counting a Trait gained from an attachment): `12138:action:1` (an ally from the top 5 that shares a Trait with the source),
  `06035:response:1` (an enemy that shares a Trait with the one just destroyed). `other: true` is "another", `different`
  leaves out cards this effect already picked.
- `who: "firstPlayer"` when the card says the first player chooses.

The same filter counts cards (an amount, a `count` condition), names the holders of a constant modifier and says which
cards an event is heard about (`subject`). A family that needs a new filter adds it to `effect-schema-pick.ts` with a
comment naming the file that reads it.

## Amounts

A number, or an object the engine reads when the instruction runs: `{ "count": <pick> }`, `{ "stat": "attack", "of":
"subject" }` (stats include willpower, attack, defense, threat, hitPoints, engagementCost, questPoints, damage, resources,
progress, cost, threatCost, attachments; `printed` reads the printed value), `{ "x": true }`, `{ "players": true }`,
`{ "threat": "actor" | "tens" }`, `{ "hand": true }`, `{ "dealt": true }`, each with optional `times`, `plus`, `limit`
(`negative` makes it come out below 0). A printed number on a verb that moves or deals something is at least 1; a read one
may come to 0 and then nothing happens. `ChooseX` and `ChooseAmount` let the player choose the X.

## Conditions

`condition` on a record, or `when` on any instruction. `phase`, `threat` (`min` for Valour, `max` for Secrecy), `count`,
`canPick`, `matches` (the source, host, subject, picked card... fits a filter), `sourceIn` (where the source is now), `step`
and `combatStep` (where the round is), `attacking` (read while a stat is read), `faceUp` (a contract's side), and many more
by what cards ask; combine with `not`, `all` and `any` (one level deep).

## Triggers and stat flags

Responses and Forced effects hear an event (`trigger`) about a card (`subject`): `"self"` for "After ~ ...", `"host"` for
"After attached hero ...", or a filter for "After a Silvan ally ..." (read from the source controller's side). `eventSeat:
"you"` for "After you ..." (the event happened to the card's controller), `"other"` for another player. Without `subject`
an event about one card is heard by that card only. The core triggers are in `effect-schema.ts` (play, leave play,
committed, quest result, declared attacker or defender, attack destroyed or resolved, engaged, traveled, staging,
revealed, damaged and healed, phase boundaries) and each family adds its own to `TRIGGERS`; the comment on each says which
card it is about. The cancel windows are `whenRevealedPending`, `shadowPending`, `encounterRevealed` and `damageDealt`,
where `CancelEffect` or `CancelDamage` answers.

A flag is a `ModifyStat` with amount 1 on a stat that names it: `until: "whileSourceInPlay"` for a constant,
`endOfPhase` / `endOfRound` / `endOfAttack` for a lasting effect. Whose stat changes is `target` (default the source; `host`,
`picked`, `table`, a seat...) or `holders`, a filter ("Each Outlands character you control gets +1 Attack"). Flags that
the card text names directly: `sentinel`, `ranged`, `noExhaustQuest` / `Attack` / `Defend`, `cannotQuest`, `cannotAttack`,
`cannotDefend`, `cannotHaveAttachments`, `doesNotReady`, `noThreatContribution`, `extraResource`, `extraDraw`. The
families add many more (`FLAGS`); a rule a constant sets for the whole table (there can be 2 active locations, the players
must travel) is a flag on `table`, so the engine reads it from the state alone. `EntersPlayExhausted`, `GrantTrait` and
`GrantIcon` are verbs.

## Patterns

Attachment hosts. "Attach to a Dale or Dwarf character." `hosts` is a list of filters, any of which a host may match
("a hero or Gandalf" is two filters; "a location" is `{"type":"location","control":"any"}`); `limitPerHost` is "Limit 1 per
hero". `AttachesTo` also takes `host.kind: "quest"` and `"ringBearer"`. Restricted is a keyword the engine reads; the word
needs no record. Traps and attachments played unattached use `PlayInto` (`10124:constant:1`, onto a threat dial).

```json
{"id":"19120:constant:1","cardCode":"19120","lines":["19120:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character"},"hosts":[{"type":"character","control":"any","traits":["Dale","Dwarf"]}]}]}
```

Static stats. "Attached hero gets +1 Attack (+2 Attack instead if attached hero is a Dwarf.)" is two `ModifyStat`s with
opposite `when`s (`01041:constant:2`). "~ gets +1 Defense for each enemy engaged with you" is
`"amount": {"count": {"type":"enemy","control":"any","engaged":"you"}}`. A stat that holds only in an attack is a
`when: {"kind":"attacking", "enemy": {...}}` (`01039:constant:2`: +1 Attack against an Orc). A constant that works only while the host is the active location uses `{"kind":"hostActive"}` (`04103:constant:2`).

Cost payment. A cost is one object or a list paid together (`exhaustSelf`, `exhaustHost`, `discardSelf`, `resources` with
`from: "self"` or `"host"`, `raiseThreat`, `damageSelf`, `discardDeckTop`, `playEvent`...; see `costSchema`).

```json
{"id":"131011:action:1","cardCode":"131011","lines":["131011:A:2"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready","target":"host"}]}
```

Responses. "After a Silvan ally enters play, ..." is `trigger: "enteredPlay"` with a `subject` filter and instructions on
`target: "subject"`. "Response: After ~ participates in an attack that destroys an enemy" is `attackDestroyed` with
`subject: "self"` or `"host"` (`01005:response:1`, `01039:response:1`); "After you engage an enemy" is `engaged` with
`eventSeat: "you"`; `145012:response:1` answers `optionallyEngaged` and declares an attack with the host.

Putting a card into play. `PutIntoPlay` is the one verb: from a hand, discard pile or deck, without paying or playing it
(no cost, no play restriction; a unique card already in play stays where it is). `card` says which (the source by default,
`picked`, `subject`, `host`), `who` the controller, `exhausted`, `committed` and `damage` its terms, and `until` with `then`
(`returnToHand`, `shuffleIntoDeck`, `discard`) the end-of-phase or end-of-round return, so no `Delay` is needed. An
attachment takes a `host` filter and goes on a card the actor chooses among those it may be attached to, and a Guarded
attachment is guarded first (wor.guarded-x). Examples: `01054:action:1` (a hero from the discard pile), `02053:response:1`
(the destroyed hero, with 1 damage), `10085:action:1` (`PutIntoPlayFromHand`: up to 2 allies from any hands, back at the end
of the phase). The older `MovePicked` with `to: "play"` still runs in existing records; new ones use `PutIntoPlay`.

Moving and searching. "Search the top 5 cards of your deck for a Silvan ally and add it to your hand" is a `Pick` with
`from: "deck"`, `top: 5`, `cardType` and `trait`, then `MovePicked` `to: "hand"` and `ShuffleDeck`. Looking at cards is
`LookAtTop`, ordering them `ArrangeTop` (`01067:action:1`, Gandalf's Search, looks at any player's deck). `MoveCard` moves a picked
or referenced player card between the zones; `Each` with `upTo` searches for several.

Attacks outside the attack step. `DeclareAttack` declares and resolves one attack now (`04131:action:1` into the staging
area); `OfferAttacks` and `ChooseAttackers` are the variants (attack family, attachments family). Attacks the engine makes
for an enemy are `ImmediateAttack`. Cancelling and moving damage are `CancelDamage` (`10004:response:1`) and `RedirectDamage`
(`131009:response:1`) in a Response to `damageDealt`; `CancelAttack` ends an attack in progress.

Costs and the play of a card. A constant on a card in hand sets how it is played: `PlayOnlyIf` (a condition),
`PlayFromDiscard`, `ReduceCost`, `PlayCost` (an additional cost), `PayDistinctHeroes`, `DeckLimit` and `InPlayLimit`. A
constant in play changes how other cards are paid for: `ReduceCostOf`, `IgnoreResourceMatch`, `PaysFor`, `PaysAsIcons`,
`CannotPayFor`, `GrantSecrecy`. A lasting discount for the next card is `ReduceNextCost` (`07002:action:1`, with `doomed`
to give the card Doomed); playing a card from the hand as part of an effect is `PlayFromHand`.

Contracts, side quests, the victory display. A contract's sides are `FlipCard` and the `faceUp` condition, with line ids that
name the side (`21074:forced:1`); its deckbuilding limits are `DeckRule` records (`22049:constant:1`). Player side quests
hear `questDefeated`; `Encounter.` is `EncounterKeyword`; `VictoryLimit` caps copies in the victory display.

Scenario cards. The encounter deck is `LookAtTop`, `PickEncounter`, `MoveEncounterCard`, `RevealEncounter`, `DiscardUntil`;
the burden deck and the Ring-bearer's life are `RevealBurden`, `MoveBurden`, `ReduceLife` (Flight to the Ford); a second
active location, the captive Ring-bearer and the Watcher are `MakeSetAsideActive`, `CaptureRingBearer` and the `extraActiveLocation`
and `mustTravel` flags on `table` (`142023:whenRevealed:1`, `142023:constant:1`).

## Mechanic families: engine and records together

Lines the core vocabulary could not express were worked by mechanic family: encounter, costs, quest, defense, attachments,
attack, play, deck, sidequests, misc, and for the saga box burden (the burden deck and the Ring-bearer's life, Flight to the
Ford), south (a second active location, the Ring-bearer facedown under an enemy, an enemy engaged with every player,
progress gates and caps; The Ring Goes South) and moria (damage tokens counting down on an objective, an enemy engaged with the
first player from the staging area, a hero given up for damage, burden objectives that attach to a hero; Journey in the Dark) and breaking (the Ring-bearer removed from the game, the staging area, quest stage and active location each seat has from stage 2B, progress that discards cards, a hero that falls into evil, skipped phases; Breaking of the Fellowship). Whoever takes a family adds the engine support and writes the records. A
family owns files that are composed by the `index.ts` next to them, so families do not edit the same lists:

- `src/catalog/families/<family>.ts` exports `VERBS` (zod `strictObject`s with `...when` from `effect-schema-conditions.ts`, each
  with a comment saying what the engine does), `TRIGGERS` (event names) and `FLAGS` (stat flags `ModifyStat` can set).
  `families/index.ts` spreads them into `FAMILY_VERBS`, `FAMILY_TRIGGERS` and `FAMILY_FLAGS`, which join the verb union,
  the trigger enum and the stat enum. `families.test.ts` fails if two families add the same trigger or flag; a duplicate verb
  or condition kind fails when the schema loads. A new pick filter, condition kind or amount field goes in the shared
  `effect-schema-*.ts` file, with a comment naming the family file that reads it.
- `src/rules/families/<family>/index.ts` exports `run`, which resolves the family's verbs and returns `null` for any other.
  `src/rules/families/index.ts` lists the runners; `interpret.ts` asks the families before the player verbs and the core
  switch. Bigger families split into part files in the family's folder (`<family>/<part>.ts`). Tests go next to them (`<family>/index.test.ts`) and name the
  rule ids they implement.
- `src/effects/authored/families/<family>.ts` exports `RECORDS` and `REPLACES`, composed by that folder's `index.ts` (burden and
  south and moria have none: their records are in the scenario files). A card's other lines may have records in `pool/<PACK>.ts`.

Adding a family is therefore: the three files, its entries in the three `index.ts` files (catalog, rules, authored), a test, and `pnpm effects:open`.
Adding a verb to an existing family is the schema entry with its comment, a case in the family's `run`, and a test. Adding a
verb is engine work, never data. Bump `ENGINE_VERSION` (`src/rules/version.ts`) when the change can move a game replayed from its intents.

## Not expressible yet: leave open, report

`pnpm effects:open` lists the open lines in `src/effects/open-lines.ts`. Every player-card line is closed except
the two below.

- **21072:B:1 and 21072:B:2, not expressible (Sméagol's Gollum side).** "Immune to non-Gollum card effects. Gollum engages the
  first player" and "Forced: When Gollum is defeated, flip him to Sméagol and return him to his owner's control, exhausted."
  Side B is an enemy, but its stats appear in no source (`data/cards/ASitE.json` has the hero side only), and the engine has
  no flip that turns a hero into an enemy and back. The line stays open and its text shows as inactive. It needs the enemy
  side's data from a source or an override, then a hero-to-enemy `FlipCard`.

- **Engine gap: `usage.ts` does not announce an exhausted cost.** A Forced or Response effect that listens for "after this card
  exhausts" does not hear a card that was exhausted as the cost of an Action (`src/rules/usage.ts` pays the cost without an
  `exhausted` event). Changing that would move The Ring Goes South's golden, so Cave Torch (41029:A:2) and Cavern Warg
  (41031:A:1) exhaust as the first instruction of the record, where `Exhaust` announces the event and the Torch's Forced effect
  (41029:A:3) hears it. A new card whose Forced effect listens for an exhaust does the same; the gap closes only with an
  `ENGINE_VERSION` bump and the goldens it moves.

When you leave any other line open, report it with the mechanic it needs, and write records for the card's other lines.
