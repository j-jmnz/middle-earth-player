// Rules: rr.hit-points, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 04125:A:2, 04126:A:2, 901704:A:2, 901705:A:2.
//
// The settle sweep of a game that attaches player cards to enemies: a Nameless enemy whose attached cards (all of them) cost 0 in all has X = 0 hit points and is discarded (not destroyed: it was not dealt damage), and a card that lay on an enemy and has left it is a plain player card again.
import type { PrintedCard } from "../../core/printed.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { allAttached, attachedCost } from "./attach.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

export function namelessSweep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!gameReads(state, ctx, '"AttachDeckTop"')) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    // A card that left its enemy (it went to its owner's discard pile) is nobody's attachment: the marks it carried go.
    if (card.nameless === true && card.zone !== "attached") {
      next = updateCard(next, card.id, { nameless: undefined, owner: undefined });
      continue;
    }
    if (card.zone !== "staging" && card.zone !== "engaged") continue;
    if (!printedOf(ctx.cards as Cards, card.code).keywords.statsX || !inPlay(card.zone)) continue;
    if (allAttached(next, card.id).length > 0 && attachedCost(next, card.id, ctx.cards) === 0) next = moveEncounter(next, card.id, "discard", card.controller ?? next.firstPlayer, ctx, steps);
  }
  return next;
}
