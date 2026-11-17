// Rules: rr.explored, rr.effects (data/rules/entries.json); ledger line 02093:A:1.
// RemoveProgressEach on a table of The Hills of Emyn Muil: up to the amount of progress comes off each location in play, the staging area and the active location alike, and the effect's X is the number of tokens taken off in all.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { first, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

describe("RemoveProgressEach (02093:A:1)", () => {
  const run = (progress: Readonly<Record<string, number>>) => {
    const made = tableFromLayout("the-hills-of-emyn-muil", { active: "02085", staging: [{ code: "place", progress: progress.place ?? 0 }, "02086"], stage: "02082", progress: 2 });
    const state = Object.entries(progress).reduce((current, [code, amount]) => (code === "place" ? current : { ...current, cards: { ...current.cards, [first(current, code)]: { ...current.cards[first(current, code)]!, progress: amount } } }), made.state);
    return { made, state: runInstruction(state, { verb: "RemoveProgressEach", amount: 1, pick: { type: "location", control: "any" } }, { seat: 0, sourceId: null }, made.ctx, []) };
  };

  it("02093:A:1 takes 1 progress from each location in the staging area and the active location, and none from the quest card", () => {
    const { state } = run({ place: 2, "02085": 3, "02086": 0 });
    expect(["place", "02085", "02086"].map((code) => state.cards[first(state, code)]?.progress)).toEqual([1, 2, 0]);
    expect(state.cards[first(state, "02082")]?.progress).toBe(2);
  });
});
