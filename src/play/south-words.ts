// The words of the south family's verbs (src/catalog/families/south.ts) inside a choice: what a branch of a Choose does.
import type { Instruction } from "../catalog/boundary.ts";

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
