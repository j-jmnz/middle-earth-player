// The words of the misc family's instructions in a choice (src/catalog/families/misc.ts).
import type { Instruction } from "../../catalog/boundary.ts";

/** What a misc instruction that asks for a card is asking, or null when it is not one of them. */
export function miscPickWords(instruction: Instruction): { verb: string; prompt: string } | null {
  if (instruction.verb === "SwapHero") return { verb: "Swap in", prompt: "Choose the hero from your collection that takes the place of the chosen hero." };
  if (instruction.verb === "TakeHeroFromCollection") return { verb: "Take", prompt: "Choose a hero from your collection to put into play." };
  if (instruction.verb === "AttachCollectionHero") return { verb: "Attach", prompt: "Choose the version of the hero from your collection to attach to this card." };
  return null;
}

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
    case "SwapHero":
      return "swap it for a hero from your collection";
    case "AddPhaseInstance":
      return `an additional ${instruction.phase.toLowerCase()} phase follows this phase`;
    case "TakeHeroFromCollection":
      return "take a hero from your collection";
    case "TakeCardFromCollection":
      return "take the card from your collection";
    case "AttachCollectionHero":
      return "attach another version of the hero from your collection";
    case "AttachAsMount":
      return "attach this card to an ally";
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
