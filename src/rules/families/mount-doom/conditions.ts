// Rules: mec113.fortitude-tests (data/rules/entries.json); ledger lines 146046:A:1, 146051:A:1, 146055:A:3, 146076:B:1. The Fortitude conditions of effect records.
import type { Condition } from "../../../catalog/boundary.ts";

import type { Scope } from "../../interpret/conditions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { failedThisRound, lastFortitude } from "./failures.ts";

/** True or false for the family's conditions, null for any other. */
export function fortitudeCondition(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  switch (condition.kind) {
    case "lastFortitudeFailed":
      return lastFortitude(state, "failed");
    case "lastFortitudePassed":
      return lastFortitude(state, "passed");
    case "fortitudeFailed":
      return failedThisRound(state, condition.who === "actor" ? scope.actor : null);
    case "hostControlledByActor": {
      const host = scope.sourceId ? state.cards[scope.sourceId]?.host : null;
      return host != null && state.cards[host]?.controller === scope.actor;
    }
    default:
      return null;
  }
}
