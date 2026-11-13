// Rules: mec108.campaign-log (data/rules/entries.json); ledger line 10172:A:1. The pick filter `determined`: the character's code is one the Campaign Log marks "determined" (`campaignFacts.angmar.determined`, written by the Resolution's RecordDetermined).
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";

/** False for a card the filter `determined` rules out; true when the pick does not ask. A game with no log marks none. */
export function determinedMatches(state: ScenarioState, id: string, spec: PickSpec): boolean {
  if (spec.determined !== true) return true;
  const code = state.cards[id]?.code;
  return code != null && (state.campaignFacts?.angmar?.determined.includes(code) ?? false);
}
