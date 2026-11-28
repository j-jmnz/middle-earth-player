// Rules: rr.attachment-cards, rr.lasting-effects (data/rules/entries.json); ledger lines 21017:A:1, 21021:A:1, 21024:A:2, 21025:A:1, 21027:A:2.
// The verbs src/catalog/families/mordor.ts adds: a treachery of the discard pile attached to an enemy (attach.ts) and a lasting effect held by a class of cards (held.ts, read by heldBy in core/holder-classes.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { attachTreachery } from "./attach.ts";
import { modifyHeld } from "./held.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachTreachery":
      return attachTreachery(state, instruction, focus, ctx);
    case "ModifyHeld":
      return modifyHeld(state, instruction, focus, ctx);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "mordor", verbs: ["AttachTreachery", "ModifyHeld"], run };
