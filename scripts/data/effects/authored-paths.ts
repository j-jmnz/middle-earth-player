import { loadCampaignsInOrder } from "../load-scenarios.ts";

// Where a scenario's authored effect file lives (src/effects/authored/). A campaign that has a folder here keeps its box's file and its scenarios' files in it (a
// box whose scenarios would crowd the top level: scripts/checks/layout.test.ts holds the count); every other file is top-level, named for its scenario or campaign.
export const AUTHORED_CAMPAIGN_FOLDERS: Readonly<Record<string, string>> = {
  "the-return-of-the-king": "return-of-the-king",
  "angmar-awakened": "angmar-awakened",
  "shadows-of-mirkwood": "shadows-of-mirkwood",
  "standalone-scenarios": "standalone-scenarios",
};

/** The path under src/effects/authored/, without the extension, of the file named `id` for a scenario (or the campaign card file) of `campaignId`. */
export function authoredRel(id: string, campaignId: string | null): string {
  const folder = campaignId == null ? undefined : AUTHORED_CAMPAIGN_FOLDERS[campaignId];
  return folder ? `${folder}/${id}` : id;
}

/** The same for a scenario id alone: the campaign that lists it decides the folder. */
export function authoredRelOfScenario(id: string): string {
  const campaign = loadCampaignsInOrder().find((one) => one.scenarios.includes(id));
  return authoredRel(id, campaign?.id ?? null);
}
