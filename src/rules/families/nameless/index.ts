// Rules: rr.attachment-cards, rr.reveal, rr.travel (data/rules/entries.json); ledger lines 04125:A:1, 04126:A:1, 04123:A:2, 901704:A:1, 901705:A:1, 901706:A:1, 901706:A:2, 901708:A:2.
// The verbs src/catalog/families/nameless.ts adds: the player cards attached to the Nameless enemies (attach.ts), the cost they add up to (amounts.ts, the settle sweep that discards an enemy whose attached cards cost 0, sweep.ts) and Nest of Horrors' travel (reveal.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { namelessAmount } from "./amounts.ts";
import { attachDeckTop } from "./attach.ts";
import { discardEncounterPerPlayer, revealDiscarded } from "./reveal.ts";
import { namelessSweep } from "./sweep.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachDeckTop":
      return attachDeckTop(state, instruction, focus, ctx, steps);
    case "DiscardEncounterPerPlayer":
      return discardEncounterPerPlayer(state, focus);
    case "RevealDiscarded":
      return revealDiscarded(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "nameless",
  verbs: ["AttachDeckTop", "DiscardEncounterPerPlayer", "RevealDiscarded"],
  run,
  amount: namelessAmount,
  settle: { sweep: namelessSweep },
};
