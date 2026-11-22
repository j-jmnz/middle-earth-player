// Rules: the Investigate keyword of Murder at the Prancing Pony (docs/scenarios/standalone-scenarios.md, Murder at the Prancing Pony).
import type { Instruction } from "../../../../catalog/boundary.ts";

/** One instruction of the investigation family in words, as a branch of a Choose says it, or null when it is not one of its verbs that a branch holds. */
export function investigationWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "LookAtInvestigation": {
      const count = typeof instruction.count === "number" ? instruction.count : null;
      const cards = count === null || count === 1 ? "card" : `${count} cards`;
      return `look at the ${instruction.from} ${cards} of the Investigation deck`;
    }
    case "ShuffleSelfIntoInvestigation":
      return "shuffle this card into the Investigation deck";
    default:
      return null;
  }
}
