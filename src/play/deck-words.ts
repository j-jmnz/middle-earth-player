// The words of the deck family's verbs (src/catalog/families/deck.ts) inside a choice: what a branch of a Choose does ("Shuffle
// that player's discard pile into their deck"), and what a choosing
// verb asks for (a card to play from a discard pile, cards chosen up to a number).
import type { Instruction } from "../catalog/boundary.ts";

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
    case "PlayFrom":
      return verb.free ? "play a card from a discard pile for no cost" : "play a card from your discard pile";
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
      return asked.card ? { verb: "Attach", prompt: "Choose the card to attach it to." } : { verb: "Play", prompt: "Choose a card to play from the discard pile." };
    default:
      return null;
  }
}
