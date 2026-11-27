import { describe, expect, it } from "vitest";

import { loadCards } from "../data/load-cards.ts";
import { dealtCodes, loadCampaignsInOrder, loadAnyScenario } from "../data/load-scenarios.ts";
import { boxPacks, undealtBoxCards } from "./box-dealt.ts";

// Every card with text in the packs a campaign's encounter cards come from, of a non-player type or a boon or burden,
// is dealt by some scenario (dealtCodes over all of them), or is named here with the reason the app does not deal it.
const EXCEPTIONS: Readonly<Record<string, string>> = {
  "140077": "Stricken Dumb as printed in The Road Darkens (TRD 77), Flight to the Ford: the same card as 141064 (TBR 64), which Flight to the Ford deals; the app deals the Black Riders print.",
  "140151": "The Argonath as printed in The Road Darkens (TRD 151), Breaking of the Fellowship: the same card as 142075 (TRD 75), which Breaking of the Fellowship deals.",
  "146064": "In Darkness Bind Them (epic multiplayer mode only): the Epic Multiplayer Mode campaign card's Setup shuffles one copy into each encounter deck (mec113.epic-multiplayer-mode); epic multiplayer mode is not built.",
  "146080": "Epic Multiplayer Mode, the double-sided setup card of the last two scenarios played together (mec113.epic-multiplayer-mode); epic multiplayer mode is not built.",
  "146081": "The Eye of Sauron (The Black Gate Opens side), an epic multiplayer mode objective that the Epic Multiplayer Mode card's Setup places (mec113.epic-multiplayer-mode); epic multiplayer mode is not built.",
  "146082": "The Eye of Sauron (Mount Doom side), an epic multiplayer mode objective that the Epic Multiplayer Mode card's Setup places (mec113.epic-multiplayer-mode); epic multiplayer mode is not built.",
  "147023": "The Old Forest's campaign card (The Lord of the Rings Part 1.1): Campaign Mode only; the Standalone scenarios cycle has no campaign log, so the standalone game deals no campaign card (docs/scenarios/standalone-scenarios/the-old-forest.md, The Old Forest).",
  "147024": "Old Bogey-stories, the boon the Old Forest campaign card attaches and its Resolution earns: Campaign Mode only, never dealt by the standalone game (docs/scenarios/standalone-scenarios/the-old-forest.md, The Old Forest).",
  "148020": "Fog on the Barrow-downs's campaign card (The Lord of the Rings Part 1.2): Campaign Mode only; the Standalone scenarios cycle has no campaign log, so the standalone game deals no campaign card (docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md, Fog on the Barrow-downs).",
  "148021": "Ho! Tom Bombadil!, the boon the Fog campaign card's Resolution earns: a player card of Campaign Mode, never dealt by the standalone game (docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md, Fog on the Barrow-downs).",
  "40003": "Hard Mode, the mode card of the hard difficulty of The Hunt for the Dreadnaught: the app deals the Standard Mode card (40002) on Normal and the Easy Mode card (40001) on Easy; no difficulty setting of the app picks another mode card (docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md, The Hunt for the Dreadnaught).",
  "50802": "Epic Multiplayer Mode, the mode card of The Siege of Annúminas' 3-team mode; epic multiplayer mode is not built (docs/scenarios/standalone-scenarios/the-siege-of-annuminas.md, The Siege of Annúminas).",
  "50806": "Raise the Levee (stage 1C/1D), a quest card of The Siege of Annúminas' epic multiplayer mode only; the Standard Game Mode's Setup removes the 1C-3C deck from the game, and epic multiplayer mode is not built.",
  "50807": "Guard the Gate (stage 2C/2D), a quest card of The Siege of Annúminas' epic multiplayer mode only; epic multiplayer mode is not built.",
  "50808": "Rescue the Captives (stage 3C/3D), a quest card of The Siege of Annúminas' epic multiplayer mode only; epic multiplayer mode is not built.",
  "50809": "Delay the Enemy (stage 1E/1F), a quest card of The Siege of Annúminas' epic multiplayer mode only; the Standard Game Mode's Setup removes the 1E-3E deck from the game, and epic multiplayer mode is not built.",
  "50810": "Man the Walls (stage 2E/2F), a quest card of The Siege of Annúminas' epic multiplayer mode only; epic multiplayer mode is not built.",
  "50811": "Stop the Attack (stage 3E/3F), a quest card of The Siege of Annúminas' epic multiplayer mode only; epic multiplayer mode is not built.",
  "50932": "Epic Multiplayer Mode, the mode card of Attack on Dol Guldur's 3-team mode; epic multiplayer mode is not built (docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur).",
  "21071": "Stinker, the treachery the hero Sméagol (21072) shuffles into the encounter deck at Setup (vom.smeagol-gollum): no scenario lists it; the player card of Sméagol deals it.",
  "21073": "Gollum, the enemy side of the Sméagol / Gollum card (21072; vom.smeagol-gollum): no scenario lists it; Stinker flips Sméagol to it.",
  "142091": "The One Ring as printed in The Road Darkens (TRD 91): the app deals 141085 (TBR 85, TFotR 166), the same card, attached through the campaign card's setup.",
};

const cards = loadCards();
const campaigns = loadCampaignsInOrder();
const scenarios = [...new Set(campaigns.flatMap((campaign) => campaign.scenarios))].map((id) => loadAnyScenario(id));
const dealt = dealtCodes(campaigns, scenarios);

function packsOf(scenarioIds: readonly string[]): Set<string> {
  return boxPacks(cards, loadScenarios(scenarioIds).flatMap((scenario) => scenario.cards.map((card) => card.code)));
}
function loadScenarios(ids: readonly string[]) {
  return ids.map((id) => loadAnyScenario(id));
}

describe("box-wide dealt check", () => {
  it("reports Send for Help (11211-11214), which only the booklet paragraph dcce.campaign-setup-<id> sets aside, when no scenario deals it", () => {
    const before = new Set(dealt);
    for (const code of ["11211", "11212", "11213", "11214"]) before.delete(code);
    const dreamChaser = campaigns.find((campaign) => campaign.id === "dream-chaser");
    expect(dreamChaser).toBeDefined();
    expect(undealtBoxCards(cards, packsOf(dreamChaser?.scenarios ?? []), before)).toEqual(["11211", "11212", "11213", "11214"]);
  });

  for (const campaign of campaigns) {
    it(`${campaign.id}: every card of its packs is dealt or excepted`, () => {
      const missing = undealtBoxCards(cards, packsOf(campaign.scenarios), dealt);
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
