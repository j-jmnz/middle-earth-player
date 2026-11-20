// The words of the attack family's instructions in a choice (src/catalog/families/attack.ts), and of Commit with a target.
import type { Instruction } from "../../catalog/boundary.ts";

/** One of the attack family's instructions in words, or null when it is not one of them. */
export function attackWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DeclareAttack":
      return instruction.ranged ? "make a ranged attack against that enemy" : "declare it as an attacker against that enemy";
    case "OfferAttacks":
      return "declare an attack against each of those enemies";
    case "ImmediateAttack":
      return instruction.afterThis ? "make an additional attack against the defending player after this one" : "make an immediate attack against you";
    case "AttackFromStaging":
      return instruction.target === "host" ? "make the attached enemy attack from the staging area" : "make an immediate attack against you from the staging area";
    // An AfterAttack inside a Choose option (145021:A:3, Haunted Path's shadow): the enemy that attacked returns to the staging area once the attack has ended.
    case "AfterAttack":
      if (instruction.instructions.length > 0 && instruction.instructions.every((inner) => inner.verb === "ReturnToStaging")) return "return the attacking enemy to the staging area after this attack";
      // Body Count (50728:A:2): the threat raise that waits for the attack to end and counts only a destroyed character.
      return instruction.instructions.length === 1 && instruction.instructions[0]?.verb === "RaiseThreat" && typeof instruction.instructions[0].amount === "number" ? `raise your threat by ${instruction.instructions[0].amount} after this attack if it destroyed a character` : null;
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

/** A named enemy picked in the staging area (`staging`; the Balrog's `stagingOnly` pick keeps the generic words) that attacks from it (Lashing Tentacles' Thing in the Depths, 12056:A:1 and A:2): its title, and where it attacks from. Null for any other pick. */
export function attackPickWords(pick: Instruction, next: Instruction | undefined): { verb: string; prompt: string } | null {
  if (pick.verb !== "Pick" || next?.verb !== "AttackFromStaging" || pick.pick.staging !== true || pick.pick.names?.length !== 1) return null;
  return { verb: "Choose", prompt: `Choose ${pick.pick.names[0]} to attack from the staging area.` };
}
