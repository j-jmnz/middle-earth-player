// Rules: mec108.side-quests-in-play, mec108.time-x (data/rules/entries.json); ledger lines 09049:A:2, 09024:A:2, 09051:A:1, 10156:A:2, 10107:A:1.
// The verbs of the angmar family (src/catalog/families/angmar.ts) and the search for an encounter side quest, in words for a branch of a Choose ("choose a different quest card to be the current quest").
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { PickWords } from "../../choice.ts";

/** One instruction of the angmar family in words, or null when it is not one of them. */
export function angmarWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "ChooseCurrentQuest":
      return "choose a different quest card in play to be the current quest until the end of the phase";
    case "SearchReveal":
      if (instruction.type === "enemy" && instruction.to === "staging") return `search for ${instruction.trait ? `a ${instruction.trait}` : "an"} enemy and add it to the staging area`;
      return instruction.type === "encounter-side-quest" ? "search the encounter deck and discard pile for an encounter side quest and reveal it" : null;
    // Dark Covenant's first option (10107:A:1): X is the total printed Threat of the cards it discarded.
    case "RemoveProgressAmong":
      return `remove ${typeof instruction.amount === "number" ? `${instruction.amount} progress` : "progress equal to the discarded cards' Threat"} from among the quest cards in play`;
    case "Time":
      return `put ${instruction.amount} time counters on this card`;
    case "HoldUnder":
      return "place the card facedown under this card";
    case "DiscardHeld":
      return "discard the card held under this card";
    case "PlaceHandUnderSelf":
      return "place your hand facedown under this card";
    case "TradeDamageForResources":
      return `place ${instruction.damage} damage on the card to add ${instruction.resources} resource to each of your heroes`;
    default:
      return null;
  }
}

/** What a window of the angmar family that asks for a card says. Null for any other instruction. */
export function angmarPickWords(pick: Instruction): PickWords | null {
  // Possession (101162:A:2): allies tie for the highest printed cost; the first player chooses which is destroyed.
  if (pick.verb === "DestroyHighestCostAlly") return { verb: "Destroy", prompt: "Possession: allies tie for the highest printed cost. Choose which one is destroyed. Its controller reanimates it into the staging area." };
  return null;
}
