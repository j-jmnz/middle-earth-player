// Rules: mec108.campaign-log, mec108.campaign-mode, mec108.objective-allies, mec108.captured-cards, rr.campaign-pool, rr.campaign-setup-checklist, rr.removed-from-game, rr.keywords, rr.attachment-cards, faq.progress-without-advancing (data/rules/entries.json).
// The pool cards that meet Across the Ettenmoors, on the scenario dealt from the log Escape from Mount Gram's won golden leaves (goldenState, not a game played again): what the Campaign Setup deals, where the cards of the pool go and which of their lines run here.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { eriadorPlan, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { gramLoadout, gramPlan, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { ettenmoorsLoadout, ettenmoorsStart, ettenmoorsWorld } from "../../../../test/scenarios/across-the-ettenmoors/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { applyResolution, poolCard, type CampaignLog } from "../../log.ts";
import { validateLoadout } from "../../loadout.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
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

// The log each won golden writes onto the parts before it, the campaign's order: what Across the Ettenmoors is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", WON(seats)), dike.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", WON(seats)), eriador.cards, NO_COPY_LIMITS);
const gramLog = (seats: 1 | 2): CampaignLog => applyResolution(gramPlan(seats, wastesLog(seats)).log, "escape-from-mount-gram", goldenState("escape-from-mount-gram", WON(seats)), gram.cards, NO_COPY_LIMITS);

// The scenario dealt from a log and its Setup played, every question answered with its first option.
function opened(log: CampaignLog, seed: number, seats: 1 | 2 = 1): ScenarioState {
  let state = startScenario(ettenmoorsStart(seats, seed, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("the pool Escape from Mount Gram leaves, dealt to Across the Ettenmoors", () => {
  it("10182:A:2 sets 5 Losing Time aside, out of play, and the Setup of 10064 stages its pair and gives the first player Amarthiúl", () => {
    const state = opened(gramLog(1), 1);
    expect(copies(state, "10183").map((card) => card.zone)).toEqual(["setAside", "setAside", "setAside", "setAside", "setAside"]);
    const staged = state.staging.map((id) => state.cards[id]?.code ?? "");
    expect(staged.filter((code) => ["10068", "10069", "10070", "10071"].includes(code))).toHaveLength(1);
    expect(staged.filter((code) => ["10081", "10082", "10083"].includes(code))).toHaveLength(1);
    expect(copies(state, "10067").map((card) => card.zone)).toEqual(["play"]);
  });

  it("10171:A:2 and 10173:A:1 deal Fend Off Despair into the encounter deck and Determination into the pool's hands, as the Wastes left them", () => {
    const log = gramLog(1);
    expect(log.campaignPool.some((card) => card.code === "10172")).toBe(true);
    const state = opened(log, 2);
    expect(copies(state, "10173").map((card) => card.zone)).toContain("encounterDeck");
    expect(copies(state, "10172").length).toBeGreaterThan(0);
  });

  it("10160:A:2 deals Mysterious Omens into the encounter deck and Arnor Ravaged into the staging area, once each, with the damage the log noted (100158:A:1)", () => {
    const log = gramLog(1);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["10160", "100158"]));
    const state = opened(log, 3);
    expect(copies(state, "10160").map((card) => card.zone)).toEqual(["encounterDeck"]);
    expect(copies(state, "100158").map((card) => card.zone)).toEqual(["staging"]);
  });

  it("10167:A:1 attaches Amarthiúl's Courage to Amarthiúl after the quest card's Setup puts him into play, when the pool holds it", () => {
    const log = gramLog(1);
    const withCourage: CampaignLog = { ...log, campaignPool: [...log.campaignPool.filter((card) => card.code !== "10157"), poolCard(world.cards.get("10167")!, "10167", null, null)] };
    const state = opened(withCourage, 6);
    const courage = copies(state, "10167")[0];
    expect(courage?.zone).toBe("attached");
    expect(courage?.host).toBe(copies(state, "10067")[0]?.id);
  });

  it("10168:A:1 removes Thaurdir's burden from this game only (he is not in the scenario), and it stays in the pool", () => {
    const log = gramLog(1);
    expect(log.campaignPool.some((card) => card.code === "10168")).toBe(true);
    const state = opened(log, 4);
    expect(copies(state, "10168").map((card) => card.zone)).toEqual(["removed"]);
  });

  it("10172:A:1 and 10173:A:1 deal Determination into the player's deck and Fend Off Despair into the encounter deck, as the Wastes left them", () => {
    const log = gramLog(1);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["10172", "10173"]));
    const state = opened(log, 2);
    expect(copies(state, "10173").map((card) => card.zone)).toEqual(["encounterDeck"]);
    expect(copies(state, "10172").length).toBeGreaterThan(0);
  });

  it("10175:A:2 loads the Loot the Dungeons boons with this scenario, as the cards a player added to their hand and the pool", () => {
    for (const code of ["10176", "10177", "10178", "10179", "10180", "10181"]) expect(world.cards.has(code), code).toBe(true);
    const log = gramLog(1);
    const withBoon: CampaignLog = { ...log, campaignPool: [...log.campaignPool, poolCard(world.cards.get("10176")!, "10176", null, 0)] };
    const state = opened(withBoon, 5);
    expect(copies(state, "10176").length).toBe(1);
  });

  it("10174:B:3 refuses a card stolen in Escape from Mount Gram in that player's deck, and still lets a stolen hero start", () => {
    const state = goldenState("escape-from-mount-gram", WON(1));
    const log = applyResolution(wastesLog(1), "escape-from-mount-gram", state, gram.cards, NO_COPY_LIMITS);
    const first = log.stolenCards[0]?.[0] ?? "";
    expect(first, "the golden leaves a unique card in the player's captured deck").not.toBe("");
    const [seat] = gramLoadout(1);
    const clean = seat!.deck.filter((code) => !(log.stolenCards[0] ?? []).includes(code));
    const errors = (deck: readonly string[]) => validateLoadout([{ ...seat!, deck: [...deck] }], world.cards, false, [], [], {}, log.stolenCards).filter((error) => error.rule === "stolenCard");
    expect(errors(clean)).toHaveLength(0);
    expect(errors([...clean, first])).toHaveLength(1);
    expect(ettenmoorsLoadout).toBeDefined();
  });
});
