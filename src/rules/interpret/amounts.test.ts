import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";

import { readsAmount } from "./amounts.ts";

describe("readsAmount", () => {
  it("finds an amount that reads the damage dealt at any depth, and nothing else", () => {
    const direct: Instruction[] = [{ verb: "RaiseThreat", amount: { dealt: true }, who: "actor" }];
    const nested = [{ verb: "AfterAttack", instructions: direct }] as unknown as Instruction[];
    const none: Instruction[] = [{ verb: "RaiseThreat", amount: 2, who: "actor" }];
    expect(readsAmount(direct, "dealt")).toBe(true);
    expect(readsAmount(nested, "dealt")).toBe(true);
    expect(readsAmount(none, "dealt")).toBe(false);
    expect(readsAmount([], "dealt")).toBe(false);
  });
});
