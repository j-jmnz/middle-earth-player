// Rules: mec109.campaign-mode, ltp.scoring, rr.winning-the-game, rr.player-elimination, sotm.escape-test (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { runOf } from "../../runs.ts";
import { completedRounds, scoreOf } from "../../score.ts";
import { ENGINE_VERSION } from "../../../rules/engine/version.ts";
import { resolutionResult } from "../../../rules/setup/resolution.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { deadmarshesWorld } from "../../../../test/scenarios/the-dead-marshes/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import type { SuiteWorld } from "../../../../test/harness/golden-suite.ts";
import { isPlayable } from "../../playable.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const deadmarshes = loadAnyScenario("the-dead-marshes");

// The Dead Marshes in the shadows-of-mirkwood cycle (part 5). A cycle has no Campaign Mode: the scenario has no campaign card, no log, no XP and no next part, and is played standalone only. It stands in place of a campaign test:
// no Campaign Setup Checklist and no earlier part; a win is scored (src/campaign/score.ts) and recorded as a run, with nothing earned, and a loss keeps its reason. The games are the goldens' (goldenState), not played again.
let world: SuiteWorld;
beforeAll(async () => {
  world = await deadmarshesWorld("strong");
});

const run = (state: ScenarioState, heroes: readonly (readonly string[])[]) => runOf({ id: "run-1", kind: "standalone", refId: "game-1", campaignId: null, box: cycle.id, state, cards: world.cards, heroes, reward: null, startedAt: 100, endedAt: 200, activeMs: null, engineVersion: ENGINE_VERSION });

describe("The Dead Marshes in the shadows-of-mirkwood cycle", () => {
  it("is part 5 of the cycle, has no campaign card and is playable", () => {
    expect(cycle.kind).toBe("cycle");
    expect(cycle.scenarios.indexOf(deadmarshes.id)).toBe(4);
    expect(deadmarshes.campaignCard).toBeUndefined();
    expect(isPlayable(deadmarshes.id)).toBe(true);
  });

  it("deals standalone with nothing from a campaign: no campaign card on the table, no Resolution to follow on a win", () => {
    const state = goldenState(deadmarshes.id, "solo win");
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
    expect(state.resolutionLog.earned).toEqual([]);
    expect(state.resolutionLog.xp).toBeUndefined();
  });

  it("scores a win and records it as a standalone run with nothing earned", () => {
    for (const name of ["solo win", "two-handed win", "Easy solo win", "Nightmare two-handed win"]) {
      const state = goldenState(deadmarshes.id, name);
      expect(resolutionResult(state), name).toEqual({ earned: [], fallen: [], captives: [] });
      const score = scoreOf(state, world.cards);
      expect(score.rounds, name).toBe(completedRounds(state));
      const record = run(state, [["q1", "q2", "q3"]]);
      expect(record, name).toMatchObject({ result: "won", lossCause: null, rounds: score.rounds, score: score.score, reward: null, scenarioId: deadmarshes.id, seatCount: state.seatCount });
    }
  });

  it("keeps the reason of a loss in its run record: no score, nothing earned", () => {
    const reasons: Readonly<Record<string, string>> = {
      "solo loss: threat 50": "No seats remain",
      "solo loss: every hero destroyed": "No seats remain",
      "Nightmare two-handed loss: every hero destroyed": "No seats remain",
    };
    for (const [name, reason] of Object.entries(reasons)) {
      const state = goldenState(deadmarshes.id, name);
      expect(state.lost, name).toBe(true);
      expect(state.lossReason, name).toContain(reason);
      expect(resolutionResult(state), name).toBeNull();
      expect(run(state, [["q1", "q2", "q3"]]), name).toMatchObject({ result: "lost", lossCause: state.lossReason, score: null, reward: null });
    }
  });

  it("deals its Nightmare deck on Nightmare, and a Nightmare win ends on stage 2B, its test passed", () => {
    const state = goldenState(deadmarshes.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === deadmarshes.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("02106");
  });
});
