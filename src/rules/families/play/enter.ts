// Rules: rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.delayed-effects, rr.hit-points,
// rr.unique-cards (data/rules/entries.json).
//
// Cards put into play rather than played: the card's own ability from the hand ("put Brok Ironfist into play from your
// hand"), a hero back from the discard pile (Landroval), allies chosen from the hands ("Each player may put one ally card into
// play from his hand"), and what happens to them later ("At the end of the phase, return each of those allies that are still
// in play to their owners' hands").
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { askTarget } from "../../windows/choices.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { uniqueBlocked } from "../../core/keywords.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { entersExhausted } from "../../player/planning.ts";
import { seatOf } from "../../interpret/player-verbs.ts";
import { isAllyLike, printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { putAttachmentIntoPlay } from "../attachments/play.ts";
import { playBlocked } from "../sidequests/contract.ts";
import type { Focus } from "../index.ts";
import { lastPickedSeat, markPicked, namedCard, queueFront, scheduleFor } from "./refs.ts";

type PutIntoPlay = Extract<Instruction, { verb: "PutIntoPlay" }>;
type PutFromHand = Extract<Instruction, { verb: "PutIntoPlayFromHand" }>;
type Terms = Pick<PutIntoPlay, "exhausted" | "committed" | "damage" | "until" | "then">;

// The answer that stops a "may put up to N" choice.
export const NONE = "none";

// What the delayed effect does to the card, if it is still in play then.
function followUp(then: NonNullable<PutIntoPlay["then"]>): Instruction[] {
  const stillInPlay = { kind: "matches" as const, card: "picked" as const, inPlay: true };
  switch (then) {
    case "returnToHand":
      return [{ verb: "ReturnToHand", target: "picked" }];
    case "shuffleIntoDeck":
      return [{ verb: "PutOnDeck", position: "shuffle", target: "picked", when: stillInPlay }];
    case "discard":
      return [{ verb: "Discard", target: { kind: "picked" }, when: stillInPlay }];
  }
}

// Whether a card out of play can be put into play now: a hero or an ally, and no copy of a unique card is in play already.
export function canEnter(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card || inPlay(card.zone)) return false;
  const printed = printedOf(ctx.cards, card.code);
  return (printed.type === "hero" || isAllyLike(printed)) && !uniqueBlocked(state, printed, ctx.cards) && !playBlocked(state, id, card.controller ?? card.owner ?? state.firstPlayer, ctx, true);
}

// The card enters play under `seat`: among the heroes for a hero, in the play area otherwise. It is not played (no "played"
// event); it enters play ("enteredPlay"), ready unless it enters exhausted, and stays its owner's card.
export function enterPlay(state: ScenarioState, id: string, seat: number, terms: Terms, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !canEnter(state, id, ctx) || state.seats[seat]?.eliminated) return state;
  const owner = card.owner ?? card.controller ?? seat;
  const printed = printedOf(ctx.cards, card.code);
  let next = moveCard(state, id, { zone: printed.type === "hero" ? "heroes" : "play", seat });
  next = updateCard(next, id, { exhausted: terms.exhausted === true || entersExhausted(ctx, card.code), committed: terms.committed === true, owner: owner !== seat ? owner : undefined });
  if (terms.damage) {
    next = updateCard(next, id, { damage: terms.damage });
    steps.push({ kind: "damage", targetId: id, amount: terms.damage, cause: currentCause(steps, UNATTRIBUTED) });
  }
  next = queueEvent(next, { trigger: "enteredPlay", seat, cardId: id });
  if (terms.until && terms.then) next = scheduleFor(next, id, terms.until, followUp(terms.then), focus, currentCause(steps, UNATTRIBUTED));
  return next;
}

function termsOf(instruction: PutIntoPlay | PutFromHand): Terms {
  return {
    ...("exhausted" in instruction && instruction.exhausted ? { exhausted: true } : {}),
    ...("committed" in instruction && instruction.committed ? { committed: true } : {}),
    ...("damage" in instruction && instruction.damage ? { damage: instruction.damage } : {}),
    ...(instruction.until ? { until: instruction.until } : {}),
    ...(instruction.then ? { then: instruction.then } : {}),
  };
}

