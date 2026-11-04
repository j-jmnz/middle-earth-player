import { describe, expect, it } from "vitest";

import { loadCards } from "../data/load-cards.ts";
import { dealtCodes, loadCampaignsInOrder, loadScenario } from "../data/load-scenarios.ts";
import { boxPacks, undealtBoxCards } from "./box-dealt.ts";

// Every card with text in the packs a campaign's encounter cards come from, of a non-player type or a boon or burden,
// is dealt by some scenario (dealtCodes over all of them), or is named here with the reason the app does not deal it.
// Send for Help 11211-11214 were once missing: only the booklet paragraph dcce.campaign-setup-<id> named them.
const EXCEPTIONS: Readonly<Record<string, string>> = {
  "140077": "Stricken Dumb as printed in The Road Darkens (TRD 77), Flight to the Ford: the same card as 141064 (TBR 64), which Flight to the Ford deals; the app deals the Black Riders print.",
  "140151": "The Argonath as printed in The Road Darkens (TRD 151), Breaking of the Fellowship: the same card as 142075 (TRD 75), which Breaking of the Fellowship deals.",
  "142091": "The One Ring as printed in The Road Darkens (TRD 91): the app deals 141085 (TBR 85, TFotR 166), the same card, attached through the campaign card's setup.",
};

const cards = loadCards();
const campaigns = loadCampaignsInOrder();
const scenarios = [...new Set(campaigns.flatMap((campaign) => campaign.scenarios))].map((id) => loadScenario(id));
const dealt = dealtCodes(campaigns, scenarios);

function packsOf(scenarioIds: readonly string[]): Set<string> {
  return boxPacks(cards, loadScenarios(scenarioIds).flatMap((scenario) => scenario.cards.map((card) => card.code)));
}
function loadScenarios(ids: readonly string[]) {
  return ids.map((id) => loadScenario(id));
}

describe("box-wide dealt check", () => {
  it("reports the Send for Help cards for the dealt codes before 8162bee", () => {
    const before = new Set(dealt);
    for (const code of ["11211", "11212", "11213", "11214"]) before.delete(code);
    const dreamChaser = campaigns.find((campaign) => campaign.id === "dream-chaser");
    expect(dreamChaser).toBeDefined();
    expect(undealtBoxCards(cards, packsOf(dreamChaser?.scenarios ?? []), before)).toEqual(["11211", "11212", "11213", "11214"]);
  });

  for (const campaign of campaigns) {
    it(`${campaign.id}: every card of its packs is dealt or excepted`, () => {
      const missing = undealtBoxCards(cards, packsOf(campaign.scenarios), dealt);
      if (campaign.id === "dream-chaser") expect(missing).toEqual([]);
      expect(missing.filter((code) => EXCEPTIONS[code] === undefined)).toEqual([]);
    });
  }

  it("every exception is a real undealt card and has a reason", () => {
    const all = new Set(campaigns.flatMap((campaign) => undealtBoxCards(cards, packsOf(campaign.scenarios), dealt)));
    for (const [code, reason] of Object.entries(EXCEPTIONS)) {
      expect(reason.length, code).toBeGreaterThan(20);
      expect(all.has(code), `${code} is dealt now; remove its exception`).toBe(true);
    }
  });
});
