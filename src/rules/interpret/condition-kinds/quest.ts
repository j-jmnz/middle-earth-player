// Conditions about the phase, the quest and its stage.
import { questSucceeded } from "../../families/costs/pay.ts";
import { currentQuestHas, questHasKeywords, stepHolds } from "../../families/quest/conditions.ts";
import { onStage } from "../../families/nightmare/guards.ts";
import { committedWillpower, stagingThreat } from "../../quest/quest.ts";
import type { ConditionHandlers } from "../condition-scope.ts";

export const questHandlers = {
  phase: (state, condition, scope) => {
    // The action window after 7.4 (the engine's "End of round" step) is still in the refresh phase (rr.step-7-4,
    // rr.step-7-5): a Refresh Action may be used there. An ended phase an event names is read as it is.
    if (scope.phase == null && condition.is === "Refresh" && state.phase === "End of round") return true;
    return (scope.phase ?? state.phase) === condition.is;
  },
  phaseEnded: (state, condition) => state.boundaryPhase === condition.is && state.phase !== condition.is,
  onStage: (state, condition) => onStage(state, condition.stage),
  stageReached: (state, condition) => (state.stagesReached ?? []).includes(condition.code) === condition.is,
  questProgress: (state) => {
    const stage = state.questStage ? state.cards[state.questStage] : undefined;
    return stage != null && stage.progress > 0;
  },
  stageProgress: (state, condition) => {
    const stage = state.questStage ? state.cards[state.questStage] : undefined;
    return stage != null && stage.progress >= condition.min * (condition.perStartedPlayer === true ? state.seatCount : 1);
  },
  step: (state, condition) => stepHolds(state, condition.is),
  questKeyword: (state, condition, _scope, ctx) => currentQuestHas(state, condition.keyword, ctx.cards) === condition.is,
  questKeywords: (state, condition, _scope, ctx) => questHasKeywords(state, ctx) === condition.is,
  questSucceeded: (state, condition, scope) => questSucceeded(state, scope.actor, scope.sourceId, condition.committed === true),
  questFailed: (state, _condition, scope) => state.quested?.round === state.round && (state.quested.failed ?? []).includes(scope.actor),
  committedWillpower: (state, condition, scope, ctx) => committedWillpower(state, ctx.cards, scope.actor) >= condition.min,
  stagingThreat: (state, condition, scope, ctx) => stagingThreat(state, ctx.cards, scope.actor) <= condition.max,
} satisfies Partial<ConditionHandlers>;
