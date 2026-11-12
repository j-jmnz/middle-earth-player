// Rules: mec113.fortitude-tests (data/rules/entries.json); ledger line 146049:A:3. The cards a `fortitudeDiscarded` filter starts from: those discarded for the Fortitude test in progress that still lie in the encounter discard pile.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";

/** The pool of a `fortitudeDiscarded` filter, or null when the filter is not set. Empty with no Fortitude test in progress. */
export function fortitudePool(state: ScenarioState, spec: PickSpec): string[] | null {
  if (!spec.fortitudeDiscarded) return null;
  const frame = state.stack.findLast((entry) => entry.data.kind === "fortitude");
  return frame?.data.kind === "fortitude" ? frame.data.discardedIds.filter((id) => state.cards[id]?.zone === "encounterDiscard") : [];
}
