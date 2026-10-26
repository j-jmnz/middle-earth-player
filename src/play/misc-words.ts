// The words of the misc family's instructions in a choice (src/catalog/families/misc.ts).
import type { Instruction } from "../catalog/boundary.ts";

/** One of the misc family's instructions in words, or null when it is not one of them. */
export function miscWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DrawEach": {
      const amount = instruction.amount == null ? "1" : typeof instruction.amount === "number" ? String(instruction.amount) : "X";
      return `each player draws ${amount === "1" ? "1 card" : `${amount} cards`}`;
    }
    case "HealQuietly":
      return "heal it";
    case "MoveDamage":
      return instruction.all ? "move all its damage to the other enemy" : "move damage from one enemy to the other";
    case "LoseGame":
      return "the players lose the game";
    case "DiscardCanceled":
      return "discard that card";
    case "ShuffleIntoEncounterDeck":
      return "shuffle a card into the encounter deck";
    default:
      return null;
  }
}
