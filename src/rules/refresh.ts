// Rules: rr.refresh-phase, rr.step-7-3 (data/rules/entries.json).
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { raiseThreat } from "./keywords.ts";
import { fireForced } from "./triggers.ts";
import { livingSeats, updateCard, withMode, type ScenarioState } from "./state.ts";
import { inPlay } from "./zones.ts";

export function doRefresh(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone) || (!instance.exhausted && !instance.committed)) continue;
    next = updateCard(next, instance.id, { exhausted: false, committed: false });
  }
  for (const seat of livingSeats(next)) next = raiseThreat(next, seat, 1, steps);
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
