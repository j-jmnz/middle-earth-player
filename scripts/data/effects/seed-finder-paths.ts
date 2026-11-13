import { loadCampaignsInOrder } from "../load-scenarios.ts";

// Where a scenario's seed finder lives (scripts/e2e/). A campaign that has a folder here keeps its scenarios' finders in it (scripts/checks/layout.test.ts holds the file
// count of scripts/e2e); every other finder is top-level, named for its scenario. The one source for pnpm scenario new, the fixture writers and anything else that locates a finder.
export const E2E_CAMPAIGN_FOLDERS: Readonly<Record<string, string>> = {
  "angmar-awakened": "angmar-awakened",
};

/** The path under scripts/e2e/, without the extension, of the seed finder of scenario `id` in `campaignId`. */
export function seedFinderRel(id: string, campaignId: string | null): string {
  const folder = campaignId == null ? undefined : E2E_CAMPAIGN_FOLDERS[campaignId];
  return folder ? `${folder}/${id}` : id;
}

/** The same for a scenario id alone: the campaign that lists it decides the folder. */
export function seedFinderRelOfScenario(id: string): string {
  const campaign = loadCampaignsInOrder().find((one) => one.scenarios.includes(id));
  return seedFinderRel(id, campaign?.id ?? null);
}

/** The import specifier from one finder to another (both under scripts/e2e/), as "./name.ts" or "../name.ts". */
export function finderImport(fromRel: string, toRel: string): string {
  const fromDir = fromRel.split("/").slice(0, -1);
  const toParts = toRel.split("/");
  let shared = 0;
  while (shared < fromDir.length && shared < toParts.length - 1 && fromDir[shared] === toParts[shared]) shared += 1;
  const up = fromDir.length - shared;
  const rest = toParts.slice(shared).join("/");
  return `${up === 0 ? "./" : "../".repeat(up)}${rest}.ts`;
}
