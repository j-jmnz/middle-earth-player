// Rules: rr.delayed-effects (data/rules/entries.json).
//
// What the play family's verbs read from the running effect: the card a verb names ("self", the last picked card, the
// answered event's card, the source's host), the last picked player, and the delayed effects it schedules for a card.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { Cause } from "../../core/cause.ts";
import { pickedList, seatOf } from "../../interpret/player-verbs.ts";
import type { DelayedEffect, QueueItem, ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";

export type CardName = "self" | "picked" | "subject" | "host";

// The last card the running effect picked, leaving out players ("seat:N") and empty picks.
export function lastPickedCard(state: ScenarioState): string | null {
  return [...pickedList(state)].reverse().find((entry) => entry !== "" && seatOf(entry) == null) ?? null;
}

// The last player the running effect picked.
export function lastPickedSeat(state: ScenarioState): number | null {
  for (const entry of [...pickedList(state)].reverse()) {
    const seat = seatOf(entry);
    if (seat != null) return seat;
  }
  return null;
}

// The card a verb of the family names, or null.
export function namedCard(state: ScenarioState, name: CardName, focus: Focus): string | null {
  const data = topFrame(state)?.data;
  switch (name) {
    case "self":
      return focus.sourceId;
    case "picked":
      return lastPickedCard(state);
    case "subject":
      return data?.kind === "effect" ? (data.subject ?? null) : null;
    case "host":
      return focus.sourceId ? (state.cards[focus.sourceId]?.host ?? null) : null;
  }
}

// The seat the answered event happened to.
export function eventSeat(state: ScenarioState): number | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.eventSeat ?? null) : null;
}

// Adds a card to the running effect's picks, so the instructions after it name it ("that ally").
export function markPicked(state: ScenarioState, id: string): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, picked: [...(data.picked ?? []), id] } }) : state;
}

// Puts instructions at the front of the running effect's queue.
export function queueFront(state: ScenarioState, items: readonly QueueItem[]): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, queue: [...items, ...data.queue] } }) : state;
}

// Schedules instructions to run on one card (picked in the delayed frame) when the current phase or round ends.
export function scheduleFor(state: ScenarioState, cardId: string, until: DelayedEffect["until"], instructions: readonly Instruction[], focus: Focus, cause: Cause): ScenarioState {
  const entry: DelayedEffect = {
    id: `d${state.delayed.length}:${state.round}`,
    until,
    sourceId: focus.sourceId,
    seat: focus.seat,
    phase: state.phase,
    instructions,
    uncancelable: null,
    cause,
    subjectId: cardId,
  };
  return { ...state, delayed: [...state.delayed, entry] };
}
