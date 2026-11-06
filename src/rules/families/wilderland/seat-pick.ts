// Rules: (data/rules/entries.json) none; ledger line 12191:A:1. The pick filter the wilderland family adds to a pick of players. A module of its own (it imports no rules code) so the core's pick can read it without a cycle.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { uniqueEnemiesEngaged } from "./engage.ts";

/** `engagedWithUnique` on a player pick: only a player with a unique enemy engaged with them (12191:A:1). Any other player pick keeps every seat. */
export function seatPickMatches(state: ScenarioState, seat: number, spec: PickSpec, ctx: ReduceContext): boolean {
  if (!spec.engagedWithUnique) return true;
  return uniqueEnemiesEngaged(state, seat, ctx.cards).length > 0;
}
