// Rules: rr.cancel (data/rules/entries.json).
import { holds } from "./conditions.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { noteSpent } from "./families/costs/pay.ts";
import { encounterUncancelable } from "./families/encounter/cancel.ts";
import { heroPays, validatePayments } from "./payments.ts";
import type { CancelOffer, EffectData, Frame, ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { patchTop, topFrame } from "./windows.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

// The first player pays. A hero can pay when its pool is the cost's sphere (or the cost is neutral).
function payers(state: ScenarioState, offer: CancelOffer, ctx: ReduceContext): string[] {
  return (state.seats[state.firstPlayer]?.heroes ?? []).filter((id) => {
    const hero = state.cards[id];
    return hero != null && hero.resources > 0 && heroPays(state, id, offer.sphere, ctx);
  });
}

export function canPayCancel(state: ScenarioState, offer: CancelOffer, ctx: ReduceContext): boolean {
  const available = payers(state, offer, ctx).reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
  return available >= offer.amount;
}

// Runs when an effect frame starts. Opens the cancel offer unless nothing can cancel the effect.
export function beginEffect(state: ScenarioState, frame: Frame, data: EffectData, ctx: ReduceContext): ScenarioState {
  const scope = { actor: data.actor, sourceId: frame.cardId, returned: 0 };
  const blocked = [data.blockCancel, data.cancel?.unless ?? null].some((condition) => condition != null && holds(state, condition, scope, ctx)) || (data.cancel != null && encounterUncancelable(state));
  const started = patchTop(state, { step: 1, data: { ...data, uncancelable: blocked } });
  if (blocked || !data.cancel || !canPayCancel(started, data.cancel, ctx)) return started;
  const waiting = patchTop(started, { data: { ...data, uncancelable: false, wait: { kind: "cancel" } } });
  return { ...waiting, window: { kind: "cancelOffer", seat: state.firstPlayer }, activeSeat: state.firstPlayer, passed: [] };
}

export function cancelIntents(state: ScenarioState): LegalIntent[] {
  const top = topFrame(state);
  if (state.window?.kind !== "cancelOffer" || !top?.cardId || top.data.kind !== "effect") return [];
  return [{ type: "Pass" }, { type: "Trigger", cardId: top.cardId, effectId: top.data.effectId }];
}

export function cancelReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  const top = topFrame(state);
  const data = top?.data;
  if (state.window?.kind !== "cancelOffer" || data?.kind !== "effect" || !data.cancel) return "That intent is not legal in this window";
  if (intent.cardId !== top?.cardId || intent.effectId !== data.effectId) return "That effect cannot be triggered";
  return validatePayments(state, intent.payments ?? [], { seat: state.firstPlayer, sphere: data.cancel.sphere, amount: data.cancel.amount }, ctx);
}

export function applyCancel(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  let next = state;
  for (const payment of intent.payments ?? []) {
    const hero = next.cards[payment.heroId];
    if (hero) next = updateCard(next, payment.heroId, { resources: hero.resources - payment.amount });
  }
  // The pools that paid spent resources this round ("If you have not spent any resources this round", families/costs/pay.ts).
  next = noteSpent(next, intent.payments ?? [], ctx);
  steps.push({ kind: "cancel", cardId: intent.cardId });
  const canceled = patchTop(next, { data: { ...data, canceled: true, wait: null } });
  return { ...canceled, window: null };
}

// Pass in the cancel window: the effect goes ahead.
export function declineCancel(state: ScenarioState): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return { ...state, window: null };
  return { ...patchTop(state, { data: { ...data, wait: null } }), window: null };
}
