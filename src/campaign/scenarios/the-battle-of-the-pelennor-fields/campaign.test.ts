// Rules: mec113.campaign-mode, mec113.setting-up-the-game, mec113.campaign-mode-aragorn, mec113.multiplayer-aragorn, ltp.campaign-setup-checklist, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 145078:A:1, 145078:B:1 and 145078:B:2.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { BLACK_GATE_RECORDED, fieldsStart, fieldsWorld } from "../../../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { gondorWorld } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { LAIR_GOLDENS, lairWorld, playGolden as playLair } from "../../../../test/scenarios/shelobs-lair/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { roadsWonLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { wonLog } from "../../../../scripts/e2e/seed-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { continuedLog } from "../../continue.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { newSave } from "../../save.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-return-of-the-king");
const fields = loadScenario("the-battle-of-the-pelennor-fields");
const ARAGORN = "145001";
const ANDURIL = "142014";
const BANNER = "145013";
const FLEET = "145072";
const WRAITH = "145062";
const ESQUIRES = ["145014", "145015"];
const HEAVY_BURDEN = "144052";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof fieldsWorld>>;
let afterSiege: CampaignLog;

// The log the Siege of Gondor leaves: the six parts of The Two Towers written one onto the other, taken into a new Return of the King save (`continuedLog`, which copies the enemies under The Black Gate), then the Grey Company's and the Siege's two-handed golden
// wins (their golden states read with `goldenState`, never played again) resolved onto it: both parts done, the Fleet's resources in the notes (`corsairFleet`).
beforeAll(async () => {
  world = await fieldsWorld("strong");
  ctx = world.ctx;
  const roads = await roadsWonLog();
  const finished = await wonLog({ title: "Shelob's Lair", golden: "two-handed, won, Normal", goldens: LAIR_GOLDENS, world: lairWorld, play: playLair, scenarioId: "shelobs-lair" }, roads);
  const afterTwoTowers = continuedLog({ id: "tt", campaignId: "the-two-towers", seatCount: 2, log: { ...finished, campaignPool: [...finished.campaignPool] } });
  const company = goldenState("the-passing-of-the-grey-company", "two-handed, won, Normal");
  const afterCompany = applyResolution(afterTwoTowers, company.scenarioId, company, world.cards, NO_COPY_LIMITS);
  const siege = goldenState("the-siege-of-gondor", "two-handed, won, after the Grey Company, engaging");
  afterSiege = applyResolution(afterCompany, siege.scenarioId, siege, (await gondorWorld("strong")).cards, NO_COPY_LIMITS);
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option (the Esquires attached).
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(fieldsStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zones = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
const HARAD_CODES = ["144028", "144029", "144056", "144057", "144058"];
const haradAside = (state: ScenarioState) => HARAD_CODES.flatMap((code) => copies(state, code)).filter((card) => card.zone === "setAside");

// The Battle of the Pelennor Fields in the the-return-of-the-king campaign (part 3, campaign card 145078).
describe("The Battle of the Pelennor Fields in the the-return-of-the-king campaign", () => {
  it("is part 3 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(fields.id)).toBe(2);
    expect(fields.campaignCard).toBe("145078");
  });

  it("is playable, and the path offers it next after The Siege of Gondor", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-battle-of-the-pelennor-fields");
    const path = campaignPath(campaign, {}, afterSiege);
    expect(path.map((node) => [node.id, node.status]).slice(0, 3)).toEqual([["the-passing-of-the-grey-company", "completed"], ["the-siege-of-gondor", "completed"], ["the-battle-of-the-pelennor-fields", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-battle-of-the-pelennor-fields" } });
  });

  it("145078:A:1 hands on what the Siege recorded: the Fleet's resources, as the golden win left them", () => {
    const siege = goldenState("the-siege-of-gondor", "two-handed, won, after the Grey Company, engaging");
    const fleet = copies(siege, "145071")[0]!;
    expect(afterSiege.corsairFleet).toBe(fleet.resources);
    expect(afterSiege.corsairFleet).toBeGreaterThan(0);
  });

  it("145078:A:1 Setup: each Harad enemy recorded in the campaign log is set aside, one copy for each recorded, and none with an empty log", () => {
    // The Two Towers' goldens leave no enemy under The Black Gate, so the log names the Harad enemies Journey to the Cross-roads could have recorded (the goldens' own, `BLACK_GATE_RECORDED`).
    const logged = { ...afterSiege, blackGate: { ...BLACK_GATE_RECORDED, "144028": 2 } };
    const state = opened(2, logged);
    expect(haradAside(state)).toHaveLength(4);
    for (const [code, count] of Object.entries(logged.blackGate)) expect(copies(state, code).filter((card) => card.zone === "setAside"), code).toHaveLength(count);
    expect(haradAside(opened(1, emptyLog(1)))).toHaveLength(0);
  });

  it("145078:A:1 Setup: the first player attaches Andúril and the Banner of Elendil to Aragorn and sets him aside, out of play, so his loss does not fire", () => {
    const state = opened(2, afterSiege);
    const aragorn = copies(state, ARAGORN)[0]!;
    expect(aragorn.zone).toBe("setAside");
    expect(aragorn.attachments.map((id) => state.cards[id]?.code).sort()).toEqual([ANDURIL, BANNER]);
    expect(state.lost).toBe(false);
    // A solo game and a standalone one set him aside the same way.
    expect(zones(opened(1, emptyLog(1)), ARAGORN)).toEqual(["setAside"]);
  });

  it("145078:A:1 Setup: The Corsair Fleet is added to the staging area, Gondor side faceup, with the resources recorded in the campaign log, none with an empty log", () => {
    const state = opened(2, afterSiege);
    const fleet = copies(state, FLEET);
    expect(fleet.map((card) => card.zone)).toEqual(["staging"]);
    expect(fleet[0]?.resources).toBe(afterSiege.corsairFleet);
    expect(copies(opened(1, emptyLog(1)), FLEET)[0]?.resources ?? 0).toBe(0);
  });

  it("145078:A:1 Setup: the burdens of the five earlier burden sets are left out of the encounter deck", () => {
    const burden = poolCard(world.cards.get(HEAVY_BURDEN)!, HEAVY_BURDEN, null, null);
    const withBurden = { ...afterSiege, campaignPool: [...afterSiege.campaignPool, burden] };
    expect(copies(opened(2, withBurden), HEAVY_BURDEN)).toHaveLength(0);
  });

  it("145078:A:1 deals the first player's Esquires, set aside, to the attach choice of The Garrison of Gondor, and the pool's copies attach by their own Setup", () => {
    const state = opened(2, afterSiege);
    expect(ESQUIRES.map((code) => zones(state, code)[0])).toEqual(["play", "play"]);
  });

  it("145078:B:2 the Resolution of the golden win earns a Wraith on Wings for each player and the Esquires still attached, and completes the part", () => {
    for (const name of ["true solo, won, Normal, after the Siege", "two-handed, won, Normal, after the Siege", "two-handed, won, after the Siege, no Esquire, the City damaged"]) {
      const state = goldenState("the-battle-of-the-pelennor-fields", name);
      expect(state.stageCleared, name).toBe(true);
      const seats = state.seatCount;
      const log = applyResolution(afterSiege, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
      expect(log.campaignPool.filter((card) => card.code === WRAITH), name).toHaveLength(seats);
      expect(log.campaignPool.filter((card) => ESQUIRES.includes(card.code)), name).toHaveLength(name.includes("no Esquire") ? 0 : 2);
      expect(log.completed, name).toEqual([...afterSiege.completed, "the-battle-of-the-pelennor-fields"]);
    }
  });

  it("145078:B:2 unlocks The Tower of Cirith Ungol, the next part, on the log the win writes; the app cannot deal it yet, so the path says it is coming soon", () => {
    const state = goldenState("the-battle-of-the-pelennor-fields", "two-handed, won, Normal, after the Siege");
    const log = applyResolution(afterSiege, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 4)).toEqual([
      ["the-passing-of-the-grey-company", "completed"],
      ["the-siege-of-gondor", "completed"],
      ["the-battle-of-the-pelennor-fields", "completed"],
      ["the-tower-of-cirith-ungol", "soon"],
    ]);
    expect(PLAYABLE_SCENARIOS).not.toContain("the-tower-of-cirith-ungol");
  });

  it("a lost game writes nothing: the Resolution is for a win only, so the save keeps the log it began with", () => {
    const state = goldenState("the-battle-of-the-pelennor-fields", "two-handed, lost, Minas Tirith destroyed");
    expect(state.lost).toBe(true);
    expect(state.stageCleared).toBe(false);
    expect(newSave("rk", "the-return-of-the-king", 2).log.completed).toEqual([]);
  });

  it("deals the original card in a standalone game, with no campaign card", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "145078" && card.zone !== "campaign")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("145073");
  });
});
