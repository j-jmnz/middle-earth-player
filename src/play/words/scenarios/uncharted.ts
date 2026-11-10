// The words of the uncharted family's verbs (src/catalog/families/uncharted.ts) inside a choice: what a branch of a Choose does ("Either each player must exhaust a character he controls, or each
// Lost Island in the staging area gets +1 Threat", 11033:A:1), what a Pick or a question is for, and the label of an option that is no card. Every prompt names the card it is about and
// leads with the decision.
import type { Instruction } from "../../../catalog/boundary.ts";
import { cellOf } from "../../../rules/families/island/map.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { printedOf, type PrintedCard } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { topFrame } from "../../../rules/windows/windows.ts";

import type { BranchNow } from "./aflame.ts";
import type { ChoiceNames, PickWords } from "../choice.ts";
import { plural } from "../list.ts";

/** The name every Lost Island shows, whatever its other side is called (dcce.uncharted): the side that lies face up hides which location it is. */
export const LOST_ISLAND_NAME = "Lost Island";

/** The name the Temple column's locations of the Island Map show while they lie Uncharted side up (dcce.island-map): their other side is Temple Halls or The Grotto's Entrance. Their Uncharted side is the one that prints a Threat (4) of its own. */
export const TEMPLE_NAME = "Temple of the Deceived";

