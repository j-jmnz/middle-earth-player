// Rules: rr.campaign-mode, mec109.campaign-mode, tdom.campaign-mode (data/rules/entries.json).
import type { CampaignData, CampaignIndexEntry } from "../../../src/catalog/scenario-data.ts";
import { PLAYABLE_SCENARIOS } from "../../../src/campaign/playable.ts";

import { CAMPAIGNS } from "../campaign-defs.ts";
import type { Overrides } from "./cards.ts";
import type { RawData } from "./load-raw.ts";

// data/campaigns/index.json. A built campaign lists the scenario count Hall of Beorn gives its products and is playable when
// at least one of its scenarios is (src/campaign/playable.ts); otherwise its tile stays locked. Each override campaign is
// locked, counted from the scenarios Hall of Beorn lists under its products.
export function buildCampaignIndex(
  raw: Pick<RawData, "scenarioIndex">,
  overrides: Pick<Overrides, "campaigns">,
  built: CampaignData | readonly CampaignData[],
  playable: readonly string[] = PLAYABLE_SCENARIOS,
): CampaignIndexEntry[] {
  const count = (products: ReadonlySet<string>): number => raw.scenarioIndex.filter((entry) => products.has(entry.Product)).length;
  const list = Array.isArray(built) ? (built as readonly CampaignData[]) : [built as CampaignData];
  const index: CampaignIndexEntry[] = [];
  for (const campaign of list) {
    const def = CAMPAIGNS.find((item) => item.id === campaign.id);
    if (!def) throw new Error(`campaign index: ${campaign.id} has no definition in scripts/data/campaign-defs.ts`);
    // Every scenario Hall of Beorn lists under the campaign's products is built, and no other.
    const listed = count(new Set(def.products));
    if (listed !== campaign.scenarios.length) throw new Error(`campaign index: ${campaign.id} builds ${campaign.scenarios.length} scenarios, Hall of Beorn lists ${listed}`);
    index.push({ id: campaign.id, name: campaign.name, scenarioCount: campaign.scenarios.length, playable: campaign.scenarios.some((id) => playable.includes(id)) });
  }
  for (const campaign of overrides.campaigns) {
    const scenarioCount = count(new Set(campaign.products));
    if (scenarioCount === 0) throw new Error(`campaign index: ${campaign.id} names products Hall of Beorn lists no scenario for`);
    index.push({ id: campaign.id, name: campaign.name, scenarioCount, playable: false });
  }
  return index;
}
