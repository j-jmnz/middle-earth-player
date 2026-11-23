// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json); ledger lines 132028:A:1, 132067:B:1.
//
// Poison is the top card of a character's controller's deck, attached to the character facedown (the zone under, hosted by it, `CardInstance.poison`, `owner` the seat whose deck it came from). A character with any poison is poisoned. With poison equal to its printed hit
// points a character is made unconscious at once and the poison goes to the discard pile of the player who owns it. A poison that leaves for any reason goes to its owner's discard pile, a character that leaves play takes its poison there (families/play/zones.ts leaveWith).
import type { EngineStep } from "../../core/intents.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, updateCard } from "../../core/state.ts";
import { cardsUnder, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { removeFromQuest } from "./quest.ts";

/** The poison under the character, in id order. */
export function poisonIds(state: ScenarioState, hostId: string): string[] {
  return cardsUnder(state, hostId).filter((id) => state.cards[id]?.poison === true);
}

/** How many poison the character has. */
export function poisonOf(state: ScenarioState, hostId: string): number {
  return poisonIds(state, hostId).length;
}

/** Whether the card is a character in play (a hero or an ally). */
export function isCharacterInPlay(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  return card != null && inPlay(card.zone) && (card.zone === "heroes" || isCharacterType(printedOf(ctx.cards, card.code)));
}

// The poison goes to its owner's discard pile (the player whose deck it came from), faceup.
function discardOne(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  const owner = card?.owner ?? card?.controller;
  if (!card || owner == null) return state;
  return updateCard(moveCard(state, id, { zone: "discard", seat: owner }), id, { face: "up", owner: undefined, poison: undefined });
}

/** DiscardPoison: `amount` poison (all of it with `all`) leaves the character for its owner's discard pile, the newest first. */
export function discardPoison(state: ScenarioState, hostId: string | null, amount: number | "all"): ScenarioState {
  if (!hostId) return state;
  const found = poisonIds(state, hostId);
  const leaving = amount === "all" ? found : found.slice(Math.max(0, found.length - amount));
  let next = state;
  for (const id of leaving) next = discardOne(next, id);
  return next;
}

/** MakeUnconscious: the character is rotated, leaves the quest and its poison is discarded (hob.unconscious-characters). A character already unconscious, or not in play, is left as it is. */
export function makeUnconscious(state: ScenarioState, id: string | null, ctx: ReduceContext): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.unconscious === true || !isCharacterInPlay(state, id, ctx)) return state;
  const unpoisoned = discardPoison(state, id, "all");
  return removeFromQuest(updateCard(unpoisoned, id, { unconscious: true, exhausted: true }), id, ctx);
}

/** ReadyUnconscious: the character is no longer unconscious and is ready. */
export function readyUnconscious(state: ScenarioState, id: string | null): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.unconscious !== true) return state;
  return updateCard(state, id, { unconscious: undefined, exhausted: false });
}

/** GivePoison: for each of `amount`, the top card of the controller's deck goes facedown under the character. A deck with no card gives none, a character that cannot be poisoned gets none. With poison equal to the printed hit points the character is made unconscious at once. */
export function givePoison(state: ScenarioState, id: string | null, amount: number, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let count = 0; count < amount; count += 1) {
    const card = id ? next.cards[id] : undefined;
    if (!id || !card || card.unconscious === true || card.controller == null || !isCharacterInPlay(next, id, ctx) || flagged(next, id, "cannotBePoisoned")) return next;
    const top = next.seats[card.controller]?.deck[0];
    if (!top) return next;
    next = updateCard(moveCard(next, top, { zone: "under", locationId: id }), top, { owner: card.controller, poison: true });
    const hitPoints = printedOf(ctx.cards, card.code).health;
    if (hitPoints != null && hitPoints > 0 && poisonOf(next, id) >= hitPoints) return makeUnconscious(next, id, ctx);
  }
  return next;
}
