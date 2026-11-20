// Rules: rr.search, rr.unique-cards, rr.destroy, rr.printed (data/rules/entries.json); ledger lines 10136:A:1, 10137:A:1, 10137:A:2. The cards of a player's deck that share a title with a card just discarded or destroyed, and the printed cost of the dearest card in their discard pile.
import type { Amount, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { topFrame } from "../../windows/windows.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { shuffleSeatDeck } from "../deck/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The ally the attack that left the running effect destroyed (the frame carries it from shadow.ts), or null for any other frame.
function destroyedAllyOf(state: ScenarioState): string | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.destroyedAlly ?? null) : null;
}

/** DiscardCopiesFromDeck: the actor's deck is searched for the cards with the printed title of the card named (the last picked card, or the ally the attack that left the effect destroyed); each of them (`all`) or one goes to the actor's discard pile, and the deck is shuffled with `shuffle`. */
export function discardCopiesFromDeck(state: ScenarioState, instruction: Verb<"DiscardCopiesFromDeck">, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  const id = instruction.of === "picked" ? lastPicked(state) : destroyedAllyOf(state);
  const named = id ? state.cards[id] : undefined;
  const seat = state.seats[focus.seat];
  // The card discarded for this seat, not one an earlier seat's discard left picked.
  if (!named || !seat || (instruction.of === "picked" && !seat.discard.includes(named.id))) return state;
  const printed = printedOf(ctx.cards, named.code);
  if (instruction.of === "other" && printed.type !== "ally") return state;
  const found = seat.deck.filter((deckId) => {
    const card = state.cards[deckId];
    return card != null && printedOf(ctx.cards, card.code).name === printed.name;
  });
  let next = state;
  // Each copy is discarded from the deck, and the cards that hear such a discard hear it (Hidden Cache, 06143:A:1; Ered Luin Miner, 12066:A:1).
  for (const deckId of instruction.all === true ? found : found.slice(0, 1)) next = queueEvent(moveCard(next, deckId, { zone: "discard", seat: focus.seat }), { trigger: "discardedFromDeck", seat: focus.seat, cardId: deckId });
  return instruction.shuffle === true ? shuffleSeatDeck(next, focus.seat) : next;
}

/** The amount `discardPileMaxCost`: the highest printed cost in the actor's discard pile, a card with no printed cost (a hero, an X cost) counting 0. Null for any other amount. */
export function discardPileMaxCostAmount(state: ScenarioState, found: Exclude<Amount, number>, seat: number, ctx: ReduceContext): number | null {
  if (!found.discardPileMaxCost) return null;
  return (state.seats[seat]?.discard ?? []).reduce((most, id) => {
    const card = state.cards[id];
    const cost = card ? printedOf(ctx.cards, card.code).cost : null;
    return Math.max(most, typeof cost === "number" ? cost : 0);
  }, 0);
}
