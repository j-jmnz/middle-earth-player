// The words of the uncharted family's verbs (src/catalog/families/uncharted.ts) inside a choice: what a branch of a Choose does ("Either each player must exhaust a character he controls, or each
// Lost Island in the staging area gets +1 Threat", 11033:A:1), what a Pick or a question is for, and the label of an option that is no card. Every prompt names the card it is about and
// leads with the decision.
import type { Instruction } from "../catalog/boundary.ts";
import type { ScenarioState } from "../rules/state.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

/** The name every Lost Island shows, whatever its other side is called (dcce.uncharted): the side that lies face up hides which location it is. */
export const LOST_ISLAND_NAME = "Lost Island";

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** One instruction in words, or null when it is not one of the family's. */
export function unchartedWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "AddLostIslands":
      return `add ${typeof instruction.count === "number" ? plural(instruction.count, "Lost Island", "Lost Islands") : "Lost Islands"} from the Uncharted deck to the staging area`;
    case "FlipUncharted":
      return "flip it over";
    case "LookAtFacedown":
      return "look at the facedown side of a Lost Island";
    case "ScrambleUncharted":
      return "remove all progress from the Lost Islands in the staging area and shuffle them";
    case "EachExhaustsOne":
      return "each player exhausts a character they control";
    case "LookAtBottom":
      return instruction.deck === "encounter" ? "look at the bottom card of the encounter deck" : instruction.deck === "picked" ? "look at the bottom card of that player's deck" : `look at the bottom ${instruction.count == null || instruction.count === 1 ? "card" : "cards"} of your deck`;
    case "MayDiscardShadow":
      return "you may discard it";
    default:
      return null;
  }
}

/** What a Pick of the family's cards, or one of its questions, asks. Null for any other pick. `next` is the instruction after it. */
export function unchartedPickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "TradeDamageForThreat": {
      const who = pick.character ? names.card(pick.character) : "A character";
      return { verb: "Trade", prompt: `${who}: deal ${pick.damage} damage to it to lower its controller's threat by ${pick.threat}?` };
    }
    case "EachExhaustsOne":
      return { verb: "Exhaust", prompt: `${host}: choose a character you control to exhaust.` };
    case "StageLooked":
      return { verb: "Add", prompt: `${host}: choose the ${pick.trait} ${pick.type} you add to the staging area.` };
    case "RemoveWillpowerFromQuest":
      return { verb: "Remove", prompt: `${host}: choose a character to remove from the quest. The characters removed must have ${pick.left == null ? "a total of at least X" : `at least ${pick.left} more`} Willpower.` };
    case "MayDiscardShadow":
      return { verb: "Discard", prompt: `${host}: discard the shadow card you looked at, or keep it?` };
    case "Pick":
      break;
    default:
      return null;
  }
  switch (next?.verb) {
    case "LookAtFacedown":
      return { verb: "Look", prompt: `${host}: choose a Lost Island to look at the facedown side of. Only you see it.` };
    case "LookAtShadow":
      return { verb: "Look", prompt: `${host}: choose an enemy to look at its shadow card.` };
    case "LookAtTop":
    case "LookAtBottom":
      return { verb: "Look", prompt: `${host}: choose the player whose deck you look at the top and bottom cards of.` };
    case "Pick":
      return { verb: "Switch", prompt: `${host}: choose the card from your deck, among the ones you looked at, to switch with a card in your hand.` };
    case "SwapPicked":
      return { verb: "Switch", prompt: `${host}: choose the card in your hand to switch with the one from your deck.` };
    case "MoveCard":
      return next.to === "deckBottom" ? { verb: "Put", prompt: `${host}: choose a card in your hand to put on the bottom of your deck.` } : null;
    default:
      return null;
  }
}

/** The label of an option that is no card: trade or keep the damage, discard the shadow card or keep it. Null for a card (the sheet names it). */
export function unchartedOptionLabel(instruction: Instruction, id: string, game: ScenarioState, names: ChoiceNames): string | null {
  if (instruction.verb === "TradeDamageForThreat" && (id === "trade" || id === "keep")) {
    const who = instruction.character && game.cards[instruction.character] ? names.card(instruction.character) : "it";
    return id === "trade" ? `Trade: ${instruction.damage} damage to ${who} for ${instruction.threat} less threat` : `Keep ${who} as it is`;
  }
  if (instruction.verb === "MayDiscardShadow" && (id === "discard" || id === "keep")) return id === "discard" ? "Discard the shadow card" : "Keep the shadow card";
  return null;
}
