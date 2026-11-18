// Rules: dwd.locate-test (data/rules/entries.json); ledger lines 04087:B:1, 901602:A:2. The conditions the long-dark family reads: the result of the last locate test the running effect made, and a card that prints PASS.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";
import { printsPass } from "./locate.ts";

/** `lastLocateFailed`, `lastLocatePassed` (the running effect's last locate test; false before it made one) and `hasPass` (the named card prints PASS). Null for any other condition. */
export function longDarkCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  if (condition.kind === "hasPass") {
    const id = condition.card === "other" ? scope.other : condition.card === "subject" ? scope.subject : scope.picked?.at(-1);
    return printsPass(state, id, ctx);
  }
  if (condition.kind !== "lastLocateFailed" && condition.kind !== "lastLocatePassed") return null;
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.locate === (condition.kind === "lastLocateFailed" ? "failed" : "passed");
}
