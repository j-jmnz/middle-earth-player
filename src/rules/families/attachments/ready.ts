// Rules: rr.refresh-phase, rr.step-7-3, rr.cost (data/rules/entries.json). Caught in a Web, 01080:A:1: "Attached hero does not ready
// during the refresh phase unless you pay 2 resources from that hero's pool."
import type { Instruction } from "../../../catalog/boundary.ts";

import { effectCause, ruleCause } from "../../core/cause.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, modifierActive } from "../../core/state.ts";

// The question each paying card asks: pay its price from the host's pool and ready the host, or leave it exhausted.
export function readyPaymentChoice(amount: number): Instruction {
  return {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "pay", instructions: [{ verb: "DiscardResources", amount, target: "host" }, { verb: "Ready", target: "host" }] },
      { id: "skip", instructions: [] },
    ],
  };
}

// Before the refresh phase readies the cards (machine.ts): the controller of each exhausted card that does not ready unless
// resources are paid (`readyPayment`, the amount) and holds that many may pay them, once this phase (`readyAsked` marks that the
// players were asked). A card that pays readies now; one that does not stays exhausted, as `doesNotReady` says. Null with nobody to ask.
export function askReadyPayments(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (state.modifiers.some((modifier) => modifier.stat === "readyAsked" && modifierActive(state, modifier))) return null;
  const payers = Object.values(state.cards).flatMap((card) => {
    if (!inPlay(card.zone) || !card.exhausted || !flagged(state, card.id, "doesNotReady")) return [];
    const price = state.modifiers.find((modifier) => modifier.stat === "readyPayment" && modifier.instanceId === card.id && modifier.amount > 0 && modifierActive(state, modifier));
    return price && card.resources >= price.amount ? [{ card, price }] : [];
  });
  if (payers.length === 0) return null;
  let next: ScenarioState = { ...state, window: null, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "readyAsked", amount: 1, until: "endOfPhase" }] };
  // The oldest card's question is asked first, so its frame is pushed last.
  for (const { card, price } of [...payers].reverse()) {
    const source = next.cards[price.sourceId];
    const record = source ? effectsOf(ctx, source.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "readyPayment")) : undefined;
    const choose = readyPaymentChoice(price.amount);
    next = pushEffectFrame(
      next,
      {
        frame: "ResolveEffect",
        sourceId: price.sourceId,
        actor: card.controller ?? next.firstPlayer,
        peril: false,
        effectId: record?.id ?? "readyPayment",
        instructions: [choose],
        cancel: null,
        blockCancel: null,
        cause: record ? effectCause(record) : ruleCause("rr.step-7-3"),
      },
      steps,
    );
  }
  return next;
}
