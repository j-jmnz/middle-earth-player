# Handover: misc family (constants and responses no other family takes, the saga heroes, The One Ring and Master cards)

Branch `wip/misc` (worktree branch `wip-misc`), based on `ccr-a8ef8247-8087n8`. Brief: `docs/handover/agent-brief.md` in the main
checkout plus the 2026-10-26 addendum (push after every step, attribution lines). 74 lines were assigned.

## Done (pushed)

- Healing group (pick `controlledBy: "picked"`, `onPicked`, verbs `DrawEach`, `HealQuietly`, trigger `resourceDrawn`): 01061, 01068,
  02102 (refresh readying now announces `readied` with phase Refresh when a record hears it), 04083, 04128, 09011, 10147, 22111, 142005.
- Constants and amounts: 06057 (amount `negative`), 12064:A:3, 02119 (amount `facedown`), 19002, 04005 (amount `resourcesAboveCopies`), 132005
  (flag `countsAsTwoDwarves`, hook in `countMatching`), 22027 and 05005 (flags `traitRohan`/`traitGondor`, read by `hasTrait`), 146012,
  12034 and 144010 (flags `countsAsRestricted`, `losesRestricted`; `restrictedLoad` in restrictions.ts), 17064 (condition `distinctTraits`).
- Saga attachments: 142011, 142012, 142013, 142014, 22009, 22033, 22085 (hosts "the hero with The One Ring" = hero with an attachment
  with the Ring trait).
- Events: 02058 (`MoveDamage`, ChooseX), 02073, 04105 (attackDamaged now carries the damage as `amount`), 05005, 06010 (flags
  `spendAs<Sphere>`, read by `heroPaysFor`), 06143, 10146, 11001, 12061, 131012, 132009, 08010 (`FixedX`), 08034 (`GrantSecrecy`), 02080
  (PlayOnlyIf), 10060:A:2 (pool record's `lines` extended).
- Tests: `src/rules/families/misc.test.ts`, `misc-constants.test.ts`, `misc-events.test.ts`; fixture `misc-fixture.ts`.

## Next

- Bilbo / Aragorn / Sméagol / The One Ring / Master cards (131001, 131019, 132001, 132013, 142001, 143001, 144013, 145001, 146002,
  21001, 21009, 21010, 21011, 21072) and the collection swaps (22090, 22146).

## Open lines

(none decided yet)
