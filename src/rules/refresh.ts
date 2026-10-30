// Rules: rr.refresh-phase, rr.step-7-3, ltp.phase-7-refresh (data/rules/entries.json).
import { ruleCause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { raiseThreat } from "./keywords.ts";
import { gameReads } from "./game-reads.ts";
import { queueEvent } from "./queue.ts";
import { fireForced } from "./triggers.ts";
import { flagged, livingSeats, updateCard, withMode, type ScenarioState } from "./state.ts";
import { inPlay } from "./zones.ts";

export function doRefresh(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  // A Response to "After a character readies during the refresh phase" (02102:A:1) hears each card that readies here.
  const heard = gameReads(state, ctx, '"trigger":"readied"');
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone) || (!instance.exhausted && !instance.committed)) continue;
    // "Does not ready during the refresh phase" (a flag) leaves the card exhausted.
    // So does "cannot ready" (cannotReady, 900103:A:1).
    const stays = instance.exhausted && (flagged(state, instance.id, "doesNotReady") || flagged(state, instance.id, "cannotReady"));
    next = updateCard(next, instance.id, { exhausted: stays, committed: false });
    if (heard && instance.exhausted && !stays) next = queueEvent(next, { trigger: "readied", seat: instance.controller, cardId: instance.id, phase: "Refresh" });
  }
  for (const seat of livingSeats(next)) next = raiseThreat(next, seat, 1, steps, ruleCause("rr.step-7-3"));
  return withMode(passToken(next, ctx, steps), "endRound");
}

// The token moves to the next seat still in the game, then the event is announced to cards in play.
// Only this function announces it.
function passToken(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.seatCount === 1) return state;
  for (let step = 1; step <= state.seatCount; step += 1) {
    const index = (state.firstPlayer + step) % state.seatCount;
    if (state.seats[index]?.eliminated) continue;
    if (index === state.firstPlayer) return state;
    return fireForced({ ...state, firstPlayer: index }, { trigger: "firstPlayerTokenPassed", seat: index }, ctx, steps);
  }
  return state;
}
