// Rules: rr.first-player, dwd.cave-torch-the-long-dark, rr.travel (data/rules/entries.json); ledger lines 03064:A:1, 03067:A:1, 901809:A:2 (docs/scenarios/dwarrowdelf/into-the-pit.md, Into the Pit, The Seventh Level, Shadow and Flame).
// A Setup line that has the first player pick among the heroes of every player ("have the first player attach Cave Torch to a hero of his choice"): the sheet of that pick names the owner on each row, as a pick that spans seats does
// in the side quest games (`seatedRows`, read by choice/sheet-parts.ts seatedLabel). Absent when the game deals no such Setup line (every other scenario).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

// An instruction, or one inside it, that picks a hero of any player.
const picksAnyHero = (instruction: Instruction): boolean =>
  (instruction.verb === "Pick" && instruction.pick.type === "hero" && instruction.pick.control === "any") || ("instructions" in instruction && Array.isArray(instruction.instructions) && (instruction.instructions as readonly Instruction[]).some(picksAnyHero));

/** Notes `seatedRows` when a dealt card's Setup record picks a hero of any player for the first player and attaches something to it, or its Travel record has each player pick a hero of any player. */
export function markSeatedRows(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.seatCount < 2) return state;
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  const seated = ctx.effects.some(
    (effect) => effect.timing === "setup" && dealt.has(effect.cardCode) && effect.instructions.some((instruction) => instruction.verb === "Pick" && instruction.pick.type === "hero" && instruction.pick.control === "any" && instruction.pick.who === "firstPlayer"),
  );
  const travelling = ctx.effects.some((effect) => effect.timing === "travel" && dealt.has(effect.cardCode) && effect.instructions.some(picksAnyHero));
  return seated || travelling ? { ...state, seatedRows: true } : state;
}
