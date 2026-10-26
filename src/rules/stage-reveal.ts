// Rules: rr.quest-cards-quest-deck, rr.quest-advancement (data/rules/entries.json).
import { pushCardEffects } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import { runQuestResolution } from "./explore.ts";
import { askQuestProgress } from "./families/attachments-quest.ts";
import type { ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import { resolveQuest } from "./quest.ts";
import { offerResponses } from "./responses.ts";
import { restricted } from "./restrictions.ts";
import { withMode, type ScenarioState } from "./state.ts";
import { fireForced } from "./triggers.ts";

// Resolving the quest is two passes. The first adds progress, and each stage the quest advanced to has
// its When Revealed effects pushed as frames. The second runs once those frames have popped, and ends
// the phase. The phase does not end while a new stage is still resolving.
export function resolutionStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.questResolved) return finish({ ...state, questResolved: false });
  // A location that may take the progress first asks the players once (Explorer's Almanac, families/attachments-quest.ts).
  const asked = askQuestProgress(state, ctx, steps);
  if (asked) return asked;
  const before = steps.length;
  const resolved = resolveQuest(state, ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length);
  // The scenario is over: settle stops on it, so there is no second pass.
  if (resolved.stageCleared || resolved.lost) return finish(resolved);
  return afterProgress({ ...resolved, questResolved: true }, before, ctx, steps);
}

// After progress was placed on the quest (from `steps[before]` on): each stage the quest advanced to has its When Revealed
// effects pushed as frames, and a location the progress explored has its Responses offered first.
export function afterProgress(state: ScenarioState, before: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const advanced = steps.slice(before).flatMap((step) => (step.kind === "advance" ? [step.cardId] : []));
  // A location the progress explored has left play. Responses to that are offered before the stage's own effects.
  const explored = steps.slice(before).flatMap((step) => (step.kind === "destroy" && isLocation(next, step.targetId, ctx) ? [step.targetId] : []));
  // The first stage reached resolves first, so it is pushed last.
  for (const cardId of [...advanced].reverse()) {
    const code = next.cards[cardId]?.code;
    const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
    next = pushCardEffects(next, "whenRevealed", cardId, next.firstPlayer, false, effects, ctx, steps);
  }
  for (const cardId of [...explored].reverse()) {
    next = runQuestResolution(next, cardId, ctx, steps);
    next = announceLeftPlay(next, cardId, ctx, steps);
  }
  return next;
}

// A card left play: Responses are offered once its Forced effects have resolved, so their frame goes under the Forced ones
// (rr.timing-of-ability-resolution).
export function announceLeftPlay(state: ScenarioState, cardId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const event = { trigger: "leftPlay", seat: null, cardId } as const;
  return fireForced(offerResponses(state, event, ctx, steps), event, ctx, steps);
}

function isLocation(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && printedOf(ctx.cards, instance.code).type === "location";
}

function finish(state: ScenarioState): ScenarioState {
  if (state.stageCleared || state.lost) return { ...withMode(state, "stopped"), window: null };
  return withMode(state, "travel");
}
