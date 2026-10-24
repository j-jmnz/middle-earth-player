import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { briefing } from "./briefing.ts";
import { fixture, fixtureSave, FIXTURE_NAMES } from "./fixtures.ts";
import { choiceSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import { contextOf, resume } from "./session.ts";
import { loadWorld } from "./world.ts";
import { emptyLog } from "./log.ts";
import { reduce } from "../rules/reduce.ts";

// The Maestro fixtures (src/campaign/fixtures/scenario-1.json) are real games of the two starter decks: a briefing would deal
// each loadout, and the reducer replays each to its moment. When this fails, run scripts/e2e-fixtures.ts again.
const campaign = loadCampaign();
const scenario = loadScenario("a-shadow-of-the-past");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

function worldFor(name: (typeof FIXTURE_NAMES)[number]) {
  const { loadout } = fixture(name);
  return loadWorld(catalog, campaign, scenario, EFFECTS, [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])]);
}

describe("Maestro fixtures", () => {
  it("are loadouts a briefing deals", () => {
    for (const name of FIXTURE_NAMES) {
      const { loadout, seatCount } = fixture(name);
      const plan = briefing({ world: worldFor(name), log: emptyLog(seatCount), seatCount, seats: loadout.seats, ringBearer: loadout.ringBearer, difficulty: loadout.difficulty, choices: loadout.choices, acceptPenalty: loadout.acceptPenalty });
      expect(plan.problems, name).toEqual([]);
    }
  });

  it("are stamped with this build's engine and catalog versions", () => {
    const save = fixtureSave("won", "s", CATALOG_VERSION);
    expect(save.active?.engineVersion).toBe(ENGINE_VERSION);
    expect(save.active?.dataHash).toBe(CATALOG_VERSION);
    expect(save.log.completed).toEqual([]);
  });

  it("won: replays to the first Resolution choice, a burden then a boon, one choice at a time", () => {
    const world = worldFor("won");
    const resumed = resume(fixtureSave("won", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    const burden = resolutionView(resumed.state, world);
    expect(burden.kind).toBe("choosing");
    if (burden.kind !== "choosing") return;
    expect(burden.eyebrow).toBe("Choose a burden");
    expect(burden.seatLabel).toBeNull();
    expect(burden.tiles.map((tile) => tile.code).sort()).toEqual(["141078", "141079"]);
    const tile = burden.tiles.find((item) => item.code === "141078");
    expect(tile && choiceSentence(burden, tile)).toBe("Gandalf's Delay is added to the campaign pool.");
    const next = reduce(resumed.state, { type: "ChooseResolution", optionId: "141078" }, contextOf(world));
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const boon = resolutionView(next.state, world);
    expect(boon.kind === "choosing" ? boon.eyebrow : boon.kind).toBe("Choose a boon");
    const last = reduce(next.state, { type: "ChooseResolution", optionId: boon.kind === "choosing" ? (boon.tiles[0]?.optionId ?? "") : "" }, contextOf(world));
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    const settled = resolutionView(last.state, world);
    expect(settled.kind).toBe("settled");
    if (settled.kind === "settled") expect(settledSentence(settled, world, "A Knife in the Dark")).toMatch(/^Confirming records Gandalf's Delay and .+ in the campaign and unlocks A Knife in the Dark\.$/);
  });

  it("lost: replays to a loss", () => {
    const world = worldFor("lost");
    const resumed = resume(fixtureSave("lost", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (resumed.ok) expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
  });
});
