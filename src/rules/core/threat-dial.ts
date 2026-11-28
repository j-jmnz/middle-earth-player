// Rules: rr.threat-threat-dial (data/rules/entries.json). Raising and lowering a threat dial.
import type { Cause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import { queueEvent } from "../windows/queue.ts";
import type { ScenarioState } from "./state.ts";
import { withThreat } from "./state.ts";
import { doomedRaised } from "../families/play/hooks.ts";
import { noteThreatRaised } from "../families/mordor/rounds.ts";
import { eliminateEmpties } from "./eliminate.ts";

export function raiseThreat(
  state: ScenarioState,
  seat: number,
  amount: number,
  steps: EngineStep[],
  cause: Cause,
): ScenarioState {
  if (amount <= 0) return state;
  const current = state.seats[seat];
  if (!current || current.eliminated) return state;
  const raised = noteThreatRaised(doomedRaised(queueEvent(withThreat(state, seat, current.threat + amount), { trigger: "threatRaised", seat }), seat, cause), seat);
  steps.push({ kind: "threat", seat, amount, cause });
  return eliminateEmpties(raised, steps);
}

// Lowers a threat dial. A dial stops at 0, and the step records what it actually dropped.
export function lowerThreat(state: ScenarioState, seat: number, amount: number, steps: EngineStep[], cause: Cause): ScenarioState {
  const current = state.seats[seat];
  if (!current || current.eliminated) return state;
  const dropped = Math.min(amount, current.threat);
  if (dropped <= 0) return state;
  steps.push({ kind: "threat", seat, amount: -dropped, cause });
  return withThreat(state, seat, current.threat - dropped);
}
