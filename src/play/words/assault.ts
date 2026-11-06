// Rules: rr.effects (data/rules/entries.json); ledger lines 19163:A:2.
// The verbs of The Fate of Wilderland that name the card they act on by its title, in words for a choice's branch ("Place 1 resource on The Heroes' Defense"). The words read the instruction, never a card code or an effect id.
import type { Instruction } from "../../catalog/boundary.ts";

import { plural } from "./list.ts";

/** One instruction in words, or null when it is not one of the scenario's. */
export function assaultWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "PlaceResourcesOnNamed":
      return `place ${typeof instruction.amount === "number" ? plural(instruction.amount, "resource") : "resources"} on ${instruction.named}`;
    case "RemoveProgressFrom":
      return `remove ${typeof instruction.amount === "number" ? `${instruction.amount} progress` : "progress"} from ${instruction.named}`;
    default:
      return null;
  }
}
