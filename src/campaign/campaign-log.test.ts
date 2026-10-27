import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { openResolution, resolutionResult } from "../rules/resolution.ts";
import { spawn } from "../rules/zones.ts";
import type { ScenarioState } from "../rules/state.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { loadWorld, table, type World } from "../../scripts/past-scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { carryOffers } from "./carry-over.ts";
import { checklist } from "./checklist.ts";
import { applyResolution, emptyLog, type CampaignLog, type PoolCard } from "./log.ts";
import { newSave, parseLog } from "./save.ts";

// Rules: ltp.campaign-pool, rr.campaign-pool, ltp.campaign-log, rr.campaign-log (data/rules/entries.json). The campaign log on
// the Mirkwood campaigns: several copies of one code in the pool, structured facts in place of notes, and the cards a finished
// campaign carries over to the next one. A won Passage-style Resolution is written on a Fellowship table, since the log reads
// only the final state and the Resolution's record.
const MENDOR = "01135";
const SUPPORT = "01132";
const SENSE = "41049";
const HERO = "141001";
const RING_DRAWS_THEM = "141079";

let world: World;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  world = await loadWorld();
  cards = new Map([...world.cards, ...(await loadPrinted([MENDOR, SUPPORT, SENSE, "41044", "141002", RING_DRAWS_THEM]))]);
  world = { ...world, cards };
});

type Resolution = ScenarioState["resolution"];

function won(resolution: Resolution, seats: 1 | 2, place: (state: ScenarioState) => ScenarioState = (state) => state): ScenarioState {
  const { state, ctx } = table(world, { seats });
  return openResolution({ ...place(state), phase: "Quest", window: null, stageCleared: true, resolution }, ctx);
}

const SCENARIO = "a-shadow-of-the-past";
const copies = (log: CampaignLog, code: string) => log.campaignPool.filter((card) => card.code === code);

describe("the pool holds several copies of one code", () => {
  it("each player earns a copy: two seats, two entries, each with its seat", () => {
    const state = won([{ verb: "Earn", codes: [SUPPORT], eachPlayer: true }], 2);
    expect(resolutionResult(state)?.earned.map((item) => [item.code, item.seat])).toEqual([[SUPPORT, 0], [SUPPORT, 1]]);
    const log = applyResolution(emptyLog(2), SCENARIO, state, cards);
    expect(copies(log, SUPPORT).map((card) => card.seat)).toEqual([0, 1]);
  });

  it("an Earn without eachPlayer is still one copy, however often it is listed (the Fellowship's behavior)", () => {
    const state = won([{ verb: "Earn", codes: [SUPPORT, SUPPORT] }, { verb: "Earn", codes: [SUPPORT] }], 2);
    expect(copies(applyResolution(emptyLog(2), SCENARIO, state, cards), SUPPORT)).toHaveLength(1);
  });

  it("a copy earned again by the same player is the same entry, and another player's copy is not", () => {
    const first = applyResolution(emptyLog(2), SCENARIO, won([{ verb: "Earn", codes: [SUPPORT], eachPlayer: true }], 2), cards);
    const again = applyResolution({ ...first, completed: [] }, SCENARIO, won([{ verb: "Earn", codes: [SUPPORT], eachPlayer: true }], 2), cards);
    expect(copies(again, SUPPORT)).toHaveLength(2);
  });

  it("The Ring Draws Them chosen in scenario 1 and earned again by Flight to the Ford's EarnAllBurdens is one pool entry", () => {
    // Scenario 1's ChooseCards writes the card with the choosing seat; the Ford's Resolution earns every burden still in the encounter deck or discard, for nobody.
    const first = won([], 1, (s) => ({ ...s, resolutionLog: { ...s.resolutionLog, earned: [{ code: RING_DRAWS_THEM, to: "pool", seat: 0, hero: null, step: 0 }] } }));
    const afterOne = applyResolution(emptyLog(1), SCENARIO, first, cards);
    expect(copies(afterOne, RING_DRAWS_THEM)).toHaveLength(1);
    const ford = won([{ verb: "EarnAllBurdens" }], 1, (s) => spawn(s, RING_DRAWS_THEM, { zone: "encounterDiscard" }).state);
    expect(resolutionResult(ford)?.earned.map((item) => [item.code, item.seat])).toEqual([[RING_DRAWS_THEM, null]]);
    const afterFord = applyResolution(afterOne, "flight-to-the-ford", { ...ford, scenarioId: "flight-to-the-ford" }, cards);
    expect(copies(afterFord, RING_DRAWS_THEM)).toHaveLength(1);
  });

  it("removing a card from the pool removes one entry for each time it was removed, the named player's copy first", () => {
    const pool: PoolCard[] = [0, 1].map((seat) => ({ code: SUPPORT, back: "player", burdenSet: null, attachedTo: null, seat, perPlayer: true }));
    const mine = won([], 2, (s) => ({ ...s, removedFromPool: [{ code: SUPPORT, seat: 1 }] }));
    expect(copies(applyResolution({ ...emptyLog(2), campaignPool: pool }, SCENARIO, mine, cards), SUPPORT).map((card) => card.seat)).toEqual([0]);
    const both = won([], 2, (s) => ({ ...s, removedFromPool: [{ code: SUPPORT, seat: 0 }, { code: SUPPORT, seat: 1 }] }));
    expect(copies(applyResolution({ ...emptyLog(2), campaignPool: pool }, SCENARIO, both, cards), SUPPORT)).toHaveLength(0);
  });

  it("an eliminated player still gets a copy: eachPlayer counts every seat", () => {
    const state = won([{ verb: "Earn", codes: [SUPPORT], eachPlayer: true }], 2, (s) => ({ ...s, seats: [s.seats[0], { ...s.seats[1], eliminated: true }] as unknown as ScenarioState["seats"] }));
    expect(resolutionResult(state)?.earned.map((item) => item.seat)).toEqual([0, 1]);
  });
});

