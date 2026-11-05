// Rules: emce.deep, emce.discover, emce.loot (data/rules/entries.json). The keywords of Ered Mithrin that are constant records on the cards that print them (`Deep`, `Loot`), found by card code, and the switch that
// ignores a keyword (`IgnoreKeyword` on a card in play, the campaign card or the quest stage). Read cheaply: the codes are indexed once for each effect list.
import type { Effect } from "../../../catalog/boundary.ts";

import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

type Marker = "Deep" | "Loot";

const MARKED = new WeakMap<readonly Effect[], Map<Marker, ReadonlySet<string>>>();

/** The codes of the cards with a constant record of this keyword marker. The effect list is never changed, so the index is built once for it. */
export function markedCodes(ctx: Pick<ReduceContext, "effects">, marker: Marker): ReadonlySet<string> {
  let byMarker = MARKED.get(ctx.effects);
  if (!byMarker) {
    byMarker = new Map();
    MARKED.set(ctx.effects, byMarker);
  }
  let codes = byMarker.get(marker);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === marker)).map((effect) => effect.cardCode));
    byMarker.set(marker, codes);
  }
  return codes;
}

/** A card in play says to ignore the keyword ("Ignore the deep keyword", emce.deep): the campaign card and the quest stage are in play all scenario, so the switch is theirs. */
export function ignoresKeyword(state: ScenarioState, ctx: ReduceContext, keyword: "deep" | "discover"): boolean {
  if (ctx.effects.length === 0) return false;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "IgnoreKeyword" && instruction.keywords.includes(keyword));
}
