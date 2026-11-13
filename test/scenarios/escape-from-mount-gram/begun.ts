import { emptyLog } from "../../../src/campaign/log.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { gramLoadout, gramStart } from "./game.ts";

// Test helper. A game of Escape from Mount Gram begun from the campaign (the Setup of the quest card and of the campaign card, stage 2A of each player revealed) and left at the first window the players answer: the mulligans are kept and each player's starting hero is the first of
// their heroes. Heroes q1 to q6 and the deck (`gramLoadout`) are the stand-ins of `gramWorld`.

export function begin(ctx: ReduceContext, seats: 1 | 2, seed = 7): ScenarioState {
  let state = startScenario(gramStart(seats, seed, "Normal", undefined, emptyLog(seats), undefined, gramLoadout(seats)), ctx);
  state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  if (seats === 2) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  // Each player chooses the starting hero: the first of the heroes.
  for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
