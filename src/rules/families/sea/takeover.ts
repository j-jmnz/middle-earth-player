// Rules: dcce.ships (data/rules/entries.json); ledger line 12136:A:3. "Take control of 1 set aside copy of Dol Amroth Warship": the first ship-objective set aside with the title comes into play
// under the player who used the Action, faceup (on the side the campaign deals it).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { dealtFace } from "../dreamchaser/facts.ts";
import type { Focus } from "../index.ts";

export function takeSetAsideShip(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeSetAsideShip" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const found = Object.values(state.cards)
    .filter((card) => {
      const printed = printedOf(ctx.cards, card.code);
      return card.zone === "setAside" && printed.ship === "objective" && printed.name === instruction.name;
    })
    .map((card) => card.id)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[0];
  if (!found) return state;
  return updateCard(moveCard(state, found, { zone: "play", seat: focus.seat }), found, { face: dealtFace(state, state.cards[found]?.code ?? "", "up") });
}
