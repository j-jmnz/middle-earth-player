import { pushCardEffects } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { resolveQuest } from "./quest.ts";
import { withMode, type ScenarioState } from "./state.ts";

// Resolving the quest is two passes. The first adds progress, and each stage the quest advanced to has
// its When Revealed effects pushed as frames. The second runs once those frames have popped, and ends
// the phase. The phase does not end while a new stage is still resolving.
export function resolutionStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.questResolved) return finish({ ...state, questResolved: false });
  const before = steps.length;
  const resolved = resolveQuest(state, ctx.cards, steps);
  // The scenario is over: settle stops on it, so there is no second pass.
  if (resolved.stageCleared || resolved.lost) return finish(resolved);
  let next: ScenarioState = { ...resolved, questResolved: true };
  const advanced = steps.slice(before).flatMap((step) => (step.kind === "advance" ? [step.cardId] : []));
  // The first stage reached resolves first, so it is pushed last.
  for (const cardId of [...advanced].reverse()) {
    const code = next.cards[cardId]?.code;
    const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
    next = pushCardEffects(next, "whenRevealed", cardId, next.firstPlayer, false, effects, ctx, steps);
  }
  return next;
}

function finish(state: ScenarioState): ScenarioState {
  if (state.stageCleared || state.lost) return { ...withMode(state, "stopped"), window: null };
  return withMode(state, "travel");
}
