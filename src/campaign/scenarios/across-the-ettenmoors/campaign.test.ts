// Rules: mec108.campaign-setup-across-the-ettenmoors, mec108.campaign-mode, mec108.campaign-log, mec108.campaign-log-tracking, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode (data/rules/entries.json); ledger lines 10182:A:2, 10182:A:3, 10182:B:1, 10172:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { eriadorPlan, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { gramPlan, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { ettenmoorsPlan, ettenmoorsStart, ettenmoorsWorld, ETTENMOORS_GOLDENS } from "../../../../test/scenarios/across-the-ettenmoors/game.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { angmarAwakenedNotes, angmarAwakenedRows } from "../../log-angmar-awakened.ts";
import { applyResolution, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const ettenmoors = loadScenario("across-the-ettenmoors");
const LOSING_TIME = "10183";
const DETERMINATION = "10172";
const WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, a safe location in the victory display" : "two-handed, won, a safe location in the victory display");
const GRAM_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof ettenmoorsWorld>>;
let dike: Awaited<ReturnType<typeof dikeWorld>>;
let eriador: Awaited<ReturnType<typeof eriadorWorld>>;
let gram: Awaited<ReturnType<typeof gramWorld>>;

beforeAll(async () => {
  world = await ettenmoorsWorld("strong");
  dike = await dikeWorld("strong");
  eriador = await eriadorWorld("strong");
  gram = await gramWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt from a campaign log and its Setup played, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(ettenmoorsStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The log each won golden writes onto the parts before it (goldenState, not a game played again): what Across the Ettenmoors is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", GRAM_WON(seats)), dike.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", GRAM_WON(seats)), eriador.cards, NO_COPY_LIMITS);
const gramLog = (seats: 1 | 2): CampaignLog => applyResolution(gramPlan(seats, wastesLog(seats)).log, "escape-from-mount-gram", goldenState("escape-from-mount-gram", GRAM_WON(seats)), gram.cards, NO_COPY_LIMITS);

// Across the Ettenmoors in the angmar-awakened campaign (part 6, campaign card 10182). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again; this scenario's own won and lost states the same way.
describe("Across the Ettenmoors in the angmar-awakened campaign", () => {
  it("is part 6 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(ettenmoors.id)).toBe(5);
    expect(ettenmoors.campaignCard).toBe("10182");
  });

  it("is playable, and the path offers it after Escape from Mount Gram's win", () => {
    expect(PLAYABLE_SCENARIOS).toContain("across-the-ettenmoors");
    const path = campaignPath(campaign, {}, gramLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(4, 6)).toEqual([["escape-from-mount-gram", "completed"], ["across-the-ettenmoors", "current"]]);
  });

  it("10182:A:2 deals the Campaign Setup: the five Losing Time set aside, out of play, with none in the pool yet", () => {
    for (const seats of [1, 2] as const) {
      const log = gramLog(seats);
      expect(log.campaignPool.some((card) => card.code === LOSING_TIME), `${seats} seats`).toBe(false);
      expect(ettenmoorsPlan(seats, log).log.campaignPool.some((card) => card.code === LOSING_TIME), `${seats} seats`).toBe(false);
      const started = opened(seats, log);
      expect(copies(started, LOSING_TIME).map((card) => card.zone), `${seats} seats`).toEqual(["setAside", "setAside", "setAside", "setAside", "setAside"]);
      expect(copies(started, "10182").map((card) => card.zone), `${seats} seats`).toEqual(["campaign"]);
    }
  });

  it("hands the previous parts to this one: the pool Escape from Mount Gram leaves reaches the game, Fend Off Despair in the encounter deck and a Determination for each player in the pool", () => {
    for (const seats of [1, 2] as const) {
      const log = gramLog(seats);
      expect(log.campaignPool.filter((card) => card.code === DETERMINATION), `${seats} seats`).toHaveLength(seats);
      const started = opened(seats, log);
      expect(copies(started, "10173").length, `${seats} seats`).toBe(1);
      expect(copies(started, "10160").length, `${seats} seats`).toBe(1);
    }
  });

  it("deals the original card in a standalone game: no campaign card, no clock, no Losing Time", () => {
    const alone = opened(1, ettenmoorsPlan(1).log, true);
    expect(copies(alone, "10182").filter((card) => card.zone !== "setAside")).toHaveLength(0);
    expect(copies(alone, LOSING_TIME)).toHaveLength(0);
    expect(alone.cards[alone.questStage ?? ""]?.code).toBe("10064");
  });

  // The Resolution (10182:B:1 and 10172:A:1's mark) on the won goldens' final states (goldenState, not a game played again), over the log Escape from Mount Gram left.
  it("10182:B:1 adds each Losing Time in the encounter deck or discard pile to the pool, none of the copies set aside, and The Treachery of Rhudaur waits behind", () => {
    for (const seats of [1, 2] as const) {
      const state = goldenState("across-the-ettenmoors", WON(seats));
      expect(state.stageCleared, `${seats} seats`).toBe(true);
      const log = applyResolution(gramLog(seats), "across-the-ettenmoors", state, world.cards, NO_COPY_LIMITS);
      const lying = copies(state, LOSING_TIME).filter((card) => card.zone === "encounterDeck" || card.zone === "encounterDiscard").length;
      const setAside = copies(state, LOSING_TIME).filter((card) => card.zone === "setAside").length;
      expect(lying, `${seats} seats`).toBeGreaterThan(0);
      expect(log.campaignPool.filter((card) => card.code === LOSING_TIME), `${seats} seats`).toHaveLength(lying);
      expect(lying + setAside + copies(state, LOSING_TIME).filter((card) => !["encounterDeck", "encounterDiscard", "setAside"].includes(card.zone)).length, `${seats} seats`).toBe(5);
      expect(log.completed, `${seats} seats`).toContain("across-the-ettenmoors");
      expect(campaignPath(campaign, {}, log).find((node) => node.id === campaign.scenarios[6])?.status, `${seats} seats`).not.toBe("completed");
    }
  });

  it("10182:B:1 a lost game writes nothing: no Losing Time joins the pool", () => {
    const lost = ETTENMOORS_GOLDENS.find((golden) => golden.outcome === "lost")!;
    expectLossWritesNothing(gramLog(1), "across-the-ettenmoors", lost.name, world.cards);
  });

  it("10172:A:1 writes Determination's mark in this scenario too: a hero carrying it when the scenario is won is determined in the log, with the Losing Time copies earned beside it", () => {
    const log = gramLog(1);
    const started = opened(1, log);
    const hero = started.seats[0]?.heroes[0] ?? "";
    // A Determination from the player's deck is in the hand (the opening hand is the seed's). It costs 2: the side quest this seed's Setup staged, Scavenge for Supplies, makes each player card cost 1 more.
    const drawn = copies(started, DETERMINATION).find((card) => card.zone === "hand" || card.zone === "deck")!;
    const inHand = drawn;
    const funded = updateCard(moveCard(started, drawn.id, { zone: "hand", seat: 0 }), hero, { resources: 3 });
    const played = expectOk(reduce(funded, { type: "PlayCard", cardId: inHand.id, payments: [{ heroId: hero, amount: 2 }] }, ctx)).state;
    let state = played;
    for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    const host = copies(state, DETERMINATION).find((card) => card.host != null)?.host;
    expect(host).toBeTruthy();
    const won = settle({ ...state, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10182", "resolution") }, ctx, []);
    const next = applyResolution(log, "across-the-ettenmoors", won, world.cards, NO_COPY_LIMITS);
    const hostCode = won.cards[host ?? ""]?.code ?? "";
    expect(next.determined).toEqual([hostCode]);
    expect(angmarAwakenedRows(next, 1).find((row) => row.id === "log-determined")).toMatchObject({ label: "Determined Characters" });
    expect(angmarAwakenedNotes(won.resolutionLog, (code) => code)).toContain(`Marked determined in the campaign log: ${hostCode}.`);
  });
});
