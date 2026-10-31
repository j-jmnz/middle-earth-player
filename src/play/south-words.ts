// The words of the south family's verbs (src/catalog/families/south.ts) inside a choice: what a branch of a Choose does.
import type { Instruction } from "../catalog/boundary.ts";

/** The prompt of a pick the damage of an AssignDamage waits on, one damage at a time: "From the Depths: assign 1 damage to a character you control (2 of 3 left)". `left` and `of` are the engine's. */
export function assignDamageWords(instruction: Extract<Instruction, { verb: "AssignDamage" }>, source: string | null): { verb: string; prompt: string } {
  const noun = instruction.pick.type === "hero" ? "hero" : instruction.pick.type === "ally" ? "ally" : instruction.pick.type === "character" ? "character" : "card";
  const left = instruction.left != null && instruction.of != null && instruction.of > 1 ? ` (${instruction.left} of ${instruction.of} left)` : "";
  return { verb: "Assign", prompt: `${source ? `${source}: assign` : "Assign"} 1 damage to ${noun === "ally" ? "an" : "a"} ${noun} ${instruction.pick.control === "you" ? "you control" : "in play"}${left}.` };
}

/** One south instruction in words, or null when it is not one of them (or adds nothing the player decides on). */
export function southWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DiscardEach":
      return `discard each ${instruction.pick.type} you control`;
    case "PickHighestEngagement":
      return `choose the ${instruction.trait} enemy in the staging area with the highest engagement cost`;
    case "AttackFromStaging":
      return instruction.who === "firstPlayer" ? "that enemy attacks the first player" : "that enemy attacks you";
    case "AssignDamage":
      return "assign the damage among your characters";
    case "AdvanceStage":
      return "advance to the next stage";
    default:
      return null;
  }
}
