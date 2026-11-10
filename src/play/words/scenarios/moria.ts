// The words of the moria family's verbs (src/catalog/families/moria.ts) inside a choice: what a branch of a Choose does, and what the pick before
// the Great Bridge's sacrifice asks for.
import type { Instruction } from "../../../catalog/boundary.ts";

type Names = { code: (code: string) => string };

/** One moria instruction in words, or null when it is not one of them. */
export function moriaWords(instruction: Instruction, names: Names): string | null {
  switch (instruction.verb) {
    case "RemoveDamageFrom":
      return `remove ${instruction.amount === 1 ? "a damage token" : `${instruction.amount} damage tokens`} from ${names.code(instruction.code)}`;
    case "PlaceDamageOn":
      return `place ${instruction.amount === 1 ? "1 damage token" : `${instruction.amount} damage tokens`} on ${names.code(instruction.code)}`;
    case "SacrificeForDamage":
      return `discard it to deal damage equal to its threat cost to ${names.code(instruction.code)}, which then loses all keywords`;
    case "AttachToSubject":
      return "attach it to that hero";
    default:
      return null;
  }
}

/** A branch that picks the enemy in the staging area and has it attack the first player reads as one sentence: "The Balrog attacks the first player". */
export function moriaBranchWords(instructions: readonly Instruction[]): string | null {
  const [pick, attack, ...rest] = instructions;
  if (rest.length > 0 || pick?.verb !== "Pick" || attack?.verb !== "AttackFromStaging" || attack.who !== "firstPlayer") return null;
  const name = pick.pick.names?.[0];
  return name ? `${name} attacks the first player` : null;
}

/** What a Pick asks for when the hero it chooses is given up for the Great Bridge's damage. */
export function moriaPickWords(next: Instruction | undefined, names: Names): { verb: string; prompt: string } | null {
  if (next?.verb !== "SacrificeForDamage") return null;
  return { verb: "Discard", prompt: `Choose a hero to discard from play. ${names.code(next.code)} takes damage equal to that hero's threat cost and loses all keywords.` };
}
