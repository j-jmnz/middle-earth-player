// Rules: dcce.gaining-xp, dcce.scalable-upgradable, rr.ownership-and-control (data/rules/entries.json); ledger lines 11209:B:1, 11209:B:4 to 11209:B:8.
// The Resolution of A Storm on Cobas Haven's campaign card (11209): the XP lines no golden reaches yet, each read from its record on the table of the scenario, the Círdan's Blessing the Setup let a player take, and
// the four XP the players may spend on Gavin ("Gavin returned", which the XP model of the campaign log keeps: src/campaign/xp.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { sideInstructions } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { updateCard } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { loadHavenWorld, havenTable, idsOf, CODES, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";

import { emptyLog } from "../../log.ts";
import { gavinReturned, markRefusal, pick, spendXp } from "../../xp.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  for (const [code, card] of await loadPrinted([CODES.dolAmrothWarship, "110102", CODES.dreamChaser])) world.cards.set(code, card);
}, 120_000);

const LINES = sideInstructions(EFFECTS, CODES.campaignCard, "B", "resolution");
const SKIRMISHER_SHIP = "12125~ship";

// The scenario won with `layout` on the table: the XP the Resolution gains, with the towers in `freed` claimed by the players as a settle sweep leaves them, and the heading `at` (Sun is on-course).
function xp(layout: HavenLayout, options: { freed?: readonly string[]; at?: "Sun" | "Storm" } = {}): number {
  const made = havenTable(world, { stage: "12122", ...layout });
  let state: ScenarioState = made.state;
  for (const code of options.freed ?? []) for (const id of idsOf(state, code)) state = updateCard(state, id, { claimed: true, controller: null });
  state = syncConstants({ ...state, sea: { heading: options.at ?? "Storm", headingCard: null, routes: state.sea?.routes ?? {} } }, made.ctx);
  const opened = openResolution({ ...state, scenarioId: "a-storm-on-cobas-haven", window: null, stageCleared: true, resolution: LINES }, made.ctx);
  return resolutionResult(opened)?.xp ?? 0;
}

describe("11209:B Gain the following", () => {
  it("B:4: 1 XP for ending on-course (Sun) and none otherwise", () => {
    expect(xp({}, { at: "Sun" }) - xp({}, { at: "Storm" })).toBe(1);
  });

  it("B:5: 1 XP when 2 Dol Amroth Warships are in play, not for 1 or for a set-aside one", () => {
    const base = xp({});
    expect(xp({ play: [CODES.dolAmrothWarship, "110102"] }) - base).toBe(1);
    expect(xp({ play: [CODES.dolAmrothWarship] }) - base).toBe(0);
    expect(xp({ play: [CODES.dolAmrothWarship], setAside: ["110102"] }) - base).toBe(0);
  });

  it("B:6: 1 XP when the players control 2 Corsair Skirmishers, and none for ones still engaged enemies", () => {
    const base = xp({});
    expect(xp({ play: [SKIRMISHER_SHIP, SKIRMISHER_SHIP] }) - base).toBe(1);
    expect(xp({ play: [SKIRMISHER_SHIP] }) - base).toBe(0);
    expect(xp({ play: [SKIRMISHER_SHIP], engaged: [CODES.corsairSkirmisher] }) - base).toBe(0);
  });

  it("B:7: 1 XP when the players control 4 Dol Amroth objectives (the towers freed of encounters), not for a tower that is still guarded", () => {
    const base = xp({});
    const towers = [CODES.seaWardTower, CODES.towerOfTheGull, CODES.theBeacon, CODES.towerOfTheHeron];
    expect(xp({ staging: towers }, { freed: towers }) - base).toBe(1);
    expect(xp({ staging: towers }, { freed: towers.slice(0, 3) }) - base).toBe(0);
    expect(xp({ staging: towers }) - base).toBe(0);
  });

  it("B:8: 1 XP for each Corsair Warship in the victory display", () => {
    const base = xp({});
    expect(xp({ victory: [CODES.corsairWarship] }) - base).toBe(1);
    expect(xp({ victory: [CODES.corsairWarship, CODES.corsairWarship, CODES.corsairWarship] }) - base).toBe(3);
  });
});

describe("11209:B:1 Resolution", () => {
  it("adds the Círdan's Blessing the Setup let a player take to the Campaign Pool (EarnDealt)", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === CODES.campaignCard && effect.timing === "resolution" && effect.lines.includes("11209:B:1"));
    expect(records.flatMap((record) => record.instructions)).toEqual([{ verb: "EarnDealt", codes: ["11205", "11206", "11207", "11208"] }]);
  });

  it("records \"Gavin returned\" for 4 XP spent on him once the scenario is won, and not before (the XP model, src/campaign/xp.ts)", () => {
    const log = { ...emptyLog(1), xpGained: { "a-storm-on-cobas-haven": 4 } };
    // Not won yet: his boxes cannot be marked.
    expect(markRefusal(log, {}, CODES.gavin)).toMatch(/after a storm on cobas haven is won/i);
    const won = { ...log, completed: ["a-storm-on-cobas-haven"] };
    const picked = pick(won, {}, CODES.gavin);
    expect(picked).toEqual({ [CODES.gavin]: 4 });
    const spent = spendXp(won, picked);
    expect(spent.ok && gavinReturned(spent.log)).toBe(true);
    expect(gavinReturned(won)).toBe(false);
  });
});
