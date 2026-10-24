import { describe, expect, it } from "vitest";

import { activeCardCodes, hasUniqueText, textInactive } from "./active-text.ts";

describe("activeCardCodes", () => {
  it("reads cardCode from effect records", () => {
    expect(activeCardCodes([{ cardCode: "01073" }, { cardCode: "141001" }, { cardCode: "141001" }])).toEqual(new Set(["01073", "141001"]));
  });

  it("treats no records as no active text", () => {
    expect(activeCardCodes([])).toEqual(new Set());
    expect(activeCardCodes([{ cardCode: "" }])).toEqual(new Set());
  });
});

describe("textInactive", () => {
  it("is true only for unique text beyond implemented keywords on a card with no record", () => {
    const active = new Set(["141002"]);
    expect(textInactive("01029", "Sentinel.\n<b>Response:</b> After Gondorian Spearman is declared as a defender, deal 1 damage to the attacking enemy.", active)).toBe(true);
    expect(textInactive("01017", "Ranged.", active)).toBe(false);
    expect(textInactive("01013", "", active)).toBe(false);
    expect(textInactive("141002", "<b>Response:</b> After you engage an enemy...", active)).toBe(false);
    expect(hasUniqueText("Doomed 2. Hide 3.")).toBe(false);
  });
});
