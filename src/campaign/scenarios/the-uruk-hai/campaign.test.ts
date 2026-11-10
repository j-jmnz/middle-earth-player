// Rules: mec112.setup-the-uruk-hai, mec112.campaign-mode, mec112.pursuit, ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { haiStart, haiWorld } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { emptyLog } from "../../log.ts";

const campaign = loadCampaign("the-two-towers");
const hai = loadScenario("the-uruk-hai");
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await haiWorld("strong")).ctx;
}, 120_000);

// The scenario dealt and its Setup played to the first round: every question answered with the first option.
function opened(start: ReturnType<typeof haiStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The Uruk-hai in the the-two-towers campaign (part 1, campaign card 143071).
describe("The Uruk-hai in the the-two-towers campaign", () => {
  it("is part 1 of the campaign, names its campaign card and the boons it places, and is playable as the first part of a fresh save", () => {
    expect(campaign.scenarios.indexOf(hai.id)).toBe(0);
    expect(hai.campaignCard).toBe("143071");
    expect([...hai.campaignPlaced].sort()).toEqual(["143015", "143016", "143017", "143018", "143019"]);
    expect(PLAYABLE_SCENARIOS).toContain("the-uruk-hai");
    expect(campaignPath(campaign, {}, emptyLog(1))[0]).toMatchObject({ id: "the-uruk-hai", status: "current" });
  });

  it("keeps the campaign card off the table: its Setup and Resolution are all it prints (src/rules/families/burden/campaign.ts)", () => {
    const state = opened(haiStart(1, 1, "Normal"));
    expect(Object.values(state.cards).some((card) => card.code === "143071")).toBe(false);
  });

  it("takes the Captive the Campaign Log names for a seat without asking, and lets a seat the log names none for choose its own (user ruling, docs/brief.md)", () => {
    // Seat 0's log names q2; seat 1 names none and is asked (the first option, its first non-Fellowship hero).
    const facts = { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [], fallen: [], fellowship: [], captives: [{ seat: 0, hero: "q2" }] } };
    const state = opened(haiStart(2, 2, "Normal", facts));
    const captives = captivesOf(state);
    expect(captives.map((card) => [card.owner, card.code]).sort()).toEqual([[0, "q2"], [1, "q4"]]);
    expect(state.pursuit).toBe(10);
  });
});
