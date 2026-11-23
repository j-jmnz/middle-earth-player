import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { AnyScenarioData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadAnyScenario, loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { loadoutOf, loadoutProblems, needsRingBearerSlot } from "./briefing.ts";
import { sagaRoleOf, titleBansOf } from "./saga.ts";
import { buildStart } from "./start.ts";
import type { World } from "./world.ts";

// Rules: hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd, hob.baggins-sphere-ohauh, hob.baggins-sphere-otd, hob.treasure-ohauh, hob.treasure-otd (data/rules/entries.json).
// The Hobbit's shell: the first player takes control of the box's Bilbo Baggins at the start of every scenario (a cycle has no Ring-bearer and no log), the loadout that
// follows from it, and the treasure cards a deck may add at the Setup. No scenario of the cycle is playable, so the loadout is read here, not the deal.
const BILBO_OHAUH = "131001";
const BILBO_OTD = "132001";
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const THEODEN = "143002";
const ARAGORN = "01001";
const FRODO = "141001";
const STING = "131020";
const ORCRIST = "131021";
const RING = "132019";
const ARKENSTONE = "132020";
const FILLER = "01030";

const campaign = loadCampaign("the-hobbit");
const ids = campaign.scenarios;
const [weMustAway, mistyMountains, dungeons, flies, lonelyMountain, fiveArmies] = ids.map((id) => loadAnyScenario(id));

let cards: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  cards = await loadPrinted([BILBO_OHAUH, BILBO_OTD, GLORFINDEL, BERAVOR, THEODEN, ARAGORN, FRODO, STING, ORCRIST, RING, ARKENSTONE, FILLER, "132020", "132021", "132022", "132023", "132024", "131021", "131022"]);
});

const worldOf = (scenario: AnyScenarioData): World => ({ campaign, scenario, effects: [], cards, sets: new Map() });
const seat = (heroes: readonly string[], deck: readonly string[] = []) => ({ deckId: "d", heroes, deck });
const input = (scenario: AnyScenarioData, heroes: readonly string[], deck: readonly string[] = []) => ({ world: worldOf(scenario), seatCount: 1 as const, seats: [seat(heroes, deck)], ringBearer: null });
const check = (args: ReturnType<typeof input>) => loadoutProblems(args, []);
const messages = (result: ReturnType<typeof loadoutProblems>) => result.problems.map((problem) => `${problem.rule}: ${problem.message}`);

describe("hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd: the first player takes control of the box's Bilbo Baggins", () => {
  it("is the Over Hill and Under Hill Bilbo in the first three scenarios and the On the Doorstep Bilbo in the last three, and no Ring-bearer", () => {
    expect(ids).toHaveLength(6);
    expect(ids.map((id) => sagaRoleOf(campaign, loadAnyScenario(id)))).toEqual([
      { kind: "hero", hero: BILBO_OHAUH },
      { kind: "hero", hero: BILBO_OHAUH },
      { kind: "hero", hero: BILBO_OHAUH },
      { kind: "hero", hero: BILBO_OTD },
      { kind: "hero", hero: BILBO_OTD },
      { kind: "hero", hero: BILBO_OTD },
    ]);
    for (const scenario of [weMustAway, flies]) expect(needsRingBearerSlot(worldOf(scenario), seat([GLORFINDEL]))).toBe(false);
    expect(titleBansOf(campaign, weMustAway)).toEqual([]);
  });

  it("deals Bilbo to the first seat only, in front of its heroes, and attaches nothing to a Ring-bearer", () => {
    const two = { world: worldOf(flies), seatCount: 2 as const, seats: [seat([GLORFINDEL]), seat([BERAVOR])], ringBearer: null };
    expect(loadoutOf(two).map((one) => one.heroes)).toEqual([[BILBO_OTD, GLORFINDEL], [BERAVOR]]);
    expect(loadoutOf(input(weMustAway, [GLORFINDEL])).map((one) => one.heroes)).toEqual([[BILBO_OHAUH, GLORFINDEL]]);
    const start = buildStart({ campaign, scenario: weMustAway, seatCount: 1, seed: 1, threatModifier: 0, seats: loadoutOf(input(weMustAway, [GLORFINDEL])), effects: EFFECTS, mode: "standalone" });
    expect(start.definition.setup.filter((step) => step.verb === "AttachToRingBearer")).toEqual([]);
    expect(start.seats[0]?.heroes).toEqual([BILBO_OHAUH, GLORFINDEL]);
  });

  it("does not count Bilbo against the starting hero limit: three heroes beside him (the OHaUH insert and the OtD card)", () => {
    for (const scenario of [weMustAway, lonelyMountain]) expect(messages(check(input(scenario, [GLORFINDEL, BERAVOR, THEODEN])))).toEqual([]);
  });

  it("refuses the other box's version of Bilbo Baggins as a hero, and the Fellowship sphere", () => {
    expect(messages(check(input(mistyMountains, [BILBO_OTD, GLORFINDEL]))).some((line) => line.startsWith("One version of the ☺ hero") && line.includes("Bilbo Baggins"))).toBe(true);
    expect(messages(check(input(flies, [BILBO_OHAUH, GLORFINDEL]))).some((line) => line.startsWith("One version of the ☺ hero") && line.includes("Bilbo Baggins"))).toBe(true);
    // The granted Bilbo picked as a hero is the same card: he is dealt once.
    expect(loadoutOf(input(flies, [BILBO_OTD, GLORFINDEL])).map((one) => one.heroes)).toEqual([[BILBO_OTD, GLORFINDEL]]);
    expect(messages(check(input(dungeons, [FRODO, GLORFINDEL]))).some((line) => line.startsWith("Fellowship heroes only in a saga"))).toBe(true);
  });

  it("refuses a fourth hero of the player's own: the saved deck holds three", () => {
    const found = messages(check(input(fiveArmies, [GLORFINDEL, BERAVOR, THEODEN, ARAGORN])));
    expect(found.some((line) => line.startsWith("One to three heroes"))).toBe(true);
  });
});

