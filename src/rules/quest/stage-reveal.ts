// Rules: rr.quest-cards-quest-deck, rr.quest-advancement (data/rules/entries.json).
import { pushCardEffects } from "../interpret/effect-frames.ts";
import type { EngineStep } from "../core/intents.ts";
import { runQuestResolution } from "./explore.ts";
import { afterQuestOutcome, questOutcome } from "../families/quest/outcome.ts";
import { questFailureRaise } from "../families/quest/threat.ts";
import { askQuestProgress } from "../families/attachments/quest.ts";
import { resolveSideQuests, sideQuestTotals } from "../families/sidequests/quest.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { gameReadsOnTrigger } from "../core/game-reads.ts";
import { isLocationId } from "../core/printed.ts";
import { advanceStage, clearCommitted, questPointsOf, resolveQuest } from "./quest.ts";
import { defeatedBefore, questCardDefeatedHeard } from "../families/quest/branch.ts";
import { queueEvent } from "../windows/queue.ts";
import { offerResponses } from "../windows/responses.ts";
import { restricted } from "../interpret/restrictions.ts";
import { flagged, livingSeats, withMode, type ScenarioState } from "../core/state.ts";
import { stageSeat } from "../families/breaking/areas.ts";
import { payOwed } from "../families/breaking/progress.ts";
import { fireForced } from "../windows/triggers.ts";
import { announceStageRevealed } from "../families/nightmare/setup.ts";

// Resolving the quest is two passes. The first adds progress, and each stage the quest advanced to has
// its When Revealed effects pushed as frames. The second runs once those frames have popped, and ends
// the phase. The phase does not end while a new stage is still resolving.
export function resolutionStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.questResolved) return finish({ ...state, questResolved: false });
  // A location that may take the progress first asks the players once (Explorer's Almanac, families/attachments/quest.ts).
  const asked = askQuestProgress(state, ctx, steps);
  if (asked) return asked;
  const before = steps.length;
  // Who was committed, read before resolving clears it, and the threat a failed quest raises (families/quest/).
  const outcome = questOutcome(state, ctx);
  // The progress each side quest takes from its committed characters, read before resolution clears who is committed.
  const sides = sideQuestTotals(state, ctx);
  const canAdvance = (current: ScenarioState) => !restricted(current, ctx, "advance").length;
  // Once stages are separate each seat resolves the quest of its own stage in player order, against its own staging area (mec109.multiple-staging-areas).
  const quested = state.separate ? resolveSeparate(state, ctx, steps, canAdvance) : resolveQuest(state, ctx.cards, steps, canAdvance, questFailureRaise(ctx, steps), undefined, failureAmountRead(state, ctx));
  const resolved = resolveSideQuests(quested, sides, ctx, steps);
  // The scenario is over: settle stops on it, so there is no second pass.
  if (resolved.stageCleared || resolved.lost) return finish(resolved);
  return afterQuestOutcome(afterProgress({ ...resolved, questResolved: true }, before, ctx, steps), outcome, ctx, steps);
}

// A card in the game answers a failed quest with an X amount (Urdug's Gambit, 19051:B:2): the event carries the shortfall for it.
const failureAmountRead = (state: ScenarioState, ctx: ReduceContext): boolean => gameReadsOnTrigger(state, ctx, "questFailed", '"x":true');

// The quest of each living seat in player order, one stage and one staging area each: its committed willpower against the threat in its own staging area,
// progress on its own stage or only its own threat raised (resolveQuest with `only`). The commitments end once every seat has resolved.
function resolveSeparate(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], canAdvance: (state: ScenarioState) => boolean): ScenarioState {
  let next = state;
  for (const seat of livingSeats(state)) {
    next = resolveQuest(next, ctx.cards, steps, canAdvance, questFailureRaise(ctx, steps), seat, failureAmountRead(state, ctx));
    if (next.stageCleared || next.lost) break;
  }
  return clearCommitted(next);
}

