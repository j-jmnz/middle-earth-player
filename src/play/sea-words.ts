// The words of the sea family's verbs (src/catalog/families/sea.ts) inside a choice: what a branch of a Choose does ("Either shift your heading
// off-course or deal 1 damage to each exhausted character", 11055:A:1).
import type { Instruction } from "../catalog/boundary.ts";

/** One sea instruction in words, or null when it is not one of them. */
export function seaWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "ShiftHeading":
      return instruction.direction === "offCourse" ? "shift your heading off-course" : "shift your heading on-course";
    case "RevealCorsair": {
      const count = instruction.count == null ? "1" : typeof instruction.count === "number" ? String(instruction.count) : "X";
      return `reveal the top ${count === "1" ? "card" : `${count} cards`} of the Corsair deck and put ${count === "1" ? "it" : "them"} into play engaged with ${instruction.who === "eachSeat" ? "each player" : "you"}`;
    }
    case "EngageLastPlayer":
      return "it engages the last player";
    default:
      return null;
  }
}
