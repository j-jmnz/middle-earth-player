// Rules: dcce.campaign-mode, dcce.campaign-setup-flight-of-the-stormcaller, dcce.setup-flight-of-the-stormcaller, dcce.stormcallers-area, dcce.scalable-upgradable, dcce.gaining-xp, ltp.campaign-setup-checklist,
// rr.campaign-setup-checklist (data/rules/entries.json). Flight of the Stormcaller in the Dream-chaser campaign: it is the fourth part, its campaign card's Setup is dealt (the Stormcaller on its Campaign Mode only side
// with Black Key, the ships fitted, Thunderstruck, Crowley, Calaerion), the previous parts' pool, XP and marks reach it, a win writes its XP and unlocks the next part, and a standalone game uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { areaOf } from "../../../rules/families/stormcaller/zone.ts";
import { UPGRADED_CODES, afterRaid, FLIGHT_GOLDENS, flightPlan, flightStart, flightWorld, playGolden } from "../../../../test/scenarios/flight-of-the-stormcaller/game.ts";
import { CODES, MODIFICATIONS, SHIP_CODES, campaign, flight } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { newSave } from "../../save.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { levelOf } from "../../xp.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

beforeAll(async () => {
  const world = await flightWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

// The scenario dealt and its Setup played to the first round: every question answered with the first option.
function opened(start: ReturnType<typeof flightStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("Flight of the Stormcaller in the Dream-chaser campaign", () => {
  it("is the fourth part of a save, playable, and the campaign card names the Setup and Resolution", () => {
    const save = newSave("flight", campaign.id, 1);
    const unlocked = { ...save.log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"] };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(0, 5)).toEqual([["voyage-across-belegaer", "completed"], ["the-fate-of-numenor", "completed"], ["raid-on-the-grey-havens", "completed"], ["flight-of-the-stormcaller", "current"], ["the-thing-in-the-depths", "locked"]]);
    expect(PLAYABLE_SCENARIOS).toContain("flight-of-the-stormcaller");
    expect(flight.campaignCard).toBe("11191");
    expect([...flight.campaignPlaced].sort()).toEqual(["11172", "11173", "11174", "11175", "11177", "11178", "11192", "11193", "12019"].sort());
    // The campaign deals the Campaign Expansion's reprints (the 110… codes) of the Stormcaller and the ships; standalone deals the originals.
    expect(flight.reprints).toEqual({ "11080": "110136", "11081": "110137", "11082": "110140", "11083": "110141", "12019": "110042" });
    expect(campaignScenario(flight).campaignPlaced).toContain("110042");
    expect(campaignScenario(flight).cards.filter((card) => card.pile === "setAside").map((card) => card.code)).toContain("110042");
    expect(campaignScenario(flight).cards.map((card) => card.code)).not.toContain("12019");
  });

  it("deals the Campaign Setup: the Modification boons, Black Key and Calaerion set aside, Thunderstruck in the encounter deck, Crowley in the Corsair deck, and the rest after the quest card's Setup", () => {
    const start = flightStart(2, 1, "Normal");
    const setAside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    for (const code of [...MODIFICATIONS, CODES.blackKey, CODES.calaerion, "110042", "12016", "12017", "12018"]) expect(setAside, code).toContain(code);
    expect(setAside).not.toContain("12019");
    expect(start.encounterDeck).toContain(CODES.thunderstruck);
    expect(start.corsairDeck).toContain(CODES.crowley);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["FlipStormcaller", "AttachSetAsideTo", "FitShips", "PutSetAsideInPlay"]);
    expect(start.definition.part).toBe(4);
    expect(flight.number).toBe(1);
    expect(start.questDeck).toEqual(["12012", "12013", "12014", "12015"]);
    expect(start.definition.modeCard).toBeUndefined();
  });

  it("starts with the Stormcaller on its Campaign Mode only side in its area carrying Black Key, Calaerion in play under the player with the Dream-chaser, the ships fitted, and the Stormcaller's stage 2D beside it", () => {
    const state = opened(flightStart(2, 1, "Normal"));
    const area = areaOf(state);
    expect(area).toBeDefined();
    const caller = state.cards[area?.card ?? ""];
    expect(caller).toMatchObject({ code: "110042", zone: "stormcallerArea", face: "B" });
    expect(codes(state, caller?.attachments ?? [])).toEqual([CODES.blackKey]);
    expect(state.cards[area?.stage ?? ""]).toMatchObject({ code: "12016", zone: "stormcallerArea", face: "B" });
    expect(area?.number).toBe(2);
    expect(codes(state, area?.deck ?? [])).toEqual(["12017", "12018"]);
    const calaerion = Object.values(state.cards).find((card) => card.code === CODES.calaerion);
    const chaser = Object.values(state.cards).find((card) => card.code === CODES.dreamChaser);
    expect(calaerion).toMatchObject({ zone: "play", face: "up" });
    expect(calaerion?.controller).toBe(chaser?.controller);
    // Every ship carries a Modification boon.
    const ships = Object.values(state.cards).filter((card) => SHIP_CODES.includes(card.code) && card.zone === "play");
    expect(ships).toHaveLength(2);
    for (const ship of ships) expect(codes(state, ship.attachments).filter((code) => (MODIFICATIONS as readonly string[]).includes(code))).toHaveLength(1);
    // The campaign card has no ability that works during the scenario, so it is not placed beside the quest deck (rr.campaign-cards).
    expect(Object.values(state.cards).some((card) => card.code === "11191")).toBe(false);
    // The Stormcaller's quest stages that wait are out of play, and the encounter deck holds Thunderstruck.
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toContain(CODES.thunderstruck);
    expect(state.corsairDeck?.map((id) => state.cards[id]?.code)).toContain(CODES.crowley);
    // Rolling Seas: 2 copies with 3 or more players, 1 otherwise.
    expect(state.staging.map((id) => state.cards[id]?.code).filter((code) => code === CODES.rollingSeas)).toHaveLength(1);
    expect(state.round).toBe(1);
  });

  it("puts 2 copies of Rolling Seas in the staging area with 3 or more players, 1 with fewer", () => {
    const placement = flight.cards.find((card) => card.code === CODES.rollingSeas && card.pile === "staging");
    expect(placement?.byPlayers).toEqual({ few: 1, many: 2, from: 3 });
  });

  it("hands the previous parts to this one: the pool is shuffled into the encounter deck, and the log's marks reach the game as a scalable card's level and the Upgraded sides", () => {
    const log = afterRaid(1);
    const plan = flightPlan(1, log);
    expect(plan.poolEncounterCards).toEqual([CODES.ominousFate]);
    expect(levelOf(log, "11184")).toBe(3);
    const state = opened(flightStart(1, 1, "Normal", { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES, levels: { "11184": 3 } }, log));
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toContain(CODES.ominousFate);
    const deal = (code: string) => Object.values(state.cards).find((card) => card.code === code);
    // Upgraded cards are dealt on their Upgraded side.
    expect(deal("110136")).toMatchObject({ face: "B" });
    expect(deal(CODES.calaerion)).toMatchObject({ face: "B" });
    expect(deal(CODES.blackKey)).toMatchObject({ face: "B" });
    // The Stormcaller shows its Campaign Mode only side whether or not the log marks anything.
    expect(deal("110042")).toMatchObject({ face: "B" });
    expect(state.campaignFacts?.levels?.["11184"]).toBe(3);
  });

  it("deals a standalone game the base sides: the original Stormcaller on side A, no campaign card, no Black Key, no Calaerion, no Modification boons, Thunderstruck or Crowley", async () => {
    const plan = flightPlan(1);
    const standalone = buildStart({ campaign, scenario: flight, seatCount: 1, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, mode: "standalone" });
    expect(standalone.definition.campaignCard).toBeUndefined();
    expect(standalone.definition.resolution).toEqual([]);
    expect(standalone.definition.afterSetup).toBeUndefined();
    expect(standalone.definition.part).toBe(4);
    const state = opened(standalone);
    const area = areaOf(state);
    expect(state.cards[area?.card ?? ""]).toMatchObject({ code: "12019", face: "up", zone: "stormcallerArea", attachments: [] });
    const present = new Set(Object.values(state.cards).map((card) => card.code));
    for (const code of [CODES.blackKey, CODES.calaerion, CODES.thunderstruck, CODES.crowley, ...MODIFICATIONS, "110042", "11191"]) expect(present.has(code), code).toBe(false);
    // The ships are the originals (Duskbringer and Glórinaith are new in the Campaign Expansion and have no original).
    expect(Object.values(state.cards).some((card) => ["110136", "110137", "110140", "110141"].includes(card.code))).toBe(false);
    expect(Object.values(state.cards).filter((card) => card.zone === "play" && card.code.startsWith("1108")).length).toBeGreaterThan(0);
  });

  it("wins by catching up, writes the XP its Resolution awards and unlocks the next part, Heading and ships in the log", () => {
    const golden = FLIGHT_GOLDENS.find((item) => item.outcome === "won")!;
    const game = playGolden(golden, ctx);
    expect(game.state.stageCleared).toBe(true);
    const log = applyResolution(emptyLog(golden.seatCount), game.state.scenarioId, game.state, cards, NO_COPY_LIMITS);
    expect(log.completed.at(-1)).toBe("flight-of-the-stormcaller");
    expect(log.xpGained["flight-of-the-stormcaller"]).toBeGreaterThanOrEqual(1);
    const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller"] });
    expect(path.map((node) => node.status).slice(0, 5)).toEqual(["completed", "completed", "completed", "completed", "current"]);
    expect(path[4]?.id).toBe("the-thing-in-the-depths");
  });
});
