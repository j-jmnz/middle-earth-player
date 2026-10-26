# Phase 13 handover (Flight to the Ford)

Branch `wip-phase-13`, pushed to `wip/phase-13`. Delete this file in the final commit and restore `src/effects/open-lines.ts`
(`git checkout src/effects/open-lines.ts`; the main session regenerates it).

## Done

- Records for all 34 open lines (`src/effects/authored/flight-to-the-ford.ts`, wired in `src/effects/index.ts`).
  141029:B:4 and 141057:A:3 are `inert` in `data/printed/fellowship-of-the-ring.json` (each restates a rule the engine applies).
- New family `burden` (catalog `src/catalog/families/burden.ts`, rules `src/rules/families/burden*.ts`), registered in the two
  `families/index.ts`. Encounter family: RevealMore + flag revealMore.
- Shared engine hooks: placeDamage (damageToLife), Heal/HealAmong (cannotBeHealed), hasKeyword and actionEffect (blank text),
  dealAdditionalShadow (noShadowDealt), finishAttack (X = characters destroyed), settle (announceProgress), travelCostUnpayable
  (RevealBurden), actions.ts (objective/quest/location Actions for any player), startScenario (campaign zone), frames.ts (extra
  reveals), conditions (burdenDeck, campaign, x), CardType campaign + world.ts prints the scenario's campaign card.
- Tests: ford-life, ford-burden, ford-encounter, ford-treacheries, ford-shadows, ford-campaign, golden-ford (+ causes, replay),
  burden.test.ts, play/widgets, play/ford-sheets. Golden `src/campaign/golden/flight-to-the-ford.json`.
- Phone half: `src/play/widgets.ts` + `table-view.tsx` (life and burden deck count), choice words, three Maestro flows.
- Docs: brief (decisions of phase 13), phase file (E2E), STATUS row.
- `flight-to-the-ford` is in `src/campaign/playable.ts`; `PENDING_LINES` is empty.

## In progress

- Final checks (tsc, lint, effects:open, full suite, data:check) and the final commit.

## Decisions

- Ring-bearer = the hero with the Ring-bearer trait.
- The campaign card is placed in a new `campaign` zone (counts as in play) only when it has a Response, Forced, Action or constant.
- The Last Bridge's X is its Threat (Hall of Beorn prints Threat X, quest points 4).
- "If this attack destroys a character": the after-attack effect's X is the characters destroyed (`x` condition).
- No ENGINE_VERSION bump: no replayed game of scenarios 1, 2 or the starter decks moved (their goldens are unchanged).
- Maestro fixtures `ford-start/won/lost` stay open: they need the scenario 1 and 2 win chain, which does not exist.

## Next

- Nothing in the engine half. Phone checks and Maestro runs stay open.
