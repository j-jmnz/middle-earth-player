// Rules: rr.first-player (data/rules/entries.json; the first player has the final say on an encounter card's choice). The words of a choice an effect asks in the middle of resolving: the
// branches of a Choose instruction ("either remove X progress or shuffle 1 out-of-play Ringwraith", 141026:B:2) and what a
// Pick is for (the heroes Unwanted Attention removes from the quest, 141054:A:2). The words describe the effect record's
// instructions; the reducer still decides what each one does.
import type { Instruction } from "../catalog/boundary.ts";
import { questProgressMoved } from "../rules/verbs.ts";
import type { ScenarioState } from "../rules/reduce.ts";

export type ChoiceNames = {
  // A card instance by id.
  card: (cardId: string) => string;
  // A card code.
  code: (code: string) => string;
};

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;
type PickInstruction = Extract<Instruction, { verb: "Pick" }>;

const PICK_NOUNS: Readonly<Record<string, string>> = { hero: "hero", ally: "ally", attachment: "attachment", enemy: "enemy", character: "character", location: "location", player: "player" };
const PLURALS: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", enemy: "enemies" };

function article(noun: string): string {
  return /^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One instruction in words, or null when it adds nothing the player decides on (a shuffle after a search). */
function instructionWords(instruction: Instruction, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string | null {
  switch (instruction.verb) {
    case "RemoveQuestProgress":
      return `remove ${questProgressMoved(game, instruction)} progress from the quest`;
    case "PlaceQuestProgress":
      return `place ${questProgressMoved(game, instruction)} progress on the quest`;
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return `shuffle an out-of-play ${names.code(instruction.code)} into the encounter deck`;
    case "GainSurge":
      return "reveal an additional encounter card";
    case "RaiseThreat": {
      if (instruction.perCommitted) {
        const except = instruction.perCommitted.exceptSphere ? ` other than ${capital(instruction.perCommitted.exceptSphere)}` : "";
        return `each player raises threat by 1 for each ${instruction.perCommitted.type}${except} committed to the quest`;
      }
      const amount = instruction.amount ?? 1;
      if (instruction.who === "firstPlayer") return `the first player raises threat by ${amount}`;
      if (instruction.who === "eachSeat") return `each player raises threat by ${amount}`;
      return `raise your threat by ${amount}`;
    }
    case "LowerThreat":
      if (instruction.who === "eachSeat") return `each player lowers threat by ${instruction.amount}`;
      return instruction.who === "picked" ? `lower that player's threat by ${instruction.amount}` : `lower your threat by ${instruction.amount}`;
    case "Draw": {
      const amount = instruction.amount ?? 1;
      const cards = amount === 1 ? "1 card" : `${amount} cards`;
      return instruction.who === "picked" ? `that player draws ${cards}` : `draw ${cards}`;
    }
    case "DamageCard":
      return `deal ${instruction.amount} damage to it`;
    case "AddResources":
      return `add ${instruction.amount} resource${instruction.amount === 1 ? "" : "s"} to its pool`;
    case "DiscardShadow":
      return "discard its shadow card";
    case "Exhaust":
      return instruction.target?.kind === "byCode" ? `exhaust ${names.code(instruction.target.code)}` : "exhaust the chosen card";
    case "HideTest":
      return `make a Hide ${instruction.x} test`;
    case "ReturnToStaging":
      return instruction.target.kind === "engagedEnemies" ? `return an engaged ${instruction.target.trait ?? ""} enemy to the staging area`.replace("  ", " ") : "return it to the staging area";
    case "ReadyHero":
      return "ready a hero";
    case "SearchMove":
      return instruction.to === "staging"
        ? `add ${article(`${instruction.trait ?? ""} enemy`.trim())} from the encounter deck or discard pile to the staging area`
        : `put ${article(`${instruction.trait ?? ""} enemy`.trim())} into play engaged with the first player`;
    case "Pick": {
      const noun = PICK_NOUNS[instruction.pick.type] ?? "card";
      return `choose ${article(noun)}`;
    }
    case "RemoveFromQuest":
      return "remove it from the quest";
    case "DiscardPicked":
      return "discard it";
    case "MovePicked":
      return instruction.to === "play" ? "put it into play" : "put it into your hand";
    case "PlaceUnderSelf":
      return `place it facedown under ${sourceId ? names.card(sourceId) : "the location"}`;
    case "ShuffleEncounterDeck":
      return null;
    // Denethor (01010:A:1) and Protector of Lórien (01070:A:2).
    case "EncounterTopToBottom":
      return "move the top card of the encounter deck to its bottom";
    case "ModifyStat": {
      const stat = instruction.stat.charAt(0).toUpperCase() + instruction.stat.slice(1);
      const who = instruction.target === "host" ? "attached hero" : "it";
      return `${who} gets ${instruction.amount >= 0 ? "+" : ""}${instruction.amount} ${stat}`;
    }
    default:
      return null;
  }
}

/** A branch of a Choose instruction in words: "Remove 2 progress from the quest", "Remove 2 heroes you control from the quest". */
export function branchWords(choose: ChooseInstruction, optionId: string, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string {
  const option = choose.options.find((entry) => entry.id === optionId);
  if (!option) return capital(optionId);
  if (option.instructions.length === 0) return "Do nothing";
  // A run of "pick a hero, remove it from the quest" is one decision: how many heroes leave the quest.
  const removals = option.instructions.filter((instruction) => instruction.verb === "RemoveFromQuest").length;
  const picks = option.instructions.filter((instruction): instruction is PickInstruction => instruction.verb === "Pick");
  if (removals > 0 && removals === picks.length && removals * 2 === option.instructions.length) {
    const noun = PICK_NOUNS[picks[0]?.pick.type ?? "hero"] ?? "character";
    const control = picks[0]?.pick.control === "you" ? " you control" : "";
    return `Remove ${removals === 1 ? article(noun) : `${removals} ${PLURALS[noun] ?? `${noun}s`}`}${control} from the quest`;
  }
  const words = option.instructions.map((instruction) => instructionWords(instruction, game, names, sourceId)).filter((text): text is string => text != null);
  return words.length > 0 ? capital(words.join(", then ")) : capital(optionId);
}

/** The threat a branch changes, from its record's amount: +1 for "raise your threat by 1", -2 for "lower ... by 2". Null when the
 * branch changes no threat, or the change depends on the table ("for each hero committed"). */
export function branchThreat(choose: ChooseInstruction, optionId: string): number | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  for (const instruction of option?.instructions ?? []) {
    if (instruction.verb === "RaiseThreat" && !instruction.perCommitted) return instruction.amount ?? 1;
    if (instruction.verb === "LowerThreat") return -instruction.amount;
  }
  return null;
}

export type PickWords = { verb: string; prompt: string };

/** What a Pick asks for, from the instruction that uses the picked card: the verb for the button and a prompt sentence. */
export function pickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null): PickWords {
  // Out-of-play copies in different zones (rr.in-play-and-out-of-play, rr.first-player): which one joins the encounter deck.
  if (pick.verb === "ShuffleOutOfPlayIntoEncounterDeck") {
    const name = names.code(pick.code);
    return { verb: "Shuffle in", prompt: `Choose which out-of-play ${name} is shuffled into the encounter deck. Any other copy stays where it is.` };
  }
  if (pick.verb !== "Pick") return { verb: "Choose", prompt: "Choose one." };
  const noun = PICK_NOUNS[pick.pick.type] ?? "card";
  const one = article(noun);
  switch (next?.verb) {
    case "RemoveFromQuest":
      return { verb: "Remove", prompt: `Choose ${one} to remove from the quest.` };
    case "DiscardPicked":
      return { verb: "Discard", prompt: `Choose ${one} to discard.` };
    case "MovePicked":
      return next.to === "play" ? { verb: "Put into play", prompt: `Choose ${one} to put into play from your hand.` } : { verb: "Take", prompt: `Choose ${one} to put into your hand.` };
    case "PlaceUnderSelf":
      return { verb: "Place", prompt: `Choose ${one} to place facedown under ${sourceId ? names.card(sourceId) : "the location"}.` };
    default:
      return { verb: "Choose", prompt: `Choose ${one}.` };
  }
}

/** Where an out-of-play card is, for an option that names one copy among several: "Ringwraith set aside". */
export function outOfPlayLabel(game: ScenarioState, cardId: string, names: ChoiceNames): string {
  const card = game.cards[cardId];
  const name = card ? names.code(card.code) : cardId;
  switch (card?.zone) {
    case "setAside":
      return `${name} set aside`;
    case "encounterDiscard":
      return `${name} from the encounter discard pile`;
    case "victory":
      return `${name} from the victory display`;
    case "under":
      return `${name} under ${card.host ? names.card(card.host) : "a location"}`;
    default:
      return name;
  }
}
