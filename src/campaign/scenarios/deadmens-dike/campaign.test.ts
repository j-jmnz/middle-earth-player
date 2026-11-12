// Rules: mec108.campaign-setup-deadmens-dike, mec108.setup-deadmens-dike, rr.campaign-pool, rr.campaign-setup-checklist, rr.first-player, ltp.permanent (data/rules/entries.json); ledger lines 10160:A:3 and 10166:A:3.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterHills, dikePlan, dikeStart, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { settle } from "../../../rules/engine/machine.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const dike = loadScenario("deadmens-dike");
const OMENS = "10160";
const BOONS = ["10161", "10162", "10163", "10164", "10165"];
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof dikeWorld>>;

beforeAll(async () => {
  world = await dikeWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt from a campaign log and its Setup played, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(dikeStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// Deadmen's Dike in the angmar-awakened campaign (part 3, campaign card 10166). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("Deadmen's Dike in the angmar-awakened campaign", () => {
  it("is part 3 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(dike.id)).toBe(2);
    expect(dike.campaignCard).toBe("10166");
  });

  it("10160:A:3 deals the five boons set aside, so Mysterious Omens left in the pool (The Weather Hills lost or Omens not defeated) has them to offer here, and the boon the pool holds on a hero is not offered twice", () => {
    expect(dike.campaignPlaced).toEqual(expect.arrayContaining(BOONS));
    const log = afterHills(2);
    const hero = dikePlan(2, log).seats[0]?.heroes[0] ?? "";
    const carried: CampaignLog = { ...log, campaignPool: [...log.campaignPool, poolCard(world.cards.get("10162")!, "10162", hero, 0)] };
    expect(dikePlan(2, carried).poolEncounterCards).toContain(OMENS);
    const started = opened(2, carried);
    // Hardy (10162) is on a hero from the pool: no second copy of it is in the game to take.
    expect(copies(started, "10162").filter((card) => card.zone === "play" || card.zone === "attached")).toHaveLength(1);
    expect(copies(started, "10161")).toHaveLength(0);
    const seen: string[][] = [];
    resolveRecords(started, ctx, OMENS, "forced", undefined, (state) => {
      if (state.window?.kind !== "choose") return "";
      seen.push([...state.window.options]);
      return state.window.options.includes("none") ? "none" : (state.window.options[0] ?? "");
    });
    expect(seen[0]).toEqual(["10161", "10163", "10164", "10165", "none"]);
    // A boon taken comes from the supply: attached to the hero, the one copy.
    const taken = resolveRecords(started, ctx, OMENS, "forced", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("10161") ? "10161" : state.window.options.find((option) => option.startsWith("dh") || /^i\d+$/.test(option)) ?? "none") : ""));
    expect(copies(taken.state, "10161").filter((card) => card.host != null)).toHaveLength(1);
  });

  it("10166:A:3 adds the burden Thaurdir carries to the Campaign Pool when the scenario is won, wherever it lies then (on a hero or on him), and none when no burden was attached", () => {
    const resolution = recordInstructions(EFFECTS, "10166", "resolution").filter((instruction) => instruction.verb === "EarnAllBurdens");
    expect(resolution).toHaveLength(1);
    const pooled = (layout: Parameters<typeof tableFromLayout>[1]) => {
      const table = tableFromLayout("deadmens-dike", { campaign: true, staging: ["09033"], deckOf: ["filler", "filler"], ...layout });
      const state = settle({ ...table.state, phase: "Quest", window: null, stageCleared: true, resolution }, table.ctx, []);
      return applyResolution(emptyLog(1), "deadmens-dike", state, table.cards, NO_COPY_LIMITS).campaignPool.map((card) => card.code);
    };
    expect(pooled({ attached: [{ code: "10169", to: "09033" }] })).toEqual(["10169"]);
    expect(pooled({ attached: [{ code: "10168", to: "dh1" }] })).toEqual(["10168"]);
    expect(pooled({})).toEqual([]);
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  // The previous parts' logs come from their golden states (goldenState, test/harness/golden-state.ts), never from playing their goldens again;
  // this scenario's own won or lost state too, once its goldens are pinned (.claude/rules/code-standards.md, Test cost).
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});
