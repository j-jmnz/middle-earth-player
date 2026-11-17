// Rules: rr.reveal, rr.staging, rr.running-out-of-cards (data/rules/entries.json); ledger lines 03068:B:2, 901110:A:1.
//
// RevealTopEnemies: "Reveal the top X cards of the encounter deck, adding all enemies to the staging area. Discard the other revealed cards without resolving them." The cards come one at a time. An enemy goes through the full reveal
// (src/rules/windows/frames.ts startReveal: its When Revealed, Surge, Doomed and the Forced effects that hear a reveal) and the cards still to come wait in the effect's queue behind it; any other card is discarded at once, unresolved. The encounter
// discard pile, the cards just discarded included, is shuffled back when the deck runs out partway.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { reshuffleDiscard } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { startReveal } from "../../windows/frames.ts";
import { moveCard } from "../../core/zones.ts";
import { queueFront } from "../play/refs.ts";
import { effectData } from "./moves.ts";

export function revealTopEnemies(state: ScenarioState, count: number, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let left = count; left > 0; left -= 1) {
    next = reshuffleDiscard(next, steps, "rr.running-out-of-cards");
    const top = next.encounterDeck[0];
    if (!top) return next;
    const card = next.cards[top];
    if (card && printedOf(ctx.cards, card.code).type === "enemy") {
      // The cards still to come wait behind this reveal; outside an effect frame nobody can wait, so only this one is revealed.
      const rest = left > 1 && effectData(next) ? queueFront(next, [{ instruction: { verb: "RevealTopEnemies", count: left - 1 }, seat, chosen: null }]) : next;
      return startReveal(rest, seat, ctx, steps);
    }
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
  }
  return next;
}
