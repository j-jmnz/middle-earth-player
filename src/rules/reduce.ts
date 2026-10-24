import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { rejectionReason } from "./legal.ts";
import { syncConstants } from "./constants.ts";
import { applyIntent, settle } from "./machine.ts";
import type { ScenarioState } from "./state.ts";
import { bindReduce, noteHistory } from "./undo.ts";

export type ReduceResult =
  | { ok: true; state: ScenarioState; steps: readonly EngineStep[] }
  | { ok: false; reason: string; state: ScenarioState };

export function reduce(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext): ReduceResult {
  const reason = rejectionReason(state, intent, ctx);
  if (reason) return { ok: false, reason, state };
  const steps: EngineStep[] = [];
  const settled = syncConstants(settle(applyIntent(state, intent, ctx, steps), ctx, steps), ctx);
  if (settled.failure) return { ok: false, reason: settled.failure, state };
  return { ok: true, state: noteHistory(state, settled, intent, steps), steps };
}

bindReduce(reduce);

export { replay } from "./undo.ts";
export { legalIntents, legalTargets } from "./legal.ts";
export { startScenario } from "./setup.ts";
export { addToStaging } from "./interpret.ts";
export type { ReduceContext } from "./interpret.ts";
export type { PlayerIntent, LegalIntent, Selection, EngineStep } from "./intents.ts";
export type { ScenarioState } from "./state.ts";
export type { PrintedCard } from "./printed.ts";
