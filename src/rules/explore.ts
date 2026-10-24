import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { pushCardEffects } from "./effect-frames.ts";
import type { ScenarioState } from "./state.ts";

// A location the progress explored has left play. Its questResolution records run in a frame of their
// own, on the card that left, before any Response to it is offered.
export function runQuestResolution(state: ScenarioState, cardId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const code = state.cards[cardId]?.code;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "questResolution");
  return pushCardEffects(state, "ResolveEffect", cardId, state.firstPlayer, false, effects, ctx, steps);
}
