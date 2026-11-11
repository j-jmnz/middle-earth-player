// Rules: mec112.setup-helms-deep, mec112.campaign-mode, mec112.poisoned-counsels-searching-eye, mec112.campaign-mode-aragorn, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json); ledger lines 143077:A:2 and 143077:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { DEEP_GOLDENS, deepPlan, deepStart, deepWorld, playGolden } from "../../../../test/scenarios/helms-deep/game.ts";
import { HAI_GOLDENS, haiWorld, playGolden as playHai } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { fillerLoadout } from "../../../../test/harness/game-kit.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { checklist } from "../../checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-two-towers");
const deep = loadScenario("helms-deep");
const COUNSELS = "143021";
let ctx: ReduceContext;
let cards: Map<string, PrintedCard>;
let afterHai: CampaignLog;

// The log The Uruk-hai's real Resolution leaves (143071:B:1), two-handed: the golden's win with the heroes of each seat given the Trait its Skill boon needs (a Healer for Hands of a Healer, a Ranger for Forewarned), so each player earns
// the boon and the log attaches it to that hero. The pursuit value of the win is 25 or lower, so the first player chose the Skill boons.
beforeAll(async () => {
  const world = await haiWorld("strong");
  world.cards.set("q1", { ...world.cards.get("q1")!, traits: ["Healer"] });
  world.cards.set("q4", { ...world.cards.get("q4")!, traits: ["Ranger"] });
  const golden = HAI_GOLDENS.find((item) => item.name === "two-handed, won, Normal")!;
  const game = playHai(golden, world.ctx);
  expect(game.state.stageCleared).toBe(true);
  afterHai = applyResolution(emptyLog(2), game.state.scenarioId, game.state, world.cards, NO_COPY_LIMITS);
  const made = await deepWorld("strong");
  ctx = made.ctx;
  cards = made.cards;
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(deepStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// Helm's Deep in the the-two-towers campaign (part 2, campaign card 143077).
describe("Helm's Deep in the the-two-towers campaign", () => {
  it("is part 2 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(deep.id)).toBe(1);
    expect(deep.campaignCard).toBe("143077");
  });

  it("is playable, and the path offers it as the current part once The Uruk-hai is won", () => {
    expect(PLAYABLE_SCENARIOS).toContain("helms-deep");
    expect(campaignPath(campaign, {}, emptyLog(1))[1]).toMatchObject({ id: "helms-deep", status: "locked" });
    const path = campaignPath(campaign, {}, afterHai);
    expect(path.slice(0, 2).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "helms-deep" } });
  });

  it("143077:A:2 the Skill boons The Uruk-hai's Resolution earned reach Helm's Deep through the Campaign Setup Checklist, each on the hero it was attached to", () => {
    expect(afterHai.campaignPool.map((card) => [card.code, card.seat, card.attachedTo]).sort()).toEqual([["143016", 0, "q1"], ["143017", 1, "q4"]]);
    const plan = deepPlan(2, afterHai);
    expect(plan.steps.find((step) => step.n === 5)?.did).toEqual(["Forewarned goes on q4.", "Hands of a Healer goes on q1."]);
    // The game is dealt with the boons attached to those heroes.
    const state = opened(2, afterHai);
    const host = (code: string) => state.cards[Object.values(state.cards).find((card) => card.code === code)?.host ?? ""]?.code;
    expect([host("143016"), host("143017")]).toEqual(["q1", "q4"]);
  });

  it("143077:A:2 waives the +1 penalty for changing a hero that The Uruk-hai's does not", () => {
    // Seat 0 trades q3 for q7, a hero the log does not list: the stand-in heroes are alike, so the trade is the only difference between the two plans.
    const seats = fillerLoadout(2).map((seat, index) => (index === 0 ? { ...seat, heroes: [...seat.heroes.slice(0, 2), "q7"] } : seat));
    const traded = new Map(cards).set("q7", { ...cards.get("q3")!, code: "q7", name: "q7" });
    const run = (scenario: string) => checklist({ log: afterHai, scenario: loadScenario(scenario), seats, effects: EFFECTS, cards: traded });
    const waived = run("helms-deep");
    const charged = run("the-uruk-hai");
    if (!waived.ok || !charged.ok) throw new Error([...(waived.ok ? [] : waived.errors), ...(charged.ok ? [] : charged.errors)].join("; "));
    expect(waived.steps.find((step) => step.n === 3)?.did[0]).toBe("1 hero change(s) cost nothing: the campaign card waives the +1 penalty.");
    expect(charged.steps.find((step) => step.n === 3)?.did[0]).toBe("1 hero change(s) add 1 to the threat penalty.");
    expect(waived.threatModifier).toBe(0);
    expect(charged.threatModifier).toBe(1);
  });

  it("143077:A:2 leaves the burdens of the Fellowship's earlier sets out of the encounter deck, and keeps the campaign card off the table", () => {
    const state = opened(2, afterHai);
    expect(Object.values(state.cards).some((card) => card.code === "143077")).toBe(false);
    expect(Object.values(state.cards).some((card) => ["141078", "141080", "142085"].includes(card.code))).toBe(false);
  });

  // The goldens' wins: the Resolution (143077:B:1) earns Poisoned Counsels for each player holding a copy in hand, deck or discard pile.
  const won = (name: string) => DEEP_GOLDENS.find((golden) => golden.name === name)!;
  const resolved = (name: string): { state: ScenarioState; log: CampaignLog } => {
    const golden = won(name);
    const game = playGolden(golden, ctx);
    return { state: game.state, log: applyResolution(emptyLog(golden.seatCount), game.state.scenarioId, game.state, cards, NO_COPY_LIMITS) };
  };

  it("143077:B:1 a seat that took Poisoned Counsels at stage 1A and still holds it at the win earns it, each seat its own", () => {
    const { state, log } = resolved("two-handed, won, Normal");
    const held = state.seats.slice(0, 2).map((seat) => [...seat.hand, ...seat.deck, ...seat.discard].filter((id) => state.cards[id]?.code === COUNSELS).length);
    expect(held).toEqual([1, 1]);
    expect(log.campaignPool.filter((card) => card.code === COUNSELS).map((card) => card.seat).sort()).toEqual([0, 1]);
    expect(log.completed).toEqual(["helms-deep"]);
    expect(log.earned["helms-deep"]).toHaveLength(2);
  });

  it("143077:B:1 a player who bypassed stage 1B holds no copy and earns none", () => {
    const { state, log } = resolved("true solo, won, bypassing stage 1B");
    expect(Object.values(state.cards).some((card) => card.code === COUNSELS)).toBe(false);
    expect(log.campaignPool.some((card) => card.code === COUNSELS)).toBe(false);
  });

  it("143077:B:1 unlocks The Road to Isengard on the path", () => {
    const { log } = resolved("two-handed, won, Normal");
    const path = campaignPath(campaign, {}, { ...afterHai, completed: ["the-uruk-hai", "helms-deep"], campaignPool: log.campaignPool });
    expect(path.slice(0, 3).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "current"]]);
  });

  it("deals the original card in a standalone game, with no campaign card", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "143077")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("143072");
  });
});
