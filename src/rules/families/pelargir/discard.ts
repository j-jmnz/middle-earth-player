// Rules: rr.running-out-of-cards, rr.encounter-deck, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 05024:A:1.
// Collateral Damage discards in two steps and counts the locations of both.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { discardEncounterTop } from "../uncharted/cards.ts";

/**
 * DiscardEncounterTopMore: DiscardEncounterTop, then the cards it discarded join the ones the effect discarded before, so the amount `discardedMatching` and StageDiscarded read them all.
 */
export function discardEncounterTopMore(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardEncounterTopMore" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const before = effectData(state)?.looked ?? [];
  const next = discardEncounterTop(state, { verb: "DiscardEncounterTop", count: instruction.count, ...(instruction.reset ? { reset: true } : {}) }, focus, ctx, steps);
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, looked: [...before, ...(data.looked ?? [])] } }) : next;
}
