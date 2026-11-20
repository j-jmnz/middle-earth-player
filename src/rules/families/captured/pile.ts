// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines of Escape from Mount Gram (10038 to 10053, 10174, 10175).
//
// Captured cards. A card is captured by being put facedown underneath another card (its host) or, in a player's captured deck, nowhere: both are the zone `captured`, out of play, controlled by nobody, each still owned
// (`CardInstance.owner`). A seat's captured deck is `Seat.captured`, top card first; the cards under a host are the cards of the zone with that host, in id order (the rules give them no order). A hero captured keeps `heroSlot`, so a
// rescued card knows it is a hero. The state holds nothing for a game with no captured card.
import type { ScenarioState } from "../../core/state.ts";
import { updateCard, withSeat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { announceAllyLeft } from "../../core/ally-left.ts";
import type { PrintedCard } from "../../core/printed.ts";

// The cards captured underneath the host, in id order.
export function capturedUnder(state: ScenarioState, hostId: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.zone === "captured" && card.host === hostId)
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((card) => card.id);
}

// The seat's captured deck, top card first.
export function capturedDeck(state: ScenarioState, seat: number): readonly string[] {
  return state.seats[seat]?.captured ?? [];
}

// A card captured underneath a host: out of play, with its tokens and attachments gone (moveCard). A hero keeps its place among its owner's heroes (`heroSlot`) and so is known as a hero when it is rescued.
export function captureCard(state: ScenarioState, id: string, hostId: string): ScenarioState {
  const card = state.cards[id];
  const host = state.cards[hostId];
  if (!card || !host || id === hostId) return state;
  const owner = card.owner ?? card.controller;
  const hero = card.zone === "heroes" && owner != null ? { heroSlot: state.seats[owner]?.heroes.indexOf(id) ?? 0 } : {};
  return updateCard(moveCard(state, id, { zone: "captured", hostId, ...(owner != null ? { seat: owner } : {}) }), id, hero);
}

// An ally in play captured underneath a host leaves play, and is announced (core/ally-left.ts).
export function captureAlly(state: ScenarioState, id: string, hostId: string, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  const card = state.cards[id];
  const captured = captureCard(state, id, hostId);
  return card && captured !== state ? announceAllyLeft(captured, card, cards) : captured;
}

// The seat's captured deck in the order given.
export function setCapturedDeck(state: ScenarioState, seat: number, ids: readonly string[]): ScenarioState {
  const owner = state.seats[seat];
  return owner ? withSeat(state, seat, { ...owner, captured: ids }) : state;
}

// The seat captures the top (or bottom) `amount` cards of its captured deck underneath the host: fewer when the deck is shorter, none when it is empty (mec108.capture-x).
export function captureFromDeck(state: ScenarioState, seat: number, hostId: string, amount: number, end: "top" | "bottom" = "top"): ScenarioState {
  const deck = capturedDeck(state, seat);
  const taken = end === "top" ? deck.slice(0, amount) : deck.slice(Math.max(0, deck.length - amount));
  return taken.reduce((current, id) => captureCard(current, id, hostId), state);
}

// A captured card that is a hero.
export function isCapturedHero(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  return card?.zone === "captured" && card.heroSlot != null;
}

// Every host that holds captured cards and the cards under it, in id order. A state is never changed once the reducer returns it, so the map is kept for the state: the table asks for it once for each card it draws.
const BY_HOST = new WeakMap<ScenarioState, ReadonlyMap<string, readonly string[]>>();
export function capturedByHost(state: ScenarioState): ReadonlyMap<string, readonly string[]> {
  const kept = BY_HOST.get(state);
  if (kept) return kept;
  const held = new Map<string, string[]>();
  if (state.capture != null) {
    for (const card of Object.values(state.cards)) {
      if (card.zone !== "captured" || card.host == null) continue;
      held.set(card.host, [...(held.get(card.host) ?? []), card.id]);
    }
    for (const ids of held.values()) ids.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }
  BY_HOST.set(state, held);
  return held;
}
