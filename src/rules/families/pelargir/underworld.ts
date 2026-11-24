// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear-underworld-deck, rr.in-play-and-out-of-play, rr.reveal (data/rules/entries.json); ledger lines 06011:A:1, 06013:B:1, 06018:A:2, 06022:A:1, 06023:A:2.
// The underworld deck of The Steward's Fear: set-aside cards that hold `stackedAt` (0 for the top), facedown, out of play, apart from the encounter deck. It is built by the Setup, the top cards are stacked under a location that enters play (Underworld X), the top card is revealed by
// Unwelcome Discovery, and the deck is shuffled into the encounter deck at stage 3. No card of the deck is dealt a shadow card, searched or shuffled before that. Hidden information: no EngineStep names a card of the deck, and the table lists the cards as facedown (AsideSecret in the family manifest).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { resolveAmount, frameScope } from "../../interpret/amounts.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The cards of the underworld deck, the top one first: the set-aside cards that hold a place in the stack. */
export function underworldDeck(state: ScenarioState): string[] {
  return state.setAside
    .filter((id) => state.cards[id]?.stackedAt != null)
    .sort((left, right) => (state.cards[left]?.stackedAt ?? 0) - (state.cards[right]?.stackedAt ?? 0));
}

/** A card that leaves the deck loses its place in it. */
function leaveDeck(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const { stackedAt: _gone, ...kept } = card;
  return { ...state, cards: { ...state.cards, [id]: kept } };
}

/** The set-aside cards with one of these codes, in id order, so one seed always rolls the same cards. */
function setAsideWith(state: ScenarioState, codes: readonly string[]): string[] {
  return state.setAside.filter((id) => codes.includes(state.cards[id]?.code ?? "") && state.cards[id]?.stackedAt == null).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/** BuildUnderworldDeck: the set-aside cards with these codes are shuffled with the game's seed and lie facedown as the underworld deck, the first one on top. */
export function buildUnderworldDeck(state: ScenarioState, instruction: Verb<"BuildUnderworldDeck">): ScenarioState {
  const set = setAsideWith(state, instruction.codes);
  if (set.length === 0) return state;
  const rolled = shuffleIds(set, state.seed, state.seedCursor);
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  rolled.ids.forEach((id, place) => {
    next = updateCard(next, id, { face: "down", controller: null, stackedAt: place });
  });
  return next;
}

/** HideOneAside: one of the set-aside cards with these codes, picked with the game's seed, stays set aside facedown; the others leave the game unseen. */
export function hideOneAside(state: ScenarioState, instruction: Verb<"HideOneAside">): ScenarioState {
  const set = setAsideWith(state, instruction.codes);
  if (set.length === 0) return state;
  const rolled = shuffleIds(set, state.seed, state.seedCursor);
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  for (const id of set) next = id === rolled.ids[0] ? updateCard(next, id, { face: "down", controller: null }) : updateCard(moveCard(next, id, { zone: "removed" }), id, { face: "down", controller: null });
  return next;
}

/** TakeUnderworld: the top cards of the deck go facedown under the host. A host that is not in play, or an empty deck, takes nothing; fewer cards than the amount: what remains. */
export function takeUnderworld(state: ScenarioState, instruction: Verb<"TakeUnderworld">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = instruction.host === "self" ? focus.sourceId : state.activeLocation;
  const host = hostId ? state.cards[hostId] : undefined;
  if (!host || (host.zone !== "staging" && host.zone !== "activeLocation" && host.zone !== "secondActiveLocation")) return state;
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (const id of underworldDeck(state).slice(0, Math.max(0, amount))) next = updateCard(leaveDeck(moveCard(next, id, { zone: "under", locationId: host.id }), id), id, { face: "down", controller: null });
  return next;
}

/** RevealUnderworld: the top card is revealed in full and added to the staging area, or put in the encounter discard pile when it has the Trait named (a Clue). */
export function revealUnderworld(state: ScenarioState, instruction: Verb<"RevealUnderworld">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = underworldDeck(state)[0];
  const card = top ? state.cards[top] : undefined;
  if (!top || !card) return state;
  const left = leaveDeck(state, top);
  if (instruction.discardTrait != null && printedOf(ctx.cards, card.code).traits.includes(instruction.discardTrait)) return updateCard(moveCard(left, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
  return startReveal(left, focus.seat, ctx, steps, top);
}

/** ShuffleUnderworldIntoEncounterDeck: every card of the deck joins the encounter deck facedown, and the deck is shuffled. */
export function shuffleUnderworldIntoEncounterDeck(state: ScenarioState): ScenarioState {
  let next = state;
  for (const id of underworldDeck(state)) next = updateCard(leaveDeck(moveCard(next, id, { zone: "encounterDeck" }), id), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}
