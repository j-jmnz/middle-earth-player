// Rules: rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 11199:A:3. A card that is not a player card and was drawn into a hand: "Forced: When Recurring Nightmare enters your hand, add
// it to the staging area". The draw steps say which cards were drawn; the ones that are enemies are announced once (settle), to the card itself, which hears it from the hand.
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";

const SEEN = new WeakMap<object, number>();

/** Every enemy drawn into a hand since the last call is announced as `enteredHand` (about the card, for its owner's seat). Nothing is read in a game that draws no enemy. */
export function announceEnteredHand(state: ScenarioState, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  const from = Math.min(SEEN.get(steps) ?? 0, steps.length);
  SEEN.set(steps, steps.length);
  if (steps.length === from) return state;
  let next = state;
  for (const step of steps.slice(from)) {
    if (step.kind !== "draw") continue;
    const card = next.cards[step.cardId];
    if (card?.zone === "hand" && ctx.cards.get(card.code)?.type === "enemy") next = queueEvent(next, { trigger: "enteredHand", seat: step.seat, cardId: step.cardId });
  }
  return next;
}
