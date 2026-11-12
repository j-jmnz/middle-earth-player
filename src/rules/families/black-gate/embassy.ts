// Rules: mec113.saga-staging-rules, rr.in-player-order, rr.first-player, rr.reveal (data/rules/entries.json); ledger line 146072:B:1. The Embassy from the Dark Tower: the top cards of the players' decks and of the encounter deck lie faceup, are paired, and for each pair the
// first player chooses to discard both or to reveal the encounter card and play the player card at no cost. The row lies set aside (faceup, out of the decks) while it lasts; `state.embassy` remembers it.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickedList } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard, withSeat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { startReveal } from "../../windows/frames.ts";
import { canPlayFree } from "../encounter/items.ts";
import { pushPicked } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** The pair the running effect is on (EmbassyNext took it), while its player card still lies in the row. */
export function currentPair(state: ScenarioState): { player: string; encounter: string } | null {
  const embassy = state.embassy;
  const pair = embassy ? embassy.pairs[embassy.at - 1] : undefined;
  return pair && state.cards[pair.player]?.zone === "setAside" ? pair : null;
}

function layFaceup(state: ScenarioState, id: string, seat: number | null): ScenarioState {
  const moved = moveCard(state, id, { zone: "setAside" });
  return updateCard(moved, id, { face: "up", ...(seat != null ? { controller: seat } : {}) });
}

/** EmbassyDeal: the players, first player first, each place the top card of their deck faceup in turn until `cards` lie out (a player with an empty deck passes; the row stops short when no deck has a card), then the top `cards` cards of the encounter deck. */
export function embassyDeal(state: ScenarioState, cards: number): ScenarioState {
  let next = state;
  const players: string[] = [];
  const seats = livingSeats(state);
  for (let pass = 0; pass < cards && players.length < cards; pass += 1) {
    let placed = false;
    for (const seat of seats) {
      if (players.length >= cards) break;
      const top = next.seats[seat]?.deck[0];
      if (!top) continue;
      next = layFaceup(next, top, seat);
      players.push(top);
      placed = true;
    }
    if (!placed) break;
  }
  const encounter = next.encounterDeck.slice(0, cards);
  for (const id of encounter) next = layFaceup(next, id, null);
  return { ...next, embassy: { players, encounter, pairs: [], at: 0 } };
}

/** EmbassyPair: the last two cards picked (a player card of the row, then an encounter card of it) make the next pair. */
export function embassyPair(state: ScenarioState): ScenarioState {
  const embassy = state.embassy;
  const [player, encounter] = pickedList(state).slice(-2);
  if (!embassy || !player || !encounter || !embassy.players.includes(player) || !embassy.encounter.includes(encounter)) return state;
  if (embassy.pairs.some((pair) => pair.player === player || pair.encounter === encounter)) return state;
  return { ...state, embassy: { ...embassy, pairs: [...embassy.pairs, { player, encounter }] } };
}

/** EmbassyNext: the next pair becomes the pair the effect is on, its player card and then its encounter card picked; nothing is picked ("") when the pairs are done. */
export function embassyNext(state: ScenarioState): ScenarioState {
  const embassy = state.embassy;
  const pair = embassy?.pairs[embassy.at];
  if (!embassy || !pair) return pushPicked(state, "");
  return pushPicked(pushPicked({ ...state, embassy: { ...embassy, at: embassy.at + 1 } }, pair.player), pair.encounter);
}

/** EmbassyDiscard: the current pair is discarded, the player card to its owner's discard pile, the encounter card to the encounter discard pile. */
export function embassyDiscard(state: ScenarioState): ScenarioState {
  const pair = currentPair(state);
  const player = pair ? state.cards[pair.player] : undefined;
  if (!pair || !player) return state;
  const owner = player.owner ?? player.controller;
  const gone = owner != null ? moveCard(state, pair.player, { zone: "discard", seat: owner }) : state;
  return updateCard(moveCard(gone, pair.encounter, { zone: "encounterDiscard" }), pair.encounter, { face: "up", controller: null });
}

/** EmbassyReveal: the first player reveals the current pair's encounter card. */
export function embassyReveal(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const pair = currentPair(state);
  if (!pair || state.cards[pair.encounter]?.zone !== "setAside") return state;
  return startReveal(state, state.firstPlayer, ctx, steps, pair.encounter);
}

/** EmbassyEnd: an encounter card of the row never paired goes back on top of the encounter deck in the order it was placed; the Embassy is forgotten. */
export function embassyEnd(state: ScenarioState): ScenarioState {
  const embassy = state.embassy;
  if (!embassy) return state;
  const paired = new Set(embassy.pairs.map((pair) => pair.encounter));
  const back = embassy.encounter.filter((id) => !paired.has(id) && state.cards[id]?.zone === "setAside");
  let next = state;
  for (const id of back) next = moveCard(next, id, { zone: "encounterDeck" });
  next = { ...next, encounterDeck: [...back, ...next.encounterDeck.filter((id) => !back.includes(id))] };
  // A player card of the row never paired returns to the top of its owner's deck (never happens with four cards each).
  for (const id of [...embassy.players].reverse()) {
    const card = next.cards[id];
    const seat = card?.owner ?? card?.controller;
    if (!card || seat == null || card.zone !== "setAside" || embassy.pairs.some((pair) => pair.player === id)) continue;
    const moved = moveCard(next, id, { zone: "deck", seat });
    const pile = moved.seats[seat];
    next = pile ? withSeat(moved, seat, { ...pile, deck: [id, ...pile.deck.filter((entry) => entry !== id)] }) : moved;
  }
  const { embassy: _done, ...rest } = next;
  return rest;
}

/** The condition `embassy`: `pair`, the effect is on a pair; `playable`, its player card can be played at no cost by its owner now. */
export function embassyHolds(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  if (condition.kind !== "embassy") return null;
  const pair = currentPair(state);
  if (!pair) return false;
  if (condition.is === "pair") return true;
  const player = state.cards[pair.player];
  return player?.controller != null && canPlayFree(state, pair.player, player.controller, ctx);
}

export type EmbassyInstruction = Extract<Instruction, { verb: "EmbassyDeal" | "EmbassyPair" | "EmbassyNext" | "EmbassyDiscard" | "EmbassyReveal" | "EmbassyEnd" }>;

/** The family's verbs. */
export function runEmbassy(state: ScenarioState, instruction: EmbassyInstruction, _focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  switch (instruction.verb) {
    case "EmbassyDeal":
      return embassyDeal(state, instruction.cards);
    case "EmbassyPair":
      return embassyPair(state);
    case "EmbassyNext":
      return embassyNext(state);
    case "EmbassyDiscard":
      return embassyDiscard(state);
    case "EmbassyReveal":
      return embassyReveal(state, ctx, steps);
    case "EmbassyEnd":
      return embassyEnd(state);
  }
}
