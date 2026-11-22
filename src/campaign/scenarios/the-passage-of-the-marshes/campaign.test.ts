// Rules: mec112.campaign-mode, mec112.setting-up-the-game, mec112.poisoned-counsels-searching-eye, ltp.campaign-setup-checklist (data/rules/entries.json); ledger lines 144067:A:2 and 144067:B:1.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { marshesStart, marshesWorld } from "../../../../test/scenarios/the-passage-of-the-marshes/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { isengardWonLog } from "../../../../scripts/e2e/the-passage-of-the-marshes.ts";
import { prebuiltDeck, SOLO_FIXTURE_DECK } from "../../../../scripts/e2e/seed-kit.ts";
import { temporaryCatalog } from "../../../../test/harness/temp-catalog.ts";

import { briefing, startFor } from "../../briefing.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { standaloneStart } from "../../standalone.ts";
import { loadWorld } from "../../world.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-two-towers");
const marshes = loadScenario("the-passage-of-the-marshes");
const SEARCHING_EYE = "144015";
const COUNSELS = "143021";
const VOICE = "143068";
const FRODO = "141001";
const ONE_RING = "144063";
let ctx: ReduceContext;
let cards: Map<string, PrintedCard>;
let afterIsengard: CampaignLog;

// The log the earlier parts' real Resolutions leave: The Uruk-hai's, Helm's Deep's and The Road to Isengard's wins, resolved one onto the other, two-handed (scripts/e2e/the-passage-of-the-marshes.ts).
beforeAll(async () => {
  afterIsengard = await isengardWonLog();
  const made = await marshesWorld("strong");
  ctx = made.ctx;
  cards = made.cards;
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog): ScenarioState {
  let state = startScenario(marshesStart(seats, 1, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The Passage of the Marshes in the the-two-towers campaign (part 4, campaign card 144067).
describe("The Passage of the Marshes in the the-two-towers campaign", () => {
  it("is part 4 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(marshes.id)).toBe(3);
    expect(marshes.campaignCard).toBe("144067");
  });

  it("is playable, and the path offers it as the current part once The Road to Isengard is won", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-passage-of-the-marshes");
    expect(campaignPath(campaign, {}, emptyLog(1))[3]).toMatchObject({ id: "the-passage-of-the-marshes", status: "locked" });
    const path = campaignPath(campaign, {}, afterIsengard);
    expect(path.slice(0, 4).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "completed"], ["the-passage-of-the-marshes", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-passage-of-the-marshes" } });
  });

  it("144067:A:2 the Setup shuffles 1 Searching Eye into each deck, and removes the burdens of Helm's Deep and The Road to Isengard from the encounter deck and the decks", () => {
    expect(afterIsengard.campaignPool.some((card) => card.code === COUNSELS)).toBe(true);
    const state = opened(2, afterIsengard);
    for (const seat of [0, 1]) {
      const held = copies(state, SEARCHING_EYE).filter((card) => card.controller === seat || card.owner === seat);
      expect(held, `seat ${seat}`).toHaveLength(1);
      expect(["deck", "hand"], `seat ${seat}`).toContain(held[0]?.zone);
    }
    expect(copies(state, COUNSELS)).toHaveLength(0);
    expect(copies(state, VOICE)).toHaveLength(0);
    expect(Object.values(state.cards).some((card) => card.code === "144067")).toBe(false);
  });

  it("144067:A:2 deals no Searching Eye from a standalone deal of the same seat, and one from a campaign deal", () => {
    const seat = { deckId: SOLO_FIXTURE_DECK, ...prebuiltDeck(SOLO_FIXTURE_DECK) };
    const world = loadWorld(drizzle(new Database(temporaryCatalog(), { readonly: true })), campaign, marshes, EFFECTS, [FRODO, ...seat.heroes, ...seat.deck]);
    const standalone = standaloneStart(world, 1, { scenarioId: marshes.id, difficulty: "Normal", seats: [seat], ringBearer: FRODO }, 1);
    const campaignStart = startFor({ world, log: emptyLog(1), seatCount: 1, seats: [seat], ringBearer: FRODO, difficulty: "Normal" }, 1);
    const eyes = (start: { seats: readonly { deck: readonly string[] }[] }) => start.seats.flatMap((one) => one.deck).filter((code) => code === SEARCHING_EYE).length;
    expect(eyes(standalone)).toBe(0);
    expect(eyes(campaignStart)).toBe(1);
  });

  // The saga start of scenarios 10 to 12 (mec112.setting-up-the-game): the Ring-bearer returns to the first seat, with The One Ring attached.
  it("144063:A:1 the first player holds the Ring-bearer with The One Ring attached, true solo and two-handed", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats, afterIsengard);
      const ring = copies(state, ONE_RING);
      expect(ring, `${seats} seats`).toHaveLength(1);
      expect(ring[0]?.zone).toBe("play");
      const host = ring[0]?.host ? state.cards[ring[0].host] : undefined;
      expect(host?.code, `${seats} seats`).toBe(FRODO);
      expect(host?.zone).toBe("heroes");
      expect(host?.controller).toBe(state.firstPlayer);
    }
  });

  it("144063:A:1 refuses a first seat with no Ring-bearer, and takes one with the saga Frodo", () => {
    const seat = { deckId: SOLO_FIXTURE_DECK, ...prebuiltDeck(SOLO_FIXTURE_DECK) };
    const world = loadWorld(drizzle(new Database(temporaryCatalog(), { readonly: true })), campaign, marshes, EFFECTS, [FRODO, ...seat.heroes, ...seat.deck]);
    const input = { world, log: emptyLog(1), seatCount: 1 as const, seats: [seat], difficulty: "Normal" as const };
    expect(briefing({ ...input, ringBearer: null }).problems.map((problem) => problem.message).join(" ")).toMatch(/Ring-bearer/);
    expect(briefing({ ...input, ringBearer: FRODO }).problems).toEqual([]);
  });

  it("deals no campaign card and no Searching Eye from a fresh log in the Setup's place, and starts on stage 1", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "144067")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("144064");
  });

  // The Resolution (144067:B:1) asks each player in turn for a permanent +2 starting threat penalty or a copy of The Searching Eye, and records the choice in the log.
  // The goldens' final states (their golden.json): the penalty is the policy's first option, the Searching Eye its last.
  const resolved = (name: string) => {
    const state = goldenState("the-passage-of-the-marshes", name);
    expect(state.stageCleared, name).toBe(true);
    return { log: applyResolution(emptyLog(state.seatCount), state.scenarioId, state, cards, NO_COPY_LIMITS) };
  };

  it("144067:B:1 each player who chooses the penalty starts the next scenarios 2 higher, and the choice is in the log", () => {
    const { log } = resolved("two-handed, won, Normal");
    expect(log.threatPenaltyBySeat).toEqual([2, 2]);
    expect(log.marshesChoice).toEqual(["penalty", "penalty"]);
    expect(log.campaignPool.some((card) => card.code === SEARCHING_EYE)).toBe(false);
    expect(log.completed).toEqual(["the-passage-of-the-marshes"]);
  });

  it("144067:B:1 each player who chooses the Searching Eye earns a copy for themselves and no penalty", () => {
    const { log } = resolved("two-handed, won, Normal, each player takes the Searching Eye");
    expect((log.threatPenaltyBySeat ?? []).reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(log.marshesChoice).toEqual(["searchingEye", "searchingEye"]);
    expect(log.campaignPool.filter((card) => card.code === SEARCHING_EYE).map((card) => card.seat).sort()).toEqual([0, 1]);
  });

  it("144067:B:1 a true solo win asks the one player the same question", () => {
    const { log } = resolved("true solo, won, Normal");
    expect(log.threatPenaltyBySeat).toEqual([2]);
    expect(log.marshesChoice).toEqual(["penalty"]);
  });

  it("144067:B:1 unlocks Journey to the Cross-roads on the path, which the app deals", () => {
    const path = campaignPath(campaign, {}, { ...afterIsengard, completed: [...afterIsengard.completed, "the-passage-of-the-marshes"] });
    expect(path.slice(3, 5).map((node) => [node.id, node.status])).toEqual([["the-passage-of-the-marshes", "completed"], ["journey-to-the-cross-roads", "current"]]);
    expect(PLAYABLE_SCENARIOS).toContain("journey-to-the-cross-roads");
  });
});
