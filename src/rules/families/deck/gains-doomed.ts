// Rules: rr.keywords, rr.doomed-x (data/rules/entries.json); ledger line 10173:A:1. "Each event card gains doomed 1": the constant GainsDoomed records of the cards in play add their amount to the Doomed X of each card that matches their pick, read as the card is played.
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { matchesPick } from "../../interpret/pick.ts";
import type { ScenarioState } from "../../core/state.ts";

/**
 * The Doomed the constants of the cards in play give the card, for the seat playing it (every player raises their threat by it, on top of the printed X). An amount
 * can be read from the source ("X is the number of progress tokens on this card", 900205:A:1). A record with `byEncounterDeck` gives it only to a card the encounter
 * deck reveals (`fromDeck`), not to a card played from a hand.
 */
export function gainedDoomed(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, fromDeck = false): number {
  let amount = 0;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "GainsDoomed" || (instruction.byEncounterDeck === true && !fromDeck)) continue;
    if (!matchesPick(state, cardId, instruction.pick, { seat, sourceId: null, counting: true }, ctx)) continue;
    amount += typeof instruction.amount === "number" ? instruction.amount : resolveAmount(state, instruction.amount, { actor: seat, sourceId: source.id }, ctx);
  }
  return amount;
}
