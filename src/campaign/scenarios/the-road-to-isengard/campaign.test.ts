// Rules: mec112.setup-the-road-to-isengard, mec112.campaign-mode, mec112.poisoned-counsels-searching-eye, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json); ledger lines 143081:A:2 and 143081:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { openResolution } from "../../../rules/setup/resolution.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { DEEP_GOLDENS, deepWorld, playGolden as playDeep } from "../../../../test/scenarios/helms-deep/game.ts";
import { ISENGARD_GOLDENS, isengardStart, isengardWorld, playGolden } from "../../../../test/scenarios/the-road-to-isengard/game.ts";
import { HAI_GOLDENS, haiWorld, playGolden as playHai } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-two-towers");
const isengard = loadScenario("the-road-to-isengard");
const COUNSELS = "143021";
const VOICE = "143068";
const PALANTIR = "143020";
let ctx: ReduceContext;
let cards: Map<string, PrintedCard>;
let afterDeep: CampaignLog;

// The log Helm's Deep's real Resolution leaves (143077:B:1) on the log The Uruk-hai's real Resolution leaves (143071:B:1), two-handed: each seat's copy of Poisoned Counsels held at the win is earned for its player.
beforeAll(async () => {
  const hai = await haiWorld("strong");
  hai.cards.set("q1", { ...hai.cards.get("q1")!, traits: ["Healer"] });
  hai.cards.set("q4", { ...hai.cards.get("q4")!, traits: ["Ranger"] });
  const haiGame = playHai(HAI_GOLDENS.find((item) => item.name === "two-handed, won, Normal")!, hai.ctx);
  expect(haiGame.state.stageCleared).toBe(true);
  const afterHai = applyResolution(emptyLog(2), haiGame.state.scenarioId, haiGame.state, hai.cards, NO_COPY_LIMITS);
  const deep = await deepWorld("strong");
  const deepGame = playDeep(DEEP_GOLDENS.find((item) => item.name === "two-handed, won, Normal")!, deep.ctx);
  expect(deepGame.state.stageCleared).toBe(true);
  afterDeep = applyResolution(afterHai, deepGame.state.scenarioId, deepGame.state, deep.cards, NO_COPY_LIMITS);
  const made = await isengardWorld("strong");
  ctx = made.ctx;
  cards = made.cards;
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(isengardStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The Road to Isengard in the the-two-towers campaign (part 3, campaign card 143081).
describe("The Road to Isengard in the the-two-towers campaign", () => {
  it("is part 3 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(isengard.id)).toBe(2);
    expect(isengard.campaignCard).toBe("143081");
  });

  it("is playable, and the path offers it as the current part once Helm's Deep is won", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-road-to-isengard");
    expect(campaignPath(campaign, {}, emptyLog(1))[2]).toMatchObject({ id: "the-road-to-isengard", status: "locked" });
    const path = campaignPath(campaign, {}, afterDeep);
    expect(path.slice(0, 3).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-road-to-isengard" } });
  });

  it("143081:A:2 the Poisoned Counsels Helm's Deep earned is shuffled into its owner's deck after the starting hand, one for each seat", () => {
    expect(afterDeep.campaignPool.filter((card) => card.code === COUNSELS).map((card) => card.seat).sort()).toEqual([0, 1]);
    const state = opened(2, afterDeep);
    const found = copies(state, COUNSELS);
    expect(found).toHaveLength(2);
    // Shuffled in after the starting hand: neither seat's opening hand holds it, and it lies in its owner's deck.
    for (const card of found) {
      expect(card.zone).toBe("deck");
      expect(state.seats.flatMap((seat) => seat.hand)).not.toContain(card.id);
    }
    for (const seat of [0, 1]) expect(state.seats[seat]?.deck.filter((id) => state.cards[id]?.code === COUNSELS)).toHaveLength(1);
  });

  it("143081:A:2 does not take the Poisoned Counsels out: the Setup removes only the Fellowship's burdens, and the encounter deck holds Saruman's Voice", () => {
    const campaignDeal = opened(2, afterDeep);
    const standalone = opened(2, emptyLog(2));
    expect(Object.values(campaignDeal.cards).some((card) => card.code === "143081")).toBe(false);
    expect(Object.values(campaignDeal.cards).some((card) => ["141078", "141080", "142085"].includes(card.code))).toBe(false);
    // Saruman's Voice is shuffled into the encounter deck by the Setup (the original card's own copy is the same card, so a standalone game holds one too): one copy lies there, and the Setup's shuffle added no second.
    const inDeck = (state: ScenarioState) => copies(state, VOICE).filter((card) => card.zone === "encounterDeck").length;
    expect(inDeck(campaignDeal)).toBe(1);
    expect(inDeck(standalone)).toBe(1);
    expect(copies(campaignDeal, COUNSELS).every((card) => card.zone === "deck")).toBe(true);
  });

  it("deals the original card in a standalone game, with no campaign card and no burden", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "143081")).toBe(false);
    expect(copies(state, COUNSELS)).toHaveLength(0);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("143078");
  });

  // The Resolution (143081:B:1) reads the hands at the win: Saruman's Voice when any hand holds 3 or fewer cards, the Palantír of Orthanc for the first player when any holds 3 or more.
  const won = (name: string) => {
    const golden = ISENGARD_GOLDENS.find((item) => item.name === name)!;
    const game = playGolden(golden, ctx);
    expect(game.state.stageCleared, name).toBe(true);
    return { golden, state: game.state };
  };
  const withHands = (state: ScenarioState, counts: readonly number[]): ScenarioState => {
    const resized = (index: 0 | 1) => {
      const seat = state.seats[index];
      return counts[index] == null ? seat : { ...seat, hand: Array.from({ length: counts[index] ?? 0 }, (_, at) => seat.hand[at] ?? seat.hand[0] ?? "") };
    };
    return { ...state, seats: [resized(0), resized(1)] };
  };
  // The campaign card's Resolution run again on the table at the win with these hands (it was run once, with the hands the game ended with).
  const earned = (state: ScenarioState, seatCount: 1 | 2) => {
    const resolving: ScenarioState = { ...state, window: null, stageCleared: true, resolutionAt: 0, resolutionSeat: 0, resolutionLog: { earned: [], fallen: [], captives: [] }, resolution: recordInstructions(EFFECTS, isengard.campaignCard, "resolution") };
    const done = openResolution(resolving, ctx);
    return applyResolution(emptyLog(seatCount), done.scenarioId, done, cards, NO_COPY_LIMITS).campaignPool;
  };

  it("143081:B:1 a win with every hand at 3 or fewer earns Saruman's Voice and no Palantír, and with every hand above 3 the Palantír and no Voice", () => {
    const { state } = won("two-handed, won, Normal");
    const seats = state.seats.slice(0, 2).map((seat) => seat.hand.length);
    expect(seats.every((count) => count >= 1)).toBe(true);
    const few = earned(withHands(state, [2, 2]), 2);
    expect(few.map((card) => card.code)).toEqual([VOICE]);
    const many = earned(withHands(state, [6, 4]), 2);
    expect(many.map((card) => card.code)).toEqual([PALANTIR]);
    expect(many[0]?.seat).toBe(state.firstPlayer);
  });

  it("143081:B:1 a win with one hand at 3 or fewer and another at 3 or more earns both, and the Palantír goes to the first player", () => {
    const { state } = won("two-handed, won, Easy");
    const both = earned(withHands(state, [2, 5]), 2);
    expect(both.map((card) => card.code).sort()).toEqual([PALANTIR, VOICE].sort());
    expect(both.find((card) => card.code === PALANTIR)?.seat).toBe(state.firstPlayer);
    const solo = won("true solo, won, Normal");
    expect(earned(withHands(solo.state, [3]), 1).map((card) => card.code).sort()).toEqual([PALANTIR, VOICE].sort());
    expect(earned(withHands(solo.state, [4]), 1).map((card) => card.code)).toEqual([PALANTIR]);
  });

  it("143081:B:1 the golden wins earn what their own hands say, and the log records the part as completed", () => {
    for (const golden of ISENGARD_GOLDENS.filter((item) => item.outcome === "won")) {
      const game = playGolden(golden, ctx);
      const log = applyResolution(emptyLog(golden.seatCount), game.state.scenarioId, game.state, cards, NO_COPY_LIMITS);
      const hands = game.state.seats.slice(0, golden.seatCount).map((seat) => seat.hand.length);
      expect(log.campaignPool.some((card) => card.code === VOICE), golden.name).toBe(hands.some((count) => count <= 3));
      expect(log.campaignPool.some((card) => card.code === PALANTIR), golden.name).toBe(hands.some((count) => count >= 3));
      expect(log.completed, golden.name).toEqual(["the-road-to-isengard"]);
    }
  });

  it("143081:B:1 unlocks The Passage of the Marshes on the path, which the app cannot deal yet", () => {
    const path = campaignPath(campaign, {}, { ...afterDeep, completed: ["the-uruk-hai", "helms-deep", "the-road-to-isengard"] });
    expect(path.slice(0, 4).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "completed"], ["the-passage-of-the-marshes", "soon"]]);
  });
});
