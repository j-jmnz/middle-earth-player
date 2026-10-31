// Rules: dcce.corsair-deck, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 11062:A:1, 110139:A:4, 110139:B:5. The card-specific
// verbs of the Dream-chaser's fleet and the Corsair Pirates: a random discard that pays in resources, and the Glórinaith's discard of "the top cards of any deck".
import type { Instruction } from "../../catalog/boundary.ts";

import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import { nextUint } from "../seed.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, updateCard } from "../state.ts";
import { topFrame, patchTop } from "../windows.ts";
import { moveCard } from "../zones.ts";
import { effectData } from "./encounter-moves.ts";
import type { Focus } from "./index.ts";

/** PlunderHand: a random card of the actor's hand is discarded, and the source gets resources equal to its printed cost. */
export function plunderHand(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hand = state.seats[focus.seat]?.hand ?? [];
  const id = hand.length === 0 ? undefined : hand[nextUint(state.seed, state.seedCursor) % hand.length];
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  const rolled = { ...state, seedCursor: state.seedCursor + 1 };
  const cost = printedOf(ctx.cards, card.code).cost ?? 0;
  const seat = card.owner ?? focus.seat;
  const discarded = queueEvent(moveCard(rolled, id, { zone: "discard", seat }), { trigger: "discardedFromHand", seat, cardId: id });
  const source = focus.sourceId ? discarded.cards[focus.sourceId] : undefined;
  return source && cost > 0 ? updateCard(discarded, source.id, { resources: source.resources + cost }) : discarded;
}

// A deck the actor may discard from, as an option id: "seat:N" for a player's deck, "encounter", "corsair". Only a deck that holds a card is offered.
function decks(state: ScenarioState): string[] {
  const found = livingSeats(state).filter((seat) => (state.seats[seat]?.deck.length ?? 0) > 0).map((seat) => `seat:${seat}`);
  if (state.encounterDeck.length > 0) found.push("encounter");
  if ((state.corsairDeck?.length ?? 0) > 0) found.push("corsair");
  return found;
}

function cardsOf(state: ScenarioState, deck: string): readonly string[] {
  if (deck === "encounter") return state.encounterDeck;
  if (deck === "corsair") return state.corsairDeck ?? [];
  const seat = /^seat:(\d+)$/.exec(deck);
  return seat ? (state.seats[Number(seat[1])]?.deck ?? []) : [];
}

const NAMED = "name:";

/** The title the running effect named (NameCard), or null. */
export function namedCard(state: ScenarioState): string | null {
  const picked = effectData(state)?.picked ?? [];
  const entry = picked.findLast((item) => item.startsWith(NAMED));
  return entry ? entry.slice(NAMED.length) : null;
}

/** NameCard: the titles of the cards in the decks, each once, are the choices; a title is recorded among the effect's picks. */
export function nameCard(state: ScenarioState, instruction: Extract<Instruction, { verb: "NameCard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const titles = [...new Set(decks(state).flatMap((deck) => cardsOf(state, deck).map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name)))].sort((left, right) => left.localeCompare(right));
  if (titles.length === 0) return state;
  const data = effectData(state);
  if (!data) return state;
  const options = titles.map((title) => `${NAMED}${title}`);
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  const frame = topFrame(state)?.data;
  return frame?.kind === "effect" ? patchTop(state, { data: { ...frame, picked: [...(frame.picked ?? []), chosen] } }) : state;
}

/** DiscardFromAnyDeck: the actor chooses a deck (one deck is taken without asking) and its top cards are discarded; X says whether the named card was among them. */
export function discardFromAnyDeck(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardFromAnyDeck" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const options = decks(state);
  if (options.length === 0) return state;
  const deck = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!deck) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : state;
  const named = namedCard(state);
  let next = state;
  let hit = false;
  const seat = /^seat:(\d+)$/.exec(deck) ? Number(/^seat:(\d+)$/.exec(deck)?.[1]) : null;
  for (const id of cardsOf(state, deck).slice(0, instruction.count)) {
    const card = next.cards[id];
    if (!card) continue;
    if (named != null && printedOf(ctx.cards, card.code).name === named) hit = true;
    if (seat != null) next = queueEvent(moveCard(next, id, { zone: "discard", seat }), { trigger: "discardedFromDeck", seat, cardId: id });
    else if (deck === "corsair") next = moveCard(next, id, { zone: "corsairDiscard" });
    else next = moveCard(next, id, { zone: "encounterDiscard" });
  }
  // The effect's X: 1 when the card named was discarded (110139:B:5, "2 damage instead").
  const frame = topFrame(next)?.data;
  return frame?.kind === "effect" && named != null ? patchTop(next, { data: { ...frame, x: hit ? 1 : 0 } }) : next;
}
