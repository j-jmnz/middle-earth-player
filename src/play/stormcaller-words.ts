// The words of the stormcaller family's verbs (src/catalog/families/stormcaller.ts) inside a choice or a log line, and what a card of the Stormcaller's area says in its preview (dcce.stormcallers-area,
// dcce.stormcallers-area-stages). Every sentence names what it does and leads with it; the numbers are the engine's.
import type { Instruction } from "../catalog/boundary.ts";

import type { ChoiceNames } from "./choice-words.ts";

/** The preview sentence of a card in the Stormcaller's area while the players are at another stage than the Stormcaller's (the zone `stormcallerArea`). */
export const AREA_APART = "In the Stormcaller's area: not in the staging area, immune to player card effects";
/** The preview sentence of a card of the area while the players are at the Stormcaller's stage: it stands in the staging area and is no longer immune. */
export const AREA_TOGETHER = "In the Stormcaller's area, at the Stormcaller's stage: in the staging area";
/** The preview sentence of the Stormcaller's current quest stage when the players have reached it. */
export const STAGE_TOGETHER = "Same stage as the Stormcaller";

const stages = (codes: readonly string[]): string => {
  const names = codes.map((_, at) => `${at + 2}C`);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

/** One instruction of the family in words, or null when it is not one of them. */
export function stormcallerWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "PrepareStormcallerArea":
      return `prepare the Stormcaller's area: a second quest deck of the Stormcaller's stages ${stages(instruction.stages)}, and the Stormcaller beside it`;
    case "FlipStormcaller":
      return "flip the Stormcaller to its Campaign Mode only side";
    case "MoveProgressToStormcaller":
      return `move ${typeof instruction.amount === "number" ? instruction.amount : "X"} progress from the main quest to the Stormcaller's quest stage`;
    case "StormcallerProgress":
      return "discard the top card of the encounter deck; the Stormcaller places progress on its stage equal to its Threat plus the Threat of the discarded card";
    case "MoveToStormcallerArea":
      return "add it to the Stormcaller's area";
    case "CatchUpWins":
      return `defeating this stage when the Stormcaller is at stage ${instruction.stage} wins the game`;
    default:
      return null;
  }
}

/** A branch of a Choose that gives the source card Boarding ("or it gains Boarding 1", 12022:A:3): the card named and the value, because the table tells it from the threat branch by what it does to the ship. */
export function stormcallerBranchWords(choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, names: ChoiceNames, sourceId: string | null): string | null {
  const [only] = choose.options.find((option) => option.id === optionId)?.instructions ?? [];
  if (only?.verb !== "ModifyStat" || only.stat !== "boarding" || typeof only.amount !== "number" || only.amount <= 0) return null;
  return `${sourceId ? names.card(sourceId) : "It"} gains Boarding ${only.amount}`;
}
