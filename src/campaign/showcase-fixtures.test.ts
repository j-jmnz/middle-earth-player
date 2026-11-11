import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { boardHolds } from "../../scripts/e2e/seed-kit.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { legalTargets } from "../rules/engine/reduce.ts";

import scenarioOne from "./fixtures/scenario-1.json";
import { fixture, fixtureSave, hasFixture, type FixtureName } from "./fixtures.ts";
import { contextOf, resume } from "./session.ts";
import { loadWorld, logCodes } from "./world.ts";

// The README showcase's saves (docs/plans/readme-showcase.md, Saves and decks) replay to the moments the capture flows open: a full table on a planning window,
// a quest commit and an enemy's attack waiting for a defender. What a flow taps (`showcase` in scenario-1.json) is a move the moment offers.
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const TAPS = scenarioOne as unknown as Record<string, { showcase?: { commit?: string[]; defender?: string } }>;

function opened(name: FixtureName) {
  const { loadout, log, campaignId } = fixture(name);
  const codes = [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  const world = loadWorld(catalog, loadCampaign(campaignId), loadScenario(loadout.scenarioId), EFFECTS, codes);
  const resumed = resume(fixtureSave(name, "s", CATALOG_VERSION), world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(`${name}: ${resumed.reason}`);
  return { state: resumed.state, ctx: contextOf(world) };
}

describe("README showcase fixtures", () => {
  it("are committed, two-handed", () => {
    for (const name of ["past-showcase-board", "past-showcase-quest", "past-showcase-combat", "sea-showcase", "deep-showcase"] as const) {
      expect(hasFixture(name), name).toBe(true);
      expect(fixture(name).seatCount, name).toBe(2);
    }
  });

  it("the tables park on the first player's planning window from round 3 on, full", () => {
    const least = { "past-showcase-board": { play: 8, attached: 4, engaged: 1, staging: 2, location: true }, "sea-showcase": { play: 8, staging: 2 }, "deep-showcase": { play: 8, engaged: 2, staging: 2 } } as const;
    for (const [name, board] of Object.entries(least) as [FixtureName, (typeof least)[keyof typeof least]][]) {
      const { state } = opened(name);
      expect(state.lost, name).toBe(false);
      expect(state.round, name).toBeGreaterThanOrEqual(3);
      expect([state.mode, state.activeSeat], name).toEqual(["planning", 0]);
      expect(boardHolds(state, board), name).toBe(true);
    }
  });

  it("past-showcase-quest parks on a quest commit whose characters the flow commits", () => {
    const { state, ctx } = opened("past-showcase-quest");
    expect(state.mode).toBe("questCommit");
    const commit = TAPS["past-showcase-quest"]?.showcase?.commit ?? [];
    expect(commit.length).toBeGreaterThan(0);
    const legal = legalTargets(state, { type: "Commit" }, ctx);
    for (const id of commit) expect(legal, id).toContain(id);
  });

  it("past-showcase-combat parks on an attack whose defender the flow declares", () => {
    const { state, ctx } = opened("past-showcase-combat");
    expect(state.window?.kind).toBe("defense");
    const defender = TAPS["past-showcase-combat"]?.showcase?.defender;
    expect(defender).toBeDefined();
    expect(legalTargets(state, { type: "DeclareDefender" }, ctx)).toContain(defender);
  });
});