describe("structured campaign facts", () => {
  it("start with nothing, and a win writes what the game recorded: the prisoner, a once-per-campaign use, a counter", () => {
    const blank = applyResolution(emptyLog(1), SCENARIO, won([], 1), cards);
    expect(blank).toMatchObject({ prisoner: null, usedOnce: [], counters: {}, carryOver: [], carryIn: [] });
    const facts = { prisoner: HERO, usedOnce: ["41044"], counters: { "41050": 6 } };
    const log = applyResolution(emptyLog(1), SCENARIO, won([], 1, (s) => ({ ...s, campaignFacts: facts })), cards);
    expect(log).toMatchObject(facts);
    // A Resolution that names a prisoner or a counter writes that over the facts it was started with.
    const named = applyResolution(emptyLog(1), SCENARIO, won([], 1, (s) => ({ ...s, campaignFacts: facts, resolutionLog: { ...s.resolutionLog, prisoner: "141002", counters: { "41050": 7 } } })), cards);
    expect(named).toMatchObject({ prisoner: "141002", counters: { "41050": 7 }, usedOnce: ["41044"] });
  });

  it("a log saved before the facts existed reads with the defaults", () => {
    const { prisoner: _p, usedOnce: _u, counters: _c, carryOver: _o, carryIn: _i, ...old } = emptyLog(1);
    expect(parseLog(old)).toEqual(emptyLog(1));
  });

  it("round trips through the stored JSON", () => {
    const log = applyResolution(emptyLog(2), SCENARIO, won([{ verb: "Earn", codes: [SUPPORT], eachPlayer: true }, { verb: "CarryOver", codes: [MENDOR] }], 2, (s) => ({ ...s, campaignFacts: { prisoner: HERO, usedOnce: [], counters: {} } })), cards);
    expect(parseLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
  });
});

describe("carry-over to the next campaign", () => {
  const resolution: Resolution = [
    { verb: "CarryOver", codes: [MENDOR] },
    { verb: "CarryOver", codes: [SUPPORT], eachPlayer: true },
  ];
  const scenariosOf = (id: string) => (id === "campaign" ? [SCENARIO] : null);

  it("a Resolution writes carryOver cards, one copy or one for each player, and a loss writes nothing", () => {
    const log = applyResolution(emptyLog(2), SCENARIO, won(resolution, 2), cards);
    // One entry for a copy for each player: the next save's seats decide how many.
    expect(log.carryOver.map((card) => [card.code, card.seat, card.perPlayer ?? false])).toEqual([[MENDOR, null, false], [SUPPORT, null, true]]);
    expect(log.campaignPool).toEqual([]);
    const lost = applyResolution(emptyLog(2), SCENARIO, { ...won(resolution, 2), lost: true }, cards);
    expect(lost.carryOver).toEqual([]);
  });

  it("offers the carry-over of a finished save of any campaign, and only a finished one", () => {
    const done = { ...newSave("done", "campaign", 2), log: applyResolution(emptyLog(2), SCENARIO, won(resolution, 2), cards) };
    const open = { ...done, id: "open", log: { ...done.log, completed: [] } };
    const empty = { ...newSave("empty", "campaign", 1), log: { ...emptyLog(1), completed: [SCENARIO] } };
    const other = { ...done, id: "other", campaignId: "another" };
    const offers = carryOffers([done, open, empty, other], scenariosOf);
    expect(offers.map((offer) => offer.saveId)).toEqual(["done"]);
    expect(offers[0]?.cards).toHaveLength(2);
  });

  it("a new save takes the cards in, and its first checklist moves them into the pool and clears carryIn", () => {
    const finished = applyResolution(emptyLog(2), SCENARIO, won(resolution, 2), cards);
    const fresh = newSave("next", "mirkwood-paths", 2, finished.carryOver);
    expect(fresh.log.carryIn).toHaveLength(3);
    expect(fresh.log.carryIn.map((card) => card.seat)).toEqual([null, 0, 1]);
    expect(fresh.log.campaignPool).toEqual([]);
    const plan = checklist({ log: fresh.log, scenario: loadScenario("passage-through-mirkwood"), seats: [{ heroes: [HERO], deck: [] }, { heroes: ["141002"], deck: [] }], effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join(" "));
    expect(plan.steps[0]?.did.join(" ")).toContain("carried over");
    expect(plan.log.campaignPool.map((card) => card.code).sort()).toEqual([MENDOR, SUPPORT, SUPPORT].sort());
    expect(plan.log.carryIn).toEqual([]);
    // Each player's copy of Mendor's Support is shuffled into that player's own deck.
    expect(plan.seats.map((seat) => seat.deck.filter((code) => code === SUPPORT).length)).toEqual([1, 1]);
    // Mendor is encounter-backed: without a record that puts him into play he is shuffled into the encounter deck.
    expect(plan.poolEncounterCards).toEqual([MENDOR]);
  });

  it("a copy for each player follows the new save's seats: two seats to one gives one copy, one to two gives each a copy", () => {
    const twoSeats = applyResolution(emptyLog(2), SCENARIO, won(resolution, 2), cards);
    const solo = newSave("solo", "mirkwood-paths", 1, twoSeats.carryOver);
    expect(solo.log.carryIn.filter((card) => card.code === SUPPORT).map((card) => card.seat)).toEqual([0]);
    const oneSeat = applyResolution(emptyLog(1), SCENARIO, won(resolution, 1), cards);
    const pair = newSave("pair", "mirkwood-paths", 2, oneSeat.carryOver);
    expect(pair.log.carryIn.filter((card) => card.code === SUPPORT).map((card) => card.seat)).toEqual([0, 1]);
  });

  it("the Dark of Mirkwood mini campaign and a plain new save start on a blank log", () => {
    for (const id of ["the-dark-of-mirkwood", "mirkwood-paths"]) {
      expect(newSave("s", id, 1).log).toEqual(emptyLog(1));
    }
    expect(loadCampaign("the-dark-of-mirkwood").saga).toBe(false);
  });

  it("an unfinished campaign's carryOver stays on its own log: part 4 of Mirkwood Paths continues the same log", () => {
    const part3 = applyResolution(emptyLog(1), SCENARIO, won(resolution, 1), cards);
    // Nothing moves it into the pool while the campaign goes on: only a new save's carryIn does.
    const plan = checklist({ log: part3, scenario: loadScenario("the-oath"), seats: [{ heroes: [HERO, "141002"], deck: [] }], effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join(" "));
    expect(plan.log.campaignPool).toEqual([]);
    expect(plan.log.carryOver).toHaveLength(2);
  });
});
