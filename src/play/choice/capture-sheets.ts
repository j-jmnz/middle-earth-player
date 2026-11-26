// Rules: rr.attachment-cards, rr.engaged, rr.response (data/rules/entries.json); ledger lines 17011:A:1, 17012:A:1, 17013:A:1, 17014:A:1.
// The row of a Capture objective's Response (The Mûmakil): the Capture on its Wild Mûmak, where the Mûmak stands, and the number the test needs. The engine read each fact (the Mûmak's remaining hit points, the seat it is engaged with); nothing here changes one.
import { engagedSeat } from "../../rules/core/engaged.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { remainingHitPoints } from "../../rules/families/flame/bane.ts";
import { captureNumbers, captureRowLabel } from "../words/scenarios/haradrim/capture.ts";

/** The label and the numbers line of a Capture's Response row, or null for a card that is none of the four Captures attached to an enemy. */
export function captureRow(game: ScenarioState, ctx: ReduceContext, name: (cardId: string) => string, cardId: string): { label: string; numbers: string } | null {
  const card = game.cards[cardId];
  const host = card?.host != null ? game.cards[card.host] : undefined;
  if (!card || !host || !printedOf(ctx.cards, card.code).traits.includes("Capture")) return null;
  const seat = engagedSeat(game, host.id);
  const numbers = captureNumbers(card.code, name(host.id), remainingHitPoints(game, host.id, ctx));
  return numbers == null ? null : { label: captureRowLabel(name(cardId), name(host.id), seat, game.seatCount), numbers };
}
