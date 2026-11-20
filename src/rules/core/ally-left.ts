// Rules: rr.in-play-and-out-of-play (data/rules/entries.json).
// The one announcement of an ally leaving play, heard by "After an ally card leaves play" (Valiant Sacrifice, 01024:A:1) and the cards like it. A module
// of its own that imports only the printed card, the zones and the queue, so the captured family and the zones' callers can use it without a cycle.
import { cardTypeOf, printedOf, type PrintedCard } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { inPlay } from "./zones.ts";
import { queueEvent } from "../windows/queue.ts";

/** `before` is the card as it was before the move: an ally that was in play is announced as having left it, however it left (destroyed, discarded,
 * returned to a hand or a deck, removed from the game, captured). */
export function announceAllyLeft(state: ScenarioState, before: CardInstance, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  if (!inPlay(before.zone) || cardTypeOf(before, printedOf(cards, before.code)) !== "ally") return state;
  return queueEvent(state, { trigger: "allyLeftPlay", seat: before.controller, subject: before.id });
}
