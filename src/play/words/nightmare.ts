// The words of the nightmare family's verbs (src/catalog/families/nightmare.ts) when a Choose branch holds one (906203:A:1: "Southern Spy
// makes an immediate attack against you").
import type { Instruction } from "../../catalog/boundary.ts";

/** One instruction of the nightmare family, in words, or null when it is not one of them (or says nothing to the player). */
export function nightmareWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  switch (instruction.verb) {
    case "AttackActor":
      return "it makes an immediate attack against you";
    case "AttachToQuest":
      return "attach it to the current quest";
    case "SearchToStaging":
      return `add ${nameOf(instruction.code)} to the staging area`;
    case "AttachToDamagedDefender":
      return "attach it to the defending character if this attack damages it";
    default:
      return null;
  }
}
