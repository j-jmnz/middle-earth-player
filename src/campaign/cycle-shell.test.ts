// Rules: mec109.campaign-mode (data/rules/entries.json): a scenario of a cycle (Shadows of Mirkwood, data/campaigns kind "cycle") belongs to no campaign. It has no
// campaign card, no log and no Resolution, and is played standalone only. This is the shell every cycle scenario sits in: dealt standalone on stand-in heroes
// while its lines are still open, so it is not playable. The tabs that list it are src/screens/campaign/cycle-tabs.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { catalog } from "../../test/harness/fixture-world.ts";
import { loadAnyScenario, loadCampaign } from "../../scripts/data/load-scenarios.ts";
import { HERO_STATS, standaloneGame } from "../../test/harness/game-kit.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";

import { standaloneBriefing } from "./standalone.ts";
import { isPlayable } from "./playable.ts";
import { loadWorld, worldHash } from "./world.ts";
import { buildStart } from "./start.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const ID = "the-hunt-for-gollum";
const gollum = loadAnyScenario(ID);
const POLICY = { scout: "", prefer: "", protect: "", play: false, act: false } as const;

const game = standaloneGame<"strong", object>({
  campaign: cycle,
  scenario: gollum,
  stats: HERO_STATS,
  codes: [],
  intent: (state, ctx, memory) => nextIntent(state, ctx, POLICY, memory),
  policy: {},
  limit: 200,
});

let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await game.world("strong")).ctx;
});

describe("a scenario of the Shadows of Mirkwood cycle", () => {
  it("has no campaign card and belongs to a cycle, not a campaign", () => {
    expect(cycle.kind).toBe("cycle");
    expect(cycle.campaignCards).toEqual({});
    expect(cycle.saga).toBe(false);
    expect(gollum.campaignCard).toBeUndefined();
    expect(cycle.scenarios[0]).toBe(ID);
  });

  it("deals standalone on the stand-in heroes: no campaign card, no campaign Setup, no Resolution, its own quest stage", () => {
    const start = game.start(1, 3, "Normal");
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.campaignCard).toBeUndefined();
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(state.cards[state.questStage ?? ""]?.code).toBe(gollum.stages[0]);
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
  });

  it("deals the same on Nightmare, the setup card beside the quest deck", () => {
    const start = game.start(2, 5, "Nightmare");
    expect(start.definition.nightmareCard).toBe(gollum.nightmare?.setupCard);
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(Object.values(state.cards).some((card) => card.code === gollum.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
  });

  it("is built the same without the stand-in: buildStart in standalone mode with the cycle's own data", () => {
    const start = buildStart({ campaign: cycle, scenario: gollum, seatCount: 1, seed: 1, threatModifier: 0, seats: game.plan(1), effects: EFFECTS, mode: "standalone" });
    expect(start.definition.id).toBe(ID);
  });

  it("is coming soon while any of its lines is open: not playable, and the standalone briefing says so and nothing else", () => {
    expect(isPlayable(ID)).toBe(false);
    const world = loadWorld(catalog, cycle, gollum, EFFECTS, []);
    expect(worldHash(world)).toBeGreaterThan(0);
    const plan = standaloneBriefing({ world, seatCount: 1, seats: [{ deckId: null, heroes: [], deck: [] }], ringBearer: null, difficulty: "Normal" });
    expect(plan.dealable).toBe(false);
    expect(plan.problems.map((problem) => problem.rule)).toContain("Coming soon");
  });
});
