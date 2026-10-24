import type { EngineStep } from "./intents.ts";
import { raiseThreat } from "./keywords.ts";
import { livingSeats, updateCard, withMode, type ScenarioState } from "./state.ts";
import { inPlay } from "./zones.ts";

export function doRefresh(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone) || (!instance.exhausted && !instance.committed)) continue;
    next = updateCard(next, instance.id, { exhausted: false, committed: false });
  }
  for (const seat of livingSeats(next)) next = raiseThreat(next, seat, 1, steps);
  return withMode(passToken(next), "endRound");
}

function passToken(state: ScenarioState): ScenarioState {
  if (state.seatCount === 1) return state;
  for (let step = 1; step <= state.seatCount; step += 1) {
    const index = (state.firstPlayer + step) % state.seatCount;
    if (!state.seats[index]?.eliminated) return { ...state, firstPlayer: index };
  }
  return state;
}
