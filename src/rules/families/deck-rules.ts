// Rules: rr.in-play-and-out-of-play, rr.lasting-effects, rr.action, rr.doomed-x (data/rules/entries.json).
//
// Small rules of the deck family that the engine reads where cards move or are played; this module imports almost nothing,
// so keywords.ts, actions.ts and effect-frames.ts can call it.
import type { Condition, Effect } from "../../catalog/boundary.ts";

import type { PrintedCard } from "../printed.ts";
import type { CardInstance, EffectData, ScenarioState } from "../state.ts";
import { inPlay, modifierActive } from "../state.ts";
import type { Destination } from "../zones.ts";

/** Where an ally that leaves play goes while a lasting effect says it goes to its owner's hand instead of the discard pile
 * ("Until the end of the phase, add each ally that leaves play to its owner's hand", Rallying Cry 10003), or null. */
export function alliesToHandDestination(state: ScenarioState, instance: CardInstance, printed: PrintedCard): Destination | null {
  if (printed.type !== "ally" || !inPlay(instance.zone)) return null;
  const seat = instance.owner ?? instance.controller;
  if (seat == null || state.seats[seat]?.eliminated) return null;
  const held = state.modifiers.some((modifier) => modifier.stat === "alliesToHand" && modifier.amount > 0 && modifierActive(state, modifier));
  return held ? { zone: "hand", seat } : null;
}

function namesHand(condition: Condition | undefined): boolean {
  if (!condition) return false;
  if (condition.kind === "sourceIn") return condition.zone === "hand";
  if (condition.kind === "all") return condition.conditions.some((inner) => inner.kind === "sourceIn" && inner.zone === "hand");
  return false;
}

/** An Action its player uses from the hand: its condition asks that the source be in the hand ("Discard the top 3 cards of
 * your deck to put Emery into play from your hand"). */
export function usedFromHand(effect: Effect): boolean {
  return effect.timing === "action" && namesHand(effect.condition);
}

/** The seat whose deck holds the cards the effect looked at, for ArrangeTop on another player's deck (Gandalf's Search). */
export function lookedDeckSeat(state: ScenarioState, data: EffectData | undefined): number | null {
  const id = (data?.looked ?? []).find((entry) => state.cards[entry]?.zone === "deck");
  return id ? (state.cards[id]?.controller ?? null) : null;
}

/** The Doomed value the event raises each player's threat by, with the seat's next-Doomed reduction spent on it
 * (ReduceNextDoomed: "Reduce the X value of the next Doomed X event you play this phase by 2"). */
export function doomedRaise(state: ScenarioState, seat: number, printed: PrintedCard): { state: ScenarioState; amount: number } {
  const doomed = printed.keywords.doomed ?? 0;
  if (doomed <= 0 || printed.type !== "event") return { state, amount: doomed };
  const holder = `seat:${seat}`;
  const at = state.modifiers.findIndex((modifier) => modifier.stat === "doomedReduction" && modifier.instanceId === holder && modifierActive(state, modifier));
  const reduction = state.modifiers[at];
  if (!reduction) return { state, amount: doomed };
  return { state: { ...state, modifiers: state.modifiers.filter((_, index) => index !== at) }, amount: Math.max(0, doomed - reduction.amount) };
}
