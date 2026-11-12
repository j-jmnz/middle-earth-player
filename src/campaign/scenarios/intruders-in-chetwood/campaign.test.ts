// Rules: mec108.campaign-setup-intruders-in-chetwood, mec108.setup-intruders-in-chetwood, mec108.campaign-log-tracking, ltp.campaign-setup-checklist, rr.winning-the-game (data/rules/entries.json); ledger lines 10156:A:2 and 10156:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../../rules/core/state.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { chetwoodStart, chetwoodWorld } from "../../../../test/scenarios/intruders-in-chetwood/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const chetwood = loadScenario("intruders-in-chetwood");
const IARION = "09016";
const PENDANT = "10157";
const PROTECT = "10158";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof chetwoodWorld>>;

beforeAll(async () => {
  world = await chetwoodWorld("strong");
  ctx = world.ctx;
}, 240_000);

const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The scenario dealt from a fresh campaign and its Setup played, the campaign card's questions answered in order by option (every other question takes its first option).
function opened(seats: 1 | 2, answers: readonly string[] = [], standalone = false): ScenarioState {
  let state = startScenario(chetwoodStart(seats, 1, "Normal", undefined, emptyLog(seats), undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  const queue = [...answers];
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) {
    // Stop the War Party's search for a location asks first (cards); an answer of the list is used only on the question it names.
    const option = queue[0] != null && state.window.options.includes(queue[0]) ? (queue.shift() ?? "") : (state.window.options[0] ?? "");
    state = expectOk(reduce(state, { type: "Choose", optionId: option }, ctx)).state;
  }
  return state;
}

// Intruders in Chetwood in the angmar-awakened campaign (part 1, campaign card 10156).
describe("Intruders in Chetwood in the angmar-awakened campaign", () => {
  it("is part 1 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(chetwood.id)).toBe(0);
    expect(chetwood.campaignCard).toBe("10156");
  });

  it("is playable, and the path offers it first on a fresh log, with the next part (The Weather Hills) playable too", () => {
    expect(PLAYABLE_SCENARIOS).toContain("intruders-in-chetwood");
    const path = campaignPath(campaign, {}, emptyLog(1));
    expect(path[0]).toMatchObject({ id: "intruders-in-chetwood", status: "current" });
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "intruders-in-chetwood" } });
    expect(PLAYABLE_SCENARIOS).toContain(campaign.scenarios[1]);
  });

  it("10156:A:2 deals the Campaign Setup: Protect the Innocent in the staging area, Iârion's Pendant on Iârion, and nothing dealt from the campaign card itself", () => {
    const state = opened(1, ["keep"]);
    const iarion = copies(state, IARION)[0]!;
    expect(iarion).toMatchObject({ zone: "play", controller: 0 });
    expect(copies(state, PENDANT).map((card) => [card.zone, card.host])).toEqual([["play", iarion.id]]);
    expect(copies(state, PROTECT).map((card) => [card.zone, card.damage])).toEqual([["staging", 0]]);
    expect(copies(state, "10156")).toHaveLength(0);
  });

  it("10156:A:2 asks each player in turn, the first player first, whether to place 4 damage on Protect the Innocent for 1 resource on each of their heroes", () => {
    const resources = (state: ScenarioState, seat: number) => state.seats[seat]?.heroes.map((id) => state.cards[id]?.resources ?? 0) ?? [];
    const neither = opened(2, ["keep", "keep"]);
    expect(copies(neither, PROTECT)[0]?.damage).toBe(0);
    const traded = opened(2, ["trade", "keep"]);
    expect(copies(traded, PROTECT)[0]?.damage).toBe(4);
    expect(resources(traded, 0)).toEqual(resources(neither, 0).map((count) => count + 1));
    expect(resources(traded, 1)).toEqual(resources(neither, 1));
    const both = opened(2, ["trade", "trade"]);
    expect(copies(both, PROTECT)[0]?.damage).toBe(8);
    expect(resources(both, 1)).toEqual(resources(neither, 1).map((count) => count + 1));
  });

  it("10156:A:2 deals the Pendant and Protect the Innocent only in campaign mode: a standalone game has neither", () => {
    const state = opened(1, [], true);
    expect(copies(state, PENDANT)).toHaveLength(0);
    expect(copies(state, PROTECT)).toHaveLength(0);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("09068");
    expect(copies(state, IARION)).toHaveLength(1);
  });

  // The Resolution (10156:B:1): the golden's final state is resolved onto a fresh log (goldenState, not a game played again).
  it("10156:B:1 notes the damage on Protect the Innocent in the log and adds it to the campaign pool", () => {
    for (const name of ["true solo, won, Normal", "two-handed, won, Normal", "true solo, won, every choice the first option"]) {
      const state = goldenState("intruders-in-chetwood", name);
      expect(state.stageCleared, name).toBe(true);
      const log = applyResolution(emptyLog(state.seatCount), state.scenarioId, state, world.cards, NO_COPY_LIMITS);
      expect(log.protectDamage, name).toBe(copies(state, PROTECT)[0]?.damage);
      expect(log.campaignPool.filter((card) => card.code === PROTECT), name).toHaveLength(1);
      expect(log.completed, name).toEqual(["intruders-in-chetwood"]);
    }
  });

  it("10156:B:1 notes the damage the table holds, whatever it is: 5 damage on the card is 5 in the log", () => {
    const state = goldenState("intruders-in-chetwood", "two-handed, won, Normal");
    const quest = copies(state, PROTECT)[0]!;
    const log = applyResolution(emptyLog(2), state.scenarioId, updateCard(state, quest.id, { damage: 5 }), world.cards, NO_COPY_LIMITS);
    expect(log.protectDamage).toBe(5);
  });

  it("10156:B:1 unlocks The Weather Hills, the next part: the road reads it as Next", () => {
    const state = goldenState("intruders-in-chetwood", "two-handed, won, Normal");
    const log = applyResolution(emptyLog(2), state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 2)).toEqual([["intruders-in-chetwood", "completed"], ["the-weather-hills", "current"]]);
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing the lost golden leaves the log as it was", () => {
    for (const name of ["true solo, lost, Protect the Innocent holds 10 damage", "two-handed, lost, Rescue Iârion runs out of time"]) {
      expectLossWritesNothing(emptyLog(name.startsWith("true") ? 1 : 2), "intruders-in-chetwood", name, world.cards);
    }
  });
});
