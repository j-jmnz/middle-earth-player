// Rules: rr.active-location, rr.engaged, rr.forced (data/rules/entries.json); ledger line 900702:A:2.
// The returnsWithoutActive flag on a table of The Hills of Emyn Muil: an engaged enemy that holds it goes back to the staging area at once while no location is active, from any player's play area, and stays while one is.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { first, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const settled = (layout: Layout) => {
  const made = tableFromLayout("the-hills-of-emyn-muil", layout);
  return settle(syncConstants(made.state, made.ctx), made.ctx, []);
};

describe("returnsWithoutActive (900702:A:2)", () => {
  it("900702:A:2 returns the enemy to the staging area while no location is active, whichever player it is engaged with, and leaves other enemies engaged", () => {
    const state = settled({ seats: 2, engaged: [{ code: "900702", seat: 1 }, { code: "f0", seat: 1 }] });
    expect(state.cards[first(state, "900702")]).toMatchObject({ zone: "staging", controller: null });
    expect(state.seats[1]?.engaged).toEqual([first(state, "f0")]);
  });

  it("900702:A:2 keeps the enemy engaged while a location is active", () => {
    expect(settled({ active: "place", engaged: ["900702"] }).cards[first(settled({ active: "place", engaged: ["900702"] }), "900702")]?.zone).toBe("engaged");
  });

  it("900702:A:2 leaves an enemy in the staging area where it is", () => {
    const state = settled({ staging: ["900702"] });
    expect(state.cards[first(state, "900702")]?.zone).toBe("staging");
  });
});
