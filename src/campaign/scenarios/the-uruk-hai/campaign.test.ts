// Rules: mec112.setup-the-uruk-hai, mec112.campaign-mode, mec112.campaign-mode-aragorn, rr.campaign-setup-checklist, rr.campaign-cards, rr.winning-the-game (data/rules/entries.json); ledger lines 143071:A:2, 143071:B:1, 143069:A:1. The Uruk-hai in the
// the-two-towers campaign (part 1, campaign card 143071): the first part of a new save, its campaign card's Setup is dealt (Gildor Inglorion and Mr. Underhill leave the pool, the burdens of the Fellowship's first three sets stay out of the
// encounter deck), the log's captives reach the quest card's Setup (a seat the log names none for chooses its own), a win writes its Resolution and the next part is coming soon, and a standalone game has no campaign card.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { HAI_GOLDENS, POOL, haiPlan, haiStart, haiWorld, heroLogFacts, playGolden } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { CODES, campaign, hai } from "../../../../test/scenarios/the-uruk-hai/scene.ts";

import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { newSave } from "../../save.ts";
import { buildStart } from "../../start.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

beforeAll(async () => {
  const world = await haiWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
}, 120_000);

// The scenario dealt and its Setup played: the mulligan kept, every choice answered with its first option.
function opened(start: ReturnType<typeof haiStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 30 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const captivesOf = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.captive === true).map((card) => `${card.owner}:${card.code}`).sort();
const pooled = (code: string, seat: number | null = null, attachedTo: string | null = null) => poolCard(cards.get(code) as PrintedCard, code, attachedTo, seat);

describe("The Uruk-hai in the the-two-towers campaign", () => {
  it("is part 1 of the campaign, playable, with no XP, and names its campaign card", () => {
    const save = newSave("hai", campaign.id, 1);
    expect(campaignPath(campaign, {}, save.log).map((node) => [node.id, node.status]).slice(0, 2)).toEqual([["the-uruk-hai", "current"], ["helms-deep", "soon"]]);
    expect(campaign.scenarios.indexOf(hai.id)).toBe(0);
    expect(PLAYABLE_SCENARIOS).toContain("the-uruk-hai");
    expect(campaign.xp).toBeFalsy();
    expect(hai.campaignCard).toBe(CODES.campaignCard);
  });

  it("deals the Campaign Setup: Gildor Inglorion and Mr. Underhill leave the pool, and the burdens of the Fellowship's first three sets stay out of the encounter deck", () => {
    const pool = [pooled(POOL.gildor), pooled(POOL.underhill, 0, "141001"), pooled(POOL.shadowBurden), pooled(POOL.fordBurden), pooled(POOL.darkBurden)];
    const log: CampaignLog = { ...emptyLog(1), campaignPool: pool };
    const plan = haiPlan(1, log);
    expect(plan.log.campaignPool.map((card) => card.code)).toEqual([POOL.shadowBurden, POOL.fordBurden, POOL.darkBurden]);
    expect(plan.poolEncounterCards).toEqual([POOL.darkBurden]);
    const start = haiStart(1, 1, "Normal", undefined, log);
    expect(start.encounterDeck).toEqual(expect.arrayContaining([POOL.darkBurden]));
    expect(start.encounterDeck).not.toContain(POOL.shadowBurden);
    expect(start.encounterDeck).not.toContain(POOL.fordBurden);
    expect(start.definition.campaignCard).toBe(CODES.campaignCard);
  });

  it("hands the Campaign Log's captives to the quest card's Setup: a logged captive is taken without a question, a seat with none logged chooses its own hero (143069:A:1)", () => {
    // Both seats named: no choice is asked of either.
    const named = opened(haiStart(2, 1, "Normal", heroLogFacts(2, true)));
    expect(captivesOf(named)).toEqual(["0:q2", "1:q5"]);
    // Only the second seat's captive is in the log (a mixed log): the first seat chooses 1 non-Fellowship hero it controls, as in standalone.
    const mixed = opened(haiStart(2, 1, "Normal", { ...heroLogFacts(2, false), heroLog: { ...heroLogFacts(2, false).heroLog!, captives: [{ seat: 1, hero: "q5" }] } }));
    expect(captivesOf(mixed)).toEqual(["0:q1", "1:q5"]);
    // A fresh log names none: each seat chooses.
    expect(captivesOf(opened(haiStart(2, 1, "Normal", heroLogFacts(2, false))))).toEqual(["0:q1", "1:q4"]);
    // A log with no hero lists at all (no facts): the same.
    expect(captivesOf(opened(haiStart(1, 1, "Normal")))).toEqual(["0:q1"]);
    for (const state of [named, mixed]) expect(state.pursuit).toBe(10);
  });

  it("writes the Resolution on a win and the next part, Helm's Deep, is coming soon; a loss writes nothing", async () => {
    const won = HAI_GOLDENS.find((item) => item.name === "two-handed, won")!;
    const game = playGolden(won, ctx);
    const log = applyResolution(emptyLog(2), game.state.scenarioId, game.state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual(["the-uruk-hai"]);
    expect(log.xpGained).toEqual({});
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 2)).toEqual(["completed", "soon"]);
    expect(PLAYABLE_SCENARIOS).not.toContain("helms-deep");
    const lost = HAI_GOLDENS.find((item) => item.name === "true solo, weak, lost on threat")!;
    const lostGame = playGolden(lost, (await haiWorld(lost.decks)).ctx);
    const untouched = emptyLog(1);
    expect(applyResolution(untouched, lostGame.state.scenarioId, lostGame.state, cards, NO_COPY_LIMITS)).toBe(untouched);
  });
});

describe("a standalone game of The Uruk-hai", () => {
  it("deals the original game with no campaign card, no Setup of the campaign and no Resolution, each seat choosing its own Captive", () => {
    const start = buildStart({ campaign, scenario: hai, seatCount: 1, seed: 1, threatModifier: 0, seats: haiPlan(1).seats, effects: EFFECTS, mode: "standalone", facts: heroLogFacts(1, true) });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.facts).toBeUndefined();
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 30 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    expect(captivesOf(state)).toEqual(["0:q1"]);
    expect(state.pursuit).toBe(10);
  });
});
