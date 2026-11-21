// Rules: rr.travel, rr.the-word-choose (data/rules/entries.json); ledger line 00010:A:1.
// TravelOrRaiseThreat on a table of The Massing at Osgiliath: once the players have crossed the Anduin, with Pelennor Fields in the staging area and no active location, declining to travel or traveling to another location raises each
// player's threat by 3; traveling to a location named Pelennor Fields does not, and two copies are charged once.
import { describe, expect, it } from "vitest";

import { idsOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { travelTax } from "./streets.ts";

const PELENNOR = "00010";
const WATCHTOWER = "00007";

const tax = (layout: Layout, toward: string | null) => {
  const made = tableFromLayout("the-massing-at-osgiliath", { seats: 2, phase: "Travel", staging: [PELENNOR, WATCHTOWER], ...layout });
  const id = toward == null ? null : idsOf(made.state, toward)[0] ?? null;
  return travelTax(made.state, made.ctx, id);
};

describe("TravelOrRaiseThreat (00010:A:1)", () => {
  it("00010:A:1 declining, or traveling to another location, raises each player's threat by 3 once the players have crossed", () => {
    for (const toward of [null, WATCHTOWER]) {
      const charge = tax({ stage: "00019" }, toward);
      expect(charge?.instructions).toEqual([{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }]);
    }
  });

  it("00010:A:1 traveling to Pelennor Fields costs nothing, and two copies are satisfied by either", () => {
    expect(tax({ stage: "00019" }, PELENNOR)).toBeNull();
    expect(tax({ stage: "00019", staging: [PELENNOR, PELENNOR, WATCHTOWER] }, PELENNOR)).toBeNull();
    expect(tax({ stage: "00019", staging: [PELENNOR, PELENNOR, WATCHTOWER] }, WATCHTOWER)?.instructions).toHaveLength(1);
  });

  it("00010:A:1 asks nothing before the players have crossed or while a location is active", () => {
    expect(tax({ stage: "00018" }, null)).toBeNull();
    expect(tax({ stage: "00019", active: WATCHTOWER }, null)).toBeNull();
  });
});
