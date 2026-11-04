// The words of the deck family's verbs (src/catalog/families/deck.ts) inside a choice: what a branch of a Choose does ("Shuffle
// that player's discard pile into their deck"), and what a choosing
// verb asks for (a card to play from a discard pile, cards chosen up to a number).
import type { Instruction } from "../../catalog/boundary.ts";

import type { PickWords } from "./choice.ts";

type DeckVerb = Extract<
  Instruction,
  {
    verb:
      | "MoveCard"
      | "GivePicked"
      | "SwapPicked"
      | "ShuffleDiscardIntoDeck"
      | "ShuffleHandIntoDeck"
      | "DiscardFromDeck"
      | "AddToX"
      | "ActAs"
      | "PlayFrom"
      | "ReduceNextDoomed"
      | "KeepOpeningHand"
      | "ReducePlayCost";
  }
>;

function cardWords(card: string | undefined): string {
  switch (card) {
    case "self":
      return "this card";
    case "subject":
    case "other":
      return "that card";
    case "host":
      return "the attached card";
    default:
      return "it";
  }
}

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** One of the deck family's instructions in words, or null when it is not one of them or adds nothing to decide on. */
export function deckWords(instruction: Instruction): string | null {
  const verb = instruction as DeckVerb;
  switch (verb.verb) {
    case "MoveCard": {
      const card = cardWords(verb.card);
      switch (verb.to) {
        case "hand":
          return `return ${card} to its owner's hand`;
        case "deckTop":
          return `put ${card} on top of its owner's deck`;
        case "deckBottom":
          return `put ${card} on the bottom of its owner's deck`;
        case "deckShuffle":
          return `shuffle ${card} into its owner's deck`;
        case "discard":
          return `discard ${card}`;
        case "removed":
          return `remove ${card} from the game`;
      }
      return null;
    }
    case "GivePicked":
      return "add it to that player's hand";
    case "SwapPicked":
      return "switch those two cards";
    case "ShuffleDiscardIntoDeck":
      return verb.who === "picked" ? "shuffle that player's discard pile into their deck" : "shuffle your discard pile into your deck";
    case "ShuffleHandIntoDeck":
      return "shuffle your hand into your deck";
    case "DiscardFromDeck": {
      const amount = amountWords(verb.amount);
      return `discard the top ${amount === "1" ? "card" : `${amount} cards`} of your deck`;
    }
    case "PlayFrom": {
      // Send for Help (Leadership, 11211:A:2) plays from the top cards of the player's own deck.
      if (verb.pick.from === "deck") return `play a card from the top ${verb.pick.top ?? "few"} cards of your deck${verb.free ? " for no cost" : ""}`;
      return verb.free ? "play a card from a discard pile for no cost" : "play a card from your discard pile";
    }
    case "ReduceNextDoomed":
      return `reduce the Doomed value of the next Doomed event you play ${verb.until === "endOfPhase" ? "this phase" : "this round"} by ${verb.amount}`;
    case "KeepOpeningHand":
      return "keep your opening hand";
    case "ReducePlayCost":
      return `reduce its cost by ${verb.amount}`;
    case "AddToX":
    case "ActAs":
      return null;
    default:
      return null;
  }
}

/** What one of the family's choosing verbs asks for (the verb for the button and a prompt), or null when it is not one. */
export function deckPickWords(asked: Instruction): { verb: string; prompt: string } | null {
  switch (asked.verb) {
    case "Each":
      if (asked.upTo == null) return null;
      return { verb: "Choose", prompt: asked.upTo === "any" ? "Choose any number of cards, one at a time. Done stops." : `Choose up to ${asked.upTo} card${asked.upTo === 1 ? "" : "s"}, one at a time. Done stops.` };
    case "PlayFrom":
      if (asked.card) return { verb: "Attach", prompt: "Choose the card to attach it to." };
      if (asked.pick.from === "deck") return { verb: "Play", prompt: `Choose a card from the top ${asked.pick.top ?? "few"} cards of your deck to play${asked.free ? " for no cost" : ""}.` };
      return { verb: "Play", prompt: "Choose a card to play from the discard pile." };
    default:
      return null;
  }
}

type PickInstruction = Extract<Instruction, { verb: "Pick" }>;

// A pick of the top cards of the picker's own deck (Send for Help (Leadership), 11211:A:2): its size, or null when the pick is not one.
const topOfDeck = (instruction: Instruction | undefined): number | null => (instruction?.verb === "Pick" && instruction.pick.from === "deck" && instruction.pick.top != null ? instruction.pick.top : null);

/** A Pick of the deck family whose use the instruction after it tells: the player who searches the top cards of their deck (a Choose after ActAs whose branches pick from the top N cards), and the card drawn from them
 * (a Pick of the top N cards, then MovePicked to the hand). `after` is what follows `next`. Null for any other Pick. */
export function deckPickThenWords(pick: PickInstruction, next: Instruction, after: readonly Instruction[] | undefined): PickWords | null {
  if (next.verb === "ActAs" && pick.pick.type === "player") {
    const choice = after?.[0];
    const top = choice?.verb === "Choose" ? choice.options.map((option) => (option.requires?.kind === "canPick" ? topOfDeck({ verb: "Pick", pick: option.requires.pick }) : null)).find((size) => size != null) : null;
    return top != null ? { verb: "Choose", prompt: `Choose the player who searches the top ${top} cards of their deck for a card.` } : null;
  }
  const top = topOfDeck(pick);
  if (next.verb === "MovePicked" && next.to === "hand" && top != null) return { verb: "Draw", prompt: `Choose a card from the top ${top} cards of your deck to draw.` };
  return null;
}

/** A whole branch of the deck family: drawing a card of the top N cards of your deck ("Draw a card from the top 10 cards of your deck"). Null for any other branch. */
export function deckBranchWords(instructions: readonly Instruction[]): string | null {
  const [pick, move, ...rest] = instructions;
  const top = topOfDeck(pick);
  return top != null && move?.verb === "MovePicked" && move.to === "hand" && rest.length === 0 ? `Draw a card from the top ${top} cards of your deck` : null;
}
