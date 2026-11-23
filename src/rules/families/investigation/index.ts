// Rules: docs/scenarios/standalone-scenarios/murder-at-the-prancing-pony.md (Murder at the Prancing Pony), rr.in-play-and-out-of-play, rr.forced (data/rules/entries.json); ledger lines 50701:A:1, 50715:A:1 to 50720:A:2, 50702:B:1, 50702:B:2, 50714:A:1, 50728:A:1.
// The verbs and hooks src/catalog/families/investigation.ts adds: the Investigation deck built by the Setup (deck.ts), the looks at it (look.ts: Investigate X and the other looks) and the accusation (accuse.ts). Hidden information: nothing here pushes a step that names a card of the deck or the pair set aside facedown.
import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import type { Focus } from "../index.ts";
import { spendablePools } from "../costs/verbs.ts";
import { livingSeats } from "../../core/state.ts";
import { addLookedToStaging, makeAccusation, nameInvestigation } from "./accuse.ts";
import { buildInvestigationDeck, hideSuspectAndHideout, removeRandomInvestigation, shuffleSelfIntoInvestigation } from "./deck.ts";
import { investigate, investigateIgnored, investigateValue, investigationTop, lookAtInvestigation } from "./look.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "HideSuspectAndHideout":
      return hideSuspectAndHideout(state, instruction);
    case "BuildInvestigationDeck":
      return buildInvestigationDeck(state, instruction);
    case "Investigate":
      return investigate(state, instruction, focus, ctx);
    case "LookAtInvestigation":
      return lookAtInvestigation(state, instruction, focus, ctx);
    case "RemoveRandomInvestigation":
      return removeRandomInvestigation(state);
    case "ShuffleSelfIntoInvestigation":
      return shuffleSelfIntoInvestigation(state, instruction, focus, steps);
    case "NameInvestigation":
      return nameInvestigation(state, instruction, focus, steps);
    case "MakeAccusation":
      return makeAccusation(state, instruction, ctx, steps);
    case "AddLookedToStaging":
      return addLookedToStaging(state, instruction, ctx, steps);
    default:
      return null;
  }
}

function condition(state: ScenarioState, found: Condition, _scope: { actor: number }, ctx: ReduceContext): boolean | null {
  if (found.kind === "investigateIgnored") return investigateIgnored(state, ctx);
  if (found.kind === "investigationTop") return investigationTop(state, found.traits, ctx);
  return null;
}

function amount(state: ScenarioState, found: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  return found.investigateValue ? investigateValue(state, ctx, scope.actor) : null;
}

/** "Each player spends 1 resource to travel here" (50718:A:3): every living player needs a hero with a resource, or the players cannot travel (rr.travel). */
function unpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext): boolean {
  if (instruction.verb !== "ForEachPlayer") return false;
  const spend = instruction.instructions.find((inner) => inner.verb === "SpendResources");
  return spend?.verb === "SpendResources" && livingSeats(state).some((seat) => spendablePools(state, seat, {}, ctx).total < spend.amount);
}

export const manifest: RulesFamily = {
  name: "investigation",
  verbs: ["HideSuspectAndHideout", "BuildInvestigationDeck", "Investigate", "LookAtInvestigation", "RemoveRandomInvestigation", "ShuffleSelfIntoInvestigation", "NameInvestigation", "MakeAccusation", "AddLookedToStaging"],
  run,
  travel: { unpayable },
  condition,
  amount,
};
