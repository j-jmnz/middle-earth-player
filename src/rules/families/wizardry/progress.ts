// Rules: rr.explored, rr.active-location (data/rules/entries.json); ledger line 143080:B:2.
//
// The progress placed on the current quest card this phase, kept while the table holds `trackQuestProgress` (The Voice of Saruman): a `questProgressPhase` modifier on the table for each placing, which
// the end of the phase clears. CancelPhaseProgress takes it all off the quest card, the overflow of an explored active location included (that progress is placed on the quest before the location's Forced
// effects resolve), and forgets it.
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { isLocationId, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { removeQuestProgress } from "../caves/progress.ts";

/** Notes progress placed on the current quest card, when the table asks for it. Every other game's state is returned as it was. */
export function noteQuestPhase(state: ScenarioState, amount: number): ScenarioState {
  if (amount <= 0 || !flagged(state, "table", "trackQuestProgress")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "questProgressPhase", amount, until: "endOfPhase" }] };
}

/** CancelPhaseProgress: the progress noted this phase comes off the current quest card (no more than it holds) and the note is cleared. */
export function cancelPhaseProgress(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  const noted = state.modifiers.filter((modifier) => modifier.stat === "questProgressPhase" && modifier.instanceId === "table");
  if (noted.length === 0) return state;
  const total = noted.reduce((sum, modifier) => sum + modifier.amount, 0);
  const cleared: ScenarioState = { ...state, modifiers: state.modifiers.filter((modifier) => !noted.includes(modifier)) };
  return removeQuestProgress(cleared, total, steps, currentCause(steps, UNATTRIBUTED));
}

/**
 * Whether the overflow of a placing waits instead of defeating the quest card: the table tracks the phase's progress (The Voice of Saruman) and the placing explored a location (from `steps[from]` on),
 * whose Forced effect may cancel that progress (Orthanc, 143080:B:2). The stage then takes what it needs but does not advance in the placing; `advanceFreed` advances it once the Forced effects have resolved
 * and the progress is still there. Every other table's overflow advances at once.
 */
export function overflowWaits(state: ScenarioState, steps: readonly EngineStep[], from: number, cards: ReadonlyMap<string, PrintedCard>): boolean {
  if (!flagged(state, "table", "trackQuestProgress")) return false;
  return steps.slice(from).some((step) => step.kind === "destroy" && isLocationId(state, step.targetId, cards));
}
