// Rules: emce.deep, emce.discover, emce.loot (data/rules/entries.json). The switch that ignores a keyword of Ered Mithrin (`IgnoreKeyword` on a card in play, the campaign card or the quest stage). The cards that print the `Deep` and `Loot` markers are found by
// constantVerbCodes (interpret/constant-records.ts).
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

/** A card in play says to ignore the keyword ("Ignore the deep keyword", emce.deep): the campaign card and the quest stage are in play all scenario, so the switch is theirs. */
export function ignoresKeyword(state: ScenarioState, ctx: ReduceContext, keyword: "deep" | "discover" | "investigate"): boolean {
  if (ctx.effects.length === 0) return false;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "IgnoreKeyword" && instruction.keywords.includes(keyword));
}
