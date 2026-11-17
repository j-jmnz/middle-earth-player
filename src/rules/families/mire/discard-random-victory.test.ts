// Rules: rr.victory, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 900709:A:1.
// DiscardRandomVictoryLocation on a table of The Hills of Emyn Muil: one location of the victory display with the Trait, chosen with the game's seed, goes to the encounter discard pile.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { first, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

describe("DiscardRandomVictoryLocation (900709:A:1)", () => {
  const discard = (seed: number) => {
    const made = tableFromLayout("the-hills-of-emyn-muil", { seed, victory: ["02083", "02084", "02085", "place"] });
    const state = runInstruction(made.state, { verb: "DiscardRandomVictoryLocation", trait: "Emyn Muil" }, { seat: 0, sourceId: null }, made.ctx, []);
    return { state, discarded: state.encounterDiscard.map((id) => state.cards[id]?.code) };
  };

  it("900709:A:1 discards one Emyn Muil location, never another card of the display, and the same game's seed picks the same one", () => {
    const { state, discarded } = discard(1);
    expect(discarded).toHaveLength(1);
    expect(["02083", "02084", "02085"]).toContain(discarded[0]);
    expect(state.victory).toContain(first(state, "place"));
    expect(state.victory).toHaveLength(3);
    expect(discard(1).discarded).toEqual(discarded);
  });

  it("900709:A:1 can pick any of the Emyn Muil locations as the seed changes", () => {
    const seen = new Set(Array.from({ length: 12 }, (_, seed) => discard(seed + 1).discarded[0]));
    expect(seen.size).toBeGreaterThan(1);
  });
});
