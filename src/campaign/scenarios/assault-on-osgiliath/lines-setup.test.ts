// Rules: ats.setup-assault-on-osgiliath, rr.search, rr.staging, rr.first-player, ltp.easy-mode, easy-mode.easy-mode (data/rules/entries.json); ledger line 06091:A:1.
// The Setup of Assault on Osgiliath, run through the records of the Retake the City stage: each player in turn, the first player first, chooses an enemy and then a unique Osgiliath location from the encounter deck and adds them to the staging area. A Haradrim Elite chosen there makes its attack
// as it is added . Hall of Beorn's `easyQuantity` of this set is 0 for the four unique locations, but the booklet's Easy deck (E03.7, the `easy` counts of the scenario's data) keeps all four.
import { readFileSync } from "node:fs";

import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { encounterCodes, parseAnyScenarioData } from "../../../catalog/scenario-data.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { finish, idOf, resolveRecords, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, table } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const ELITE = "05053";
const MERCENARIES = "05052";
const VANGUARD = "05058";

/** The Setup resolves; an enemy window takes the enemy with this code (the first offered otherwise) and a location window the first unique location. */
function setup(seats: 1 | 2, deck: readonly string[], enemy: string, effects: readonly Effect[]) {
  const made = table({ seats, deck }, effects, [ELITE, MERCENARIES, VANGUARD]);
  const windows: string[][] = [];
  const run = resolveRecords(made.state, made.ctx, CODES.retake, "setup", idOf(made.state, CODES.retake), (state: ScenarioState) => {
    if (state.window?.kind !== "choose") return "";
    windows.push([...state.window.options]);
    return state.window.options.find((option) => state.cards[option]?.code === enemy) ?? state.window.options[0] ?? "";
  }, false);
  return { made, run, windows, staged: run.state.staging.map((id) => run.state.cards[id]?.code) };
}
const locations = (windows: string[][]): string[][] => windows.filter((options) => options.every((option) => option.startsWith("0609")));

lineSpec("06091:A:1", "with one player: he chooses an enemy and then a unique location from the four in the encounter deck, and both enter the staging area", (effects) => {
  const { windows, staged, run } = setup(1, [MERCENARIES, VANGUARD, "06096", "06097", "06098", "06099", "06100"], MERCENARIES, effects);
  expect(locations(windows)).toEqual([["06096", "06097", "06098", "06099"]]);
  expect(staged).toEqual([MERCENARIES, "06096"]);
  // The encounter deck is shuffled after the choices; the cards taken are out of it.
  expect(run.state.encounterDeck).toHaveLength(5);
});

lineSpec("06091:A:1", "with two players: each chooses in turn, the first player first, and the second one finds the location the first took gone", (effects) => {
  const { windows, staged } = setup(2, [MERCENARIES, VANGUARD, "06096", "06097", "06100"], MERCENARIES, effects);
  // The first player chose among the two unique locations in the deck, West Gate (the first offered); the second had King's Library left, the one copy of it, and no choice to make. West Quarter is no unique location.
  expect(locations(windows)).toEqual([["06096", "06097"]]);
  expect(staged.filter((code) => code === "06096")).toHaveLength(1);
  expect(staged.filter((code) => code === "06097")).toHaveLength(1);
  expect(staged).not.toContain("06100");
  expect(staged).toHaveLength(4);
});

lineSpec("06091:A:1", "a Haradrim Elite chosen at Setup makes its attack against the first player as it is added to the staging area, and no attack is made when another enemy is chosen", (effects) => {
  const elite = setup(1, [ELITE, MERCENARIES, "06096"], ELITE, effects);
  expect(elite.run.state.pendingAttack).toMatchObject({ enemyId: idOf(elite.run.state, ELITE) });
  expect(elite.run.state.window?.kind).toBe("defense");
  expect(setup(1, [ELITE, MERCENARIES, "06096"], MERCENARIES, effects).run.state.pendingAttack).toBeNull();
});

lineSpec("06091:A:1", "an earlier player's Haradrim Elite is not announced again when a later player's search finds no enemy (one attack)", (effects) => {
  // Two players, one enemy in the deck: the first player takes the Elite and its attack is made; the second player's search finds no enemy. The attacks of the Elite are counted against a game of one player.
  const attacksOf = (seats: 1 | 2): number => {
    const { made, run } = setup(seats, [ELITE, "06096", "06097"], ELITE, effects);
    const done = finish(send(run, { type: "Undefended", heroId: made.hero }, made.ctx), made.ctx);
    return done.steps.filter((step) => step.kind === "attack" && step.side === "enemy").length;
  };
  expect(attacksOf(2)).toBe(attacksOf(1));
});

lineSpec("06091:A:1", "on Easy the encounter deck holds each of the four unique locations, so the Setup has them to offer", (effects) => {
  const data = parseAnyScenarioData(JSON.parse(readFileSync("data/scenarios/assault-on-osgiliath.json", "utf8")));
  for (const code of ["06096", "06097", "06098", "06099"]) expect(encounterCodes(data, "Easy").filter((card) => card === code)).toHaveLength(1);
  // The Setup still needs its record to put one of them in the staging area.
  expect(setup(1, [MERCENARIES, "06096", "06097", "06098", "06099"], MERCENARIES, effects).staged).toContain("06096");
});
