// Rules: mec112.campaign-mode, mec112.setting-up-the-game, mec112.setup-journey-to-the-cross-roads, ltp.campaign-setup-checklist, rr.winning-the-game (data/rules/entries.json); ledger lines 144069:A:2 and 144069:B:1.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { ROADS_GOLDENS, roadsStart, roadsWorld } from "../../../../test/scenarios/journey-to-the-cross-roads/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { marshesWonLog } from "../../../../scripts/e2e/journey-to-the-cross-roads.ts";
import { prebuiltDeck } from "../../../../scripts/e2e/seed-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { temporaryCatalog } from "../../../../test/harness/temp-catalog.ts";

import { startFor } from "../../briefing.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { standaloneStart } from "../../standalone.ts";
import { loadWorld } from "../../world.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-two-towers");
const roads = loadScenario("journey-to-the-cross-roads");
const BRACE = "144014";
const FRODO = "141001";
const ONE_RING = "144063";
const BLACK_GATE = "144027";
let ctx: ReduceContext;
let afterMarshes: CampaignLog;
// The wins are played with the "tense" stand-in heroes the golden wins with.
let tense: Awaited<ReturnType<typeof roadsWorld>>;

// The log the earlier parts' real Resolutions leave: The Uruk-hai's, Helm's Deep's, The Road to Isengard's and The Passage of the Marshes' wins, resolved one onto the other, two-handed (scripts/e2e/journey-to-the-cross-roads.ts).
beforeAll(async () => {
  afterMarshes = await marshesWonLog();
  const made = await roadsWorld("strong");
  ctx = made.ctx;
  tense = await roadsWorld("tense");
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option.
function opened(seats: 1 | 2, log: CampaignLog, choices: readonly string[]): ScenarioState {
  let state = startScenario(roadsStart(seats, 1, "Normal", undefined, log, undefined, choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const heroResources = (state: ScenarioState, seat: number) => state.seats[seat]?.heroes.map((id) => state.cards[id]?.resources ?? 0) ?? [];

// Journey to the Cross-roads in the the-two-towers campaign (part 5, campaign card 144069).
describe("Journey to the Cross-roads in the the-two-towers campaign", () => {
  it("is part 5 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(roads.id)).toBe(4);
    expect(roads.campaignCard).toBe("144069");
  });

  it("is playable, and the path offers it as the current part once The Passage of the Marshes is won", () => {
    expect(PLAYABLE_SCENARIOS).toContain("journey-to-the-cross-roads");
    expect(campaignPath(campaign, {}, emptyLog(1))[4]).toMatchObject({ id: "journey-to-the-cross-roads", status: "locked" });
    const path = campaignPath(campaign, {}, afterMarshes);
    expect(path.slice(0, 5).map((node) => [node.id, node.status])).toEqual([["the-uruk-hai", "completed"], ["helms-deep", "completed"], ["the-road-to-isengard", "completed"], ["the-passage-of-the-marshes", "completed"], ["journey-to-the-cross-roads", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "journey-to-the-cross-roads" } });
  });

  it("144069:A:2 a player who takes the resources starts each hero with 1 more, a player who takes Brace of Coneys shuffles a copy into their deck", () => {
    const state = opened(2, afterMarshes, ["resources", BRACE]);
    expect(heroResources(state, 0).every((amount) => amount >= 1)).toBe(true);
    const held = copies(state, BRACE).filter((card) => card.owner === 1 || card.controller === 1);
    expect(held).toHaveLength(1);
    expect(["deck", "hand"]).toContain(held[0]?.zone);
    expect(copies(state, BRACE).filter((card) => card.owner === 0 || card.controller === 0)).toHaveLength(0);
    expect(heroResources(state, 1).every((amount) => amount === 0 || amount === (heroResources(state, 1)[0] ?? 0))).toBe(true);
    const both = opened(2, afterMarshes, ["resources", "resources"]);
    expect(copies(both, BRACE)).toHaveLength(0);
    expect(heroResources(both, 1).every((amount) => amount >= 1)).toBe(true);
  });

  // What The Passage of the Marshes' Resolution (144067:B:1) leaves reaches this deal: a seat that took the penalty starts 2 higher, a seat that earned The Searching Eye has it in its deck.
  it("144067:B:1 the penalty and the Searching Eye the Marshes earned reach this Setup, each seat its own", () => {
    const threats = (state: ScenarioState) => state.seats.map((seat) => seat.threat);
    const nowhere = opened(2, { ...afterMarshes, threatPenaltyBySeat: [0, 0], marshesChoice: ["searchingEye", "searchingEye"] }, ["resources", "resources"]);
    const penalised = opened(2, afterMarshes, ["resources", "resources"]);
    expect(threats(penalised).map((value, seat) => value - (threats(nowhere)[seat] ?? 0))).toEqual([2, 2]);
    // Seat 1 took the Searching Eye in the Marshes, seat 0 the penalty.
    const eye = { code: "144015", back: "player", burdenSet: null, attachedTo: null, seat: 1 } as const;
    const mixed = opened(2, { ...afterMarshes, threatPenaltyBySeat: [2, 0], marshesChoice: ["penalty", "searchingEye"], campaignPool: [...afterMarshes.campaignPool, eye] }, ["resources", "resources"]);
    expect(threats(mixed).map((value, seat) => value - (threats(nowhere)[seat] ?? 0))).toEqual([2, 0]);
    const held = copies(mixed, "144015").filter((card) => card.owner === 1 || card.controller === 1);
    expect(held).toHaveLength(1);
    expect(copies(mixed, "144015").filter((card) => card.owner === 0 || card.controller === 0)).toHaveLength(0);
    expect(copies(penalised, "144015")).toHaveLength(0);
  });

  it("144069:A:2 leaves the Two Towers burdens out of the decks and deals the Ring-bearer with The One Ring to the first player", () => {
    const state = opened(2, afterMarshes, ["resources", "resources"]);
    for (const code of ["143021", "143068"]) expect(copies(state, code)).toHaveLength(0);
    const ring = copies(state, ONE_RING);
    expect(ring).toHaveLength(1);
    expect(ring[0]?.host && state.cards[ring[0].host]?.code).toBe(FRODO);
    expect(Object.values(state.cards).some((card) => card.code === "144069")).toBe(false);
  });

  it("144069:A:2 deals no Brace of Coneys from a standalone deal of the same seat, and one from a campaign deal that chose it", () => {
    const seat = { deckId: "the-one-deck", ...prebuiltDeck("the-one-deck") };
    const world = loadWorld(drizzle(new Database(temporaryCatalog(), { readonly: true })), campaign, roads, EFFECTS, [FRODO, BRACE, ...seat.heroes, ...seat.deck]);
    const standalone = standaloneStart(world, 1, { scenarioId: roads.id, difficulty: "Normal", seats: [seat], ringBearer: FRODO }, 1);
    const campaignStart = startFor({ world, log: emptyLog(1), seatCount: 1, seats: [seat], ringBearer: FRODO, difficulty: "Normal", choices: [BRACE] }, 1);
    const braces = (start: { seats: readonly { deck: readonly string[] }[] }) => start.seats.flatMap((one) => one.deck).filter((code) => code === BRACE).length;
    expect(braces(standalone)).toBe(0);
    expect(braces(campaignStart)).toBe(1);
  });

  // The Resolution (144069:B:1) earns each Brace of Coneys chosen at Setup, for the seat that chose it, and writes the enemies facedown under The Black Gate to the log. A copy of Brace of Coneys in a deck changes what the
  // seed deals, so each answer has a golden of its own (test/scenarios/journey-to-the-cross-roads/game.ts); the test reads its final state from golden.json.
  const resolved = (name: string) => {
    const state = goldenState("journey-to-the-cross-roads", name);
    expect(state.stageCleared, name).toBe(true);
    return { game: { state }, log: applyResolution(emptyLog(state.seatCount), state.scenarioId, state, tense.cards, NO_COPY_LIMITS) };
  };

  it("144069:B:1 earns a Brace of Coneys for each player who chose it at Setup, and none for the player who took the resources", () => {
    const { log } = resolved("two-handed, won, Normal, one player takes Brace of Coneys");
    expect(log.campaignPool.filter((card) => card.code === BRACE).map((card) => card.seat)).toEqual([0]);
    expect(log.completed).toEqual(["journey-to-the-cross-roads"]);
    const both = resolved("two-handed, won, Normal, both players take Brace of Coneys").log;
    expect(both.campaignPool.filter((card) => card.code === BRACE).map((card) => card.seat).sort()).toEqual([0, 1]);
    const none = resolved("two-handed, won, Normal").log;
    expect(none.campaignPool.some((card) => card.code === BRACE)).toBe(false);
  });

  it("144069:B:1 a true solo win earns the one copy the player chose", () => {
    const { log } = resolved("true solo, won, Normal, the player takes Brace of Coneys");
    expect(log.campaignPool.filter((card) => card.code === BRACE).map((card) => card.seat)).toEqual([0]);
  });

  it("144069:B:1 writes the enemies lying facedown under The Black Gate to the campaign log, by code", () => {
    for (const name of ["two-handed, won, Normal", "two-handed, won, Easy", "true solo, won, Normal", "true solo, won, Easy"]) {
      const { game, log } = resolved(name);
      const gate = Object.values(game.state.cards).find((card) => card.code === BLACK_GATE)!;
      const under = Object.values(game.state.cards).filter((card) => card.zone === "under" && card.host === gate.id);
      const counted: Record<string, number> = {};
      for (const card of under) counted[card.code] = (counted[card.code] ?? 0) + 1;
      expect(log.blackGate, name).toEqual(counted);
    }
    const some = ROADS_GOLDENS.filter((golden) => golden.outcome === "won").some((golden) => {
      const { game } = resolved(golden.name);
      return Object.values(game.state.cards).some((card) => card.zone === "under");
    });
    expect(some).toBe(true);
  });

  it("144069:B:1 unlocks Shelob's Lair on the path, which the app cannot deal yet", () => {
    const path = campaignPath(campaign, {}, { ...afterMarshes, completed: [...afterMarshes.completed, "journey-to-the-cross-roads"] });
    expect(path.slice(4, 6).map((node) => [node.id, node.status])).toEqual([["journey-to-the-cross-roads", "completed"], ["shelobs-lair", "soon"]]);
    expect(PLAYABLE_SCENARIOS).not.toContain("shelobs-lair");
  });

  it("deals no campaign card from a fresh log in the Setup's place, and starts on stage 1", () => {
    const state = opened(1, emptyLog(1), ["resources"]);
    expect(Object.values(state.cards).some((card) => card.code === "144069")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("144068");
  });
});
