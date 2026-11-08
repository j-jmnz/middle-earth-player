// The words of the pursuit family's verbs (src/catalog/families/pursuit.ts) inside a choice: what a branch of a Choose does ("Increase the pursuit value by 3").
import type { Instruction } from "../../catalog/boundary.ts";

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** One pursuit instruction in words, or null when it is not one of them. */
export function pursuitWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "RaisePursuit":
      return `increase the pursuit value by ${amountWords(instruction.amount)}`;
    case "LowerPursuit":
      return `reduce the pursuit value by ${amountWords(instruction.amount)}`;
    case "SetPursuit":
      return `set the pursuit value to ${instruction.value}`;
    default:
      return null;
  }
}
