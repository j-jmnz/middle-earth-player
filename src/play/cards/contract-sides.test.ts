// A two-sided contract's sides in its preview (contract-sides.ts).
import { describe, expect, it } from "vitest";

import { contractSides } from "./contract-sides.ts";

const BURGLAR = "<b>Side A</b>\r\nYou cannot include attachments in your deck. \r\n<b>Setup:</b> Choose 14 attachments.\r\n\r\n<b>Side B</b>\r\nThe active location gets +1 quest point.";

describe("contract sides", () => {
  it("splits a two-sided contract's text at its side headings", () => {
    expect(contractSides("contract", BURGLAR)).toEqual({ A: "You cannot include attachments in your deck. \r\n<b>Setup:</b> Choose 14 attachments.", B: "The active location gets +1 quest point." });
  });

  it("leaves a one-sided contract and any other card whole", () => {
    expect(contractSides("contract", "You cannot include more than 1 copy of a card, by title, in your deck.")).toBeNull();
    expect(contractSides("hero", BURGLAR)).toBeNull();
    expect(contractSides("contract", null)).toBeNull();
  });
});
