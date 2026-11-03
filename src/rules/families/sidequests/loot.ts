// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.explored (data/rules/entries.json). The Rules Reference in data/rules has no
// contract span; this follows The Burglar's Turn (22024): a player's loot deck of 14 attachments chosen from their collection (the
// deck builder supplies the codes: StartSeat.loot), set facedown under the contract, whose top card is attached faceup to a location
// the players travel to as a guarded objective: out of play, under the location, still the player's card, until the location is
// explored and the player puts it into play or adds it to their hand.
import { frameScope, refCard } from "../../interpret/amounts.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

// BuildLootDeck: the seat's loot deck is made from the 14 cards it chose, shuffled together and set aside under the contract.
export function buildLootDeck(state: ScenarioState, focus: Focus): ScenarioState {
  const codes = state.lootPlan?.[focus.seat] ?? [];
  if (codes.length === 0 || state.lootDecks?.[focus.seat]) return state;
  let next = state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, { zone: "setAside" });
    next = updateCard(made.state, made.id, { owner: focus.seat, controller: focus.seat });
    ids.push(made.id);
  }
  const shuffled = shuffleIds(ids, next.seed, next.seedCursor);
  const decks = Array.from({ length: next.seatCount }, (_, seat) => (seat === focus.seat ? shuffled.ids : (next.lootDecks?.[seat] ?? [])));
  return { ...next, seedCursor: shuffled.cursor, lootDecks: decks };
}

// AttachLoot: the top card of the actor's loot deck is attached faceup to the location the answered event is about, as a guarded
// objective (under it, out of play).
export function attachLoot(state: ScenarioState, focus: Focus): ScenarioState {
  const deck = state.lootDecks?.[focus.seat] ?? [];
  const top = deck[0];
  const location = refCard(state, "subject", frameScope(state, focus.seat, focus.sourceId));
  if (!top || !location || !state.cards[location]) return state;
  const moved = updateCard(moveCard(state, top, { zone: "under", locationId: location }), top, { face: "up", controller: focus.seat, owner: focus.seat });
  return { ...moved, lootDecks: (moved.lootDecks ?? []).map((ids, seat) => (seat === focus.seat ? ids.filter((id) => id !== top) : ids)) };
}

// The loot cards guarding this card: under it, still their player's (a card under Weather Hills has no controller).
export function lootUnder(state: ScenarioState, hostId: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.zone === "under" && card.host === hostId && card.controller != null)
    .map((card) => card.id);
}