const ordinal = (n: number): string => {
  const mod = n % 100;
  if (mod >= 11 && mod <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/** What tells one Lost Island from another, which all carry one name: the progress on it and its place ("3 progress · row 2, column 1" on the Island Map, "3 progress · 2nd in staging" in a staging area of Lost Islands). Every
 * location of the Island Map has its place, whichever side lies up, so a flipped one is told too. Null for any other card. */
export function islandTell(game: ScenarioState, card: Pick<CardInstance, "id" | "code" | "face" | "progress">): string | null {
  const mapped = game.uncharted?.island ? cellOf(game.uncharted.island, card.id) : null;
  if (mapped == null && (card.face !== "B" || game.uncharted?.codes.includes(card.code) !== true)) return null;
  const place = game.staging.indexOf(card.id);
  const where = mapped ? `row ${mapped.row + 1}, column ${mapped.col + 1}` : place >= 0 ? `${ordinal(place + 1)} in staging` : null;
  return [card.progress > 0 ? `${card.progress} progress` : null, where].filter((part) => part != null).join(" · ") || null;
}

/** The effect's next question trades a card of the deck for one of the hand ("Then, you may switch that card with a card in your hand"). */
function switchesNext(game: ScenarioState): boolean {
  const data = topFrame(game)?.data;
  return data?.kind === "effect" && data.queue.some((item) => item.instruction.verb === "Choose" && item.instruction.options.some((option) => option.instructions.some((step) => step.verb === "SwapPicked")));
}

/** The look at the bottom of a deck says what comes next when the card may be switched with one in hand. Null otherwise. */
export function switchNote(game: ScenarioState, count: number): string | null {
  if (!switchesNext(game)) return null;
  return `You may switch ${count > 1 ? "one of them" : "it"} with a card in your hand next.`;
}

type Choose = Extract<Instruction, { verb: "Choose" }>;

const KEPT_NOUNS: Readonly<Record<string, string>> = { ally: "allies", attachment: "attachments", event: "events", "player-side-quest": "side quests", treasure: "treasures" };

/** The cards in a seat's hand and how many of each printed type (the card types Into the Abyss lets the player keep). */
export function handTypes(game: ScenarioState, ctx: ReduceContext, seat: number): { total: number; byType: Readonly<Record<string, number>> } {
  const hand = game.seats[seat]?.hand ?? [];
  const byType: Record<string, number> = {};
  for (const id of hand) {
    const type = printedOf(ctx.cards, game.cards[id]?.code ?? "").type;
    byType[type] = (byType[type] ?? 0) + 1;
  }
  return { total: hand.length, byType };
}

/** What Into the Abyss' card-type choice asks: the type to keep, and the surge when nothing is discarded. Null for any other Choose. */
export function unchartedNote(choose: Choose, cardName: string): string | null {
  const discards = choose.options.some((option) => option.instructions.some((step) => step.verb === "DiscardEach" && step.pick.notCardType != null));
  return discards ? `Choose the card type to keep in your hand. If no card is discarded, ${cardName} gains surge.` : null;
}

/** "Flip Dark Abyss to its Grotto side": the card (the source by default) and the side its other face is, read from that face's Traits. */
export function flipWords(instruction: Extract<Instruction, { verb: "FlipDoubleSided" }>, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string {
  const card = (instruction.target == null || instruction.target === "self") && sourceId ? game.cards[sourceId] : undefined;
  const other = card ? (card.other ?? game.uncharted?.pairs?.[card.code]) : undefined;
  const traits = other ? (names.traits?.(other) ?? []) : [];
  const side = traits.includes("Underwater") ? "Underwater" : traits.includes("Grotto") ? "Grotto" : null;
  return card && side ? `flip ${names.card(card.id)} to its ${side} side` : "flip it to its other side";
}

/** The words of a branch of the family's Choose instructions, or null: "Switch it with a card in your hand" / "Keep your hand" (Calphon), "Place 1 progress on a location (2 on a Lost Island)"
 * (Spyglass), "Raise each player's threat by 2 to look at a Lost Island's facedown side" (Aimless Wandering). */
export function unchartedBranchWords(choose: Choose, optionId: string, now?: BranchNow): string | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  if (!option) return null;
  const swaps = (steps: readonly Instruction[]) => steps.some((step) => step.verb === "SwapPicked");
  if (swaps(option.instructions)) return "Switch it with a card in your hand";
  if (option.instructions.length === 0 && choose.options.some((other) => swaps(other.instructions))) return "Keep your hand";
  const placed = option.instructions.filter((step): step is Extract<Instruction, { verb: "PlaceProgressOn" }> => step.verb === "PlaceProgressOn");
  const [plain, island] = placed;
  if (placed.length === 2 && plain && island && typeof plain.amount === "number" && typeof island.amount === "number" && plain.when != null && island.when != null) {
    return `Place ${plural(plain.amount, "progress", "progress")} on a location (${island.amount} on a Lost Island)`;
  }
  const keeps = option.instructions.find((step): step is Extract<Instruction, { verb: "DiscardEach" }> => step.verb === "DiscardEach" && step.pick.notCardType != null);
  if (keeps?.pick.notCardType) {
    const type = keeps.pick.notCardType;
    // The count of the hand now: "Keep only events (2), discard 3".
    if (now?.hand) {
      const kept = now.hand.byType[type] ?? 0;
      const lost = now.hand.total - kept;
      return `Keep only ${KEPT_NOUNS[type] ?? `${type}s`} (${kept}), discard ${lost === 0 ? "none" : lost}`;
    }
    const kind = type === "player-side-quest" ? "side quest" : type;
    return `Keep only ${kind} cards in your hand and discard the rest`;
  }
  const doomed = option.instructions.find((step): step is Extract<Instruction, { verb: "Doomed" }> => step.verb === "Doomed");
  if (doomed && option.instructions.some((step) => step.verb === "LookAtFacedown")) return `Raise each player's threat by ${typeof doomed.amount === "number" ? doomed.amount : "X"} to look at a Lost Island's facedown side`;
  return null;
}

/** The sentence of a trade of damage for threat: who takes the damage, whose threat falls, and for Calphon what is left of him and what his leaving costs. */
export function tradeWords(game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, instruction: Extract<Instruction, { verb: "TradeDamageForThreat" }>, name: string, leavingLoses: boolean): string {
  const card = instruction.character ? game.cards[instruction.character] : undefined;
  const seat = (card?.controller ?? game.firstPlayer) + 1;
  const left = card ? modifiedStat(game, card, "hitPoints", cards) - card.damage - instruction.damage : null;
  const hurt = left == null ? "" : left <= 0 ? ` ${name} would leave play, and the players would lose the game.` : leavingLoses ? ` ${name} would have ${plural(left, "hit point", "hit points")} left; if he leaves play the players lose the game.` : ` ${name} would have ${plural(left, "hit point", "hit points")} left.`;
  return `${name}: take ${plural(instruction.damage, "damage", "damage")} to lower Player ${seat}'s threat by ${instruction.threat}?${hurt}`;
}

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
    case "EachExhaustsOne":
      return { verb: "Exhaust", prompt: `${host}: choose a character you control to exhaust.` };
    case "StageLooked":
      return { verb: "Add", prompt: `${host}: choose the ${pick.trait} ${pick.type} you add to the staging area.` };
    case "RemoveWillpowerFromQuest":
      return { verb: "Remove", prompt: `${host}: choose a character to remove from the quest. The characters removed must have ${pick.left == null ? "a total of at least X" : `at least ${pick.left} more`} Willpower.` };
    case "MayDiscardShadow":
      return { verb: "Discard", prompt: `${host}: discard the shadow card you looked at, or keep it?` };
    case "PutSetAsideInPlay":
      return { verb: "Give", prompt: `Choose the player who takes control of ${pick.name}.` };
    case "Pick":
      break;
    default:
      return null;
  }
  switch (next?.verb) {
    case "LookAtFacedown":
      return { verb: "Look", prompt: `${host}: choose a Lost Island to look at the facedown side of.` };
    case "LookAtShadow":
      return { verb: "Look", prompt: `${host}: choose an enemy to look at its shadow card.` };
    case "LookAtTop":
    case "LookAtBottom":
      return { verb: "Look", prompt: `${host}: choose the player whose deck you look at the top and bottom cards of.` };
    // The card from the deck among the ones looked at (The Fate of Númenor's switch); any other Pick that precedes a Pick is worded by its own family.
    case "Pick":
      return pick.verb === "Pick" && pick.pick.looked === true && pick.pick.from === "deck" ? { verb: "Switch", prompt: `${host}: choose the card from your deck, among the ones you looked at, to switch with a card in your hand.` } : null;
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
