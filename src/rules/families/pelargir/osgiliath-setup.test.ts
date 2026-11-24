// Rules: ats.setup-assault-on-osgiliath, rr.search, rr.staging (data/rules/entries.json); ledger lines 06091:A:1, 05053:A:1.
// The Setup of Assault on Osgiliath, run through the records of the Retake the City stage: each player in turn, the first player first, chooses an enemy and then a unique Osgiliath location from the encounter deck. A Haradrim Elite chosen there makes its attack (05053:A:1).
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { encounterCodes, parseAnyScenarioData } from "../../../catalog/scenario-data.ts";

import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";
import type { ScenarioState } from "../../core/state.ts";

const ELITE = "05053";
const MERCENARIES = "05052";

/** The Setup resolves; an enemy window takes the enemy with this code (the first offered otherwise) and a location window the first unique location. */
function setup(seats: 1 | 2, deck: readonly string[], enemy: string) {
  const made = table({ seats, deck }, undefined, [ELITE, MERCENARIES, "05058"]);
  const windows: string[][] = [];
  const run = resolveRecords(made.state, made.ctx, CODES.retake, "setup", idOf(made.state, CODES.retake), (state: ScenarioState) => {
    if (state.window?.kind !== "choose") return "";
    windows.push([...state.window.options]);
    return state.window.options.find((option) => state.cards[option]?.code === enemy) ?? state.window.options[0] ?? "";
  }, false);
  return { made, run, windows };
}

describe("06091:A:1 Retake the City: the Setup choices", () => {
  it("lets each player choose an enemy and then a unique location nobody took", () => {
    const { run, windows } = setup(2, [MERCENARIES, "05058", "06096", "06097", "06100"], MERCENARIES);
    const staged = run.state.staging.map((id) => run.state.cards[id]?.code);
    // The first player chose among the two unique locations in the deck, West Gate (the first offered); the second had King's Library left, the one copy of it, and no choice to make. West Quarter is no unique location.
    expect(windows.filter((options) => options.every((option) => option.startsWith("0609")))).toEqual([["06096", "06097"]]);
    expect(staged.filter((code) => code === "06096")).toHaveLength(1);
    expect(staged.filter((code) => code === "06097")).toHaveLength(1);
    expect(staged).not.toContain("06100");
    expect(staged).toHaveLength(4);
  });
});

describe("05053:A:1 Haradrim Elite chosen at the Setup", () => {
  it("makes its attack against the first player as it is added to the staging area", () => {
    const { run } = setup(1, [ELITE, MERCENARIES, "06096"], ELITE);
    expect(run.state.pendingAttack).toMatchObject({ enemyId: idOf(run.state, ELITE) });
    expect(run.state.window?.kind).toBe("defense");
  });

  it("makes no attack when another enemy is chosen", () => {
    const { run } = setup(1, [ELITE, MERCENARIES, "06096"], MERCENARIES);
    expect(run.state.pendingAttack).toBeNull();
  });
});

describe("06091:A:1 Retake the City on Easy mode", () => {
  // Hall of Beorn's `easyQuantity` of this set is 0 for the four unique locations, but the booklet's Easy deck (E03.7, the scenario's `easy` counts) keeps all four: each player's choice has locations to offer on Easy.
  const deck = (difficulty: "Easy" | "Normal") => encounterCodes(parseAnyScenarioData(JSON.parse(readFileSync("data/scenarios/assault-on-osgiliath.json", "utf8"))), difficulty);

  it("deals each of the four unique locations in the Easy encounter deck, so the Setup has them to offer", () => {
    for (const code of ["06096", "06097", "06098", "06099"]) expect(deck("Easy").filter((card) => card === code)).toHaveLength(1);
  });
});
