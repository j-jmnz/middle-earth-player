# Phase 13 handover (Flight to the Ford)

Branch `wip-phase-13`, pushed to `wip/phase-13`. Delete this file in the final commit and restore `src/effects/open-lines.ts`
(`git checkout src/effects/open-lines.ts`; the main session regenerates it).

## Done

- Records for all 34 open lines of the scenario (`src/effects/authored/flight-to-the-ford.ts`, wired in `src/effects/index.ts`).
  141029:B:4 and 141057:A:3 are `inert` in `data/printed/fellowship-of-the-ring.json` (each restates a rule the engine applies).
- New family `burden` (catalog `src/catalog/families/burden.ts`, rules `src/rules/families/burden*.ts`): SetLife, ReduceLife,
  ShuffleBurdenDeck, RevealBurden, MoveBurden, AttachSelfToRingBearer, ImmediateAttackEach, PassFirstPlayer, EndQuestPhase,
  SetStatUntil, RemoveAllQuestProgress; trigger progressPlaced; flags damageToLife, cannotBeHealed, noShadowDealt.
- Encounter family: RevealMore + flag revealMore (next to RevealFewer).
- `flight-to-the-ford` is in `src/campaign/playable.ts`.

## In progress

- Engine tests, goldens, campaign tests, phone half (burden deck count), Maestro yaml, STATUS note.

## Decisions

- Ring-bearer = the hero with the Ring-bearer trait.
- The campaign card is placed in a new `campaign` zone (counts as in play) only when it has a Response, Forced, Action or constant.
- The Last Bridge's X is its Threat (Hall of Beorn prints Threat X, quest points 4).
- "If this attack destroys a character": the after-attack effect's X is the characters the attack destroyed (`x` condition).

## Next

- See In progress.