describe("hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd: Bilbo Baggins is no hero of another product's scenario", () => {
  it("refuses a Baggins hero where the scenario does not grant one", () => {
    const other = loadScenario("a-knife-in-the-dark");
    const world: World = { campaign: loadCampaign(), scenario: other, effects: [], cards, sets: new Map() };
    const found = messages(loadoutProblems({ world, seatCount: 1, seats: [seat([BILBO_OHAUH, GLORFINDEL])], ringBearer: FRODO }, []));
    expect(found.some((line) => line.startsWith("Bilbo Baggins only in The Hobbit's scenarios"))).toBe(true);
    // A standalone scenario of no saga refuses him as well.
    const plain = loadAnyScenario("conflict-at-the-carrock");
    const plainWorld: World = { campaign: loadCampaign("shadows-of-mirkwood"), scenario: plain, effects: [], cards, sets: new Map() };
    expect(messages(loadoutProblems({ world: plainWorld, seatCount: 1, seats: [seat([BILBO_OTD, GLORFINDEL])], ringBearer: null }, [])).some((line) => line.startsWith("Bilbo Baggins only in The Hobbit's scenarios"))).toBe(true);
  });
});

describe("hob.treasure-ohauh, hob.treasure-otd: a deck adds the treasure of the sets the scenario lists", () => {
  it("lists the sets of the earlier scenarios that discover treasure: none in the first, the troll set in the next three, then the web and the dragon sets", () => {
    expect(ids.map((id) => loadAnyScenario(id).treasures ?? [])).toEqual([
      [],
      [STING, ORCRIST, "131022"],
      [STING, ORCRIST, "131022"],
      [STING, ORCRIST, "131022"],
      [STING, ORCRIST, "131022", RING],
      [STING, ORCRIST, "131022", RING, ARKENSTONE, "132021", "132022", "132023", "132024"],
    ]);
  });

  it("admits a listed treasure outside the 50 card minimum, one copy of a title", () => {
    expect(messages(check(input(mistyMountains, [GLORFINDEL], [STING])))).toEqual([]);
    expect(messages(check(input(fiveArmies, [GLORFINDEL], [STING, RING, ARKENSTONE])))).toEqual([]);
    const twice = messages(check(input(mistyMountains, [GLORFINDEL], [STING, STING])));
    expect(twice.some((line) => line.startsWith("One copy of a treasure"))).toBe(true);
  });

  it("refuses a treasure of a set the scenario does not list, and any in the first scenario", () => {
    expect(messages(check(input(weMustAway, [GLORFINDEL], [STING]))).some((line) => line.startsWith("A treasure of a set the scenario lists"))).toBe(true);
    expect(messages(check(input(flies, [GLORFINDEL], [RING]))).some((line) => line.startsWith("A treasure of a set the scenario lists"))).toBe(true);
    expect(messages(check(input(lonelyMountain, [GLORFINDEL], [ARKENSTONE]))).some((line) => line.startsWith("A treasure of a set the scenario lists"))).toBe(true);
    expect(messages(check(input(lonelyMountain, [GLORFINDEL], [RING]))).some((line) => line.startsWith("A treasure of a set the scenario lists"))).toBe(false);
  });
});