// After progress was placed on the quest (from `steps[before]` on): each stage the quest advanced to has its When Revealed
// effects pushed as frames, and a location the progress explored has its Responses offered first (those that put progress on the quest, under the
// stage's frames).
export function afterProgress(state: ScenarioState, before: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The progress a stage 3B turned into discards from the encounter deck (families/breaking/progress.ts).
  let next = payOwed(state, ctx, steps);
  const advanced = steps.slice(before).flatMap((step) => (step.kind === "advance" && step.stormcaller !== true ? [step.cardId] : []));
  // A location the progress explored has left play. Responses to that are offered before the stage's own effects.
  const explored = steps.slice(before).flatMap((step) => (step.kind === "destroy" && isLocationId(next, step.targetId, ctx.cards) ? [step.targetId] : []));
  // Goblin Trail (41014:A:2) puts progress on the current quest: its Response waits for the new stage's When Revealed (below), so the
  // progress lands on a stage that is revealed (rr.quest-advancement: advancing is immediate; rr.triggering-condition).
  const early = explored.filter((cardId) => advanced.length > 0 && progressesQuest(next, cardId, ctx));
  for (const cardId of [...early].reverse()) {
    next = runQuestResolution(next, cardId, ctx, steps);
    next = announceLeftPlay(next, cardId, ctx, steps, true);
  }
  // The first stage reached resolves first, so it is pushed last.
  for (const cardId of [...advanced].reverse()) {
    const code = next.cards[cardId]?.code;
    const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
    // "Forced: After stage 2B is revealed" (11182:A:3) goes down first, so it resolves once the stage's When Revealed effects have.
    next = announceStageRevealed(next, cardId, ctx, steps, "afterStageRevealed");
    // A stage a seat advanced to once stages are separate is revealed by that seat (families/breaking/areas.ts).
    next = pushCardEffects(next, "whenRevealed", cardId, stageSeat(next, cardId) ?? next.firstPlayer, false, effects, ctx, steps);
    // "Forced: When stage 3A is revealed" (906101:A:2) resolves above the stage's own When Revealed effects.
    next = announceStageRevealed(next, cardId, ctx, steps);
  }
  // "After a quest card is defeated" (Mendor, 01135:A:3) and "When you defeat this stage" (01120:B:1) hear each stage the quest left.
  if (questCardDefeatedHeard(next, ctx)) {
    for (const cardId of advanced) {
      const defeated = defeatedBefore(next, cardId);
      if (defeated) next = queueEvent(next, { trigger: "questCardDefeated", seat: null, subject: defeated });
    }
  }
  for (const cardId of [...explored.filter((id) => !early.includes(id))].reverse()) {
    next = runQuestResolution(next, cardId, ctx, steps);
    next = announceLeftPlay(next, cardId, ctx, steps, true);
  }
  // A defeated stage that looks at the next ones (LookAtStages, families/quest/order.ts) asks the first player, in a frame of the stage's own record.
  return next.stageChoice === "due" ? askStage(next, ctx, steps) : next;
}

function askStage(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.questStage;
  const code = id ? state.cards[id]?.code : undefined;
  if (!id || !code) return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.instructions.some((instruction) => instruction.verb === "LookAtStages"));
  return pushCardEffects({ ...state, stageChoice: "asking" }, "forced", id, state.firstPlayer, false, effects, ctx, steps);
}

// A stage that holds its quest points in progress but was held back advances as soon as nothing holds it any more
// (rr.quest-advancement: "immediately"; faq.progress-without-advancing lets it take more meanwhile): To the River... once no
// Hill Troll is in play (01126:B:2), The Necromancer's Tower once the players have an objective (01123:B:3). The rules engine
// asks between two steps of the round, with no window open, no effect resolving and no attack under way. A stage with no
// progress is left for the progress it next takes (a stage at 0 quest points, advanceStage), unless it holds the flag advancesWhenFreed (146066:B:3).
export function advanceFreed(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.window || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || state.stageCleared || state.lost) return state;
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage || (stage.progress === 0 && !flagged(state, stage.id, "advancesWhenFreed"))) return state;
  const points = questPointsOf(state, stage, ctx.cards);
  const canAdvance = (current: ScenarioState) => restricted(current, ctx, "advance").length === 0;
  if (points == null || stage.progress < points || !canAdvance(state)) return state;
  const before = steps.length;
  return afterProgress(advanceStage(state, ctx.cards, steps, canAdvance), before, ctx, steps);
}

// A card left play: Responses are offered once its Forced effects have resolved, so their frame goes under the Forced ones
// (rr.timing-of-ability-resolution). `explored`: the location left play explored (rr.explored), read by `subjectExplored`.
export function announceLeftPlay(state: ScenarioState, cardId: string, ctx: ReduceContext, steps: EngineStep[], explored = false): ScenarioState {
  const event = { trigger: "leftPlay", seat: null, cardId, ...(explored ? { explored: true } : {}) } as const;
  return fireForced(offerResponses(state, event, ctx, steps), event, ctx, steps);
}

// Whether the location's Response to leaving play puts progress on the quest (a record's instruction says so).
function progressesQuest(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const code = state.cards[id]?.code;
  return ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "response" && effect.trigger === "leftPlay" && effect.instructions.some((instruction) => instruction.verb === "ProgressQuest"));
}

function finish(state: ScenarioState): ScenarioState {
  if (state.stageCleared || state.lost) return { ...withMode(state, "stopped"), window: null };
  return withMode(state, "travel");
}
