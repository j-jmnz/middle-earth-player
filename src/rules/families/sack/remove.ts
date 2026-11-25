// Rules: hob.sack-x, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 131025:B:1. "Remove all Troll enemies and Sack cards from the game": every card with one of the traits leaves the game wherever it lies.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

export function removeTraitFromGame(state: ScenarioState, instruction: Extract<Instruction, { verb: "RemoveTraitFromGame" }>, ctx: ReduceContext): ScenarioState {
  const ids = Object.values(state.cards)
    .filter((card) => card.zone !== "removed" && printedOf(ctx.cards, card.code).traits.some((trait) => instruction.traits.includes(trait)))
    .map((card) => card.id);
  return ids.reduce((next, id) => (next.cards[id] && next.cards[id].zone !== "removed" ? moveCard(next, id, { zone: "removed" }) : next), state);
}
