// The words of the attack family's instructions in a choice (src/catalog/families/attack.ts), and of Commit with a target.
import type { Instruction } from "../../catalog/boundary.ts";

/** One of the attack family's instructions in words, or null when it is not one of them. */
export function attackWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DeclareAttack":
      return instruction.ranged ? "make a ranged attack against that enemy" : "declare it as an attacker against that enemy";
    case "OfferAttacks":
      return "declare an attack against each of those enemies";
    case "QuestProgress":
      return `place ${typeof instruction.amount === "number" ? instruction.amount : "X"} progress on the current quest`;
    case "ExcessDamageTo":
      return "assign the attack's excess damage to that enemy";
    case "Commit":
      return instruction.target ? "commit it to the quest" : "commit this card to the quest";
    default:
      return null;
  }
}
