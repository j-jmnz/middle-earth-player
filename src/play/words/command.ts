// The words of the Command events' choices (11201 to 11204, A:1 to A:5; dcce.campaign-setup-the-drowned-ruins): each option of "choose up to X options, where X is its level" as the card prints it, the
// stop ("done") that ends the choice, and the "you may" inside an option (engage the enemy, move the attachment, Spyglass from the hand, the deck or the discard pile). The options are told by their
// id, which the records of src/effects/authored/pool/DCCE.ts keep apart from every other Choose.
import type { Instruction } from "../../catalog/boundary.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { topFrame } from "../../rules/windows/windows.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

const OPTION_WORDS: Readonly<Record<string, string>> = {
  defense: "A hero gets +2 Defense until the end of the round",
  enemyDefense: "An enemy gets -2 Defense until the end of the round",
  ready: "Ready a character with Círdan's Blessing on it",
  ally: "Put an ally with cost X or less from your discard pile into play, then discard it at the end of the phase",
  resources: "Remove X resources from a non-unique enemy",
  blessings: "Add 2 resources to each Círdan's Blessing",
  bottom: "Add the bottom card of your deck to your hand",
  encounter: "Look at the top 10 cards of the encounter deck, discard any number of them, and shuffle it",
  willpower: "A hero gets +2 Willpower until the end of the round",
  noExhaust: "Each character with Círdan's Blessing on it does not exhaust to commit to a quest this round",
  progress: "Place 2 progress on a non-unique location",
  spyglass: "Put Spyglass into play attached to a hero",
  spyglassHand: "Spyglass from your hand",
  spyglassDeck: "Spyglass from your deck, then shuffle it",
  spyglassDiscard: "Spyglass from your discard pile",
  attack: "A hero gets +2 Attack until the end of the round",
  enemyAttack: "An enemy gets -2 Attack until the end of the round",
  damage: "Deal 2 damage to an enemy, then you may engage it",
  engageIt: "Engage that enemy",
  noEngage: "Leave it where it is",
  attachment: "Ready an attachment, then you may move it to an eligible character",
  moveIt: "Move it to another character",
  stayPut: "Leave it where it is",
};

const NESTED: ReadonlySet<string> = new Set(["spyglassHand", "spyglassDeck", "spyglassDiscard", "engageIt", "noEngage", "moveIt", "stayPut"]);

/** The words of a Command option, the stop of its choice, and the question inside an option. Null for any other Choose. */
export function commandBranchWords(choose: Choose, optionId: string): string | null {
  if (choose.upTo != null) return optionId === "done" ? "Done choosing" : choose.options.some((option) => option.id === optionId) ? (OPTION_WORDS[optionId] ?? null) : null;
  const nested = choose.options.length > 0 && choose.options.every((option) => OPTION_WORDS[option.id] != null && NESTED.has(option.id));
  return nested ? (OPTION_WORDS[optionId] ?? null) : null;
}


/** What a Choose with `upTo` asks: how many options it may still take, read now. Null for any other Choose. */
export function upToNote(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number, sourceId: string | null): string | null {
  if (choose.upTo == null) return null;
  const limit = typeof choose.upTo === "number" ? choose.upTo : resolveAmount(game, choose.upTo, frameScope(game, seat, sourceId), ctx);
  const data = topFrame(game)?.data;
  const left = Math.max(0, limit - (data?.kind === "effect" ? (data.options ?? []).length : 0));
  return `Choose ${left === 1 ? "1 more option" : `up to ${left} more options`}, one at a time. Done stops.`;
}
