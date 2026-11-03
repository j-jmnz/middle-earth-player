// Rules: rr.engaged, rr.in-play-and-out-of-play, rr.attachment-cards (data/rules/entries.json); ledger lines 01107:A:1, 01125:B:1.
//
// The Orc Guard of Escape from Dol Guldur: the top card of a player's deck, facedown, acts as an enemy engaged with that player with 1 hit
// point, 1 Attack and 1 Defense. The engine makes an enemy stand-in (printed.ts ORC_GUARD_CODE) engaged with the player and holds the
// deck card facedown under it. When the stand-in leaves play the deck card goes to its owner's discard pile, and the stand-in leaves the
// game, so no copy of it can ever be shuffled into a deck.
import type { EngineStep } from "../../intents.ts";
import { ORC_GUARD_CODE } from "../../printed.ts";
import { engageWith } from "../../quest.ts";
import type { ScenarioState } from "../../state.ts";
import { updateCard } from "../../state.ts";
import { cardsUnder, moveCard, spawn } from "../../zones.ts";

// PlaceOrcGuard: nothing happens when the seat's deck is empty (or the seat is out of the game).
export function placeOrcGuard(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  const top = state.seats[seat]?.deck[0];
  if (!top || state.seats[seat]?.eliminated) return state;
  const spawned = spawn(state, ORC_GUARD_CODE, { zone: "staging" });
  const held = updateCard(moveCard(spawned.state, top, { zone: "under", locationId: spawned.id }), top, { owner: seat });
  return engageWith(held, seat, spawned.id, steps);
}

// The Orc Guard stand-in has just left play (zones.ts moveCard): the card it is made of returns to its owner's discard pile and the
// stand-in leaves the game.
export function releaseOrcGuard(state: ScenarioState, guardId: string): ScenarioState {
  let next = state;
  for (const id of cardsUnder(state, guardId)) {
    const owner = next.cards[id]?.owner;
    const moved = moveCard(next, id, owner != null ? { zone: "discard", seat: owner } : { zone: "encounterDiscard" });
    next = updateCard(moved, id, { face: "up", owner: undefined });
  }
  return moveCard(next, guardId, { zone: "removed" });
}
