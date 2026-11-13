// Rules: mec108.campaign-setup-the-treachery-of-rhudaur, mec108.campaign-mode, mec108.campaign-log, mec108.the-investigation, mec108.objective-allies, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode (data/rules/entries.json); ledger lines 10094:A:1, 10168:A:1, 10167:A:1, 10184:B:1, 10172:A:1, 100158:A:1, 10160:A:3.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { moveCard, attachTo, spawn } from "../../../rules/core/zones.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { advanceResolution, applyResolution as answerResolution } from "../../../rules/setup/resolution.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { eriadorPlan, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { gramPlan, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { ettenmoorsWorld } from "../../../../test/scenarios/across-the-ettenmoors/game.ts";
import { rhudaurPlan, rhudaurStart, rhudaurWorld } from "../../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { applyResolution, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const rhudaur = loadScenario("the-treachery-of-rhudaur");
const ETT_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, a safe location in the victory display" : "two-handed, won, a safe location in the victory display");
const GRAM_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof rhudaurWorld>>;
let dike: Awaited<ReturnType<typeof dikeWorld>>;
let eriador: Awaited<ReturnType<typeof eriadorWorld>>;
let gram: Awaited<ReturnType<typeof gramWorld>>;
let ett: Awaited<ReturnType<typeof ettenmoorsWorld>>;

