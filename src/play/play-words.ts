// The words of the play family's verbs (src/catalog/families/play.ts) inside a choice: what a branch of a Choose does ("Give
// control of this card to that player") and what a choice asks for (the ally to put into play, the player who controls it).
import type { Instruction } from "../catalog/boundary.ts";

type PlayVerb = Extract<
  Instruction,
  {
    verb:
      | "PutIntoPlay"
      | "PutIntoPlayFromHand"
      | "ChangeControl"
      | "ControlledBy"
      | "TakeFirstPlayer"
      | "Doomed"
      | "TakeIntoHand"
      | "ReturnAttachments"
      | "AttachFacedown"
      | "SwitchActor"
      | "DiscardWhen"
      | "PlaceDamage"
      | "SpendFrom"
      | "DiscardSameTitle";
  }
>;

const NAMES: Readonly<Record<string, string>> = { self: "this card", picked: "it", subject: "that card", host: "the attached card" };

const OWNERS: Readonly<Record<string, string>> = { picked: "that player", eventSeat: "that player", firstPlayer: "the first player", actor: "you" };

/** A play family verb in words, or null when the instruction is not one. */
export function playWords(instruction: Instruction): string | null {
  const verb = instruction as PlayVerb;
  switch (verb.verb) {
    case "PutIntoPlay": {
      if (verb.host) return `attach ${NAMES[verb.card ?? "self"]} to ${verb.host.trait ? `a ${verb.host.trait} ${verb.host.type}` : `a ${verb.host.type}`}`;
      const who = verb.who === "owner" ? " under its owner's control" : verb.who === "picked" ? " under that player's control" : "";
      const state = verb.committed ? " exhausted and committed to the quest" : verb.exhausted ? " exhausted" : "";
      const damage = verb.damage ? ` with ${verb.damage} damage on it` : "";
      return `put ${NAMES[verb.card ?? "self"]} into play${who}${state}${damage}`;
    }
    case "PutIntoPlayFromHand":
      return `put ${verb.upTo && verb.upTo > 1 ? `up to ${verb.upTo} cards` : "a card"} into play from ${verb.from === "picked" ? "that player's hand" : verb.from === "any" ? "the players' hands" : "your hand"}`;
    case "ChangeControl":
      return `give control of ${NAMES[verb.card ?? "self"]} to ${OWNERS[verb.to]}`;
    case "ControlledBy":
      return "the first player gains control of it";
    case "TakeFirstPlayer":
      return "take control of the first player token";
    case "Doomed":
      return `each player raises threat by ${verb.amount}`;
    case "TakeIntoHand":
      return `return ${NAMES[verb.card ?? "subject"]} to its owner's hand`;
    case "ReturnAttachments":
      return "return each of its attachments to its owner's hand";
    case "AttachFacedown":
      return `attach ${NAMES[verb.card ?? "subject"]} facedown to this card`;
    case "SwitchActor":
      return "that player resolves the rest";
    case "DiscardWhen":
      return "discard this card";
    case "PlaceDamage":
      return `place ${verb.amount} damage on ${NAMES[verb.card ?? "self"]}`;
    case "SpendFrom":
      return `spend ${verb.amount} resource${verb.amount === 1 ? "" : "s"} from its pool`;
    case "DiscardSameTitle":
      return "discard a card with the same title from the staging area";
    default:
      return null;
  }
}

/** What a play family verb that stopped for a choice asks: the button's verb and the prompt. Null for any other verb. */
export function playPickWords(asked: Instruction): { verb: string; prompt: string } | null {
  if (asked.verb === "PutIntoPlay") return asked.host || asked.who !== "choose" ? { verb: "Attach", prompt: "Choose the card to attach it to." } : { verb: "Choose", prompt: "Choose the player who controls it." };
  if (asked.verb !== "PutIntoPlayFromHand") return null;
  if (asked.card) return { verb: "Choose", prompt: "Choose the player who controls it." };
  return { verb: "Put into play", prompt: `Choose a card to put into play from ${asked.from === "any" ? "the players' hands" : "your hand"}, or none.` };
}
