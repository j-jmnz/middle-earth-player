// Rules: sotm.guarding-gollum, sotm.setup-return-to-mirkwood, rr.ownership-and-control, rr.first-player, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 02126:A:1, 02128:B:1, 02130:A:1, 02130:A:2, 02134:A:1.
// The verbs and hooks src/catalog/families/guardian.ts adds: the player guarding Gollum (seats.ts), the change of guard (change.ts), the damage of undefended attacks sent to Gollum (combat.ts) and the hand the guard cannot play from (hand.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { changeGuardian, guardGollum } from "./change.ts";
import { undefendedHolders } from "./combat.ts";
import { guardBarsPlay, guardBarsPlayReason } from "./hand.ts";
import { guardianCanChange } from "./seats.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "GuardGollum":
      return guardGollum(state, instruction.code, focus);
    case "ChangeGuardian":
      return changeGuardian(state, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "guardian",
  verbs: ["GuardGollum", "ChangeGuardian"],
  run,
  condition: (state, condition) => (condition.kind === "guardianCanChange" ? guardianCanChange(state) : null),
  combat: { undefended: (state) => undefendedHolders(state) },
  play: (state, _cardId, ctx, how) => guardBarsPlay(state, ctx, how),
  playReason: (state, cardId, ctx) => guardBarsPlayReason(state, cardId, ctx),
};
