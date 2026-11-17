// Rules: rr.first-player, dwd.cave-torch-the-long-dark (data/rules/entries.json); ledger line 03064:A:1 (docs/brief.md, Into the Pit).
// A Setup line that has the first player pick among the heroes of every player ("have the first player attach Cave Torch to a hero of his choice"): the sheet of that pick names the owner on each row, as a pick that spans seats does
// in the side quest games (`seatedRows`, read by choice/sheet-parts.ts seatedLabel). Absent when the game deals no such Setup line (every other scenario).
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Notes `seatedRows` when a dealt card's Setup record picks a hero of any player for the first player and attaches something to it. */
export function markSeatedRows(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.seatCount < 2) return state;
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  const seated = ctx.effects.some(
    (effect) => effect.timing === "setup" && dealt.has(effect.cardCode) && effect.instructions.some((instruction) => instruction.verb === "Pick" && instruction.pick.type === "hero" && instruction.pick.control === "any" && instruction.pick.attachable != null && instruction.pick.who === "firstPlayer"),
  );
  return seated ? { ...state, seatedRows: true } : state;
}
