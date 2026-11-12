// Rules: mec113.saga-staging-rules, mec113.dire, rr.in-player-order, rr.first-player (data/rules/entries.json); ledger lines 146072:B:1, 146026:A:1. The verbs src/catalog/families/black-gate.ts adds and the hooks the core calls: the Embassy from the Dark Tower (embassy.ts), the pick filters and the stat total (pick.ts) and
// the Dire keyword (dire.ts, kept on the state by the settle loop).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { embassyHolds, runEmbassy, type EmbassyInstruction } from "./embassy.ts";
import { totalOfStat } from "./pick.ts";

const EMBASSY_VERBS = ["EmbassyDeal", "EmbassyPair", "EmbassyNext", "EmbassyDiscard", "EmbassyReveal", "EmbassyEnd"] as const;
const isEmbassy = (instruction: Instruction): instruction is EmbassyInstruction => (EMBASSY_VERBS as readonly string[]).includes(instruction.verb);

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  return isEmbassy(instruction) ? runEmbassy(state, instruction, focus, ctx, steps) : null;
}

export const manifest: RulesFamily = {
  name: "black-gate",
  verbs: EMBASSY_VERBS,
  run,
  condition: (state, condition, _scope, ctx) => embassyHolds(state, condition, ctx),
  amount: (state, amount, scope, ctx) => totalOfStat(state, amount, scope, ctx),
};
