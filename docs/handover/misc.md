# Handover: misc family (constants and responses no other family takes, the saga heroes, The One Ring and Master cards)

Branch `wip/misc` (worktree branch `wip-misc`), based on `ccr-a8ef8247-8087n8`. Brief: `docs/handover/agent-brief.md` in the main
checkout plus the 2026-10-26 addendum (push after every step, attribution lines). 74 lines were assigned.

## Done (pushed)

- Healing group (pick `controlledBy: "picked"`, `onPicked`, verbs `DrawEach`, `HealQuietly`, trigger `resourceDrawn`): 01061, 01068,
  02102 (refresh readying announces `readied` with phase Refresh, only in a game with a card that reads it), 04083, 04128, 09011, 10147,
  22111, 142005.
- Constants and amounts: 06057 (amount `negative`), 12064:A:3, 02119 (amount `facedown`), 19002, 04005 (amount `resourcesAboveCopies`),
  132005 (flag `countsAsTwoDwarves`, hook in `countMatching`), 22027 and 05005 (flags `traitRohan`/`traitGondor`, read by `hasTrait`),
  146012, 12034 and 144010 (flags `countsAsRestricted`, `losesRestricted`; `restrictedLoad` in restrictions.ts), 17064 (condition
  `distinctTraits`).
- Saga attachments: 142011, 142012, 142013, 142014, 22009, 22033, 22085 (hosts "the hero with The One Ring" = hero with an attachment
  with the Ring trait).
- Events: 02058 (`MoveDamage`, ChooseX), 02073, 04105 (attackDamaged now carries the damage as `amount`), 05005, 06010 (flags
  `spendAs<Sphere>`, read by `heroPaysFor`), 06143, 10146, 11001, 12061, 131012, 132009, 08010 (`FixedX`), 08034 (`GrantSecrecy`), 02080
  (PlayOnlyIf), 10060:A:2 (pool record's `lines` extended).
- The One Ring (21001): Delay `until: "startOfGame"` (delayed.ts, machine.ts afterOpening) so a player's Setup can ask choices after the
  opening hands; `PutAttachmentIntoPlay`; flags `eliminationReduction` (keywords.ts `eliminateEmpties`), `immuneToNonMaster` (pick.ts via
  misc-guards.ts); `LoseGame`. Master Ring (21009: `DiscardCanceled` + frames.ts `revealAnother`), 21010, 21011.
- Saga heroes: Bilbo (131001, 132001, 131019, 132013: flags `noPlayerCardResources`, `noNonTreasureResources`, verb `PayFromHero`,
  amount `ofNamed`, pick `exceptNames`, pick cardType `treasure`), Aragorn (143001, 145001, 146002), Frodo (142001: flag `dealsNoDamage`
  read in shadow.ts), 144013, Sméagol side A (21072:A:2: setup-search.ts now runs a hero's Setup; `ShuffleIntoEncounterDeck` handled in
  the family).
- Tests: `src/rules/families/misc.test.ts`, `misc-constants.test.ts`, `misc-events.test.ts`, `misc-ring.test.ts`, `misc-saga.test.ts`;
  fixture `misc-fixture.ts`.

## Decisions

- A player's Setup that needs choices (The One Ring) runs after the opening hand and mulligan, before the first round, not before the
  hand is drawn (mec109.setup): the engine cannot ask in `startScenario`.
- `HealQuietly`: Elrond's (04128) own healing announces no `healed` event, so it does not answer itself.
- The One Ring's constant/triggered sentences are claimed on the unlabelled line 2 (a line opening with "Setup:" allows no other timing).
- The app has no collection tracker (docs/brief.md), so "your collection" for Helm of Secrecy / Thorongil is every hero card in the catalog.

## Next

- 22090 Helm of Secrecy, 22146 Thorongil (hero swaps from the collection).
- 21072:B:1, B:2 (Sméagol side B / Gollum): see Open lines.

## Open lines

- 21072:B:1, 21072:B:2: side B is an enemy (Gollum) whose Attack, Defense, hit points and engagement are not in `data/` (the card's `back`
  is null), and no engine verb flips a hero card into an enemy. Needs the back-side stats in the data and a flip mechanic.
