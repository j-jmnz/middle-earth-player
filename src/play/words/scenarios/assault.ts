// Rules: rr.effects (data/rules/entries.json); ledger lines 19163:A:2.
// The verbs of The Fate of Wilderland that name the card they act on by its title, in words for a choice's branch ("remove 1 progress from The Goblins' Assault"), and the Pick before resource tokens go on an objective. The words read the instruction, never a card code or an effect id.
import type { Instruction } from "../../../catalog/boundary.ts";

import { plural } from "../list.ts";
import type { PickWords } from "../choice.ts";

/** One instruction in words, or null when it is not one of the scenario's. */
export function assaultWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "RemoveProgressFrom":
      return `remove ${typeof instruction.amount === "number" ? `${instruction.amount} progress` : "progress"} from ${instruction.named}`;
    default:
      return null;
  }
}

/** The Pick before resource tokens go on an objective (the Watchtower's resource, 19163:A:2): "Choose an objective to place 1 resource on." Null for any other Pick. */
export function objectiveTokensWords(pick: Instruction, next: Instruction | undefined, one: string, amountNow?: number): PickWords | null {
  if (pick.verb !== "Pick" || pick.pick.type !== "objective" || next?.verb !== "PlaceResourceTokens") return null;
  const amount = amountNow ?? next.amount;
  return typeof amount === "number" ? { verb: "Place", prompt: `Choose ${one} to place ${plural(amount, "resource")} on.` } : null;
}
