// Rules: rr.engaged, rr.optional-engagement, rr.triggering-condition (data/rules/entries.json).
//
// Engagements the attack family remembers or announces: a seat that engaged an enemy this round (the `engagedThisRound`
// condition, "If you have not engaged an enemy this round", 08056:A:2), and an optional engagement ("After you optionally engage
// an enemy", 145012:A:3). Both only in a game with a card that reads them, so a game without one is unchanged.
import type { GameEvent } from "../frame-types.ts";
import type { ReduceContext } from "../interpret.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { heldAmount } from "../state.ts";
import { gameReads } from "./costs-pay.ts";

// A drained `engaged` event marks its seat until the end of the round (an endOfRound modifier on "seat:N").
export function noteEngaged(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ScenarioState {
  if (event.trigger !== "engaged" || event.seat == null || engagedThisRound(state, event.seat)) return state;
  if (!gameReads(state, ctx, '"kind":"engagedThisRound"')) return state;
  const holder = `seat:${event.seat}`;
  return { ...state, modifiers: [...state.modifiers, { instanceId: holder, sourceId: holder, stat: "engagedThisRound", amount: 1, until: "endOfRound" }] };
}

export function engagedThisRound(state: ScenarioState, seat: number): boolean {
  return heldAmount(state, `seat:${seat}`, "engagedThisRound") > 0;
}

// The seat chose to engage the enemy in the encounter phase (rr.optional-engagement).
export function optionallyEngaged(state: ScenarioState, seat: number, enemyId: string, ctx: ReduceContext): ScenarioState {
  if (state.cards[enemyId]?.zone !== "engaged" || !gameReads(state, ctx, '"trigger":"optionallyEngaged"')) return state;
  return queueEvent(state, { trigger: "optionallyEngaged", seat, subject: enemyId });
}
