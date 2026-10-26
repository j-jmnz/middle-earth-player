// Rules: rr.doomed-x, rr.destroy, rr.in-play-and-out-of-play, rr.triggering-condition (data/rules/entries.json).
//
// The small reads the shared engine files make into the play family: which events a trigger hears, the threat a seat is
// treated as having, and the events a doomed raise and a discard from play announce. Only state types and the event queue are
// imported here, so the lowest engine files (zones.ts, keywords.ts, listen.ts) can call it.
import type { Trigger } from "../../catalog/boundary.ts";

import type { Cause } from "../cause.ts";
import { queueEvent } from "../queue.ts";
import type { CardInstance, ScenarioState } from "../state.ts";
import { modifierActive } from "../state.ts";

// Whether an effect's trigger hears an event: its own trigger, or either half of "enters or leaves play" (Gwaihir, 22108:A:3).
export function triggerHears(trigger: Trigger | undefined, heard: Trigger): boolean {
  return trigger === heard || (trigger === "enteredOrLeftPlay" && (heard === "enteredPlay" || heard === "leftPlay"));
}

// The threat a seat is treated as having: its dial, or less while a `threatCeiling` it holds is lower ("Until the end of the
// phase, if your threat is higher than 20, treat your threat as if it is 20", 12011:A:2). The dial itself does not move.
export function seatThreat(state: ScenarioState, seat: number): number {
  const threat = state.seats[seat]?.threat ?? 0;
  let ceiling = threat;
  for (const modifier of state.modifiers) {
    if (modifier.stat === "threatCeiling" && modifier.instanceId === `seat:${seat}` && modifierActive(state, modifier)) ceiling = Math.min(ceiling, modifier.amount);
  }
  return ceiling;
}

// A threat raise the doomed keyword caused is announced to "After a player raises his threat from the doomed keyword"
// (22057:A:2).
export function doomedRaised(state: ScenarioState, seat: number, cause: Cause): ScenarioState {
  return !state.lost && "rule" in cause && cause.rule === "rr.doomed-x" ? queueEvent(state, { trigger: "doomedRaised", seat }) : state;
}

// A player card that was in play and is now in its owner's discard pile, not destroyed by damage, was discarded from play by
// a card effect ("After a Rohan ally is discarded from play by a card effect", 10141:A:1, 144007:A:1): a card destroyed is not
// discarded (rr.destroy). Every card hears it (the event's subject).
export function discardedFromPlay(state: ScenarioState, before: CardInstance, byDamage: boolean): ScenarioState {
  const after = state.cards[before.id];
  // A lost game is over: nothing answers any more.
  if (byDamage || state.lost || before.controller == null || after?.zone !== "discard" || (before.zone !== "play" && before.zone !== "heroes")) return state;
  return queueEvent(state, { trigger: "discardedFromPlay", seat: before.controller, subject: before.id });
}
