// Rules: mec108.campaign-setup-deadmens-dike, mec108.setup-deadmens-dike, mec108.campaign-log-tracking, rr.campaign-pool, rr.campaign-setup-checklist, rr.first-player, ltp.permanent (data/rules/entries.json); ledger lines 10160:A:3, 10166:A:2, 10166:A:3, 10166:B:1, 100158:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterHills, DIKE_GOLDENS, dikePlan, dikeStart, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { settle } from "../../../rules/engine/machine.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
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
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(dikeStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// Deadmen's Dike in the angmar-awakened campaign (part 3, campaign card 10166). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again; this scenario's own won state the same way.
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

  it("is playable, the road offers it after The Weather Hills' win, and the part after it (The Wastes of Eriador) is not playable yet", () => {
    expect(PLAYABLE_SCENARIOS).toContain("deadmens-dike");
    expect(PLAYABLE_SCENARIOS).not.toContain(campaign.scenarios[3]);
    const path = campaignPath(campaign, {}, afterHills(1));
    expect(path.map((node) => [node.id, node.status]).slice(1, 4)).toEqual([["the-weather-hills", "completed"], ["deadmens-dike", "current"], ["the-wastes-of-eriador", "soon"]]);
  });

  it("10166:A:2 deals the Campaign Setup: Iârion's Pendant on Iârion, and Protect the Innocent staged with the damage the log noted for it (The Weather Hills' Resolution)", () => {
    const log: CampaignLog = { ...afterHills(2), protectDamage: 3 };
    const started = opened(2, log);
    const iarion = copies(started, "09016");
    expect(iarion.map((card) => card.zone)).toEqual(["play"]);
    expect(copies(started, "10157").map((card) => started.cards[card.host ?? ""]?.code)).toEqual(["09016"]);
    expect(copies(started, "10158").map((card) => [card.zone, card.damage])).toEqual([["staging", 3]]);
    // A log that noted nothing stages it bare.
    expect(copies(opened(1, afterHills(1)), "10158").map((card) => [card.zone, card.damage])).toEqual([["staging", 0]]);
    // The quest card's Setup: stage 1 with Fornost Square staged, Thaurdir set aside, the three encounter side quests in the deck.
    expect(started.cards[started.questStage ?? ""]?.code).toBe("09073");
    expect(copies(started, "09038").map((card) => card.zone)).toContain("staging");
    expect(copies(started, "09033").map((card) => card.zone)).toEqual(["setAside"]);
    expect(started.sideQuests).toBe(true);
  });

  it("10166:A:3 hands the log to the game: the dealt campaign attaches one burden to Thaurdir when stage 2A adds him, and no burden before", () => {
    const started = opened(1, afterHills(1));
    expect(copies(started, "10168").concat(copies(started, "10169"), copies(started, "10170")).filter((card) => card.host != null)).toHaveLength(0);
    const run = resolveRecords(started, ctx, "09074", "whenRevealed");
    const thaurdir = copies(run.state, "09033")[0];
    expect(thaurdir?.zone).toBe("staging");
    expect((thaurdir?.attachments ?? []).map((id) => run.state.cards[id]?.code).filter((code) => ["10168", "10169", "10170"].includes(code ?? ""))).toHaveLength(1);
  });

  it("deals the original card in a standalone game: no campaign card, no Pendant, no Protect the Innocent and no burden", () => {
    const started = opened(1, emptyLog(1), true);
    expect(started.cards[started.questStage ?? ""]?.code).toBe("09073");
    for (const code of ["10166", "10157", "10158", "10168", "10169", "10170", "10160"]) expect(copies(started, code).filter((card) => card.zone !== "setAside"), code).toHaveLength(0);
    expect(copies(started, "09016").map((card) => card.zone)).toEqual(["play"]);
    expect(copies(started, "09033").map((card) => card.zone)).toEqual(["setAside"]);
    const run = resolveRecords(started, ctx, "09074", "whenRevealed");
    expect(copies(run.state, "09033")[0]?.attachments ?? []).toHaveLength(0);
  });

  // The Resolution (10166:B:1) on the won golden's final state (goldenState, not a game played again), over the log The Weather Hills left.
  it("10166:B:1 notes the damage on Protect the Innocent, takes it out of the pool for Arnor Ravaged, earns the burden Thaurdir carried and the group's choice of the Pendant or Amarthiúl's Courage, and leaves The Wastes of Eriador, not playable yet, the part after", () => {
    const before = dikePlan(1, afterHills(1)).log;
    const state = goldenState("deadmens-dike", "true solo, won, Normal");
    expect(state.stageCleared).toBe(true);
    const log = applyResolution(before, "deadmens-dike", state, world.cards, NO_COPY_LIMITS);
    expect(log.protectDamage).toBe(copies(state, "10158")[0]?.damage);
    const pooled = log.campaignPool.map((card) => card.code).sort();
    expect(pooled).toContain("100158");
    expect(pooled).not.toContain("10158");
    expect(pooled).toContain(OMENS);
    expect(pooled.filter((code) => ["10168", "10169", "10170"].includes(code))).toHaveLength(1);
    expect(pooled.filter((code) => code === "10157" || code === "10167")).toHaveLength(1);
    expect(log.completed).toEqual(["intruders-in-chetwood", "the-weather-hills", "deadmens-dike"]);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(2, 4)).toEqual([["deadmens-dike", "completed"], ["the-wastes-of-eriador", "soon"]]);
  });

  it("10166:B:1 records a boon Mysterious Omens gave a hero in this scenario with that hero, as The Weather Hills does, and not twice a boon the pool already held on a hero", () => {
    const table = tableFromLayout("deadmens-dike", { seats: 2, campaign: true, deckOf: ["filler", "filler"], attached: [{ code: "10162", to: "dh1" }, { code: "10164", to: "dh3" }] });
    const resolving: ScenarioState = { ...table.state, phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10166", "resolution").filter((instruction) => instruction.verb === "EarnAttached") };
    const state = settle(resolving, table.ctx, []);
    const fresh = applyResolution(emptyLog(2), "deadmens-dike", state, table.cards, NO_COPY_LIMITS);
    expect(fresh.campaignPool.filter((card) => BOONS.includes(card.code)).map((card) => [card.code, card.attachedTo, card.seat]).sort()).toEqual([["10162", "dh1", 0], ["10164", "dh3", 1]]);
    // Hardy was already in the pool on that hero when the game began (its copy was attached again at the Setup): one record of it after the Resolution.
    const carried: CampaignLog = { ...emptyLog(2), campaignPool: [poolCard(table.cards.get("10162")!, "10162", "dh1", 0)] };
    const again = applyResolution(carried, "deadmens-dike", state, table.cards, NO_COPY_LIMITS);
    expect(again.campaignPool.filter((card) => card.code === "10162")).toHaveLength(1);
    // A game that ended with no boon attached records none.
    const bare = tableFromLayout("deadmens-dike", { seats: 2, campaign: true, deckOf: ["filler", "filler"] });
    const none = applyResolution(emptyLog(2), "deadmens-dike", settle({ ...bare.state, phase: "Quest", window: null, stageCleared: true, resolution: resolving.resolution }, bare.ctx, []), bare.cards, NO_COPY_LIMITS);
    expect(none.campaignPool.filter((card) => BOONS.includes(card.code))).toEqual([]);
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing each lost golden leaves the log as it was", () => {
    for (const golden of DIKE_GOLDENS.filter((one) => one.outcome === "lost")) {
      const log = golden.after ? afterHills(golden.seatCount) : emptyLog(golden.seatCount);
      expectLossWritesNothing(log, "deadmens-dike", golden.name, world.cards);
    }
  });
});
