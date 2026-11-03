import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { startScenario } from "../rules/engine/reduce.ts";
import { loadWorld } from "../../scripts/past-scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { buildStart } from "./start.ts";

// The quest card's Setup at the seat count and difficulty played (data/scenarios, printed Setup lines).
const campaign = loadCampaign();
const seats = [{ heroes: ["141001"], deck: [] }, { heroes: ["h"], deck: [] }];

function count(codes: readonly string[], code: string): number {
  return codes.filter((entry) => entry === code).length;
}

function staged(start: ReturnType<typeof buildStart>, code: string): number {
  return start.definition.setup.filter((instruction) => instruction.verb === "AddToStaging" && instruction.code === code).length;
}

describe("buildStart", () => {
  it("Flight to the Ford (141028:A): 1 Fell Rider per player in staging, the other copies in the encounter deck", () => {
    const scenario = loadScenario("flight-to-the-ford");
    for (const seatCount of [1, 2] as const) {
      const start = buildStart({ campaign, scenario, seatCount, seed: 1, threatModifier: 0, seats: seats.slice(0, seatCount), effects: EFFECTS });
      expect(staged(start, "141063")).toBe(seatCount);
      expect(count(start.encounterDeck, "141063")).toBe(4 - seatCount);
    }
  });

  it("A Knife in the Dark: Easy sets aside the Easy count of Ringwraiths", () => {
    const scenario = loadScenario("a-knife-in-the-dark");
    const setAside = (difficulty: "Easy" | "Normal") =>
      buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: seats.slice(0, 1), effects: EFFECTS, difficulty })
        .definition.setup.filter((instruction) => instruction.verb === "SetAside" && instruction.code === "141069").length;
    expect(setAside("Normal")).toBe(4);
    expect(setAside("Easy")).toBe(2);
  });

  it("Easy Mode puts 1 resource on each hero during setup (easy-mode.easy-mode)", async () => {
    const world = await loadWorld();
    const scenario = loadScenario("a-shadow-of-the-past");
    const loadout = [{ heroes: ["141001", "141002"], deck: [] }];
    for (const difficulty of ["Easy", "Normal"] as const) {
      const start = buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: loadout, effects: EFFECTS, difficulty });
      const state = startScenario(start, { effects: EFFECTS, cards: world.cards });
      const pools = (state.seats[0]?.heroes ?? []).map((id) => state.cards[id]?.resources);
      expect(pools).toEqual([1, 1].map((one) => (difficulty === "Easy" ? one : 0)));
    }
  });
});
