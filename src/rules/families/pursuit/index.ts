// Rules: mec112.pursuit, rr.quest-advancement, rr.step-6-8b (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:1, 143069:B:3, 143070:B:2, 143022:A:2, 143015:A:3.
// The pursuit tracker of The Uruk-hai (ScenarioState.pursuit: absent until the quest card's Setup sets it) and what reads it: the amount X of the quest stages, the condition `soleAttacker`.
import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";

// SetPursuit, RaisePursuit and LowerPursuit. A game with no tracker has none to raise or lower: only SetPursuit starts it. The value never goes below 0.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "SetPursuit":
      return { ...state, pursuit: instruction.value };
    case "RaisePursuit":
    case "LowerPursuit": {
      if (state.pursuit == null) return state;
      const amount = Math.max(0, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
      return { ...state, pursuit: Math.max(0, state.pursuit + (instruction.verb === "RaisePursuit" ? amount : -amount)) };
    }
    default:
      return null;
  }
}

// "X is the pursuit value" (143069:B:1): the tracker's value, 0 while there is none.
function amount(state: ScenarioState, found: Exclude<Amount, number>, _scope: AmountScope): number | null {
  return found.pursuit ? (state.pursuit ?? 0) : null;
}

// "Declared as the only attacker" (143015:A:3): the attack in progress was declared with exactly one attacker (rr.step-6-8b: the attackers of an attack are declared together).
function condition(state: ScenarioState, found: Condition): boolean | null {
  return found.kind === "soleAttacker" ? state.pendingStrike?.attackerIds.length === 1 : null;
}

export const manifest: RulesFamily = {
  name: "pursuit",
  verbs: ["SetPursuit", "RaisePursuit", "LowerPursuit"],
  run,
  amount: (state, found, scope) => amount(state, found, scope),
  condition: (state, found) => condition(state, found),
};
