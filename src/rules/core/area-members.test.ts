// Rules: dcce.stormcallers-area-stages, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { memberPlace, membersStanding, sameMembers, syncMembers } from "./area-members.ts";
import type { CardInstance, ScenarioState } from "./state.ts";

const at = (zone: CardInstance["zone"]): CardInstance => ({ id: "x", code: "x", zone, controller: null, damage: 0, progress: 0, face: "up", exhausted: false } as unknown as CardInstance);
const game = (zones: Record<string, CardInstance["zone"]>) => ({ cards: Object.fromEntries(Object.entries(zones).map(([id, zone]) => [id, { ...at(zone), id }])) }) as unknown as ScenarioState;

describe("the cards of a quest area", () => {
  const state = game({ a: "orcsArea", b: "staging", c: "engaged" as CardInstance["zone"], d: "discard" });
  it("membersStanding keeps the members in the area zone or the staging area", () => {
    expect(membersStanding(state, ["a", "b", "c", "d", "gone"], "orcsArea")).toEqual(["a", "b"]);
  });
  it("memberPlace says apart, together or null", () => {
    expect(memberPlace(state, ["a", "b", "c"], "orcsArea", "a")).toBe("apart");
    expect(memberPlace(state, ["a", "b", "c"], "orcsArea", "b")).toBe("together");
    expect(memberPlace(state, ["a", "b", "c"], "orcsArea", "c")).toBeNull();
    expect(memberPlace(state, ["a"], "orcsArea", "b")).toBeNull();
  });
  it("syncMembers keeps the members that stand in the area, and leaves a state alone when nothing moves", () => {
    const apart = syncMembers(game({ a: "orcsArea", c: "engaged" as CardInstance["zone"] }), ["a", "c"], "orcsArea", false);
    expect(apart.kept).toEqual(["a"]);
    expect(sameMembers(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameMembers(["a"], ["a", "b"])).toBe(false);
  });
});
