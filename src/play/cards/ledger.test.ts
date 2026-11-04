import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { ledgerLine, ruleTitle } from "./ledger.ts";

describe("ledger lookups", () => {
  it("names the printed line of every scenario 1 effect record and a rule title", () => {
    const record = EFFECTS.find((effect) => effect.cardCode === "141039");
    expect(record).toBeDefined();
    expect(ledgerLine(record?.lines[0] ?? "")).toBeTruthy();
    expect(ruleTitle("rr.step-6-4-3")).toBeTruthy();
    expect(ledgerLine("nothing:A:1")).toBeNull();
    expect(ruleTitle("no such rule")).toBeNull();
  });
});
