import type { Effect } from "../catalog/boundary.ts";

import { applyCancel, cancelIntents, cancelReason } from "./cancel.ts";
import { holds } from "./conditions.ts";
import { effectsOf } from "./listen.ts";
import { effectCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { applyResponse, responseIntents, responseReason } from "./responses.ts";
import { applyMulliganTrigger, mulliganTriggerReason } from "./families/deck-play.ts";
import { usedFromHand } from "./families/deck-rules.ts";
import type { ScenarioState } from "./state.ts";
import { payUsage, usable, usageReason } from "./usage.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

function inTriggerWindow(state: ScenarioState): boolean {
  return state.window?.kind === "pass" || state.window?.kind === "frameAction";
}

// An Action on a card the active seat controls in play (or, for a per-player limit, any card), whose condition holds.
function actionEffect(state: ScenarioState, ctx: ReduceContext, cardId: string, effectId: string): Effect | undefined {
  const instance = state.cards[cardId];
  if (!instance) return undefined;
  // An Action used from the hand says so in its condition ("put Emery into play from your hand", families/deck-rules.ts).
  if (instance.zone !== "heroes" && instance.zone !== "play" && instance.zone !== "attached" && instance.zone !== "hand") return undefined;
  const effect = effectsOf(ctx, instance.code).find((entry) => entry.id === effectId && entry.timing === "action");
  if (effect && (instance.zone === "hand") !== usedFromHand(effect)) return undefined;
  // Only the card's controller uses its Action, unless any player may (Éowyn's once a round each, "Any player may trigger").
  if (!effect || (instance.controller !== state.activeSeat && effect.limit !== "oncePerRoundEachPlayer" && !effect.anyPlayer)) return undefined;
  const scope = { actor: state.activeSeat, sourceId: cardId, returned: 0 };
  return !effect.condition || holds(state, effect.condition, scope, ctx) ? effect : undefined;
}

// Every Action the active seat can use now: its condition holds, its limit is unspent, its cost can be paid.
export function triggerIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  if (state.window?.kind === "cancelOffer") return cancelIntents(state);
  if (state.window?.kind === "response") return responseIntents(state);
  if (!inTriggerWindow(state)) return [];
  const intents: LegalIntent[] = [];
  for (const instance of Object.values(state.cards)) {
    for (const effect of effectsOf(ctx, instance.code)) {
      if (effect.timing !== "action" || actionEffect(state, ctx, instance.id, effect.id) !== effect) continue;
      if (usable(state, effect, instance.id, state.activeSeat, ctx)) intents.push({ type: "Trigger", cardId: instance.id, effectId: effect.id });
    }
  }
  return intents;
}

export function triggerReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  if (state.window?.kind === "cancelOffer") return cancelReason(state, intent, ctx);
  if (state.window?.kind === "response") return responseReason(state, intent, ctx);
  // A Response offered in place of the mulligan (families/deck-play.ts).
  if (state.window?.kind === "mulligan") return mulliganTriggerReason(state, intent, ctx);
  if (!inTriggerWindow(state)) return "That intent is not legal in this window";
  const effect = actionEffect(state, ctx, intent.cardId, intent.effectId);
  if (!effect) return "That effect cannot be triggered";
  return usageReason(state, effect, intent.cardId, state.activeSeat, intent.payments ?? [], ctx);
}

// The cost is paid, then the effect resolves in its own frame. The window it was used in opens again
// when the frame pops, so everyone may pass again afterward.
export function applyTrigger(
  state: ScenarioState,
  intent: TriggerIntent,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  if (state.window?.kind === "cancelOffer") return applyCancel(state, intent, steps);
  if (state.window?.kind === "response") return applyResponse(state, intent, ctx, steps);
  if (state.window?.kind === "mulligan") return applyMulliganTrigger(state, intent, ctx, steps);
  const effect = actionEffect(state, ctx, intent.cardId, intent.effectId);
  if (!effect || !state.window) return state;
  const seat = state.activeSeat;
  const paid = payUsage(state, effect, intent.cardId, intent.payments ?? [], ctx, steps, seat);
  return pushEffectFrame(
    { ...paid, window: null },
    {
      frame: "ResolveEffect",
      sourceId: intent.cardId,
      actor: seat,
      peril: state.perilSeat != null,
      effectId: effect.id,
      instructions: effect.instructions,
      cancel: null,
      blockCancel: null,
      cause: effectCause(effect),
      resume: { window: state.window, seat },
    },
    steps,
  );
}
