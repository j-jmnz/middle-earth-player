import { expect } from "vitest";

import { applyResolution, type CampaignLog } from "../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../src/campaign/wilderland.ts";
import type { PrintedCard } from "../../src/rules/core/printed.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../src/rules/setup/setup.ts";

import { goldenState } from "./golden-state.ts";

// Test helper. The two steps a later part's campaign test (src/campaign/scenarios/<id>/campaign.test.ts) repeats.

/** The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option. */
export function opened(start: StartScenario, ctx: ReduceContext): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

/** The Resolution is for a win only: the golden loss `name` of `scenarioId` is lost and not cleared, and writing it onto `log` (what finishing the game does) returns the log it was given. */
export function expectLossWritesNothing(log: CampaignLog, scenarioId: string, name: string, cards: ReadonlyMap<string, PrintedCard>): void {
  const state = goldenState(scenarioId, name);
  expect(state.lost).toBe(true);
  expect(state.stageCleared).toBe(false);
  expect(applyResolution(log, scenarioId, state, cards, NO_COPY_LIMITS)).toBe(log);
}
