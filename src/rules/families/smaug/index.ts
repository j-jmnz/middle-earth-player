// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town: the Smaug deck and Burn X, from the Quest Companion), rr.reveal, rr.damage, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 50201:A:1, 50205:A:2, 50211:A:1, 50202:B:2.
// The verbs and hooks src/catalog/families/smaug.ts adds: the Smaug deck (deck.ts), burn damage (burn.ts), Smaug's attack against Lake-town (attack.ts), stage 2B's heal (stage.ts) and the Dock's split of progress (split.ts). The core calls the hooks (interpret/family-hooks.ts), not this file by name.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { smaugAmount } from "./amounts.ts";
import { attackLakeTown, SMAUG_COMBAT } from "./attack.ts";
import { resolveBurn } from "./burn.ts";
import { revealSmaug, swapSmaug } from "./deck.ts";
import { splitProgress } from "./split.ts";
import { healByProgress } from "./stage.ts";
import { DOCK, dockSecond } from "./travel.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "RevealSmaug":
      return revealSmaug(state, instruction, focus, ctx, steps);
    case "ResolveBurn":
      return resolveBurn(state, instruction, focus, ctx, steps);
    case "AttackLakeTown":
      return attackLakeTown(state, ctx, steps);
    case "HealLakeTownByProgress":
      return healByProgress(state, instruction, focus, ctx, steps);
    case "SplitProgress":
      return splitProgress(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "smaug",
  verbs: ["RevealSmaug", "ResolveBurn", "AttackLakeTown", "HealLakeTownByProgress", "SplitProgress"],
  run,
  amount: (state, amount, _scope, ctx) => smaugAmount(state, amount, ctx),
  revealed: (state, cardId, ctx) => swapSmaug(state, cardId, ctx),
  combat: SMAUG_COMBAT,
  travel: { second: (state, locationId) => state.cards[locationId]?.code === DOCK && dockSecond(state) },
};
