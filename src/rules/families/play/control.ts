// Rules: rr.ownership-and-control, rr.first-player, rr.doomed-x, rr.delayed-effects (data/rules/entries.json).
//
// Control changes: a card given to another player ("give control of Rider of the Mark to another player"), for a while
// ("Until the end of the phase, give control of that hero ... to another player"), or held by the first player ("The first
// player gains control of attached ally"); the first player token taken; the rest of an effect handed to another player.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { raiseThreat } from "../../core/keywords.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { sharing } from "../breaking/areas.ts";
import { eventSeat, lastPickedSeat, namedCard, scheduleFor } from "./refs.ts";

type ChangeControl = Extract<Instruction, { verb: "ChangeControl" }>;

// The card and every card attached to it in its controller's play area pass to `seat`, each where it was (a hero among the
// heroes) and in the same state, still its owner's card (rr.ownership-and-control). An encounter card attached to it stays the
// scenario's. `changedControl` is announced about the card.
export function giveControl(state: ScenarioState, id: string, seat: number): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone) || card.controller == null || card.controller === seat || state.seats[seat]?.eliminated) return state;
  if (card.zone !== "heroes" && card.zone !== "play") return state;
  const moving = [id, ...card.attachments.filter((other) => state.cards[other]?.zone === "play")];
  const owners = new Map(moving.map((other) => [other, state.cards[other]?.owner ?? state.cards[other]?.controller ?? seat]));
  let next = moveCard(state, id, { zone: card.zone, seat });
  if (card.host) next = attachTo(next, id, card.host);
  for (const other of moving.slice(1)) next = attachTo(moveCard(next, other, { zone: "play", seat }), other, id);
  // A claimed objective attached to the card (a Clue on Amarthiúl, 10110:A:1) is controlled by whoever controls its host.
  for (const other of card.attachments) if (state.cards[other]?.claimed === true && state.cards[other]?.zone === "attached") next = updateCard(next, other, { controller: seat });
  for (const [other, owner] of owners) next = updateCard(next, other, { owner: owner !== seat ? owner : undefined });
  return queueEvent(next, { trigger: "changedControl", seat, cardId: id });
}

function targetSeat(state: ScenarioState, to: ChangeControl["to"], focus: Focus): number | null {
  switch (to) {
    case "picked":
      return lastPickedSeat(state);
    case "eventSeat":
      return eventSeat(state);
    case "firstPlayer":
      return state.firstPlayer;
    case "actor":
      return focus.seat;
  }
}

// ChangeControl: with `until`, control goes back to the card's controller before the change at that time, if it is still in
// play (a delayed effect: rr.delayed-effects).
export function changeControl(state: ScenarioState, instruction: ChangeControl, focus: Focus, steps: EngineStep[]): ScenarioState {
  const id = namedCard(state, instruction.card ?? "self", focus);
  const seat = targetSeat(state, instruction.to, focus);
  const before = id ? state.cards[id]?.controller : null;
  if (!id || seat == null || before == null) return state;
  const given = giveControl(state, id, seat);
  if (given === state || !instruction.until) return given;
  const back: Instruction = { verb: "ChangeControl", card: "picked", to: "actor" };
  return scheduleFor(given, id, instruction.until, [back], { seat: before, sourceId: focus.sourceId }, currentCause(steps, UNATTRIBUTED));
}

// SwitchActor: the instructions still queued in the running effect are the picked player's.
export function switchActor(state: ScenarioState): ScenarioState {
  const seat = lastPickedSeat(state);
  const data = topFrame(state)?.data;
  if (seat == null || data?.kind !== "effect") return state;
  return patchTop(state, { data: { ...data, queue: data.queue.map((item) => ({ ...item, seat })) } });
}

// TakeFirstPlayer: the actor holds the first player token from now on.
export function takeFirstPlayer(state: ScenarioState, seat: number): ScenarioState {
  return state.seats[seat]?.eliminated || state.firstPlayer === seat ? state : { ...state, firstPlayer: seat };
}

// Doomed: each player raises their threat from the doomed keyword (rr.doomed-x).
export function doomed(state: ScenarioState, amount: number, steps: EngineStep[]): ScenarioState {
  let next = state;
  // The players sharing the acting seat's staging area when areas are joined (families/captured/).
  const seats = state.capture && state.separate && state.viewSeat != null ? sharing(state, state.viewSeat) : livingSeats(state);
  for (const seat of seats) next = raiseThreat(next, seat, amount, steps, ruleCause("rr.doomed-x"));
  return next;
}
