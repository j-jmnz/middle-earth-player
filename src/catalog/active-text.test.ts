import { describe, expect, it } from "vitest";

import { activeCardCodes } from "./active-text.ts";

describe("activeCardCodes", () => {
  it("reads cardCode from effect records", () => {
    expect(activeCardCodes([{ cardCode: "01073" }, { cardCode: "141001" }, { cardCode: "141001" }])).toEqual(new Set(["01073", "141001"]));
  });

  it("treats no records as no active text", () => {
    expect(activeCardCodes([])).toEqual(new Set());
    expect(activeCardCodes([{ cardCode: "" }])).toEqual(new Set());
  });
});
