// The words of the encounter family's verbs (src/catalog/families/encounter.ts) inside a choice: what a branch of a Choose does
// ("Discard the next encounter card revealed if it is an enemy", "Pay 1 Lore resource, then return this card to your hand").
import type { Instruction } from "../../catalog/boundary.ts";

type EncounterVerb = Extract<
  Instruction,
  {
    verb:
      | "LookAtTop"
      | "PickEncounter"
      | "ArrangeEncounter"
      | "MoveEncounterCard"
      | "CountEncounterTop"
      | "RevealEncounter"
      | "ShuffleEncounterDiscard"
      | "DiscardUntil"
      | "ResolveWhenRevealed"
      | "RevealFewer"
      | "WatchReveals"
      | "TravelTo"
      | "ProgressQuest"
      | "RaiseThreatTo"
      | "LowerThreatByRaise"
      | "PayResources"
      | "ReturnEventToHand"
      | "PlayRevealedFree";
  }
>;

function article(noun: string): string {
  return /^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function cards(count: number): string {
  return count === 1 ? "the top card" : `the top ${count} cards`;
}

function amountWords(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

const DESTINATIONS: Readonly<Record<Extract<EncounterVerb, { verb: "MoveEncounterCard" }>["to"], string>> = {
  deckTop: "put %s on top of the encounter deck",
  deckBottom: "move %s to the bottom of the encounter deck",
  shuffle: "shuffle %s into the encounter deck",
  discard: "discard %s",
  staging: "add %s to the staging area",
  engaged: "put %s into play engaged with you",
  activeLocation: "make %s the active location",
  victory: "add %s to the victory display",
  removed: "remove %s from the game",
};

function cardWords(card: Extract<EncounterVerb, { verb: "MoveEncounterCard" }>["card"]): string {
  switch (card) {
    case "deckTop":
      return "the top card of the encounter deck";
    case "discardTop":
      return "the top card of the encounter discard pile";
    case "activeLocation":
      return "the active location";
    case "self":
      return "this card";
    case "subject":
    case "other":
      return "that card";
    default:
      return "it";
  }
}

/** What one of the family's choosing verbs asks for (the verb for the button and a prompt), or null when it is not one. */
export function encounterPickWords(asked: Instruction, next: Instruction | undefined): { verb: string; prompt: string } | null {
  switch (asked.verb) {
    case "PickEncounter": {
      const noun = article(asked.type ?? "card");
      if (next?.verb === "MoveEncounterCard") {
        const place = DESTINATIONS[next.to].replace("%s", "it");
        return { verb: "Choose", prompt: `Choose ${noun} from the encounter ${asked.from === "play" ? "cards in play" : "deck"}, then ${place}.` };
      }
      return { verb: "Choose", prompt: `Choose ${noun}.` };
    }
    case "ArrangeEncounter":
      return { verb: "Put on top", prompt: "Choose the card to put on top of the encounter deck; the others follow." };
    case "PayResources":
      return { verb: "Pay", prompt: "Choose the hero that pays 1 resource." };
    case "PlayRevealedFree":
      return { verb: "Attach", prompt: "Choose where to attach it." };
    default:
      return null;
  }
}

/** One of the encounter family's instructions in words, or null when it is not one of them or adds nothing to decide on. */
export function encounterWords(instruction: Instruction): string | null {
  const verb = instruction as EncounterVerb;
  switch (verb.verb) {
    case "LookAtTop":
      return `look at ${typeof verb.count === "object" ? "the top X cards" : cards(verb.count ?? 1)} of ${verb.deck === "own" ? "your deck" : verb.deck === "picked" ? "that player's deck" : "the encounter deck"}`;
    case "PickEncounter":
      return verb.from === "looked" ? "choose one of them" : `choose ${article(verb.type ?? "card")}`;
    case "MoveEncounterCard":
      return DESTINATIONS[verb.to].replace("%s", cardWords(verb.card));
    case "CountEncounterTop":
      // The type counted is the one the player names, one branch per type (Palantir, 06090:A:2); the count of the other
      // cards adds nothing to read.
      return verb.not ? null : `name ${verb.type}`;
    case "RevealEncounter":
      return "reveal an encounter card";
    case "ShuffleEncounterDiscard":
      return "shuffle the encounter discard pile into the encounter deck";
    case "DiscardUntil":
      return `discard cards from the top of the encounter deck until ${article(verb.type)} is discarded`;
    case "ResolveWhenRevealed":
      return "resolve its \"when revealed\" effects";
    case "RevealFewer":
      return `reveal ${verb.amount} fewer encounter card${verb.amount === 1 ? "" : "s"} this phase`;
    case "WatchReveals": {
      const type = verb.type ?? "card";
      const during = verb.until === "endOfPhase" ? "this phase" : "this round";
      switch (verb.effect) {
        case "discard":
          return `discard the next encounter card revealed if it is ${article(type)}`;
        case "readyHost":
          return `when ${article(type)} is revealed ${during}, exhaust this card to ready the attached hero`;
        case "damage":
          return `deal ${verb.amount ?? 1} damage to the first ${type} revealed ${during}`;
        case "threatZero":
          return `the next ${type} added to the staging area has 0 Threat ${during}`;
      }
      return null;
    }
    case "TravelTo":
      return "travel to that location";
    case "ProgressQuest":
      return `place ${amountWords(verb.amount)} progress on the quest`;
    case "RaiseThreatTo":
      return `raise your threat to ${amountWords(verb.amount)}`;
    case "LowerThreatByRaise":
      return "lower your threat by the same amount";
    case "PayResources":
      return `pay ${verb.amount} ${verb.sphere.charAt(0).toUpperCase()}${verb.sphere.slice(1)} resource${verb.amount === 1 ? "" : "s"}`;
    case "ReturnEventToHand":
      return "return this card to your hand";
    case "PlayRevealedFree":
      return "play it for no cost, if able";
    default:
      return null;
  }
}
