// Condition kinds a family's own hook answers before the table (interpret/family-hooks.ts: south, black-gate, burgle, captured, armies, wilderland and the others): the entries only complete the table, so a hook that declines reads false.
import type { ConditionHandlers } from "../condition-scope.ts";

const no = (): boolean => false;

export const familyOnlyHandlers = {
  noneDiscarded: no, lastPlayer: no, logged: no, treasuresLogged: no, beldisBox: no, cavesDeck: no, pileHas: no, facedownUnder: no, questDeck: no, soleAttacker: no, captives: no, discardedHasShadowOrTentacle: no, firstLetterMatches: no,
  attackedThisPhase: no, optionTaken: no, namedFlag: no, discoverUnavailable: no, investigateIgnored: no, investigationTop: no, encounterPlacedOnStage: no, playerUnengaged: no, hasWizardry: no, questProgressNoted: no, committedThisRound: no, guardianCanChange: no, onDial: no, canAttachToDial: no, embassy: no, lastFortitudeFailed: no, lastEscapeFailed: no, lastEscapePassed: no, lastLocateFailed: no, lastLocatePassed: no, hasPass: no, playerWithoutReady: no, drew: no, thenResolves: no, engagedWithLastPlayer: no, firstTreachery: no, firstEnemy: no, underworldReleased: no, deckEmpty: no, lastFortitudePassed: no, captured: no, fortitudeFailed: no, hostControlledByActor: no, currentQuest: no, currentQuestProgress: no, questLeads: no, hitPointsLeft: no, timeOfDay: no, safeActive: no, allAtStage: no, setAsideHas: no, exploredPending: no, night: no, encounterDeckEmpty: no, encounterCanReveal: no, bagginsTravel: no, riddle: no,
  burgleSucceeded: no, burgleFailed: no, burgling: no, burgleCanDiscard: no, shadowBurgle: no, bagginsAtLeast: no, encounterTop: no,
  // The captured family answers versusVictoryTrait (families/captured/values.ts); holderExhausted is a stat condition, read where the stat is (core/modified-stat.ts).
  versusVictoryTrait: no, holderExhausted: no,
  // The armies family's hook answers these.
  stagesComplete: no, stageIsCurrent: no, stageNoProgress: no,
} satisfies Partial<ConditionHandlers>;
