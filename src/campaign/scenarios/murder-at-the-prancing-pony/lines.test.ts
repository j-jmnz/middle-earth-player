// Rules: rr.cannot, rr.immune (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (Murder at the Prancing Pony). Lines a spec row cannot express.
import { describe, expect, it } from "vitest";

import { heldAmount } from "../../../rules/core/state.ts";
import { tableFromLayout } from "../../../../test/harness/layout.ts";

describe("murder-at-the-prancing-pony lines", () => {
  it("50716:A:2 each seat holds the cap of 1 on a threat reduction by a player card while Ramshackle Manor is in play", () => {
    const { state } = tableFromLayout("murder-at-the-prancing-pony", { staging: ["50716"], seats: 2 });
    expect(heldAmount(state, "seat:0", "threatReductionToOne")).toBe(1);
    expect(heldAmount(state, "seat:1", "threatReductionToOne")).toBe(1);
    const without = tableFromLayout("murder-at-the-prancing-pony", { seats: 2 }).state;
    expect(heldAmount(without, "seat:0", "threatReductionToOne")).toBe(0);
  });
});