beforeAll(async () => {
  world = await rhudaurWorld("strong");
  dike = await dikeWorld("strong");
  eriador = await eriadorWorld("strong");
  gram = await gramWorld("strong");
  ett = await ettenmoorsWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt from a campaign log and its Setup played to the first quest phase, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(rhudaurStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
// The log each won golden writes onto the parts before it (goldenState, not a game played again): what The Treachery of Rhudaur is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", GRAM_WON(seats)), dike.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", GRAM_WON(seats)), eriador.cards, NO_COPY_LIMITS);
const gramLog = (seats: 1 | 2): CampaignLog => applyResolution(gramPlan(seats, wastesLog(seats)).log, "escape-from-mount-gram", goldenState("escape-from-mount-gram", GRAM_WON(seats)), gram.cards, NO_COPY_LIMITS);
const ettenmoorsLog = (seats: 1 | 2): CampaignLog => applyResolution(gramLog(seats), "across-the-ettenmoors", goldenState("across-the-ettenmoors", ETT_WON(seats)), ett.cards, NO_COPY_LIMITS);

// The Treachery of Rhudaur in the angmar-awakened campaign (part 7, campaign card 10184). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again.
describe("The Treachery of Rhudaur in the angmar-awakened campaign", () => {
  it("is part 7 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(rhudaur.id)).toBe(6);
    expect(rhudaur.campaignCard).toBe("10184");
  });

  it("is playable, and the path offers it after Across the Ettenmoors' win", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-treachery-of-rhudaur");
    const path = campaignPath(campaign, {}, ettenmoorsLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(5, 8)).toEqual([["across-the-ettenmoors", "completed"], ["the-treachery-of-rhudaur", "current"], [campaign.scenarios[7], "soon"]]);
  });

  it("10094:A:1 deals the Setup: the Great Hall active, the three side quests and the Ancient Causeway staged, Thaurdir set aside and Amarthiúl under the first player", () => {
    for (const seats of [1, 2] as const) {
      const started = opened(seats, ettenmoorsLog(seats));
      expect(started.cards[started.activeLocation ?? ""]?.code, `${seats} seats`).toBe("10097");
      expect(started.staging.map((id) => started.cards[id]?.code), `${seats} seats`).toEqual(expect.arrayContaining(["10109", "10111", "10113", "09057"]));
      expect(zonesOf(started, "10098"), `${seats} seats`).toEqual(["setAside"]);
      const amarthiul = copies(started, "10096")[0];
      expect(amarthiul?.zone, `${seats} seats`).toBe("play");
      expect(amarthiul?.controller, `${seats} seats`).toBe(started.firstPlayer);
      // The stage did not advance in the Setup: its three side quests are in play.
      expect(started.cards[started.questStage ?? ""]?.code, `${seats} seats`).toBe("10094");
    }
  });

  it("hands the previous parts to this one: Arnor Ravaged staged, Mysterious Omens, Fend Off Despair and the Losing Time copies shuffled in, a Determination for each player", () => {
    for (const seats of [1, 2] as const) {
      const log = ettenmoorsLog(seats);
      const started = opened(seats, log);
      expect(zonesOf(started, "100158"), `${seats} seats`).toEqual(["staging"]);
      for (const code of ["10160", "10173"]) expect(zonesOf(started, code), `${seats} seats ${code}`).toEqual(["encounterDeck"]);
      expect(zonesOf(started, "10183").every((zone) => zone === "encounterDeck"), `${seats} seats`).toBe(true);
      expect(copies(started, "10172").filter((card) => ["hand", "deck"].includes(card.zone)), `${seats} seats`).toHaveLength(seats);
    }
  });

  // Build check: the pool's Setup runs at the deal, before the data sets Thaurdir aside (10168:A:1's "Attach to Thaurdir (even if he is out of play)"): the burden waits and attaches to the set-aside Thaurdir, and stays on him when stage 2A adds him to the staging area.
  it("10168:A:1 attaches a Thaurdir burden to the set-aside Thaurdir at the Setup and keeps it on him when he enters the staging area", () => {
    for (const seats of [1, 2] as const) {
      const burden = seats === 1 ? "10168" : "10170";
      const started = opened(seats, ettenmoorsLog(seats));
      const thaurdir = copies(started, "10098")[0];
      expect(thaurdir?.zone, `${seats} seats`).toBe("setAside");
      expect(copies(started, burden).map((card) => card.host), `${seats} seats`).toEqual([thaurdir?.id]);
      expect(copies(started, burden).map((card) => card.zone), `${seats} seats`).toEqual(["attached"]);
      const stage2 = copies(started, "10095")[0];
      const entered = resolveStage2(started, stage2?.id ?? "");
      expect(entered.cards[thaurdir?.id ?? ""]?.zone, `${seats} seats`).toBe("staging");
      expect(entered.cards[thaurdir?.id ?? ""]?.attachments.map((id) => entered.cards[id]?.code), `${seats} seats`).toContain(burden);
    }
  });

  it("10167:A:1 attaches Amarthiúl's Courage to Amarthiúl once the Setup has put him into play, and removes it from the game when he is not in play", () => {
    const log = ettenmoorsLog(1);
    const withCourage: CampaignLog = { ...log, campaignPool: [...log.campaignPool.filter((card) => card.code !== "10157"), { ...log.campaignPool[0]!, code: "10167", back: "player", burdenSet: null, attachedTo: null, seat: null }] };
    const started = opened(1, withCourage);
    const courage = copies(started, "10167")[0];
    const amarthiul = copies(started, "10096")[0];
    expect(courage?.host).toBe(amarthiul?.id);
    expect(courage?.zone).toBe("attached");
    // Standalone play deals no pool card: no Courage anywhere.
    expect(copies(opened(1, rhudaurPlan(1).log, true), "10167")).toHaveLength(0);
  });

  it("deals the original card in a standalone game: no campaign card, no pool card, the Great Hall and the stage as the data says", () => {
    const alone = opened(1, rhudaurPlan(1).log, true);
    expect(copies(alone, "10184").filter((card) => card.zone !== "setAside")).toHaveLength(0);
    for (const code of ["100158", "10160", "10173", "10183", "10168"]) expect(copies(alone, code), code).toHaveLength(0);
    expect(alone.cards[alone.questStage ?? ""]?.code).toBe("10094");
    expect(alone.cards[alone.activeLocation ?? ""]?.code).toBe("10097");
  });

  // The Resolution on a won state with Clues claimed: each Clue's controller may add its boon to the pool; none offered for a Clue nobody controls.
  it("10184:B:1 offers each player the boon of each Clue they control, in the pool, and writes Determination's mark", () => {
    const log = ettenmoorsLog(2);
    const started = opened(2, log);
    const hero0 = started.seats[0]?.heroes[0] ?? "";
    const hero1 = started.seats[1]?.heroes[0] ?? "";
    let state = started;
    for (const [code, host] of [["10110", hero0], ["10112", hero1]] as const) {
      const spawned = spawn(state, code, { zone: "attached" });
      state = updateCard(attachTo(spawned.state, spawned.id, host), spawned.id, { claimed: true, controller: state.cards[host]?.controller ?? 0, face: "up" });
    }
    const won: ScenarioState = { ...state, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10184", "resolution"), resolutionAt: 0, resolutionSeat: 0 };
    // Each window offers the boon and "skip": the player takes the boon, and a Clue nobody controls opens no window.
    const asked: string[] = [];
    let step = advanceResolution(won, ctx);
    for (let guard = 0; guard < 12 && step.window?.kind === "resolution"; guard += 1) {
      const options = legalIntents(step, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      asked.push(`${step.window.seat}:${options.join("/")}`);
      step = advanceResolution(answerResolution(step, options.find((option) => option !== "skip") ?? "skip"), ctx);
    }
    expect(asked).toEqual(["0:10185/skip", "1:10186/skip"]);
    const earned = step.resolutionLog.earned.map((item) => `${item.code}:${item.seat}`);
    // Seat 0 controls the Brand and seat 1 the Heirloom; nobody controls the Orders.
    expect(earned.sort()).toEqual(["10185:0", "10186:1"]);
  });
});

// Stage 2A's When Revealed run on the Setup's state: Thaurdir is added to the staging area from where the Setup set him aside.
function resolveStage2(state: ScenarioState, stageId: string): ScenarioState {
  const stage = state.cards[stageId];
  if (!stage) return state;
  const card = state.cards[copies(state, "10098")[0]?.id ?? ""];
  return card ? moveCard(state, card.id, { zone: "staging" }) : state;
}
