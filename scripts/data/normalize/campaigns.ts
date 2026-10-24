// Rules: rr.campaign-mode, mec109.campaign-mode (data/rules/entries.json).
import type { CampaignData, CampaignIndexEntry } from "../../../src/catalog/scenario-data.ts";

import type { Overrides } from "./cards.ts";
import type { RawData } from "./load-raw.ts";

// The Hall of Beorn products the Fellowship campaign is built from. Their scenarios are the six in data/scenarios.
const FELLOWSHIP_PRODUCTS = new Set(["The Black Riders", "The Road Darkens"]);

// data/campaigns/index.json. The built campaign is playable; each override campaign is locked, counted from the scenarios
// Hall of Beorn lists under its products. The count of the built campaign is checked against the same listing.
export function buildCampaignIndex(raw: Pick<RawData, "scenarioIndex">, overrides: Pick<Overrides, "campaigns">, built: CampaignData): CampaignIndexEntry[] {
  const count = (products: ReadonlySet<string>): number => raw.scenarioIndex.filter((entry) => products.has(entry.Product)).length;
  const listed = count(FELLOWSHIP_PRODUCTS);
  if (listed !== built.scenarios.length) throw new Error(`campaign index: ${built.id} builds ${built.scenarios.length} scenarios, Hall of Beorn lists ${listed}`);
  const index: CampaignIndexEntry[] = [{ id: built.id, name: built.name, scenarioCount: built.scenarios.length, playable: true }];
  for (const campaign of overrides.campaigns) {
    const scenarioCount = count(new Set(campaign.products));
    if (scenarioCount === 0) throw new Error(`campaign index: ${campaign.id} names products Hall of Beorn lists no scenario for`);
    index.push({ id: campaign.id, name: campaign.name, scenarioCount, playable: false });
  }
  return index;
}
