// Rules: rr.constant-ability, rr.triggered-ability (data/rules/entries.json); ledger line 16045:A:2.
//
// "Each player cannot have more than 5 cards in his hand. (If you have more than 5, immediately choose and discard cards from your hand until you have only 5.)": the card holds the flag `handLimit` on the table; at each settle,
// once nothing is resolving, a seat over the limit has `handOverLimit` announced for it, and the card's record discards down to the limit (the form of 143080:A:1). The model is families/deck/pressure.ts.
import type { EngineStep } from "../../core/intents.ts";
import { flagged, heldLeast, livingSeats, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";

/** The settle hook: a seat whose hand is over the table's limit has the event queued, once (not while one is queued for it, nor while an effect or an attack is resolving). */
export function announceOverLimit(state: ScenarioState, _steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !flagged(state, "table", "handLimit")) return state;
  const limit = heldLeast(state, "table", "handLimit");
  let next = state;
  for (const seat of livingSeats(next)) {
    const held = next.seats[seat]?.hand.length ?? 0;
    if (held <= limit || (next.pendingEvents ?? []).some((event) => event.trigger === "handOverLimit" && event.seat === seat)) continue;
    next = queueEvent(next, { trigger: "handOverLimit", seat });
  }
  return next;
}
