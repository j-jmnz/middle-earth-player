// Rules: mec108.campaign-setup-the-weather-hills, mec108.setup-the-weather-hills, mec108.campaign-log-tracking, rr.campaign-pool, rr.campaign-setup-checklist, ltp.permanent, rr.winning-the-game (data/rules/entries.json); ledger lines 10159:A:2, 10159:B:1 and 10160:A:3.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { hillsPlan, hillsStart, hillsWorld, HILLS_GOLDENS } from "../../../../test/scenarios/the-weather-hills/game.ts";
import { chetwoodWorld } from "../../../../test/scenarios/intruders-in-chetwood/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const hills = loadScenario("the-weather-hills");
const PROTECT = "10158";
const OMENS = "10160";
const BOONS = ["10161", "10162", "10163", "10164", "10165"];
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof hillsWorld>>;
let chetwoodCards: Awaited<ReturnType<typeof chetwoodWorld>>["cards"];

beforeAll(async () => {
  world = await hillsWorld("strong");
  ctx = world.ctx;
  chetwoodCards = (await chetwoodWorld("strong")).cards;
}, 240_000);

const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The log of a campaign whose first part was won: Intruders in Chetwood's golden final state, resolved onto a blank log (goldenState, not a game played again).
const afterChetwood = (seats: 1 | 2): { log: CampaignLog; damage: number } => {
  const state = goldenState("intruders-in-chetwood", seats === 2 ? "two-handed, won, Normal" : "true solo, won, Normal");
  const log = applyResolution(emptyLog(seats), "intruders-in-chetwood", state, chetwoodCards, NO_COPY_LIMITS);
  return { log, damage: log.protectDamage ?? 0 };
};
// The scenario dealt from a campaign log and its Setup played, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(hillsStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The Weather Hills in the angmar-awakened campaign (part 2, campaign card 10159).
describe("The Weather Hills in the angmar-awakened campaign", () => {
  it("is part 2 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(hills.id)).toBe(1);
    expect(hills.campaignCard).toBe("10159");
  });

  it("is playable, and the road offers it after Intruders in Chetwood's win, with the part after it (Deadmen's Dike) playable too", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-weather-hills");
    expect(PLAYABLE_SCENARIOS).toContain(campaign.scenarios[2]);
    const { log } = afterChetwood(2);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 3)).toEqual([["intruders-in-chetwood", "completed"], ["the-weather-hills", "current"], ["deadmens-dike", "locked"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-weather-hills" } });
  });

  it("10159:A:2 deals the Campaign Setup from the log Intruders in Chetwood left: Protect the Innocent staged with the damage the log noted, once, and Mysterious Omens shuffled into the encounter deck, once", () => {
    for (const seats of [1, 2] as const) {
      const { log, damage } = afterChetwood(seats);
      expect(log.campaignPool.map((card) => card.code), `seats ${seats}`).toEqual([PROTECT]);
      const state = opened(seats, log);
      expect(copies(state, PROTECT).map((card) => [card.zone, card.damage]), `seats ${seats}`).toEqual([["staging", damage]]);
      expect(copies(state, OMENS).map((card) => card.zone), `seats ${seats}`).toEqual(["encounterDeck"]);
      expect(copies(state, "10159"), `seats ${seats}`).toHaveLength(0);
      expect(state.cards[state.questStage ?? ""]?.code, `seats ${seats}`).toBe("09069");
    }
  });

  it("10159:A:2 shuffles in no second Mysterious Omens when the pool already holds it, as after a lost game replayed", () => {
    const { log } = afterChetwood(1);
    const again: CampaignLog = { ...log, campaignPool: [...log.campaignPool, poolCard(chetwoodWorld0(OMENS), OMENS, null, null)] };
    const state = opened(1, again);
    expect(copies(state, OMENS)).toHaveLength(1);
    expect(copies(state, PROTECT)).toHaveLength(1);
  });

  it("10159:A:2 deals neither card in a standalone game: no campaign card, no Protect the Innocent, no Mysterious Omens", () => {
    const state = opened(1, emptyLog(1), true);
    expect(copies(state, PROTECT)).toHaveLength(0);
    expect(copies(state, OMENS)).toHaveLength(0);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("09069");
  });

  // The Resolution (10159:B:1): a golden's final state is resolved onto the log Intruders in Chetwood left (goldenState, not a game played again).
  it("10159:B:1 replaces the damage noted on Protect the Innocent, keeps it and Mysterious Omens in the pool, and unlocks Deadmen's Dike", () => {
    // The log the checklist leaves the game with: Mysterious Omens joined the pool at the Setup (10159:A:2).
    const before = hillsPlan(1, afterChetwood(1).log).log;
    const state = goldenState("the-weather-hills", "true solo, won, Normal");
    expect(state.stageCleared).toBe(true);
    const log = applyResolution(before, "the-weather-hills", state, world.cards, NO_COPY_LIMITS);
    expect(log.protectDamage).toBe(copies(state, PROTECT)[0]?.damage);
    expect(log.completed).toEqual(["intruders-in-chetwood", "the-weather-hills"]);
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([OMENS, PROTECT].sort());
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(1, 3)).toEqual([["the-weather-hills", "completed"], ["deadmens-dike", "current"]]);
  });

  it("10160:A:3 records each boon a won game ended with on the hero that carries it, one for each boon", () => {
    const table = tableFromLayout("the-weather-hills", { seats: 2, campaign: true, attached: [{ code: "10162", to: "dh1" }, { code: "10164", to: "dh3" }] });
    const resolving: ScenarioState = { ...table.state, phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10159", "resolution") };
    const state = settle(resolving, table.ctx, []);
    const log = applyResolution(emptyLog(2), "the-weather-hills", state, table.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.filter((card) => BOONS.includes(card.code)).map((card) => [card.code, card.attachedTo, card.seat]).sort()).toEqual([["10162", "dh1", 0], ["10164", "dh3", 1]]);
    // A game that ended with no boon attached records none.
    const bare = tableFromLayout("the-weather-hills", { seats: 2, campaign: true });
    const none = applyResolution(emptyLog(2), "the-weather-hills", settle({ ...bare.state, phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10159", "resolution") }, bare.ctx, []), bare.cards, NO_COPY_LIMITS);
    expect(none.campaignPool.filter((card) => BOONS.includes(card.code))).toEqual([]);
  });

  it("10160:A:3 the Campaign Setup Checklist attaches a boon the pool holds to the hero recorded for it when the scenario is dealt again from that log (a replay), and asks nobody", () => {
    const { log } = afterChetwood(2);
    const plan = hillsPlan(2, log);
    const hero = plan.seats[0]?.heroes[0] ?? "";
    const carried: CampaignLog = { ...log, campaignPool: [...log.campaignPool, poolCard(chetwoodWorld0("10162"), "10162", hero, 0)] };
    const next = hillsPlan(2, carried);
    expect(next.seats[0]?.attachments).toContainEqual({ host: hero, code: "10162" });
    expect(next.steps.find((step) => step.n === 5)?.did.join(" ")).toContain("goes on");
    const started = opened(2, carried);
    // The copy in play is the attached one (the others stay set aside): the one on the hero recorded for it.
    const inPlayCopies = copies(started, "10162").filter((card) => card.zone === "play");
    expect(inPlayCopies).toHaveLength(1);
    expect(started.cards[inPlayCopies[0]?.host ?? ""]?.code).toBe(hero);
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing each lost golden leaves the log as it was", () => {
    for (const golden of HILLS_GOLDENS.filter((one) => one.outcome === "lost")) {
      const log = golden.after ? afterChetwood(golden.seatCount).log : emptyLog(golden.seatCount);
      expectLossWritesNothing(log, "the-weather-hills", golden.name, world.cards);
    }
  });
});

const chetwoodWorld0 = (code: string) => world.cards.get(code)!;
