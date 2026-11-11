// Rules: mec112.campaign-mode, mec112.setting-up-the-game, mec112.setup-shelobs-lair, ltp.campaign-setup-checklist, rr.winning-the-game (data/rules/entries.json); ledger lines 144073:A:2 and 144073:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { lairStart, lairWorld } from "../../../../test/scenarios/shelobs-lair/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { roadsWonLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-two-towers");
const lair = loadScenario("shelobs-lair");
const FRODO = "141001";
const ONE_RING = "144063";
const HEAVY_BURDEN = "144052";
const BRACE = "144014";
let ctx: ReduceContext;
let afterRoads: CampaignLog;
let world: Awaited<ReturnType<typeof lairWorld>>;

// The log the earlier parts' real Resolutions leave: The Uruk-hai's, Helm's Deep's, The Road to Isengard's, The Passage of the Marshes' and Journey to the Cross-roads' wins, resolved one onto the other, two-handed (scripts/e2e/shelobs-lair.ts,
// from the goldens' final states).
beforeAll(async () => {
  afterRoads = await roadsWonLog();
  world = await lairWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(lairStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// Shelob's Lair in the the-two-towers campaign (part 6, campaign card 144073).
describe("Shelob's Lair in the the-two-towers campaign", () => {
  it("is part 6 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(lair.id)).toBe(5);
    expect(lair.campaignCard).toBe("144073");
  });

  it("is playable, and the path offers it as the current part once Journey to the Cross-roads is won", () => {
    expect(PLAYABLE_SCENARIOS).toContain("shelobs-lair");
    expect(campaignPath(campaign, {}, emptyLog(1))[5]).toMatchObject({ id: "shelobs-lair", status: "locked" });
    const path = campaignPath(campaign, {}, afterRoads);
    expect(path.map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "completed"], ["the-passage-of-the-marshes", "completed"], ["journey-to-the-cross-roads", "completed"], ["shelobs-lair", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "shelobs-lair" } });
  });

  it("144073:A:2 deals the Ring-bearer with The One Ring and A Heavy Burden to the first player, and leaves the Two Towers burdens out of the decks", () => {
    const state = opened(2, afterRoads);
    for (const code of ["143021", "143068"]) expect(copies(state, code)).toHaveLength(0);
    for (const code of [ONE_RING, HEAVY_BURDEN]) {
      const card = copies(state, code);
      expect(card, code).toHaveLength(1);
      expect(card[0]?.host && state.cards[card[0].host]?.code, code).toBe(FRODO);
    }
    expect(Object.values(state.cards).some((card) => card.code === "144073")).toBe(false);
  });

  it("144073:A:2 hands the pool cards the earlier parts earned to the decks: a Brace of Coneys of Journey to the Cross-roads' Resolution is in its owner's deck", () => {
    const brace = { code: BRACE, back: "player", burdenSet: null, attachedTo: null, seat: 1 } as const;
    const state = opened(2, { ...afterRoads, campaignPool: [...afterRoads.campaignPool, brace] });
    const held = copies(state, BRACE).filter((card) => card.owner === 1 || card.controller === 1);
    expect(held).toHaveLength(1);
    expect(["deck", "hand"]).toContain(held[0]?.zone);
    expect(copies(opened(2, afterRoads), BRACE)).toHaveLength(0);
  });

  // The Resolution (144073:B:1) earns A Heavy Burden: the golden's final state is resolved onto the log of the parts before (goldenState, not a game played again).
  it("144073:B:1 earns A Heavy Burden into the campaign pool for the Ring-bearer's player and completes the part", () => {
    for (const name of ["true solo, won, Normal", "two-handed, won, Normal"]) {
      const state = goldenState("shelobs-lair", name);
      expect(state.stageCleared, name).toBe(true);
      const log = applyResolution(emptyLog(state.seatCount), state.scenarioId, state, world.cards, NO_COPY_LIMITS);
      expect(log.campaignPool.filter((card) => card.code === HEAVY_BURDEN), name).toHaveLength(1);
      expect(log.completed, name).toEqual(["shelobs-lair"]);
    }
  });

  it("deals no campaign card from a fresh log in the Setup's place, and starts on stage 1", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "144073")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("144070");
  });
});
