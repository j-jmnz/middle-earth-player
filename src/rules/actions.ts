import type { Effect } from "../catalog/boundary.ts";

import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import { runEffect, type ReduceContext } from "./interpret.ts";
import type { ScenarioState } from "./state.ts";
import { withFrame } from "./windows.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

function inTriggerWindow(state: ScenarioState): boolean {
  return state.window?.kind === "pass" || state.window?.kind === "frameAction";
}

function actionEffect(state: ScenarioState, ctx: ReduceContext, cardId: string, effectId: string): Effect | undefined {
  const instance = state.cards[cardId];
  if (!instance || instance.controller !== state.activeSeat) return undefined;
  if (instance.zone !== "heroes" && instance.zone !== "play") return undefined;
  return ctx.effects.find(
    (effect) => effect.id === effectId && effect.cardCode === instance.code && effect.timing === "action",
  );
}

// Every action effect on a card the active seat controls in play.
export function triggerIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  if (!inTriggerWindow(state)) return [];
  const intents: LegalIntent[] = [];
  for (const instance of Object.values(state.cards)) {
    for (const effect of ctx.effects) {
      if (effect.id == null || actionEffect(state, ctx, instance.id, effect.id) !== effect) continue;
      intents.push({ type: "Trigger", cardId: instance.id, effectId: effect.id });
    }
  }
  return intents;
}

export function triggerReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  if (!inTriggerWindow(state)) return "That intent is not legal in this window";
  if (!actionEffect(state, ctx, intent.cardId, intent.effectId)) return "That effect cannot be triggered";
  return null;
}

// The effect resolves in its own frame. Everyone may pass again afterward.
export function applyTrigger(
  state: ScenarioState,
  intent: TriggerIntent,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const effect = actionEffect(state, ctx, intent.cardId, intent.effectId);
  if (!effect) return state;
  const seat = state.activeSeat;
  const resolved = withFrame(state, "ResolveEffect", intent.cardId, state.perilSeat != null, (framed) => {
    return runEffect(framed, effect, intent.cardId, seat, ctx, steps);
  }, steps);
  return { ...resolved, passed: [] };
}
