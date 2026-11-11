// Rules: mec113.campaign-mode, mec113.setting-up-the-game, mec113.campaign-mode-aragorn, ltp.campaign-setup-checklist, rr.winning-the-game (data/rules/entries.json); ledger lines 145066:A:1 and 145066:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import { moveCard } from "../../../rules/core/zones.ts";
import { advanceResolution } from "../../../rules/setup/resolution.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { andurilLoadout, companyStart, companyWorld } from "../../../../test/scenarios/the-passing-of-the-grey-company/game.ts";
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
const company = loadScenario("the-passing-of-the-grey-company");
const FEAR = "145016";
const ARMY_ENEMY = "145067";
const ARMY_BOON = "145068";
const ANDURIL = "142014";
const HEAVY_BURDEN = "144052";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof companyWorld>>;
let afterTwoTowers: CampaignLog;

// The log a finished Two Towers hands on: the six parts' Resolutions written one onto the other (the earlier parts' golden states, never played again), taken into a new Return of the King save (`continuedLog`, SAGA_PREVIOUS).
beforeAll(async () => {
  world = await companyWorld("strong");
  ctx = world.ctx;
  const roads = await roadsWonLog();
  const finished = await wonLog({ title: "Shelob's Lair", golden: "two-handed, won, Normal", goldens: LAIR_GOLDENS, world: lairWorld, play: playLair, scenarioId: "shelobs-lair" }, roads);
  afterTwoTowers = continuedLog({ id: "tt", campaignId: "the-two-towers", seatCount: 2, log: { ...finished, campaignPool: [...finished.campaignPool] } });
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog, extra: Parameters<typeof companyStart>[6] = {}): ScenarioState {
  let state = startScenario(companyStart(seats, 1, "Normal", undefined, log, undefined, extra), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The Passing of the Grey Company in the the-return-of-the-king campaign (part 1, campaign card 145066).
describe("The Passing of the Grey Company in the the-return-of-the-king campaign", () => {
  it("is part 1 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(company.id)).toBe(0);
    expect(company.campaignCard).toBe("145066");
  });

  it("is playable, and the path offers it first on a fresh log and again on the log a finished Two Towers hands on", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-passing-of-the-grey-company");
    for (const log of [emptyLog(1), afterTwoTowers]) {
      const path = campaignPath(campaign, {}, log);
      expect(path[0]).toMatchObject({ id: "the-passing-of-the-grey-company", status: "current" });
      expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-passing-of-the-grey-company" } });
    }
  });

  it("145066:A:1 carries the Two Towers log on: the continued log starts this box with none of its parts done", () => {
    expect(afterTwoTowers).toMatchObject({ continuedFrom: "tt", completed: [] });
  });

  it("145066:A:1 leaves the burdens of the five earlier burden sets out of the encounter deck: A Heavy Burden of Shelob's Lair, in the pool, is not dealt", () => {
    const burden = poolCard(world.cards.get(HEAVY_BURDEN)!, HEAVY_BURDEN, null, null);
    const withBurden = { ...afterTwoTowers, campaignPool: [...afterTwoTowers.campaignPool, burden] };
    expect(copies(opened(2, withBurden), HEAVY_BURDEN)).toHaveLength(0);
    expect(Object.values(opened(2, afterTwoTowers).cards).some((card) => card.code === "145066")).toBe(false);
  });

  it("145066:A:1 asks the first player about the search for Andúril only when a deck holds it, and the search costs each player 1 threat and puts it in hand", () => {
    const plain = opened(2, emptyLog(2));
    expect(copies(plain, ANDURIL)).toHaveLength(0);
    expect(plain.startingThreat).toEqual([9, 9]);
    const taken = opened(2, emptyLog(2), { loadout: andurilLoadout(2), choices: [ANDURIL] });
    expect(copies(taken, ANDURIL).map((card) => card.zone)).toEqual(["hand"]);
    expect(taken.startingThreat).toEqual([10, 10]);
    const skipped = opened(2, emptyLog(2), { loadout: andurilLoadout(2), choices: ["skip"] });
    expect(copies(skipped, ANDURIL).map((card) => card.zone)).toEqual(["deck"]);
    expect(skipped.startingThreat).toEqual([9, 9]);
  });

  it("145066:A:1 gives no +1 threat for changing heroes: the starting threat is the three heroes' own 9", () => {
    expect(opened(1, emptyLog(1)).startingThreat).toEqual([9]);
  });

  // The Resolution (145066:B:1): the golden's final state is resolved onto the log of the parts before (goldenState, not a game played again).
  it("145066:B:1 adds each Overcome by Fear on a threat dial to the campaign pool for its player and completes the part", () => {
    for (const name of ["true solo, won, Normal", "two-handed, won, Normal", "two-handed, won, engaging and defending"]) {
      const state = goldenState("the-passing-of-the-grey-company", name);
      expect(state.stageCleared, name).toBe(true);
      const dialed = copies(state, FEAR).filter((card) => card.zone === "play" && card.controller != null);
      expect(dialed.length, name).toBeGreaterThan(0);
      const log = applyResolution(afterTwoTowers, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
      const pooled = log.campaignPool.filter((card) => card.code === FEAR);
      expect(pooled.map((card) => card.seat).sort(), name).toEqual(dialed.map((card) => card.controller).sort());
      expect(log.completed, name).toEqual(["the-passing-of-the-grey-company"]);
      expect(log.campaignPool.some((card) => card.code === ARMY_BOON), name).toBe(false);
    }
  });

  it("145066:B:1 earns the Army of the Dead boon when the Army is in the victory display, whichever side shows", () => {
    const state = goldenState("the-passing-of-the-grey-company", "true solo, won, Normal");
    const army = copies(state, ARMY_ENEMY)[0]!;
    // The Resolution runs again on the table with the Army in the victory display.
    const inVictory = advanceResolution({ ...moveCard(state, army.id, { zone: "victory" }), resolutionAt: 0, resolutionLog: { earned: [], fallen: [], captives: [] } }, ctx);
    const log = applyResolution(afterTwoTowers, inVictory.scenarioId, inVictory, world.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.filter((card) => card.code === ARMY_BOON)).toHaveLength(1);
  });

  it("145066:B:1 unlocks The Siege of Gondor, the next part, on the log the win writes; the app cannot deal it yet, so the path says it is coming soon", () => {
    const state = goldenState("the-passing-of-the-grey-company", "two-handed, won, Normal");
    const log = applyResolution(afterTwoTowers, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 2)).toEqual([["the-passing-of-the-grey-company", "completed"], ["the-siege-of-gondor", "soon"]]);
  });

  it("a lost game writes nothing: the Resolution is for a win only, so the save keeps the log it began with", () => {
    const state = goldenState("the-passing-of-the-grey-company", "two-handed, lost, threat reaches 50");
    expect(state.lost).toBe(true);
    expect(state.stageCleared).toBe(false);
    expect(newSave("rk", "the-return-of-the-king", 2).log.completed).toEqual([]);
  });

  it("deals the original card in a standalone game, with no campaign card", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "145066")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("145063");
  });
});
