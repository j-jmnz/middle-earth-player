// Rules: dcce.campaign-setup-a-storm-on-cobas-haven, dcce.encounter-cards, dcce.scalable-upgradable, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 11209:A:2, 11209:A:3, 11209:B:1, 11210:A:3, 11210:A:4.
// The campaign card of A Storm on Cobas Haven (11209) dealt in a game: what its Setup sets aside and puts into play, and Gavin's two lines that close with it.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { havenStart, havenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/game.ts";
import { CODES, haven } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await havenWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered by `answers` (an option id, else the first option).
function opened(seats: 1 | 2, answers: readonly string[] = []): ScenarioState {
  let state = startScenario(havenStart(seats, 1, "Normal"), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    const wanted = answers.find((answer) => options.includes(answer));
    state = expectOk(reduce(state, { type: "Choose", optionId: wanted ?? options[0] ?? "" }, ctx)).state;
  }
  return state;
}

describe("11209:A:2, A:3 Setup (Campaign Mode)", () => {
  it("places every card the campaign paragraph names, including the four Send for Help cards, in the scenario's world", () => {
    expect(haven.campaignPlaced).toEqual(expect.arrayContaining(["11211", "11212", "11213", "11214", CODES.gavin, CODES.calaerion, CODES.blackKey]));
  });

  it("sets Gavin, the Send for Help cards and Black Key aside, shuffles Thunderstruck into the encounter deck and Crowley into the Corsair deck, and attaches Black Key to the Raider Flagship", () => {
    const state = opened(1);
    const zones = (code: string) => where(state, code).map((card) => card.zone);
    expect(["11211", "11212", "11213", "11214"].map(zones)).toEqual([["setAside"], ["setAside"], ["setAside"], ["setAside"]]);
    expect(where(state, "11211")[0]?.face).toBe("down");
    expect(zones(CODES.thunderstruck)).toEqual(["encounterDeck"]);
    expect(zones(CODES.crowley)).toEqual(["corsairDeck"]);
    const flagship = where(state, CODES.raiderFlagship)[0];
    expect(flagship?.attachments.map((id) => state.cards[id]?.code)).toEqual([CODES.blackKey]);
  });

  it("puts Calaerion into play under the player with the Dream-chaser, and fits each ship with a Modification boon", () => {
    const state = opened(2);
    // A campaign game deals the Campaign Expansion's reprint of the ship, so it is found by title.
    const ship = Object.values(state.cards).find((card) => card.zone === "play" && ctx.cards.get(card.code)?.name === "Dream-chaser");
    expect(where(state, CODES.calaerion)[0]).toMatchObject({ zone: "play", controller: ship?.controller });
    const ships = Object.values(state.cards).filter((card) => card.zone === "play" && ctx.cards.get(card.code)?.ship === "objective");
    expect(ships.length).toBe(2);
    for (const each of ships) expect(each.attachments.length, each.code).toBeGreaterThanOrEqual(1);
  });

  it("puts Gavin into play under the only player, and under the player the first player names when there are two", () => {
    const solo = opened(1);
    expect(where(solo, CODES.gavin)[0]).toMatchObject({ zone: "play", controller: 0 });
    // The first player is asked who takes Gavin: the options are the seats.
    let state = startScenario(havenStart(2, 1, "Normal"), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const asked: string[][] = [];
    for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      if (options.every((id) => id.startsWith("seat:"))) asked.push([...options]);
      state = expectOk(reduce(state, { type: "Choose", optionId: options.includes("seat:1") ? "seat:1" : (options[0] ?? "") }, ctx)).state;
    }
    expect(asked[0]).toEqual(["seat:0", "seat:1"]);
    expect(where(state, CODES.gavin)[0]).toMatchObject({ zone: "play", controller: 1 });
  });
});
