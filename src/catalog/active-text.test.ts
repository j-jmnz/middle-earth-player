import { describe, expect, it } from "vitest";

import { activeCardCodes, cardCodeFromEffectRecord } from "./active-text.ts";

describe("activeCardCodes", () => {
  it("reads cardCode from an effect record", () => {
    const record = JSON.stringify({
      cardCode: "01073",
      timing: "action",
      instructions: [{ verb: "Draw" }],
    });
    expect(cardCodeFromEffectRecord(record)).toBe("01073");
    expect(activeCardCodes([record, JSON.stringify({ cardCode: "141001", timing: "forced", instructions: [] })])).toEqual(
      new Set(["01073", "141001"]),
    );
  });

  it("treats an empty effects table as no active text", () => {
    expect(activeCardCodes([])).toEqual(new Set());
    expect(cardCodeFromEffectRecord("not json")).toBeNull();
    expect(cardCodeFromEffectRecord(JSON.stringify({ timing: "action" }))).toBeNull();
    expect(activeCardCodes(["", "{}"])).toEqual(new Set());
  });
});
