// Rules: rr.first-player (data/rules/entries.json; the first player has the final say on an encounter card's choice). The words of a choice an effect asks in the middle of resolving: the
// branches of a Choose instruction ("either remove X progress or shuffle 1 out-of-play Ringwraith", 141026:B:2) and what a
// Pick is for (the heroes Unwanted Attention removes from the quest, 141054:A:2). The words describe the effect record's
// instructions; the reducer still decides what each one does.
import type { Amount, Instruction } from "../catalog/boundary.ts";
import { questProgressMoved } from "../rules/verbs.ts";
import type { ScenarioState } from "../rules/reduce.ts";
import { encounterPickWords, encounterWords } from "./encounter-words.ts";

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

// A record's amount in words: its number, or X when the engine reads it.
function amountWords(amount: Amount | undefined, fallback = 1): string {
  if (amount == null) return String(fallback);
  return typeof amount === "number" ? String(amount) : "X";
}

const STAT_WORDS: Readonly<Record<string, string>> = { willpower: "Willpower", attack: "Attack", defense: "Defense", threat: "Threat", hitPoints: "hit points" };

// "the chosen card", "that card", "it": what a card reference names in a sentence.
function refWords(ref: string | undefined): string {
  switch (ref) {
    case "self":
      return "this card";
    case "host":
      return "the attached card";
    case "subject":
    case "other":
      return "that card";
    case "defender":
      return "the defending character";
    case "attacker":
      return "the attacking enemy";
    default:
      return "it";
  }
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
      const amount = amountWords(instruction.amount);
      if (instruction.who === "firstPlayer") return `the first player raises threat by ${amount}`;
      if (instruction.who === "eachSeat") return `each player raises threat by ${amount}`;
      return `raise your threat by ${amount}`;
    }
    case "LowerThreat": {
      const amount = amountWords(instruction.amount);
      if (instruction.who === "eachSeat") return `each player lowers threat by ${amount}`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `lower that player's threat by ${amount}` : `lower your threat by ${amount}`;
    }
    case "Draw": {
      const amount = amountWords(instruction.amount);
      const cards = amount === "1" ? "1 card" : `${amount} cards`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `that player draws ${cards}` : `draw ${cards}`;
    }
    case "DamageCard":
      return `deal ${amountWords(instruction.amount)} damage to ${refWords(instruction.target)}`;
    case "AddResources": {
      const amount = amountWords(instruction.amount);
      return `add ${amount} resource${amount === "1" ? "" : "s"} to ${instruction.to === "host" || instruction.to == null ? "the attached hero's" : instruction.to === "self" ? "this card's" : "its"} pool`;
    }
    case "ModifyStat": {
      // A resource icon held as a flag (Narvi's Belt): "the attached card gains a Leadership icon until the end of the phase".
      const icon = /^(leadership|lore|tactics|spirit)Icon$/.exec(instruction.stat)?.[1];
      if (icon) {
        const until = instruction.until === "endOfPhase" ? " until the end of the phase" : instruction.until === "endOfRound" ? " until the end of the round" : "";
        return `${refWords(instruction.target === "picked" || instruction.target == null ? undefined : instruction.target)} gains a ${capital(icon)} icon${until}`;
      }
      const stat = STAT_WORDS[instruction.stat] ?? instruction.stat;
      const amount = typeof instruction.amount === "number" ? (instruction.amount >= 0 ? `+${instruction.amount}` : `${instruction.amount}`) : "+X";
      const until = instruction.until === "endOfPhase" ? " until the end of the phase" : instruction.until === "endOfRound" ? " until the end of the round" : "";
      const who = instruction.holders ? "each matching card" : refWords(instruction.target === "picked" || instruction.target == null ? undefined : instruction.target);
      return `${who === "it" ? "it gets" : `${who} gets`} ${amount} ${stat}${until}`;
    }
    case "Heal":
      return instruction.all ? `heal all damage on ${refWords(instruction.target)}` : `heal ${amountWords(instruction.amount)} damage on ${refWords(instruction.target)}`;
    case "Ready":
      return instruction.target === "allCharacters" ? "ready each character" : `ready ${refWords(instruction.target === "picked" ? undefined : instruction.target)}`;
    case "ReturnToHand":
      return `return ${refWords(instruction.target)} to its owner's hand`;
    case "PutOnDeck":
      return instruction.position === "shuffle" ? `shuffle ${refWords(instruction.target)} into its owner's deck` : `put ${refWords(instruction.target)} on the ${instruction.position} of its owner's deck`;
    case "MoveResources":
      return instruction.all ? "move all its resources" : `move ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "DiscardFromHand":
      return `discard ${amountWords(instruction.amount)} card${amountWords(instruction.amount) === "1" ? "" : "s"} from your hand`;
    case "AddToVictory":
      return `add ${refWords(instruction.target)} to the victory display`;
    case "SetThreat":
      return `set your threat to ${instruction.value}`;
    case "CancelDamage":
      return instruction.all ? "cancel that damage" : `cancel ${amountWords(instruction.amount)} of that damage`;
    case "CancelEffect":
      return "cancel those effects";
    case "Engage":
      return "engage that enemy";
    case "Discard":
      return instruction.target.kind === "self" ? "discard this card" : "discard it";
    case "PlaceProgressOn":
      return `place ${amountWords(instruction.amount)} progress on ${instruction.target === "eachStagingLocation" ? "each location in the staging area" : instruction.target === "activeLocation" ? "the active location" : "it"}`;
    case "ReduceNextCost":
      return `reduce the cost of the next matching card you play by ${amountWords(instruction.amount)}`;
    // The costs family's verbs (src/catalog/families/costs.ts).
    case "SpendResources": {
      const sphere = instruction.sphere ? `${capital(instruction.sphere)} ` : "";
      return `${instruction.group ? "the players as a group spend" : "spend"} ${instruction.amount} ${sphere}resource${instruction.amount === 1 ? "" : "s"}`;
    }
    case "SetX":
      return `X is ${instruction.value}`;
    case "ChooseX":
      return "choose X";
    case "DiscardResources":
      return instruction.all ? "discard all its resources" : `discard ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "HeroesGainResources":
      return `each hero ${instruction.who === "picked" ? "that player controls" : "you control"} gains ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "PlayFromHand":
      return instruction.picked ? "play each of those cards from your hand" : "play a card from your hand";
    case "Reattach":
      return "attach this card to another hero";
    case "LookAtEncounterTop":
      return "look at the top card of the encounter deck";
    case "AttackEnemy":
      return "attack that enemy";
    case "BarAttack":
      return "that enemy cannot attack you";
    case "DiscardTopOfDeck":
      return "discard the top card of your deck";
    case "AttachPicked":
      return "attach it";
    case "Each":
    case "Repeat":
    case "Delay": {
      const inner = instruction.instructions.map((entry) => instructionWords(entry, game, names, sourceId)).filter((text): text is string => text != null);
      return inner.length > 0 ? inner.join(", then ") : null;
    }
    case "ShuffleDeck":
    case "ArrangeTop":
      return null;
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
    // The quest family's verbs (src/catalog/families/quest.ts).
    case "DamageEach":
      return instruction.engagedWith === "picked" ? `deal ${amountWords(instruction.amount)} damage to each enemy engaged with that player` : `deal ${amountWords(instruction.amount)} damage to each matching ${PICK_NOUNS[instruction.pick?.type ?? "enemy"] ?? "card"}`;
    case "WaiveQuestThreat":
      return `${instruction.who === "eachSeat" ? "players do" : "that player does"} not raise threat from questing unsuccessfully ${instruction.until === "endOfRound" ? "this round" : "this phase"}`;
    case "SkipQuestPhase":
      return "skip the quest phase this round";
    case "MoveProgress":
      return instruction.all ? "move all its progress" : `move ${amountWords(instruction.amount)} progress`;
    case "CommitToQuest":
      return "commit it to the quest";
    case "MakeActive":
      return "make it the active location";
    case "BarEngagement":
      return instruction.what === "checks" ? "that enemy makes no engagement checks against you" : "that enemy cannot engage you";
    default:
      // The encounter family's verbs (src/catalog/families/encounter.ts).
      return encounterWords(instruction);
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
    if (instruction.verb === "RaiseThreat" && !instruction.perCommitted) return typeof instruction.amount === "object" ? null : (instruction.amount ?? 1);
    if (instruction.verb === "LowerThreat") return typeof instruction.amount === "object" ? null : -instruction.amount;
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
  // The costs family's verbs that ask for a card: which card to play, which pool pays the next resource, the new host.
  if (pick.verb === "PlayFromHand") return { verb: "Play", prompt: "Choose a card to play from your hand." };
  if (pick.verb === "PayToPlay" || pick.verb === "SpendResources") return { verb: "Pay", prompt: "Choose whose pool pays 1 resource." };
  if (pick.verb === "Reattach") return { verb: "Attach", prompt: "Choose the card to attach it to." };
  if (pick.verb !== "Pick") return encounterPickWords(pick, next) ?? { verb: "Choose", prompt: "Choose one." };
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