// The players a card may come under: every player still in the game.
function seatOptions(state: ScenarioState): string[] {
  return livingSeats(state).map((seat) => `seat:${seat}`);
}

// PutIntoPlay: the named card enters play under the actor, the picked player, its owner, or a player the actor chooses.
export function putIntoPlay(state: ScenarioState, instruction: PutIntoPlay, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = namedCard(state, instruction.card ?? "self", focus);
  const card = id ? state.cards[id] : undefined;
  // An attachment goes on a host, guarded first when it has Guarded (X) (families/attachments/play.ts).
  if (id && card && printedOf(ctx.cards, card.code).type === "attachment") return putAttachmentIntoPlay(state, instruction, id, focus, ctx, steps);
  if (!id || !card || !canEnter(state, id, ctx)) return state;
  let seat: number | null = focus.seat;
  if (instruction.who === "owner") seat = card.owner ?? card.controller ?? focus.seat;
  if (instruction.who === "picked") seat = lastPickedSeat(state);
  if (instruction.who === "choose") {
    const options = seatOptions(state);
    seat = focus.chosen ? seatOf(focus.chosen) : options.length === 1 ? seatOf(options[0] ?? "") : null;
    if (seat == null && !focus.chosen) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  }
  return seat == null ? state : enterPlay(state, id, seat, termsOf(instruction), focus, ctx, steps);
}

// The cards of the hands a PutIntoPlayFromHand chooses from that could enter play now, one per card title and hand.
function handOptions(state: ScenarioState, instruction: PutFromHand, chooser: number, focus: Focus, ctx: ReduceContext): string[] {
  const seats = instruction.from === "any" ? livingSeats(state) : [chooser];
  const seen = new Set<string>();
  const spec = { ...instruction.pick, from: "hand" as const };
  return seats
    .flatMap((seat) => state.seats[seat]?.hand ?? [])
    .filter((id) => id !== focus.sourceId && canEnter(state, id, ctx) && matchesPick(state, id, spec, { seat: chooser, sourceId: focus.sourceId }, ctx))
    .filter((id) => {
      const key = `${state.cards[id]?.code}:${state.cards[id]?.controller}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// PutIntoPlayFromHand: the chooser picks a card (or stops), names its controller when any player may control it, and it enters
// play; then the next, up to `upTo`.
export function putFromHand(state: ScenarioState, instruction: PutFromHand, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const chooser = instruction.from === "picked" ? lastPickedSeat(state) : focus.seat;
  if (chooser == null) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const terms = termsOf(instruction);
  const left = instruction.upTo ?? 1;
  const { card: _card, ...base } = instruction;
  // The card is chosen; its controller is the answer now.
  if (instruction.card) {
    const seat = focus.chosen ? seatOf(focus.chosen) : null;
    if (seat == null) return state;
    return enterThenNext(state, instruction.card, seat, base, left, terms, focus, ctx, steps);
  }
  if (focus.chosen === NONE) return state;
  const options = handOptions(state, instruction, chooser, focus, ctx);
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : null;
  if (!chosen) return askTarget(state, { instruction, seat: chooser, chosen: null, cause }, [...options, NONE]);
  const owner = state.cards[chosen]?.controller ?? chooser;
  const seats = seatOptions(state);
  if (instruction.anyController && seats.length > 1) return askTarget(state, { instruction: { ...base, card: chosen }, seat: chooser, chosen: null, cause }, seats);
  return enterThenNext(state, chosen, owner, base, left, terms, focus, ctx, steps);
}

function enterThenNext(state: ScenarioState, id: string, seat: number, base: Omit<PutFromHand, "card">, left: number, terms: Terms, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const entered = markPicked(enterPlay(state, id, seat, terms, focus, ctx, steps), id);
  if (left <= 1) return entered;
  return queueFront(entered, [{ instruction: { ...base, upTo: left - 1 }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }]);
}

// PlaceDamage: damage tokens on the card, none of it dealt ("enters play with 1 damage on it"). The sweep destroys a character
// whose damage reaches its hit points (rr.hit-points).
export function placeTokens(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceDamage" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const id = namedCard(state, instruction.card ?? "self", focus);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || !inPlay(card.zone)) return state;
  steps.push({ kind: "damage", targetId: id, amount: instruction.amount, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { damage: card.damage + instruction.amount });
}
