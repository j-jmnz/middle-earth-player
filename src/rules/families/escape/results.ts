// Rules: sotm.escape-test (data/rules/entries.json); ledger lines 02109:A:1, 02111:A:1, 02106:B:1. The result of the last escape test an effect made, noted on that effect's frame for `lastEscapeFailed` and `lastEscapePassed`.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** The test just finished is noted on the effect that made it. */
export function noteEffectEscape(state: ScenarioState, success: boolean): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "effect") return state;
  return patchTop(state, { data: { ...top.data, escape: success ? "passed" : "failed" } });
}

/** `lastEscapeFailed`, `lastEscapePassed`: the running effect's last escape test. False before it made one. Null for any other condition. */
export function escapeCondition(state: ScenarioState, condition: Condition): boolean | null {
  if (condition.kind !== "lastEscapeFailed" && condition.kind !== "lastEscapePassed") return null;
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.escape === (condition.kind === "lastEscapeFailed" ? "failed" : "passed");
}
