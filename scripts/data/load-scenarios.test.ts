import { describe, expect, it } from "vitest";

import { dealtCodes, loadCampaign, loadScenario } from "./load-scenarios.ts";

// A card with two sides that are two catalog cards (`back`) puts the other side in play on a flip, so the effect coverage must see both (dcce.grotto-deck; ledger lines 12095:A:1, 12101:A:1, 12102:A:1, 12103:A:1).
describe("dealtCodes", () => {
  it("includes the other side of each double-sided card", () => {
    const ruins = loadScenario("the-drowned-ruins");
    const dealt = dealtCodes(loadCampaign("dream-chaser"), [ruins]);
    const backs = ruins.cards.flatMap((card) => (card.back != null ? [card.back] : []));
    expect(backs).toEqual(expect.arrayContaining(["12095", "12101", "12102", "12103"]));
    for (const back of backs) expect(dealt.has(back)).toBe(true);
  });
});
