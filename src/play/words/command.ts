// The words of the Command events' choices (11201 to 11204, A:1 to A:5; dcce.campaign-setup-the-drowned-ruins): each option of "choose up to X options, where X is its level" as the card prints it, the
// note that counts the options left, the armed "Done" that ends the choice, and the "you may" inside an option (engage the enemy, move the attachment, Spyglass from the hand, the deck, the discard pile or outside the game). The
// options are told by their id, which the records of src/effects/authored/pool/DCCEDrownedRuins.ts keep apart from every other Choose.
import type { Instruction } from "../../catalog/boundary.ts";
import { DONE, optionsLeft, upToLimit } from "../../rules/families/deck/choose.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import { plural } from "./list.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

const OPTION_WORDS: Readonly<Record<string, string>> = {
  defense: "A hero gets +2 Defense until the end of the round",
  enemyDefense: "An enemy gets -2 Defense until the end of the round",
  ready: "Ready a character with Círdan's Blessing on it",
  ally: "Put an ally with cost X or less from your discard pile into play (X is Command's level). Discard it at the end of the phase",
  resources: "Remove X resources from a non-unique enemy (X is Command's level)",
  blessings: "Add 2 resources to each Círdan's Blessing",
  bottom: "Add the bottom card of your deck to your hand",
  encounter: "Look at the top 10 cards of the encounter deck, discard any number of them, and shuffle it",
  willpower: "A hero gets +2 Willpower until the end of the round",
  noExhaust: "Each character with Círdan's Blessing on it does not exhaust to commit to a quest this round",
  progress: "Place 2 progress on a non-unique location",
  spyglass: "Put Spyglass into play attached to a hero",
  spyglassHand: "Put Spyglass from your hand into play",
  spyglassDeck: "Put Spyglass from your deck into play, then shuffle your deck",
  spyglassDiscard: "Put Spyglass from your discard pile into play",
  spyglassOutside: "Put Spyglass from outside the game into play",
  attack: "A hero gets +2 Attack until the end of the round",
  enemyAttack: "An enemy gets -2 Attack until the end of the round",
  damage: "Deal 2 damage to an enemy, then you may engage it",
  engageIt: "Engage that enemy",
  noEngage: "Leave it where it is",
  attachment: "Ready an attachment, then you may move it to an eligible character",
  moveIt: "Move it to another character",
  stayPut: "Leave it where it is",
};

const NESTED: ReadonlySet<string> = new Set(["spyglassHand", "spyglassDeck", "spyglassDiscard", "spyglassOutside", "engageIt", "noEngage", "moveIt", "stayPut"]);

/** The words of a Command option and the question inside an option. `x` is Command's X read now: the options that name it say its number. Null for any other Choose, and for the stop, which the sheet shows as its Done button. */
export function commandBranchWords(choose: Choose, optionId: string, x?: number): string | null {
  const said = OPTION_WORDS[optionId];
  if (choose.upTo != null) {
    if (said == null || !choose.options.some((option) => option.id === optionId)) return null;
    if (x == null) return said;
    // The first X is the amount the option names; the one in the closing parenthesis explains it.
    const filled = said.replace(/\bX\b/, String(x));
    return optionId === "resources" && x === 1 ? filled.replace("1 resources", "1 resource") : filled;
  }
  const nested = choose.options.length > 0 && choose.options.every((option) => OPTION_WORDS[option.id] != null && NESTED.has(option.id));
  return nested ? (said ?? null) : null;
}


/** What a Choose of the Command events asks, or null for any other Choose: how many options it may take (read now), then "Done ends the choice."; or the question inside an option. `picked` names the enemy or
 * attachment the option picked just before ("You may engage the Sea-scorpion."). */
export function commandNote(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number, sourceId: string | null, picked: string | null, name: (cardId: string) => string): string | null {
  const limit = upToLimit(game, choose, seat, sourceId, ctx);
  if (limit != null) {
    const left = optionsLeft(game, choose, seat, sourceId, ctx) ?? limit;
    const ask = left === limit ? `Choose up to ${plural(left, "option", "options")}, one at a time.` : `Choose up to ${plural(left, "more option", "more options")}.`;
    return `${ask} Done ends the choice.`;
  }
  const ids = choose.options.map((option) => option.id);
  if (ids.length > 0 && ids.every((id) => id.startsWith("spyglass"))) return "Where does Spyglass come from?";
  if (ids.includes("engageIt")) return `You may engage ${picked ? name(picked) : "that enemy"}.`;
  if (ids.includes("moveIt")) return `You may move ${picked ? name(picked) : "that attachment"} to another eligible character.`;
  return null;
}

/** The armed Done of a Choose with `upTo`: the options taken so far and where the card goes. Null for any other Choose. */
export function commandDone(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number, sourceId: string | null, cardName: string): { label: string; optionId: string; caution: string } | null {
  const limit = upToLimit(game, choose, seat, sourceId, ctx);
  if (limit == null) return null;
  const used = limit - (optionsLeft(game, choose, seat, sourceId, ctx) ?? limit);
  return { label: "Done", optionId: DONE, caution: `Tap again: ${cardName} goes to the victory display with ${used === 0 ? "no option" : plural(used, "option", "options")} used` };
}

/** Command's X read now, for the options that name it ("X is Command's level"). Undefined for any other Choose. */
export function commandX(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number, sourceId: string | null): number | undefined {
  return upToLimit(game, choose, seat, sourceId, ctx) ?? undefined;
}
