// The words of the stormcaller family's verbs (src/catalog/families/stormcaller.ts) inside a choice or a log line, and what a card of the Stormcaller's area says in its preview (dcce.stormcallers-area,
// dcce.stormcallers-area-stages). Every sentence names what it does and leads with it; the numbers are the engine's.
import type { Instruction } from "../catalog/boundary.ts";

import type { ScenarioState } from "../rules/core/state.ts";

import type { ChoiceNames } from "./choice-words.ts";

/** The preview sentence of a card in the Stormcaller's area while the players are at another stage than the Stormcaller's (the zone `stormcallerArea`). */
export const AREA_APART = "In the Stormcaller's area: not in the staging area, immune to player card effects";
/** The preview sentence of a card of the area while the players are at the Stormcaller's stage: it stands in the staging area and is no longer immune. */
export const AREA_TOGETHER = "In the Stormcaller's area, at the Stormcaller's stage: in the staging area";
/** The preview sentence of the Stormcaller's last stage: filling it loses the game (12018:B:2). */
export const STAGE_LOSS = "When this stage is full the players lose: Captain Sahír has gotten away with the key";

/** The numbers of the Stormcaller's current quest stage: its number of the last, its progress against its quest points (null for a stage without), the players' stage number and whether it is theirs. */
export type StageFacts = { number: number; last: number; progress: number; points: number | null; playersAt: number; together: boolean };

const progressOf = (facts: Pick<StageFacts, "progress" | "points">): string => (facts.points == null ? `${facts.progress}` : `${facts.progress}/${facts.points}`);

/** The Stormcaller's stage named by its numbers: "Stormcaller · stage 3 of 4 · 12/18". The label of the stage on a list and for a screen reader. */
export const stageTitle = (facts: StageFacts): string => `Stormcaller · stage ${facts.number} of ${facts.last} · ${progressOf(facts)}`;

/** The preview lines of the Stormcaller's current quest stage: where it stands against the players' stage, and at its last stage what filling it does. */
export function stageLines(facts: StageFacts): string[] {
  const reach = facts.together ? "the players are at its stage: its cards are in the staging area" : `the players are at stage ${facts.playersAt}: its cards are out of reach`;
  const line = `The Stormcaller's stage ${facts.number} of ${facts.last} · ${progressOf(facts)} · ${reach}`;
  return facts.number >= facts.last ? [line, STAGE_LOSS] : [line];
}

/** The stage pill on the Stormcaller's stage: its number, and "4/4" in threat red at its last stage, where filling it loses the game. */
export function stagePill(facts: Pick<StageFacts, "number" | "last">): { text: string; danger: boolean } {
  return facts.number >= facts.last ? { text: `${facts.number}/${facts.last}`, danger: true } : { text: `${facts.number}`, danger: false };
}

/** The cue on the Stormcaller's stage while the players are at another stage. */
export const STAGE_APART_WORD = "Apart";

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

/**
 * A branch of a Choose that gives the source card Boarding ("or it gains Boarding 1", 12022:A:3) says what it does to the ship and what Boarding does now: "Corsair Skiff gains Boarding 1: reveal 1 Corsair
 * card now"; its threat sibling says where the threat goes: "Raise your threat by 3 (to 31)", from the seat the choice is asked of. Null for any other branch.
 */
export function stormcallerBranchWords(choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string | null {
  const boarding = (id: string): number | null => {
    const [only] = choose.options.find((option) => option.id === id)?.instructions ?? [];
    return only?.verb === "ModifyStat" && only.stat === "boarding" && typeof only.amount === "number" && only.amount > 0 ? only.amount : null;
  };
  const amount = boarding(optionId);
  if (amount != null) return `${sourceId ? names.card(sourceId) : "It"} gains Boarding ${amount}: reveal ${amount} Corsair ${amount === 1 ? "card" : "cards"} now`;
  const [raise] = choose.options.find((option) => option.id === optionId)?.instructions ?? [];
  if (raise?.verb !== "RaiseThreat" || raise.perCommitted || typeof raise.amount !== "number" || !choose.options.some((option) => boarding(option.id) != null)) return null;
  const seat = game.window?.kind === "choose" ? game.window.seat : game.activeSeat;
  const now = game.seats[seat]?.threat;
  return now == null ? `Raise your threat by ${raise.amount}` : `Raise your threat by ${raise.amount} (to ${now + raise.amount})`;
}

/** The word a card of the area wears on a list that does not draw it (the web table's list): where it stands in the Stormcaller's area; the stage names its numbers. */
export function areaTell(role: "stage" | "apart" | "together", stage?: StageFacts | null): string {
  if (role === "stage") return stage ? stageTitle(stage) : "the Stormcaller's quest stage";
  return role === "apart" ? "in the Stormcaller's area, out of reach" : "in the Stormcaller's area, in the staging area";
}

/** What a screen reader hears of the Stormcaller's current quest stage, which the canvas draws sideways at the head of staging: its numbers, its name (the players' stage can share it), which cards stand in the
 * area, and whether they can be reached. `names` are the cards of the area in order. */
export function stageSpeech(facts: StageFacts & { name: string; names: readonly string[] }): string {
  const cards = facts.names.length === 0 ? "No cards in the area" : `In the area: ${facts.names.join(", ")}`;
  const reach = facts.together ? "Reachable: the players are at the same stage, so its cards are in the staging area" : "Out of reach: the players are at another stage, so its cards are immune and not in the staging area";
  const loss = facts.number >= facts.last ? `. ${STAGE_LOSS}` : "";
  return `${stageTitle(facts)}, ${facts.name}. ${cards}. ${reach}${loss}`;
}

/** What a screen reader hears of a card of the area: its name, that it is in the Stormcaller's area, and whether it can be reached. */
export function memberSpeech(name: string, role: "apart" | "together"): string {
  return `${name}, ${role === "apart" ? "in the Stormcaller's area, out of reach" : "in the Stormcaller's area, reachable in the staging area"}`;
}

/** The title of the row list a fold stack opens when only the area's group folded, and the fold stack's word and its reader phrase. */
export const AREA_LIST_TITLE = "Stormcaller's area";
export const AREA_FOLD_WORD = "Area";
export const AREA_FOLD_WHERE = "the Stormcaller's area";
