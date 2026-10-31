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

/** The word a card of the area wears on a list that does not draw it (the web table's list): where it stands in the Stormcaller's area. */
export function areaTell(role: "stage" | "apart" | "together"): string {
  return role === "stage" ? "the Stormcaller's quest stage" : role === "apart" ? "in the Stormcaller's area, out of reach" : "in the Stormcaller's area, in the staging area";
}

/** What a screen reader hears of the Stormcaller's current quest stage, which the canvas draws sideways at the head of staging: its name (the players' stage can share it), its number, its progress
 * against its quest points, which cards stand in the area, and whether they can be reached. `names` are the cards of the area in order. */
export function stageSpeech(facts: { name: string; number: number; progress: number; points: number | null; together: boolean; names: readonly string[] }): string {
  const progress = facts.points == null ? `${facts.progress} progress` : `progress ${facts.progress} of ${facts.points}`;
  const cards = facts.names.length === 0 ? "No cards in the area" : `In the area: ${facts.names.join(", ")}`;
  const reach = facts.together ? "Reachable: the players are at the same stage, so its cards are in the staging area" : "Out of reach: the players are at another stage, so its cards are immune and not in the staging area";
  return `The Stormcaller's quest stage ${facts.number}, ${facts.name}, ${progress}. ${cards}. ${reach}`;
}

/** What a screen reader hears of a card of the area: its name, that it is in the Stormcaller's area, and whether it can be reached. */
export function memberSpeech(name: string, role: "apart" | "together"): string {
  return `${name}, ${role === "apart" ? "in the Stormcaller's area, out of reach" : "in the Stormcaller's area, reachable in the staging area"}`;
}

/** The title of the row list a fold stack opens when only the area's group folded, and the fold stack's word and its reader phrase. */
export const AREA_LIST_TITLE = "Stormcaller's area";
export const AREA_FOLD_WORD = "Area";
export const AREA_FOLD_WHERE = "the Stormcaller's area";

/** A row of the area's list for the Stormcaller's stage, told from the players' stage that shares its name ("2B-Full Sail Ahead!" and "2D-Full Sail Ahead!"). */
export const stageLabel = (name: string): string => `The Stormcaller's stage: ${name}`;
