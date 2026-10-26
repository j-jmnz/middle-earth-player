# Authoring effect records for the player pool

Every deck-legal player card is automated (user decision, 2026-10-26). This is the cookbook for turning a card's printed
lines into effect records. The schema is the authority: `src/catalog/effect-schema.ts` and its parts
(`effect-schema-verbs.ts`, `-pick.ts`, `-conditions.ts`, `-stats.ts`, `-amount.ts`). Every field there has a comment saying
what the engine does with it. If a line needs something the schema does not have, leave the line open and report it; do
not bend a verb to mean something else.

## Workflow

1. `pnpm effects:draft <PACK>` writes `.agent/drafts/<code>.md` for each card of the pack with an open line: the line ids,
   the card text, DragnCards' automation (a hint about intent, never a rule), related rules text, the vocabulary and the
   nearest existing records.
2. Write the records into `src/effects/authored/pool/<PACK>.ts` (the pack is the card's `data/cards/<PACK>.json`).
3. Check: `pnpm exec tsc --noEmit`, `pnpm vitest run src/effects scripts/effect-coverage.test.ts`, and
   `node --experimental-strip-types scripts/card-smoke.ts <code> <code> ...` for the cards you wrote. The coverage test also
   compares `src/effects/open-lines.ts`; `pnpm effects:open` rewrites it.

## The record

```ts
{ "id": "<code>:<timing>:<n>", "cardCode": "<code>", "lines": ["<code>:A:2"], "timing": "response", "trigger": "...", ...,
  "instructions": [...] }
```

- `lines` names the printed lines the record implements (ids from the draft). One line can need several records (a constant
  and a Response on one line); one record can name several lines only when they are one ability.
- `<n>` counts records of that timing on the card, in text order, from 1. A generated record with the same id is replaced
  (list it in `REPLACES` with the reason).
- Timing from the label: `Action:` (also `Planning/Quest/Travel/Encounter/Combat/Refresh/Resource Action:`) → `action`,
  `Response:` → `response`, `Forced:` → `forced`, `When Revealed:` → `whenRevealed`, `Setup:` → `setup`, `Travel:` →
  `travel`, `Shadow:` → `shadow`. A line with no label is `constant`, or `triggered` for an unlabelled "At the end of the
  round, discard ~" (a mandatory effect that is not printed as Forced).
- `trigger` is required on `forced`, `triggered` and `response`, and only there.
- A phase-limited Action adds `"condition": { "kind": "phase", "is": "Combat" }`. Valour adds
  `{ "kind": "threat", "min": 40 }`. Two conditions together: `{ "kind": "all", "conditions": [a, b] }`.
- Limits: "(Limit once per round.)" `oncePerRound`; "once per phase" `oncePerPhase`; "twice per round" `twicePerRound`;
  "twice per phase" `twicePerPhase`; "3 times per phase" `thricePerPhase`; "5 times per phase" `fivePerPhase`; "once per
  attack" `oncePerAttack`; "once per game" `oncePerGame`; "once per game for the group" `oncePerGameGroup`; "3 times per game
  for the group" `thricePerGameGroup`. "This effect may be triggered by each player once each round" is
  `oncePerRoundEachPlayer`. "Any player may trigger this action/response" is `"anyPlayer": true`.

## Which card an instruction acts on

- A `Pick` chooses a card or a player; the instructions after it act on the last picked (`target` defaults to `picked`). A
  pick with one candidate is taken without asking; with none, it picks nothing and later verbs do nothing.
- Card references (`target`, `of`, `card`): `self` (the source), `host` (the card the source is attached to), `picked`,
  `subject` (the card the answered event is about: "that ally", "that enemy"), `other` (the second card the event names: the
  enemy a character defends against or attacks, the enemy an attack destroyed), `attacker`, `defender`, `activeLocation`.
- `Each { pick, instructions }` runs the instructions once per matching card, each as the picked card, with no choice.
- Players: `{ "verb": "Pick", "pick": { "type": "player", "control": "any" } }`, then verbs with `"who": "picked"`.
- `Choose` offers options ("choose one: ..."); `ForEachPlayer` runs instructions for each player.

## Filters (`Pick`)

`type` (hero, ally, character, enemy, location, attachment, card, player) and `control` (`you`, `any`, `other`) are
required. Then any of: `trait`, `traits` (any of), `notTraits`, `names`, `sphere`, `spheres` (any of), `printedIcon`,
`unique`, `nonUnique`, `keyword` (sentinel, ranged: printed or gained), `state` (ready, exhausted), `damaged`, `committed`,
`attacking`, `defending`, `hasAttachment` ({ trait, playerCard }), `attachedTo` (source, host), `hasResources`,
`aboveThreat` (engagement cost higher than the chooser's threat), `other` (not the source), `different` (not already picked
by this effect). Enemies: `engaged: "you" | "other"`, `staging` (staging enemies count too), `stagingOnly`. Zones: `from`
(play by default, hand, discard, deck with `top`, victory); `cardType`, `maxCost`, `minCost`, `intoPlay` for cards out of
play. `who: "firstPlayer"` when the card says the first player chooses.

## Amounts

A number, or `{ "count": <pick> }`, `{ "stat": "attack", "of": "subject", "printed": true }` (stats: willpower, attack,
defense, threat, hitPoints, engagementCost, questPoints, damage, resources, progress, cost, threatCost), `{ "x": true }`,
`{ "players": true }`, `{ "threat": "actor" | "tens" }`, `{ "hand": true }`, each with optional `times`, `plus`, `limit`.

## Patterns

Attachment hosts. "Attach to a Dale or Dwarf character. Restricted."

```json
{"id":"19120:constant:1","cardCode":"19120","lines":["19120:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character"},"hosts":[{"type":"character","control":"any","traits":["Dale","Dwarf"]}]}]}
```

`hosts` is a list of filters, any of which a host may match ("a hero or Gandalf" is two filters; "a location" is
`{"type":"location","control":"any"}`; "an enemy engaged with a player" is `{"type":"enemy","control":"any"}`; "a hero you
control" uses `control: "you"`). `Limit 1 per hero/character` is `"limitPerHost": true`. Restricted is a keyword the engine
reads; the word needs no record. "Limit 1 per deck." is `{ "verb": "DeckLimit", "copies": 1 }` in a constant.

Static stats. "Attached hero gets +1 Attack (+2 Attack instead if attached hero is a Dwarf.)"

```json
{"id":"01041:constant:1","cardCode":"01041","lines":["01041:A:2"],"timing":"constant","instructions":[
 {"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"not","condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","trait":"Dwarf"}}}},
 {"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","trait":"Dwarf"}}}]}
```

"~ gets +1 Defense for each enemy engaged with you." (constant on the card itself)

```json
{"verb":"ModifyStat","stat":"defense","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"until":"whileSourceInPlay"}
```

"Each Outlands character you control gets +1 Attack." → `"holders": {"type":"character","control":"you","trait":"Outlands"}`.
"While ~ is committed to a quest, ~ gets +2 Willpower" → the effect's `condition`:
`{"kind":"matches","card":"self","pick":{"type":"character","control":"any","committed":true}}`.

Flags (ModifyStat with amount 1, `until: whileSourceInPlay` for a constant or `endOfPhase` / `endOfRound` for a lasting
effect): `sentinel`, `ranged` ("gains sentinel"), `noExhaustQuest`, `noExhaustAttack`, `noExhaustDefend` ("does not exhaust
to ..."), `cannotQuest`, `cannotAttack`, `cannotDefend` ("cannot attack or defend"), `cannotHaveAttachments`,
`cannotHaveRestricted`, `doesNotReady`, `noThreatContribution` ("does not contribute its Threat"), `noEngagementChecks`,
`cannotBeOptionallyEngaged`, `extraRestricted` (amount = extra restricted attachments), `extraResource` (on a hero: extra
resources in the resource phase), `extraDraw` (on a seat: `target: "actorSeat"`), `hitPoints` for "+1 hit point". "Enters
play exhausted." is `{ "verb": "EntersPlayExhausted" }`. Gaining a trait or a resource icon on an attachment's host:
`GrantTrait`, `GrantIcon`.

Play rules on the card itself (constant records read from the hand): "Play only if you control a Noldor hero." →
`{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","trait":"Noldor"},"min":1}}`. "If each
hero you control has a printed Leadership resource icon" → `{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"leadership"}}`.
"~ can be played from your discard pile." → `{"verb":"PlayFromDiscard"}` (`"only": true` for "can only be played from").
"Reduce the cost to play ~ by 1 for each X" → `{"verb":"ReduceCost","amount":{"count":...}}`. Doomed X and Secrecy X are
keywords the engine reads; their lines need no record.

Actions with costs. "Action: Exhaust ~ to ready attached hero."

```json
{"id":"131011:action:1","cardCode":"131011","lines":["131011:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]}
```

Costs (one, or a list paid together): `exhaustSelf`, `exhaustHost` ("exhaust ~ and attached hero"), `discardSelf`,
`addSelfToVictory`, `returnSelfToHand`, `damageSelf` (amount), `raiseThreat` (amount), `discardDeckTop` (amount),
`exhaustCode` (code: The One Ring is the card in play with that code), `resources` (amount, sphere, `from: "self"` for "from
~'s pool", `from: "host"` for "from attached hero's pool"). A cost that chooses a card ("Exhaust a Dwarf character to ...",
"Discard a card from your hand to ...") is the first instructions, with a condition that it can be paid:

```json
{"timing":"action","condition":{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Dwarf","state":"ready"}},"instructions":[
 {"verb":"Pick","pick":{"type":"character","control":"you","trait":"Dwarf","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}, ...]}
```

Events. An event's `Action:` is `timing: "action"` (its printed cost is paid by playing it). An event's `Response:` adds
`"cost": {"kind":"playEvent"}`. "Action: Choose a hero. That hero gets +2 Willpower until the end of the phase."

```json
{"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","target":"picked"}]}
```

Responses and Forced effects hear an event (`trigger`) about a card (`subject`): `"self"` for "After ~ ...", `"host"` for
"After attached hero ...", or a filter for "After a Silvan ally ..." (read from the source controller's side: `control:
"you"` is "you control"). `eventSeat: "you"` for "After you ..." (the event happened to the card's controller), `"other"` for
"another player". Events:

| trigger | about (subject) | other | when |
| --- | --- | --- | --- |
| enteredPlay | the card | | a player card entered play (played or put into play) |
| played | the card | | a card was played from a hand (events too) |
| leftPlay | the card | | a player card left play (and a location, for itself) |
| characterDestroyed / enemyDestroyed | the card | | damage destroyed it |
| allyLeftPlay | the ally | | an ally left play |
| committed | the character | | it was committed to the quest |
| questSucceeded / questFailed | (none: use eventSeat) | | after the quest resolved |
| declaredDefender / declaredAttacker | the character | the enemy | |
| attackDestroyed | each attacker | the enemy | a player attack destroyed the enemy ("participates in an attack that destroys") |
| attackResolved | the attacking enemy | the defender | an enemy attack ended |
| engaged | the enemy | | `seat` engaged it ("After you engage an enemy" = eventSeat you) |
| traveled | the location | | the players traveled there |
| addedToStaging | the encounter card | | revealed or put into the staging area |
| encounterRevealed | the card | | revealed, before its effects (a cancel window) |
| whenRevealedPending / shadowPending | | | a When Revealed or shadow effect is about to resolve (cancel) |
| damaged / healed / exhausted / readied | the card | | |
| resourcesAdded | the hero | | a card effect added resources to its pool |
| threatRaised | (none: eventSeat) | | |
| discardedFromHand / discardedFromDeck | the card | | |
| beginningOfPhase / endOfPhase / endOfRound | | | with a `phase` condition |

"Response: After a Silvan ally enters play, that ally gets +1 Attack until the end of the round."

```json
{"timing":"response","trigger":"enteredPlay","subject":{"type":"ally","control":"any","trait":"Silvan"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","target":"subject"}]}
```

Verbs worth knowing: `Draw` (amount, who), `AddResources` (amount, to: host/picked/self/subject), `MoveResources`
(from the card picked before the last to the last), `LowerThreat` / `RaiseThreat` (amount, who), `SetThreat`, `Heal`
(amount or all, target), `DamageCard` (amount, target), `PlaceProgressOn` (amount, target), `PlaceQuestProgress`, `Ready`,
`Exhaust`, `ReturnToHand`, `PutOnDeck` (top, bottom, shuffle), `Discard` (target), `DiscardPicked`, `DiscardFromHand`,
`DiscardTopOfDeck`, `AddToVictory`, `Engage` (target), `ReturnToStaging` (target), `MovePicked` (to hand or play),
`AttachPicked`, `ArrangeTop`, `ShuffleDeck`, `LookAtEncounterTop`, `CancelEffect` (in a whenRevealedPending, shadowPending
or encounterRevealed Response), `BarAttack`, `AttackEnemy`, `ModifyStat`, `Delay` (until endOfPhase or endOfRound; `subject:
"picked"` keeps the picked card), `Repeat`.

Search. "Search the top 5 cards of your deck for a Silvan ally and add it to your hand. Shuffle the other cards back."

```json
[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","trait":"Silvan"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]
```

Temporary allies. "Put 1 ally card into play from your hand. At the end of the phase, if that ally is still in play,
return it to your hand."

```json
[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand","cardType":"ally","intoPlay":true}},{"verb":"MovePicked","to":"play"},
 {"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"ReturnToHand","when":{"kind":"matches","card":"picked","inPlay":true}}]}]
```

## Not expressible yet: leave open, report

Report each line you leave open with the mechanic it needs. Write records for the card's other lines.

- Canceling, preventing or redirecting damage ("cancel X damage just dealt", "takes all damage assigned to", "place that
  damage on ~ instead", "damage from undefended attacks may be assigned to"); canceling an attack.
- A character attacking outside the player attack step ("declare it as an attacker (and resolve its attack)"), attacking
  an enemy in the staging area, "attacking alone ... does not count its Defense", excess damage, extra defenders.
- Cost changes for the next card ("reduce the cost of the next X you play this phase"), "the first X you play each round",
  "does not require a resource match", "you may spend resources from ~ to pay for X", "is considered to have icons while
  paying", additional play costs, "must use resources from 3 different heroes", "paid from a single hero's pool".
- The encounter deck beyond `LookAtEncounterTop`: looking at or discarding several cards, moving a card to the bottom,
  revealing more or fewer cards, searching it, shuffling the discard pile into it.
- "Treat ... text box as blank", "considered to be out of play", "immune to card effects".
- Player side quests, contracts, Guarded, Traps ("Play into the staging area unattached"), the Encounter keyword, flipping
  a card, hero swaps from the collection, "loses the ally card type and gains the hero card type".
- Control changes (give or take control of a card, the first player token).
- "When ... would ..." replacement effects and "instead".
- Deckbuilding rules beyond `DeckLimit`; naming a card type or a number.
- Looking at shadow cards, shadow cards dealt face up.

If one sentence pattern repeats on many cards, say so in the report: it may belong in a template
(`scripts/data/effects/*-templates.ts`) instead.
