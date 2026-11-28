import type { EngineStep, PlayerIntent } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { loseWhenLeftPlay } from "../core/eliminate.ts";
import { rejectionReason } from "./legal.ts";
import { syncConstants } from "../interpret/constants.ts";
import { registerHostListeners } from "../families/attachments/hold.ts";
import { applyIntent, settle } from "./machine.ts";
import { dealScenario, type StartScenario } from "../setup/setup.ts";
import type { ScenarioState } from "../core/state.ts";
import { bindReduce, noteHistory, snapshotOf } from "./undo.ts";

export type ReduceResult =
  | { ok: true; state: ScenarioState; steps: readonly EngineStep[] }
  | { ok: false; reason: string; state: ScenarioState };

export function reduce(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext): ReduceResult {
  registerHostListeners(ctx);
  const reason = rejectionReason(state, intent, ctx);
  if (reason) return { ok: false, reason, state };
  // The steps of a Setup that ran before the opening hands (startScenario) belong to the first intent.
  const steps: EngineStep[] = [...(state.openingSteps ?? [])];
  const settled = settleAll(applyIntent(state, intent, ctx, steps), ctx, steps);
  if (settled.failure) return { ok: false, reason: settled.failure, state };
  const { openingSteps: _carried, ...rest } = settled;
  return { ok: true, state: noteHistory(state, rest, intent, steps), steps };
}

// Every intent and the start end the same way: the automatic steps run, the constants are read again, and a card whose leaving play loses the game does so.
function settleAll(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return loseWhenLeftPlay(state, syncConstants(settle(state, ctx, steps), ctx), ctx.cards);
}

/**
 * The table a scenario opens on. A Setup that fires right after the heroes are placed and may ask (The One Ring, vom.the-one-ring) is settled here, as an intent
 * is, so the table stops at its question or at the mulligan; its steps wait in `openingSteps` and join the first intent's steps. Every other game opens as dealt.
 */
export function startScenario(input: StartScenario, ctx: ReduceContext): ScenarioState {
  const dealt = dealScenario(input, ctx);
  if (dealt.stack.length === 0) return dealt;
  registerHostListeners(ctx);
  const steps: EngineStep[] = [];
  const settled = settleAll(dealt, ctx, steps);
  if (settled.failure) throw new Error(settled.failure);
  const opened = steps.length > 0 ? { ...settled, openingSteps: steps } : settled;
  return { ...opened, undo: snapshotOf(opened) };
}

bindReduce(reduce);

export { replay } from "./undo.ts";
export { legalIntents, legalTargets } from "./legal.ts";
export type { StartScenario } from "../setup/setup.ts";
export { addToStaging } from "../interpret/interpret.ts";
export type { ReduceContext } from "../interpret/interpret.ts";
export type { PlayerIntent, LegalIntent, Selection, EngineStep } from "../core/intents.ts";
export type { ScenarioState } from "../core/state.ts";
export type { PrintedCard } from "../core/printed.ts";
