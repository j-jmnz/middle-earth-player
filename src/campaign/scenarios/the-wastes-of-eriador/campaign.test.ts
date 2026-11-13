// Rules: mec108.campaign-setup-the-wastes-of-eriador, mec108.setup-the-wastes-of-eriador, mec108.campaign-log, mec108.campaign-log-tracking, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode, rr.attachment-cards, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 10171:A:2, 10171:B:1, 10172:A:1, 10173:A:2, 100158:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterDike, ERIADOR_GOLDENS, eriadorPlan, eriadorStart, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { angmarAwakenedNotes, angmarAwakenedRows } from "../../log-angmar-awakened.ts";
import { applyResolution, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { seatPenalty, threatWords } from "../../two-towers-view.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const eriador = loadScenario("the-wastes-of-eriador");
const DETERMINATION = "10172";
const FEND_OFF_DESPAIR = "10173";
const ARNOR_RAVAGED = "100158";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof eriadorWorld>>;

beforeAll(async () => {
  world = await eriadorWorld("strong");
  await dikeWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt from a campaign log and its Setup played, every question answered with its first option (a log the golden state of Deadmen's Dike wrote, or a hand-made one).
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(eriadorStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The log Deadmen's Dike's won golden writes onto the parts before it (goldenState, not a game played again): what The Wastes of Eriador is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal"), world.cards, NO_COPY_LIMITS);

// The Wastes of Eriador in the angmar-awakened campaign (part 4, campaign card 10171). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again; this scenario's own won state the same way.
describe("The Wastes of Eriador in the angmar-awakened campaign", () => {
  it("is part 4 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(eriador.id)).toBe(3);
    expect(eriador.campaignCard).toBe("10171");
  });

  it("is playable, the road offers it after Deadmen's Dike's win, and the part after it (Escape from Mount Gram) waits behind it as locked", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-wastes-of-eriador");
    expect(PLAYABLE_SCENARIOS).toContain(campaign.scenarios[4]);
    const path = campaignPath(campaign, {}, dikeLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(2, 5)).toEqual([["deadmens-dike", "completed"], ["the-wastes-of-eriador", "current"], ["escape-from-mount-gram", "locked"]]);
  });

  it("10171:A:2 deals the Campaign Setup: a Determination in each hand and in the pool, Fend Off Despair shuffled into the encounter deck, no +1 threat for changing heroes", () => {
    for (const seats of [1, 2] as const) {
      const log = dikeLog(seats);
      const plan = eriadorPlan(seats, log);
      expect(plan.seats.flatMap((seat) => seat.afterMulligan ?? []).filter((code) => code === DETERMINATION), `${seats} seats`).toHaveLength(seats);
      expect(plan.log.campaignPool.filter((card) => card.code === DETERMINATION), `${seats} seats`).toHaveLength(seats);
      const started = opened(seats, log);
      expect(copies(started, DETERMINATION).map((card) => card.zone === "hand" || card.zone === "under"), `${seats} seats`).toEqual(Array(seats).fill(true));
      expect(copies(started, FEND_OFF_DESPAIR), `${seats} seats`).toHaveLength(1);
      expect(["encounterDeck", "staging"]).toContain(copies(started, FEND_OFF_DESPAIR)[0]?.zone);
    }
    expect(eriadorPlan(1, dikeLog(1)).log.threatPenalty).toBe(0);
  });

  it("100158:A:1 stages Arnor Ravaged once, with the damage the Campaign Log noted for it, in the game dealt from Deadmen's Dike's log, and Amarthiúl is in play under the first player", () => {
    const log: CampaignLog = { ...dikeLog(1), protectDamage: 4 };
    const started = opened(1, log);
    expect(copies(started, ARNOR_RAVAGED).map((card) => [card.zone, card.damage])).toEqual([["staging", 4]]);
    expect(copies(started, "10016").map((card) => [card.zone, card.controller])).toEqual([["play", started.firstPlayer]]);
    expect(started.cards[started.questStage ?? ""]?.code).toBe("10013");
    expect(copies(started, "10017").map((card) => card.zone)).toEqual(["setAside"]);
  });

  it("hands the previous parts to this one: Deadmen's Dike's pool reaches the game (Mysterious Omens shuffled in, Amarthiúl's Courage and a burden dealt as the Setup says) and the Determination copies are the new ones", () => {
    const log = dikeLog(1);
    const pooled = log.campaignPool.map((card) => card.code);
    expect(pooled).toEqual(expect.arrayContaining(["10160", ARNOR_RAVAGED]));
    const started = opened(1, log);
    expect(copies(started, "10160")).toHaveLength(1);
    // A Courage the pool holds is attached to Amarthiúl after the quest card's Setup (pool.test.ts), a burden is removed from this game and stays in the pool.
    const burden = pooled.find((code) => ["10168", "10169", "10170"].includes(code));
    if (burden) expect(copies(started, burden).every((card) => card.zone === "removed" || card.zone === "attached" || card.zone === "setAside")).toBe(true);
  });

  it("deals the original card in a standalone game: no campaign card, no Determination added, no Fend Off Despair, no Arnor Ravaged", () => {
    const started = opened(1, eriadorPlan(1).log, true);
    expect(started.cards[started.questStage ?? ""]?.code).toBe("10013");
    for (const code of ["10171", FEND_OFF_DESPAIR, ARNOR_RAVAGED]) expect(copies(started, code).filter((card) => card.zone !== "setAside"), code).toHaveLength(0);
    // No Determination is added to a hand after the mulligan (the filler decks of the goldens hold some of their own, as free events).
    expect(started.afterMulligan ?? []).toEqual([]);
    expect(copies(started, "10016").map((card) => card.zone)).toEqual(["play"]);
  });

  // The Resolution (10171:B:1 and 10173:A:2) on the won goldens' final states (goldenState, not a game played again), over the log Deadmen's Dike left.
  it("10171:B:1 earns Fend Off Despair, leaves Arnor Ravaged in the pool, and unlocks Escape from Mount Gram, the part after", () => {
    const before = eriadorPlan(1, dikeLog(1)).log;
    const state = goldenState("the-wastes-of-eriador", "true solo, won, Normal");
    expect(state.stageCleared).toBe(true);
    const log = applyResolution(before, "the-wastes-of-eriador", state, world.cards, NO_COPY_LIMITS);
    const pooled = log.campaignPool.map((card) => card.code);
    expect(pooled).toContain(FEND_OFF_DESPAIR);
    expect(pooled).toContain(ARNOR_RAVAGED);
    expect(pooled).toContain(DETERMINATION);
    // No Fend Off Despair was defeated: nothing is written to the starting threat.
    expect(log.threatPenalty).toBe(0);
    expect(log.completed).toEqual(["intruders-in-chetwood", "the-weather-hills", "deadmens-dike", "the-wastes-of-eriador"]);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(3, 5)).toEqual([["the-wastes-of-eriador", "completed"], ["escape-from-mount-gram", "current"]]);
  });

  it("10173:A:2 records Fend Off Despair's -2 on a win, shows it as -2 in the log, and the next start takes 2 off each hero's threat (not below 0)", () => {
    const before = eriadorPlan(1, dikeLog(1)).log;
    const state = goldenState("the-wastes-of-eriador", "true solo, won, Fend Off Despair defeated");
    expect(state.resolutionLog.startingThreat).toBe(-2);
    const log = applyResolution(before, "the-wastes-of-eriador", state, world.cards, NO_COPY_LIMITS);
    expect(log.threatPenalty).toBe(-2);
    expect(threatWords(log, 1)).toBe("−2");
    expect(seatPenalty(log, 0)).toBe(-2);
    expect(angmarAwakenedNotes(state.resolutionLog, (code) => world.cards.get(code)?.name ?? code)).toContain("Each player's starting threat is 2 lower from now on, noted in the campaign log.");
    // A game dealt from that log (every later start reads the same field) starts each hero 2 lower than one dealt from the log before it.
    const lowered = startScenario(eriadorStart(1, 1, "Normal", undefined, log), ctx);
    const plain = startScenario(eriadorStart(1, 1, "Normal", undefined, before), ctx);
    expect((lowered.seats[0]?.threat ?? 0) - (plain.seats[0]?.threat ?? 0)).toBe(-2);
    const floor = startScenario(eriadorStart(1, 1, "Normal", undefined, { ...log, threatPenalty: -99 }), ctx);
    expect(floor.seats[0]?.threat).toBe(0);
    // The lost goldens defeat nothing and write nothing.
    expect(ERIADOR_GOLDENS.filter((golden) => golden.outcome === "lost")).not.toHaveLength(0);
  });

  it("10172:A:1 writes Determination's mark: a hero carrying it when the scenario is won is determined in the log, shown in its rows, and the next game reads it and Determination readies it", () => {
    const log = dikeLog(1);
    const started = opened(1, log);
    const hero = started.seats[0]?.heroes[0] ?? "";
    const code = started.cards[hero]?.code ?? "";
    // The player attaches the Determination in hand to the hero (an Action, 1 resource), then the scenario is won.
    const inHand = copies(started, DETERMINATION).find((card) => card.zone === "hand")!;
    const funded = updateCard(started, hero, { resources: 2 });
    const played = expectOk(reduce(funded, { type: "PlayCard", cardId: inHand.id, payments: [{ heroId: hero, amount: 1 }] }, ctx)).state;
    let state = played;
    for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    // The Determination is the only unique character's pick here (Amarthiúl and the heroes are unique); the host is whoever the pick took.
    const host = copies(state, DETERMINATION).find((card) => card.host != null)?.host;
    expect(host).toBeTruthy();
    const won = settle({ ...state, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10171", "resolution") }, ctx, []);
    const next = applyResolution(log, "the-wastes-of-eriador", won, world.cards, NO_COPY_LIMITS);
    const hostCode = won.cards[host ?? ""]?.code ?? "";
    expect(next.determined).toEqual([hostCode]);
    expect(angmarAwakenedRows(next, 1).find((row) => row.id === "log-determined")).toMatchObject({ label: "Determined Characters" });
    expect(angmarAwakenedNotes(won.resolutionLog, (c) => c)).toContain(`Marked determined in the campaign log: ${hostCode}.`);
    // The next game of the campaign carries the mark as a fact, so Determination readies the determined character.
    const carried = startScenario(eriadorStart(1, 1, "Normal", undefined, next), ctx);
    expect(carried.campaignFacts?.angmar?.determined).toEqual([hostCode]);
    expect(code).toBeTruthy();
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing each lost golden leaves the log as it was", () => {
    for (const golden of ERIADOR_GOLDENS.filter((one) => one.outcome === "lost")) {
      const log = golden.after ? afterDike(golden.seatCount) : eriadorPlan(golden.seatCount).log;
      expectLossWritesNothing(log, "the-wastes-of-eriador", golden.name, world.cards);
    }
  });
});
