import type { Effect } from "../../catalog/boundary.ts";

import { applyCancel, cancelIntents, cancelReason } from "../windows/cancel.ts";
import { holds } from "../interpret/conditions.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import { effectCause, inCause } from "../core/cause.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { applyResponse, responseIntents, responseReason } from "../windows/responses.ts";
import { applyMulliganTrigger, mulliganTriggerReason } from "../families/deck/play.ts";
import { textBlank } from "../families/attachments/hold.ts";
import { printedOf } from "../core/printed.ts";
import { inPlay, type ScenarioState } from "../core/state.ts";
import { payUsage, usable, usageReason } from "./usage.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

// The cards whose Actions any player may use while they are in play: an objective, quest or location ability (rr.action).
const SHARED_TYPES: ReadonlySet<string> = new Set(["objective", "quest", "location"]);

function inTriggerWindow(state: ScenarioState): boolean {
  return state.window?.kind === "pass" || state.window?.kind === "frameAction";
}

// An Action on a card the active seat controls in play (or, for a per-player limit, any card), whose condition holds.
function actionEffect(state: ScenarioState, ctx: ReduceContext, cardId: string, effectId: string): Effect | undefined {
  const instance = state.cards[cardId];
  if (!instance) return undefined;
  // A card whose printed text box is blank has none of its abilities (rr.blank).
  if (textBlank(state, instance.id)) return undefined;
  const effect = effectsOfCard(state, ctx, instance).find((entry) => entry.id === effectId && entry.timing === "action");
  // An objective, quest or location in play belongs to no player: any player may initiate its Action (rr.action).
  // The campaign card next to the quest deck belongs to no player either, and its Action is any player's (11197:A:3, "Travel Action").
  const shared = inPlay(instance.zone) && (SHARED_TYPES.has(printedOf(ctx.cards, instance.code).type) || instance.zone === "campaign");
  // An Action used from the hand ("put ~ into play from your hand", effect.fromHand) is used there; any other in play.
  if (effect?.fromHand ? instance.zone !== "hand" : instance.zone !== "heroes" && instance.zone !== "play" && instance.zone !== "attached" && !shared) return undefined;
  // Only the card's controller uses its Action, unless any player may (Éowyn's once a round each, "Any player may trigger").
  // An encounter card attached to a hero belongs to no player: the hero's controller uses its Action (41043:A:2, Guilty Conscience).
  const holder = instance.controller ?? (instance.zone === "attached" && instance.host ? (state.cards[instance.host]?.controller ?? null) : null);
  if (!effect || (holder !== state.activeSeat && !shared && effect.limit !== "oncePerRoundEachPlayer" && !effect.anyPlayer)) return undefined;
  const scope = { actor: state.activeSeat, sourceId: cardId, returned: 0 };
  return !effect.condition || holds(state, effect.condition, scope, ctx) ? effect : undefined;
}

// Every Action the active seat can use now: its condition holds, its limit is unspent, its cost can be paid.
export function triggerIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  if (state.window?.kind === "cancelOffer") return cancelIntents(state);
  if (state.window?.kind === "response") return responseIntents(state, ctx);
  if (!inTriggerWindow(state)) return [];
  const intents: LegalIntent[] = [];
  for (const instance of Object.values(state.cards)) {
    for (const effect of effectsOfCard(state, ctx, instance)) {
      if (effect.timing !== "action" || actionEffect(state, ctx, instance.id, effect.id) !== effect) continue;
      if (usable(state, effect, instance.id, state.activeSeat, ctx)) intents.push({ type: "Trigger", cardId: instance.id, effectId: effect.id });
    }
  }
  return intents;
}

export function triggerReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  if (state.window?.kind === "cancelOffer") return cancelReason(state, intent, ctx);
  if (state.window?.kind === "response") return responseReason(state, intent, ctx);
  // A Response offered in place of the mulligan (families/deck/play.ts).
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
  if (state.window?.kind === "cancelOffer") return applyCancel(state, intent, ctx, steps);
  if (state.window?.kind === "response") return applyResponse(state, intent, ctx, steps);
  if (state.window?.kind === "mulligan") return applyMulliganTrigger(state, intent, ctx, steps);
  const effect = actionEffect(state, ctx, intent.cardId, intent.effectId);
  if (!effect || !state.window) return state;
  const seat = state.activeSeat;
  // What the cost changes (threat raised to claim an objective, damage on the source) is the effect's doing.
  const paid = inCause(steps, effectCause(effect), () => payUsage(state, effect, intent.cardId, intent.payments ?? [], ctx, steps, seat));
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
