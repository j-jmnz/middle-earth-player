// Rules: rr.engaged, rr.optional-engagement, rr.triggering-condition (data/rules/entries.json).
//
// Engagements the attack family remembers or announces: a seat that engaged an enemy this round (the `engagedThisRound`
// condition, "If you have not engaged an enemy this round", 08056:A:2), and an optional engagement ("After you optionally engage
// an enemy", 145012:A:3). Both only in a game with a card that reads them, so a game without one is unchanged.
import type { GameEvent } from "../../windows/frame-types.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";
import { gameReads } from "../../core/game-reads.ts";

// Whether some card in the game hears this trigger: the attack family's own events are queued only then (attackDamaged,
// attackDestroyedEngaged, attacked).
export function heard(state: ScenarioState, ctx: ReduceContext, trigger: string): boolean {
  return gameReads(state, ctx, `"trigger":"${trigger}"`);
}

// Whether a declared player attack waits before its strength is read: when a card in the game answers "is declared as an
// attacker", or reads whether a card is attacking (a constant settle rebuilds, "While Aragorn is attacking").
export function strikeWaits(state: ScenarioState, ctx: ReduceContext): boolean {
  return heard(state, ctx, "declaredAttacker") || heard(state, ctx, "enemyAttacked") || gameReads(state, ctx, '"attacking"');
}

// A drained `engaged` event marks its seat until the end of the round (an endOfRound modifier on "seat:N").
export function noteEngaged(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ScenarioState {
  // The enemy engaged a player this round, for the `engagedThisRound` filter of a pick (a Shadow card, 142026:A:3).
  if (event.trigger === "engaged" && event.subject && heldAmount(state, event.subject, "engagedThisRound") <= 0 && gameReads(state, ctx, '"engagedThisRound":true')) {
    return noteEngagedSeat({ ...state, modifiers: [...state.modifiers, { instanceId: event.subject, sourceId: event.subject, stat: "engagedThisRound", amount: 1, until: "endOfRound" }] }, event, ctx);
  }
  return noteEngagedSeat(state, event, ctx);
}

function noteEngagedSeat(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ScenarioState {
  if (event.trigger !== "engaged" || event.seat == null || engagedThisRound(state, event.seat)) return state;
  if (!gameReads(state, ctx, '"kind":"engagedThisRound"')) return state;
  const holder = `seat:${event.seat}`;
  return { ...state, modifiers: [...state.modifiers, { instanceId: holder, sourceId: holder, stat: "engagedThisRound", amount: 1, until: "endOfRound" }] };
}

export function engagedThisRound(state: ScenarioState, seat: number): boolean {
  return heldAmount(state, `seat:${seat}`, "engagedThisRound") > 0;
}
