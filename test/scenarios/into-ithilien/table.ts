// Test helpers for the Into Ithilien tests (src/campaign/scenarios/into-ithilien/lines.test.ts): a table of the scenario, a card leaving play, and a quest phase played to its end.
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { destroyCard } from "../../../src/rules/core/keywords.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { legalIntents, type PlayerIntent } from "../../../src/rules/engine/reduce.ts";

import { idOf, send, start, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

export const SCENARIO = "into-ithilien";
export const CODES = {
  celador: "05025",
  guardian: "05026",
  company: "05027",
  road: "05028",
  spider: "05049",
  mercenaries: "05052",
  battle: "05068",
  siege: "05069",
  hiddenWay: "05070",
  approaching: "05071",
} as const;

export const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout);

/** The card leaves play (destroyed or discarded) and every Forced effect that hears it resolves. */
export function leaves(made: LayoutTable, code: string, state: ScenarioState = made.state): ScenarioState {
  const steps: EngineStep[] = [];
  return settle(destroyCard({ ...state, window: null }, idOf(state, code), made.ctx.cards, steps), made.ctx, steps);
}

/** The Quest phase of the table: each seat in turn commits its first `heroes` heroes and the windows are passed until the phase is over; the steps hold what the quest compared. */
export function questPhase(made: LayoutTable, heroes = 1): Run {
  let run = start(made.state);
  // Each seat commits once, then passes; the windows that follow are passed until the quest has resolved.
  for (let guard = 0; guard < 4 && run.state.mode === "questCommit" && run.state.window?.kind === "pass"; guard += 1) {
    run = send(run, { type: "Commit", cardIds: (run.state.seats[run.state.activeSeat]?.heroes ?? []).slice(0, heroes) }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
  }
  for (let guard = 0; guard < 40 && run.state.phase === "Quest" && !run.state.lost && !run.state.stageCleared; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}
