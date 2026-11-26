// Rules: mec108.reanimated-dead, rr.engaged, rr.destroy, rr.effects, rr.setup (data/rules/entries.json); ledger lines 10150:A:1, 10151:A:1, 10154:A:2, 101158:A:1, 101159:A:1, 101160:A:2, 101161:A:2, 101162:A:2, 101164:A:1, 10155:A:1, 10155:A:2.
// Reanimate: a player card is placed facedown in front of a player as if it had just engaged them, and acts as an Undead enemy until it leaves play (core/printed.ts DEAD_SUFFIX; core/zones.ts moveCard returns it to its owner's discard pile).
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { EngineStep } from "../../../core/intents.ts";
import { engagedSeat } from "../../../core/engaged.ts";
import { DEAD_SUFFIX, isReanimatedCode, printedOf } from "../../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../../core/state.ts";
import { moveCard } from "../../../core/zones.ts";
import { frameScope, refCard, resolveAmount } from "../../../interpret/amounts.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import { nextUint } from "../../../core/seed.ts";
import { topFrame } from "../../../windows/windows.ts";
import { engageWith } from "../../../quest/quest.ts";
import { pushPicked } from "../../encounter/moves.ts";
import { stagingDest } from "../../breaking/areas.ts";
import type { Focus } from "../../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The seat a Reanimate stands the card in front of: the actor, the first player, the controller of the ally the effect destroyed ("That ally's controller reanimates that character", 101162:A:2), or the defending player, the one the attacking source is engaged with (a sentinel ally of another player may be the character that fell, 10155:A:1). */
function seatFor(state: ScenarioState, instruction: Verb<"Reanimate">, focus: Focus): number {
  if (instruction.who === "firstPlayer") return state.firstPlayer;
  if (instruction.who === "controller") {
    const data = topFrame(state)?.data;
    return data?.kind === "effect" && data.destroyedController != null ? data.destroyedController : focus.seat;
  }
  if (instruction.who === "defending") {
    const source = focus.sourceId;
    return (source ? engagedSeat(state, source) : null) ?? focus.seat;
  }
  return focus.seat;
}

/** Reanimates one card: it is renamed to its Reanimated Dead code, turned facedown and either engages `seat` (the default) or joins the staging area. A card that is already reanimated, in play, or whose seat is out of the game is left as it is. */
export function reanimateCard(state: ScenarioState, id: string, seat: number, to: "engaged" | "staging", steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || isReanimatedCode(card.code) || card.zone === "engaged" || card.zone === "staging" || state.seats[seat]?.eliminated) return state;
  const owner = card.owner ?? card.controller ?? seat;
  const dead = updateCard(state, id, { code: card.code + DEAD_SUFFIX, owner, face: "down", exhausted: false, committed: false, host: null });
  if (to === "staging") return updateCard(moveCard(dead, id, stagingDest(dead, seat)), id, { controller: null });
  return engageWith(dead, seat, id, steps);
}

// The cards the source names, in the order they are reanimated.
function sourcesOf(state: ScenarioState, instruction: Verb<"Reanimate">, seat: number, focus: Focus, ctx: ReduceContext): string[] {
  const own = state.seats[seat];
  if (!own) return [];
  switch (instruction.from) {
    // The top cards of the deck, as many as it holds up to the count (rr.effects).
    case "deckTop": {
      const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
      return own.deck.slice(0, Math.max(0, count));
    }
    // A card of the hand chosen by the game's seed (Sinister Dungeon).
    case "handRandom":
      return own.hand.length === 0 ? [] : [own.hand[nextUint(state.seed, state.seedCursor) % own.hand.length] ?? ""].filter((id) => id !== "");
    // The card on top of the discard pile, when it is an ally the running effect discarded from the top of a deck (DiscardFromDeck; Tombs of Carn Dûm).
    case "discardTop": {
      const top = own.discard.at(-1);
      const discarded = topFrame(state)?.data;
      return top && discarded?.kind === "effect" && (discarded.discardedFromDecks ?? []).includes(top) && printedOf(ctx.cards, state.cards[top]?.code ?? "").type === "ally" ? [top] : [];
    }
    // A card the effect names: it must lie in a discard pile (a character already reanimated by an earlier effect is not reanimated twice).
    case "card": {
      const named = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
      return named && state.cards[named]?.zone === "discard" ? [named] : [];
    }
    // The character the attack that left the effect destroyed (a shadow effect's "that character").
    case "destroyed": {
      const data = topFrame(state)?.data;
      const named = data?.kind === "effect" ? data.destroyedCharacter : undefined;
      return named && state.cards[named]?.zone === "discard" ? [named] : [];
    }
  }
}

/** Reanimate: the cards the source names stand in front of the player (the actor, or the first player) as Reanimated Dead; each becomes the effect's last picked card, so a later instruction can deal it a shadow card. */
export function reanimate(state: ScenarioState, instruction: Verb<"Reanimate">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = seatFor(state, instruction, focus);
  let next = instruction.from === "handRandom" ? { ...state, seedCursor: state.seedCursor + (state.seats[seat]?.hand.length ? 1 : 0) } : state;
  const found = sourcesOf(state, instruction, seat, focus, ctx);
  if (found.length === 0) return pushPicked(next, null);
  for (const id of found) {
    next = reanimateCard(next, id, seat, instruction.to ?? "engaged", steps);
    next = pushPicked(next, next.cards[id] != null && isReanimatedCode(next.cards[id].code) ? id : null);
  }
  return next;
}
