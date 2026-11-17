// Rules: rr.engaged, rr.first-player, rr.forced (data/rules/entries.json); ledger line 900702:A:1.
// EngageFirstPlayer with `moves` on a table of The Hills of Emyn Muil: an enemy in the staging area, or engaged with another player, engages the first player; a player already engaged with it, or 
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { first, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const engages = (layout: Layout, moves = true) => {
  const made = tableFromLayout("the-hills-of-emyn-muil", { active: "place", ...layout });
  const state = runInstruction(made.state, { verb: "EngageFirstPlayer", ...(moves ? { moves: true as const } : {}) }, { seat: 0, sourceId: first(made.state, "900702") }, made.ctx, []);
  return state.cards[first(state, "900702")];
};

describe("EngageFirstPlayer moves (900702:A:1)", () => {
  it("900702:A:1 engages the first player from the staging area, and moves from another player's play area", () => {
    expect(engages({ staging: ["900702"] })).toMatchObject({ zone: "engaged", controller: 0 });
    expect(engages({ seats: 2, engaged: [{ code: "900702", seat: 1 }] })).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("900702:A:1 leaves an enemy engaged with another player where it is without `moves`", () => {
    expect(engages({ seats: 2, engaged: [{ code: "900702", seat: 1 }] }, false)).toMatchObject({ zone: "engaged", controller: 1 });
  });
});
