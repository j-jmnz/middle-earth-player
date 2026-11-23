// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.explored (data/rules/entries.json). The Rules Reference in data/rules has no
// contract span; this follows The Burglar's Turn (22024): a player's loot deck of 14 attachments chosen from their collection at Setup
// (the side deck supplies the candidates: StartSeat.loot, one of each title; with more than 14 the player leaves the rest out), set
// facedown under the contract, whose top card is attached faceup to a location
// the players travel to as a guarded objective: out of play, under the location, still the player's card, until the location is
// explored and the player puts it into play or adds it to their hand.
import type { Instruction } from "../../../catalog/boundary.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

// BuildLootDeck: the seat's loot deck is made from the cards it chose, shuffled together and set aside under the contract. With more
// candidates than the deck's size ("Choose 14", 22024:A:2), the player leaves one out at a time, asked again with the answer
// (`focus.chosen`), until the size is left; the cards left out are out of the game. The options are in code order, so the choice
// shows nothing of the shuffle.
export function buildLootDeck(state: ScenarioState, instruction: Extract<Instruction, { verb: "BuildLootDeck" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const built = (state.lootDecks?.[focus.seat]?.length ?? 0) > 0;
  const next = built ? state : dealLootDeck(state, focus.seat);
  const deck = next.lootDecks?.[focus.seat] ?? [];
  if (deck.length <= instruction.size) return next;
  if (focus.chosen != null && deck.includes(focus.chosen)) {
    const left = withLootDeck(moveCard(next, focus.chosen, { zone: "removed" }), focus.seat, deck.filter((id) => id !== focus.chosen));
    return buildLootDeck(left, instruction, { ...focus, chosen: undefined }, steps);
  }
  // Nobody to ask (no effect frame): the first cards of the shuffled deck are kept.
  const data = topFrame(next)?.data;
  if (data?.kind !== "effect") return withLootDeck(next, focus.seat, deck.slice(0, instruction.size));
  const options = [...deck].sort((a, b) => (next.cards[a]?.code ?? "").localeCompare(next.cards[b]?.code ?? "") || a.localeCompare(b));
  // The target wait askTarget opens (windows/choices.ts), built here: that module reads the family list this family is part of.
  const item = { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) };
  const waiting = patchTop(next, { data: { ...data, wait: { kind: "target", item } } });
  return { ...waiting, window: { kind: "choose", seat: focus.seat, options }, activeSeat: focus.seat, passed: [] };
}

// The seat's loot deck as these card ids, the other seats' as they are.
function withLootDeck(state: ScenarioState, seat: number, ids: readonly string[]): ScenarioState {
  const decks = Array.from({ length: state.seatCount }, (_, at) => (at === seat ? [...ids] : [...(state.lootDecks?.[at] ?? [])]));
  return { ...state, lootDecks: decks };
}

// Every card the seat chose, made and shuffled into its loot deck, set aside.
function dealLootDeck(state: ScenarioState, seat: number): ScenarioState {
  const codes = state.lootPlan?.[seat] ?? [];
  if (codes.length === 0) return state;
  const focus = { seat };
  let next = state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, { zone: "setAside" });
    next = updateCard(made.state, made.id, { owner: focus.seat, controller: focus.seat });
    ids.push(made.id);
  }
  const shuffled = shuffleIds(ids, next.seed, next.seedCursor);
  return withLootDeck({ ...next, seedCursor: shuffled.cursor }, focus.seat, shuffled.ids);
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

// The loot guarding a card and the attachments on it are read by the core too (the explored event, the pick filters): core/attached.ts.
export { lootUnder } from "../../core/attached.ts";
